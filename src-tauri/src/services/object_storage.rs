use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE},
    Client, Method, StatusCode, Url,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::notes::{AppError, NoteStore, ObjectStorageConfig};

type HmacSha256 = Hmac<Sha256>;

const SERVICE_NAME: &str = "s3";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ObjectUpload {
    pub file_name: String,
    pub object_key: String,
    pub url: String,
    pub mime_group: String,
    pub size: u64,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ObjectStorageService {
    store: NoteStore,
    client: Client,
}

impl ObjectStorageService {
    pub fn new(store: NoteStore) -> Self {
        Self {
            store,
            client: Client::new(),
        }
    }

    pub async fn upload_note_object(
        &self,
        note_id: &str,
        file_name: &str,
        content_type: &str,
        data: Vec<u8>,
    ) -> Result<ObjectUpload, AppError> {
        self.store.ensure_storage()?;
        self.store.read_note(note_id)?;
        if data.is_empty() {
            return Err(AppError::new(
                "objectStorageUploadEmpty",
                "object upload data is empty",
            ));
        }

        let config = self.store.load_config()?.object_storage;
        let target = ObjectTarget::from_config(&config, note_id, file_name)?;
        let date = Utc::now();
        let size = data.len() as u64;
        let payload_hash = sha256_hex(&data);
        let content_type = normalize_content_type(content_type);
        let headers = signed_headers(
            &config,
            &target.put_url,
            &Method::PUT,
            &content_type,
            &payload_hash,
            date,
        )?;

        let response = self
            .client
            .put(target.put_url)
            .headers(headers)
            .body(data)
            .send()
            .await
            .map_err(map_object_storage_transport_error)?;
        ensure_object_storage_success(response.status())?;

        Ok(ObjectUpload {
            file_name: target.file_name,
            object_key: target.object_key,
            url: target.public_url,
            mime_group: mime_group(file_name, &content_type).to_string(),
            size,
            uploaded_at: date,
        })
    }
}

#[derive(Debug, Clone)]
struct ObjectTarget {
    file_name: String,
    object_key: String,
    put_url: Url,
    public_url: String,
}

impl ObjectTarget {
    fn from_config(
        config: &ObjectStorageConfig,
        note_id: &str,
        file_name: &str,
    ) -> Result<Self, AppError> {
        let normalized = normalize_config(config)?;
        let file_name = clean_file_name(file_name)?;
        let object_key = object_key_for(&normalized.object_prefix, note_id, &file_name);
        let put_url = object_url(&normalized.endpoint, &normalized.bucket, &object_key)?;
        let public_url = public_object_url(&normalized.public_base_url, &object_key)?;

        Ok(Self {
            file_name,
            object_key,
            put_url,
            public_url,
        })
    }
}

fn normalize_config(config: &ObjectStorageConfig) -> Result<ObjectStorageConfig, AppError> {
    let endpoint = config.endpoint.trim();
    let region = config.region.trim();
    let bucket = config.bucket.trim();
    let access_key_id = config.access_key_id.trim();
    let public_base_url = config.public_base_url.trim();
    if !config.enabled
        || endpoint.is_empty()
        || region.is_empty()
        || bucket.is_empty()
        || access_key_id.is_empty()
        || config.secret_access_key.is_empty()
        || public_base_url.is_empty()
    {
        return Err(AppError::new(
            "objectStorageConfigIncomplete",
            "object storage endpoint, credentials, bucket and public URL are required",
        ));
    }

    validate_http_url(endpoint)?;
    validate_http_url(public_base_url)?;
    if bucket.contains('/') || bucket.contains('\\') || bucket.contains("..") {
        return Err(AppError::new(
            "objectStorageConfigInvalid",
            "object storage bucket is invalid",
        ));
    }

    Ok(ObjectStorageConfig {
        enabled: true,
        endpoint: endpoint.trim_end_matches('/').to_string(),
        region: region.to_string(),
        bucket: bucket.to_string(),
        access_key_id: access_key_id.to_string(),
        secret_access_key: config.secret_access_key.clone(),
        public_base_url: public_base_url.trim_end_matches('/').to_string(),
        object_prefix: normalize_object_prefix(&config.object_prefix),
    })
}

fn validate_http_url(value: &str) -> Result<(), AppError> {
    let url = Url::parse(value)
        .map_err(|error| AppError::new("objectStorageConfigInvalid", error.to_string()))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(AppError::new(
            "objectStorageConfigInvalid",
            "object storage URL must start with http:// or https://",
        ));
    }
    Ok(())
}

fn object_url(endpoint: &str, bucket: &str, object_key: &str) -> Result<Url, AppError> {
    let mut url = Url::parse(endpoint)
        .map_err(|error| AppError::new("objectStorageConfigInvalid", error.to_string()))?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| AppError::new("objectStorageConfigInvalid", "invalid endpoint"))?;
        segments.pop_if_empty();
        segments.push(bucket);
        for segment in object_key.split('/') {
            segments.push(segment);
        }
    }
    Ok(url)
}

fn public_object_url(public_base_url: &str, object_key: &str) -> Result<String, AppError> {
    let mut url = Url::parse(public_base_url)
        .map_err(|error| AppError::new("objectStorageConfigInvalid", error.to_string()))?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| AppError::new("objectStorageConfigInvalid", "invalid public URL"))?;
        segments.pop_if_empty();
        for segment in object_key.split('/') {
            segments.push(segment);
        }
    }
    Ok(url.to_string())
}

fn signed_headers(
    config: &ObjectStorageConfig,
    url: &Url,
    method: &Method,
    content_type: &str,
    payload_hash: &str,
    date: DateTime<Utc>,
) -> Result<HeaderMap, AppError> {
    let date_stamp = date.format("%Y%m%d").to_string();
    let amz_date = date.format("%Y%m%dT%H%M%SZ").to_string();
    let credential_scope = format!("{date_stamp}/{}/{SERVICE_NAME}/aws4_request", config.region);
    let host = url
        .host_str()
        .ok_or_else(|| AppError::new("objectStorageConfigInvalid", "endpoint host is required"))?;
    let host_header = match url.port() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_string(),
    };
    let canonical_uri = canonical_uri(url);
    let canonical_request = format!(
        "{}\n{}\n\ncontent-type:{}\nhost:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n\ncontent-type;host;x-amz-content-sha256;x-amz-date\n{}",
        method.as_str(),
        canonical_uri,
        content_type,
        host_header,
        payload_hash,
        amz_date,
        payload_hash
    );
    let canonical_hash = sha256_hex(canonical_request.as_bytes());
    let string_to_sign =
        format!("AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{canonical_hash}");
    let signing_key = signing_key(&config.secret_access_key, &date_stamp, &config.region);
    let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));
    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature={}",
        config.access_key_id, credential_scope, signature
    );

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, header_value(content_type)?);
    headers.insert(
        HeaderName::from_static("x-amz-date"),
        header_value(&amz_date)?,
    );
    headers.insert(
        HeaderName::from_static("x-amz-content-sha256"),
        header_value(payload_hash)?,
    );
    headers.insert(
        HeaderName::from_static("authorization"),
        header_value(&authorization)?,
    );
    Ok(headers)
}

fn header_value(value: &str) -> Result<HeaderValue, AppError> {
    HeaderValue::from_str(value)
        .map_err(|error| AppError::new("objectStorageConfigInvalid", error.to_string()))
}

fn signing_key(secret: &str, date_stamp: &str, region: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, SERVICE_NAME.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn canonical_uri(url: &Url) -> String {
    if url.path().is_empty() {
        "/".to_string()
    } else {
        url.path().to_string()
    }
}

fn normalize_content_type(content_type: &str) -> String {
    let trimmed = content_type.trim();
    if trimmed.is_empty() {
        "application/octet-stream".to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_object_prefix(prefix: &str) -> String {
    prefix
        .replace('\\', "/")
        .split('/')
        .map(str::trim)
        .filter(|segment| {
            !segment.is_empty() && *segment != "." && *segment != ".." && !segment.contains(':')
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn object_key_for(prefix: &str, note_id: &str, file_name: &str) -> String {
    let id = Uuid::new_v4();
    let clean_note_id = clean_path_segment(note_id);
    let extension = file_name
        .rsplit_once('.')
        .map(|(_, extension)| clean_extension(extension))
        .filter(|extension| !extension.is_empty());
    let stored_name = match extension {
        Some(extension) => format!("{id}.{extension}"),
        None => id.to_string(),
    };
    [prefix, &clean_note_id, &stored_name]
        .into_iter()
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

fn clean_file_name(file_name: &str) -> Result<String, AppError> {
    let cleaned = file_name
        .replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or_default()
        .trim()
        .chars()
        .filter(|ch| !ch.is_control())
        .collect::<String>();
    if cleaned.is_empty() {
        return Err(AppError::new(
            "invalidAttachmentSource",
            "object upload file name is empty",
        ));
    }
    Ok(cleaned)
}

fn clean_path_segment(value: &str) -> String {
    let cleaned = value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        .take(96)
        .collect::<String>();
    if cleaned.is_empty() {
        "note".to_string()
    } else {
        cleaned
    }
}

fn clean_extension(extension: &str) -> String {
    extension
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .take(16)
        .collect()
}

fn mime_group(file_name: &str, content_type: &str) -> &'static str {
    if content_type
        .split(';')
        .next()
        .map(str::trim)
        .is_some_and(|value| {
            value.eq_ignore_ascii_case("image/svg+xml") || value.starts_with("image/")
        })
    {
        return "image";
    }

    file_name
        .rsplit_once('.')
        .map(|(_, extension)| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "apng" | "avif" | "bmp" | "gif" | "jpeg" | "jpg" | "png" | "webp"
            )
        })
        .unwrap_or(false)
        .then_some("image")
        .unwrap_or("file")
}

fn map_object_storage_transport_error(error: reqwest::Error) -> AppError {
    AppError::new("objectStorageNetwork", error.to_string())
}

fn ensure_object_storage_success(status: StatusCode) -> Result<(), AppError> {
    if status.is_success() {
        return Ok(());
    }

    Err(AppError::new(
        "objectStorageUploadFailed",
        format!("object storage upload failed with status {status}"),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> ObjectStorageConfig {
        ObjectStorageConfig {
            enabled: true,
            endpoint: "https://example.r2.cloudflarestorage.com".into(),
            region: "auto".into(),
            bucket: "floral".into(),
            access_key_id: "access".into(),
            secret_access_key: "secret".into(),
            public_base_url: "https://cdn.example.com/files".into(),
            object_prefix: "notes/assets".into(),
        }
    }

    #[test]
    fn rejects_incomplete_object_storage_config() {
        let error = normalize_config(&ObjectStorageConfig {
            enabled: true,
            endpoint: String::new(),
            ..config()
        })
        .expect_err("reject config");

        assert_eq!(error.code, "objectStorageConfigIncomplete");
    }

    #[test]
    fn builds_object_and_public_urls() {
        let target =
            ObjectTarget::from_config(&config(), "note-1", "photo.PNG").expect("build target");

        assert!(target.object_key.starts_with("notes/assets/note-1/"));
        assert!(target.object_key.ends_with(".png"));
        assert_eq!(target.file_name, "photo.PNG");
        assert!(target
            .put_url
            .as_str()
            .starts_with("https://example.r2.cloudflarestorage.com/floral/notes/assets/note-1/"));
        assert!(target
            .public_url
            .starts_with("https://cdn.example.com/files/notes/assets/note-1/"));
    }

    #[test]
    fn creates_sigv4_headers() {
        let normalized = normalize_config(&config()).expect("normalize");
        let url =
            Url::parse("https://example.r2.cloudflarestorage.com/floral/key.png").expect("url");
        let date = DateTime::parse_from_rfc3339("2026-06-02T08:00:00Z")
            .expect("date")
            .with_timezone(&Utc);

        let headers = signed_headers(
            &normalized,
            &url,
            &Method::PUT,
            "image/png",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            date,
        )
        .expect("headers");
        let authorization = headers
            .get("authorization")
            .expect("authorization")
            .to_str()
            .expect("authorization string");

        assert_eq!(headers.get("x-amz-date").expect("date"), "20260602T080000Z");
        assert_eq!(
            headers.get("x-amz-content-sha256").expect("payload hash"),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert!(authorization.contains("Credential=access/20260602/auto/s3/aws4_request"));
        assert!(authorization
            .contains("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date"));
        assert!(authorization.contains("Signature="));
    }

    #[test]
    fn detects_image_mime_group() {
        assert_eq!(
            mime_group("pasted.webp", "application/octet-stream"),
            "image"
        );
        assert_eq!(mime_group("pasted", "image/png"), "image");
        assert_eq!(mime_group("report.pdf", "application/pdf"), "file");
    }
}
