use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Utc;
use reqwest::{
    header::{CONTENT_TYPE, USER_AGENT},
    Client, Method, StatusCode, Url,
};
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Component, Path, PathBuf},
};

use super::notes::{
    AppConfig, AppError, MetadataFile, NoteStore, ObjectStorageConfig, WebdavConfig,
};

const SNAPSHOT_SCHEMA_VERSION: u32 = 1;
const SNAPSHOT_FILE_NAME: &str = "floral-notepaper-sync.json";
const USER_AGENT_VALUE: &str = "floral-notepaper-webdav-sync/1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub ok: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synced_at: Option<String>,
    pub remote_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncOverview {
    pub ok: bool,
    pub remote_exists: bool,
    pub in_sync: bool,
    pub local_changed: bool,
    pub remote_changed: bool,
    pub recommended_action: String,
    pub local_signature: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_signature: Option<String>,
    pub remote_path: String,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SyncSnapshot {
    schema_version: u32,
    generated_at: String,
    config: AppConfig,
    metadata: MetadataFile,
    notes: Vec<SnapshotFile>,
    backgrounds: Vec<SnapshotFile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    attachments: Option<Vec<SnapshotFile>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct SnapshotFile {
    path: String,
    content: String,
    encoding: SnapshotEncoding,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum SnapshotEncoding {
    Utf8,
    Base64,
}

#[derive(Debug, Clone)]
pub struct SyncService {
    store: NoteStore,
    client: Client,
}

impl SyncService {
    pub fn new(store: NoteStore) -> Self {
        Self {
            store,
            client: Client::new(),
        }
    }

    pub async fn test_connection(&self) -> Result<SyncStatus, AppError> {
        let config = self.store.load_config()?;
        let remote = RemoteTarget::from_config(&config.webdav)?;
        self.ensure_remote_collection(&remote).await?;
        Ok(remote.status("WebDAV connection is available"))
    }

    pub async fn check_status(&self) -> Result<SyncOverview, AppError> {
        let config = self.store.load_config()?;
        let remote = RemoteTarget::from_config(&config.webdav)?;
        let local_snapshot = self.build_snapshot()?;
        let local_signature = snapshot_signature(&local_snapshot)?;
        let remote_snapshot = self
            .fetch_remote_snapshot(&remote, "webdavStatusFailed")
            .await?;
        let remote_signature = remote_snapshot
            .as_ref()
            .map(snapshot_signature)
            .transpose()?;
        let remote_exists = remote_signature.is_some();
        let in_sync = remote_signature.as_deref() == Some(local_signature.as_str());
        let (local_changed, remote_changed) = sync_change_flags(
            &local_signature,
            remote_signature.as_deref(),
            config.webdav.last_sync_signature.as_deref(),
        );

        Ok(SyncOverview {
            ok: true,
            remote_exists,
            in_sync,
            local_changed,
            remote_changed,
            recommended_action: recommended_sync_action(
                remote_exists,
                in_sync,
                local_changed,
                remote_changed,
            )
            .to_string(),
            local_signature,
            remote_signature,
            remote_path: remote.display_path.clone(),
            checked_at: Utc::now().to_rfc3339(),
        })
    }

    pub async fn upload_snapshot(&self) -> Result<SyncStatus, AppError> {
        let config = self.store.load_config()?;
        let remote = RemoteTarget::from_config(&config.webdav)?;
        let snapshot = self.build_snapshot()?;
        let signature = snapshot_signature(&snapshot)?;
        let body = serde_json::to_vec_pretty(&snapshot)?;

        self.ensure_remote_collection(&remote).await?;
        let response = self
            .authorized_request(Method::PUT, remote.file_url.clone(), &remote.config)
            .header(CONTENT_TYPE, "application/json; charset=utf-8")
            .body(body)
            .send()
            .await
            .map_err(map_webdav_transport_error)?;
        ensure_webdav_success(response.status(), "webdavUploadFailed")?;
        self.save_sync_signature(signature)?;

        Ok(remote.status("Snapshot uploaded"))
    }

    pub async fn download_snapshot(&self) -> Result<SyncStatus, AppError> {
        let config = self.store.load_config()?;
        let remote = RemoteTarget::from_config(&config.webdav)?;
        let Some(snapshot) = self
            .fetch_remote_snapshot(&remote, "webdavDownloadFailed")
            .await?
        else {
            return Err(AppError::new(
                "webdavSnapshotMissing",
                "remote WebDAV snapshot does not exist",
            ));
        };
        let signature = snapshot_signature(&snapshot)?;
        self.restore_snapshot(snapshot)?;
        self.save_sync_signature(signature)?;

        Ok(remote.status("Snapshot downloaded"))
    }

    fn authorized_request(
        &self,
        method: Method,
        url: Url,
        config: &WebdavConfig,
    ) -> reqwest::RequestBuilder {
        self.client
            .request(method, url)
            .header(USER_AGENT, USER_AGENT_VALUE)
            .basic_auth(&config.username, Some(&config.password))
    }

    fn build_snapshot(&self) -> Result<SyncSnapshot, AppError> {
        self.store.ensure_storage()?;
        let mut config = self.store.load_config()?;
        Self::prepare_snapshot_config(&mut config);
        Ok(SyncSnapshot {
            schema_version: SNAPSHOT_SCHEMA_VERSION,
            generated_at: Utc::now().to_rfc3339(),
            config,
            metadata: self.store.load_metadata()?,
            notes: collect_utf8_files(&self.store.notes_dir()?)?,
            backgrounds: collect_binary_files(&self.store.backgrounds_dir())?,
            attachments: Some(collect_binary_files(&self.store.attachments_root())?),
        })
    }

    fn restore_snapshot(&self, snapshot: SyncSnapshot) -> Result<(), AppError> {
        if snapshot.schema_version != SNAPSHOT_SCHEMA_VERSION {
            return Err(AppError::new(
                "webdavSnapshotInvalid",
                format!("unsupported snapshot schema {}", snapshot.schema_version),
            ));
        }

        let local_config = self.store.load_config()?;
        let mut restored_config = snapshot.config;
        self.prepare_restored_config(&mut restored_config, &local_config);

        let restore_dir = self.store.base_dir().join(".sync-restore");
        if restore_dir.exists() {
            remove_dir_all_inside(&restore_dir)?;
        }
        fs::create_dir_all(&restore_dir)?;

        let notes_restore_dir = restore_dir.join("notes");
        let backgrounds_restore_dir = restore_dir.join("backgrounds");
        write_snapshot_files(&notes_restore_dir, &snapshot.notes)?;
        write_snapshot_files(&backgrounds_restore_dir, &snapshot.backgrounds)?;
        let attachments_restore_dir = restore_dir.join("attachments");
        if let Some(attachments) = snapshot.attachments.as_ref() {
            write_snapshot_files(&attachments_restore_dir, attachments)?;
        }

        self.store.save_config(restored_config)?;
        let backup_dir = self
            .store
            .base_dir()
            .join(".sync-backups")
            .join(Utc::now().format("%Y%m%d%H%M%S").to_string());
        let mut restore_targets = vec![
            (self.store.notes_dir()?, notes_restore_dir, "notes"),
            (
                self.store.backgrounds_dir(),
                backgrounds_restore_dir,
                "backgrounds",
            ),
        ];
        if snapshot.attachments.is_some() {
            restore_targets.push((
                self.store.attachments_root(),
                attachments_restore_dir,
                "attachments",
            ));
        }
        let mut replacements = Vec::new();
        for (target, source, backup_name) in restore_targets {
            match replace_dir_contents(&target, &source, &backup_dir.join(backup_name)) {
                Ok(replacement) => replacements.push(replacement),
                Err(error) => {
                    restore_replacements(&replacements);
                    let _ = self.store.save_config(local_config.clone());
                    return Err(error);
                }
            }
        }
        if let Err(error) = self.store.save_metadata(&snapshot.metadata) {
            restore_replacements(&replacements);
            let _ = self.store.save_config(local_config);
            return Err(error);
        }

        let _ = fs::remove_dir_all(&restore_dir);
        let _ = fs::remove_dir_all(&backup_dir);
        Ok(())
    }

    #[cfg(test)]
    fn build_snapshot_for_test(&self) -> Result<SyncSnapshot, AppError> {
        self.build_snapshot()
    }

    #[cfg(test)]
    fn restore_snapshot_for_test(&self, snapshot: SyncSnapshot) -> Result<(), AppError> {
        self.restore_snapshot(snapshot)
    }

    #[cfg(test)]
    fn save_sync_signature_for_test(&self, signature: String) -> Result<(), AppError> {
        self.save_sync_signature(signature)
    }

    fn prepare_restored_config(&self, config: &mut AppConfig, local_config: &AppConfig) {
        config.notes_dir = local_config.notes_dir.clone();
        config.webdav = local_config.webdav.clone();
        config.object_storage = local_config.object_storage.clone();
        if config.background_image_path.is_empty() {
            return;
        }

        if let Some(file_name) = Path::new(&config.background_image_path)
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| !value.is_empty())
        {
            config.background_image_path = self
                .store
                .backgrounds_dir()
                .join(file_name)
                .to_string_lossy()
                .to_string();
        }
    }

    fn prepare_snapshot_config(config: &mut AppConfig) {
        config.notes_dir = "notes".to_string();
        config.webdav = WebdavConfig::default();
        config.object_storage = ObjectStorageConfig::default();
        if let Some(file_name) = Path::new(&config.background_image_path)
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| !value.is_empty())
        {
            config.background_image_path = file_name.to_string();
        }
    }

    async fn fetch_remote_snapshot(
        &self,
        remote: &RemoteTarget,
        failure_code: &str,
    ) -> Result<Option<SyncSnapshot>, AppError> {
        let response = self
            .authorized_request(Method::GET, remote.file_url.clone(), &remote.config)
            .send()
            .await
            .map_err(map_webdav_transport_error)?;

        if response.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        ensure_webdav_success(response.status(), failure_code)?;

        response
            .json::<SyncSnapshot>()
            .await
            .map(Some)
            .map_err(|error| AppError::new("webdavSnapshotInvalid", error.to_string()))
    }

    fn save_sync_signature(&self, signature: String) -> Result<(), AppError> {
        let mut config = self.store.load_config()?;
        config.webdav.last_sync_signature = Some(signature);
        self.store.save_config(config)?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
struct RemoteTarget {
    config: WebdavConfig,
    collection_urls: Vec<Url>,
    collection_url: Url,
    file_url: Url,
    display_path: String,
}

impl RemoteTarget {
    fn from_config(config: &WebdavConfig) -> Result<Self, AppError> {
        let endpoint = config.endpoint.trim();
        let username = config.username.trim();
        if endpoint.is_empty() || username.is_empty() || config.password.is_empty() {
            return Err(AppError::new(
                "webdavConfigIncomplete",
                "WebDAV endpoint, username and password are required",
            ));
        }

        let mut collection_url = Url::parse(endpoint)
            .map_err(|error| AppError::new("webdavConfigInvalid", error.to_string()))?;
        if collection_url.scheme() != "http" && collection_url.scheme() != "https" {
            return Err(AppError::new(
                "webdavConfigInvalid",
                "WebDAV endpoint must start with http:// or https://",
            ));
        }

        let remote_path = normalize_remote_path(&config.remote_path);
        let mut remote_config = config.clone();
        remote_config.endpoint = endpoint.to_string();
        remote_config.username = username.to_string();
        remote_config.remote_path = remote_path.clone();
        ensure_url_trailing_slash(&mut collection_url);
        let mut collection_urls = Vec::new();
        for segment in remote_path.split('/').filter(|segment| !segment.is_empty()) {
            collection_url
                .path_segments_mut()
                .map_err(|_| AppError::new("webdavConfigInvalid", "invalid WebDAV endpoint"))?
                .push(segment);
            ensure_url_trailing_slash(&mut collection_url);
            collection_urls.push(collection_url.clone());
        }

        let mut file_url = collection_url.clone();
        file_url
            .path_segments_mut()
            .map_err(|_| AppError::new("webdavConfigInvalid", "invalid WebDAV endpoint"))?
            .push(SNAPSHOT_FILE_NAME);

        Ok(Self {
            config: remote_config,
            collection_urls,
            collection_url,
            file_url: file_url.clone(),
            display_path: file_url.to_string(),
        })
    }

    fn status(&self, message: impl Into<String>) -> SyncStatus {
        SyncStatus {
            ok: true,
            message: message.into(),
            synced_at: Some(Utc::now().to_rfc3339()),
            remote_path: self.display_path.clone(),
        }
    }
}

impl SyncService {
    async fn ensure_remote_collection(&self, remote: &RemoteTarget) -> Result<(), AppError> {
        let collection_urls = if remote.collection_urls.is_empty() {
            vec![remote.collection_url.clone()]
        } else {
            remote.collection_urls.clone()
        };

        for collection_url in collection_urls {
            let response = self
                .authorized_request(
                    Method::from_bytes(b"MKCOL").expect("valid method"),
                    collection_url,
                    &remote.config,
                )
                .send()
                .await
                .map_err(map_webdav_transport_error)?;

            match response.status() {
                StatusCode::CREATED
                | StatusCode::METHOD_NOT_ALLOWED
                | StatusCode::OK
                | StatusCode::NO_CONTENT => {}
                status => {
                    return Err(AppError::new(
                        "webdavDirectoryFailed",
                        format!("WebDAV directory check failed with status {status}"),
                    ))
                }
            }
        }
        Ok(())
    }
}

fn normalize_remote_path(path: &str) -> String {
    let normalized_separators = path.replace('\\', "/");
    let trimmed = normalized_separators.trim().trim_matches('/');
    if trimmed.is_empty() {
        return "floral-notepaper".to_string();
    }
    let normalized = trimmed
        .split('/')
        .map(str::trim)
        .filter(|segment| !segment.is_empty() && *segment != "." && *segment != "..")
        .collect::<Vec<_>>()
        .join("/");
    if normalized.is_empty() {
        "floral-notepaper".to_string()
    } else {
        normalized
    }
}

fn ensure_url_trailing_slash(url: &mut Url) {
    if !url.path().ends_with('/') {
        let next_path = format!("{}/", url.path());
        url.set_path(&next_path);
    }
}

fn map_webdav_transport_error(error: reqwest::Error) -> AppError {
    AppError::new("webdavNetwork", error.to_string())
}

fn ensure_webdav_success(status: StatusCode, code: &str) -> Result<(), AppError> {
    if status.is_success() {
        return Ok(());
    }

    Err(AppError::new(
        code,
        format!("WebDAV request failed with status {status}"),
    ))
}

fn snapshot_signature(snapshot: &SyncSnapshot) -> Result<String, AppError> {
    let mut value = serde_json::to_value(snapshot)?;
    if let Some(object) = value.as_object_mut() {
        object.remove("generatedAt");
    }
    let canonical = serde_json::to_vec(&value)?;
    Ok(format!("{:016x}", stable_hash(&canonical)))
}

fn stable_hash(bytes: &[u8]) -> u64 {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut hash = FNV_OFFSET;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

fn sync_change_flags(
    local_signature: &str,
    remote_signature: Option<&str>,
    last_sync_signature: Option<&str>,
) -> (bool, bool) {
    let local_changed = last_sync_signature
        .map(|signature| signature != local_signature)
        .unwrap_or(true);
    let remote_changed = match (remote_signature, last_sync_signature) {
        (Some(remote), Some(signature)) => remote != signature,
        (Some(_), None) => true,
        (None, _) => false,
    };
    (local_changed, remote_changed)
}

fn recommended_sync_action(
    remote_exists: bool,
    in_sync: bool,
    local_changed: bool,
    remote_changed: bool,
) -> &'static str {
    if in_sync {
        return "none";
    }
    if !remote_exists {
        return "upload";
    }
    match (local_changed, remote_changed) {
        (false, true) => "download",
        (true, false) => "upload",
        (false, false) => "ask",
        (true, true) => "ask",
    }
}

fn collect_utf8_files(root: &Path) -> Result<Vec<SnapshotFile>, AppError> {
    collect_files(root, SnapshotEncoding::Utf8)
}

fn collect_binary_files(root: &Path) -> Result<Vec<SnapshotFile>, AppError> {
    collect_files(root, SnapshotEncoding::Base64)
}

fn collect_files(root: &Path, encoding: SnapshotEncoding) -> Result<Vec<SnapshotFile>, AppError> {
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    collect_files_inner(root, root, &encoding, &mut files)?;
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn collect_files_inner(
    root: &Path,
    current: &Path,
    encoding: &SnapshotEncoding,
    files: &mut Vec<SnapshotFile>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files_inner(root, &path, encoding, files)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }

        let relative = relative_snapshot_path(root, &path)?;
        let content = match encoding {
            SnapshotEncoding::Utf8 => fs::read_to_string(&path)?,
            SnapshotEncoding::Base64 => BASE64.encode(fs::read(&path)?),
        };
        files.push(SnapshotFile {
            path: relative,
            content,
            encoding: encoding.clone(),
        });
    }
    Ok(())
}

fn relative_snapshot_path(root: &Path, path: &Path) -> Result<String, AppError> {
    let relative = path.strip_prefix(root).map_err(|error| {
        AppError::new(
            "webdavSnapshotInvalid",
            format!("invalid snapshot path: {error}"),
        )
    })?;
    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/"))
}

fn write_snapshot_files(root: &Path, files: &[SnapshotFile]) -> Result<(), AppError> {
    fs::create_dir_all(root)?;
    for file in files {
        let path = safe_snapshot_file_path(root, &file.path)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        match file.encoding {
            SnapshotEncoding::Utf8 => fs::write(path, &file.content)?,
            SnapshotEncoding::Base64 => fs::write(
                path,
                BASE64
                    .decode(&file.content)
                    .map_err(|error| AppError::new("webdavSnapshotInvalid", error.to_string()))?,
            )?,
        }
    }
    Ok(())
}

fn safe_snapshot_file_path(root: &Path, relative: &str) -> Result<PathBuf, AppError> {
    let mut result = root.to_path_buf();
    for segment in relative.split('/') {
        let has_only_normal_components = Path::new(segment)
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
        if segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment.contains('\\')
            || segment.contains(':')
            || !has_only_normal_components
        {
            return Err(AppError::new(
                "webdavSnapshotInvalid",
                format!("unsafe snapshot path {relative}"),
            ));
        }
        result.push(segment);
    }
    Ok(result)
}

#[derive(Debug, Clone)]
struct DirectoryReplacement {
    target: PathBuf,
    backup: PathBuf,
    had_backup: bool,
}

fn replace_dir_contents(
    target: &Path,
    source: &Path,
    backup: &Path,
) -> Result<DirectoryReplacement, AppError> {
    fs::create_dir_all(target)?;
    if backup.exists() {
        fs::remove_dir_all(backup)?;
    }
    let had_backup = directory_has_entries(target)?;
    if had_backup {
        fs::create_dir_all(backup)?;
        copy_dir_contents(target, backup)?;
    }
    remove_dir_all_inside(target)?;
    if let Err(error) = copy_dir_contents(source, target) {
        restore_directory(target, backup, had_backup);
        return Err(error);
    }

    Ok(DirectoryReplacement {
        target: target.to_path_buf(),
        backup: backup.to_path_buf(),
        had_backup,
    })
}

fn restore_replacements(replacements: &[DirectoryReplacement]) {
    for replacement in replacements.iter().rev() {
        restore_directory(
            &replacement.target,
            &replacement.backup,
            replacement.had_backup,
        );
    }
}

fn restore_directory(target: &Path, backup: &Path, had_backup: bool) {
    let _ = fs::create_dir_all(target);
    let _ = remove_dir_all_inside(target);
    if had_backup && backup.exists() {
        let _ = copy_dir_contents(backup, target);
    }
}

fn directory_has_entries(path: &Path) -> Result<bool, AppError> {
    Ok(fs::read_dir(path)?.next().transpose()?.is_some())
}

fn remove_dir_all_inside(root: &Path) -> Result<(), AppError> {
    if !root.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(path)?;
        } else {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn copy_dir_contents(source: &Path, target: &Path) -> Result<(), AppError> {
    if !source.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            fs::create_dir_all(&target_path)?;
            copy_dir_contents(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path)
                .map(|_| ())
                .map_err(|error| {
                    if error.kind() == io::ErrorKind::AlreadyExists {
                        AppError::new(
                            "io",
                            format!("file already exists: {}", target_path.display()),
                        )
                    } else {
                        error.into()
                    }
                })?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::notes::SaveNoteRequest;

    fn test_root(name: &str) -> PathBuf {
        let base = std::env::var_os("FLORAL_NOTEPAPER_TEST_TEMP_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::temp_dir().join("floral-notepaper-sync-tests"));
        let root = base.join(name);
        if root.exists() {
            fs::remove_dir_all(&root).expect("remove stale test root");
        }
        fs::create_dir_all(&root).expect("create test root");
        root
    }

    #[test]
    fn builds_snapshot_with_notes_config_metadata_backgrounds_and_attachments() {
        let store = NoteStore::new(test_root("snapshot"));
        let note = store
            .create_note(SaveNoteRequest {
                title: "同步".into(),
                content: "# 同步\n内容".into(),
                category: "work".into(),
                reminder: None,
            })
            .expect("create note");
        let bg_dir = store.backgrounds_dir();
        fs::create_dir_all(&bg_dir).expect("create backgrounds");
        let background_path = bg_dir.join("paper.bin");
        fs::write(&background_path, [1_u8, 2, 3]).expect("write background");
        let mut config = store.load_config().expect("load config");
        config.background_image_path = background_path.to_string_lossy().to_string();
        config.webdav.endpoint = "https://example.com/dav".into();
        config.webdav.username = "secret-user".into();
        config.webdav.password = "secret-pass".into();
        config.object_storage.enabled = true;
        config.object_storage.endpoint = "https://r2.example.com".into();
        config.object_storage.bucket = "private-bucket".into();
        config.object_storage.access_key_id = "secret-access".into();
        config.object_storage.secret_access_key = "secret-key".into();
        config.object_storage.public_base_url = "https://cdn.example.com".into();
        store.save_config(config).expect("save config");
        let attachment_source = store.base_dir().join("source.png");
        fs::write(&attachment_source, [4_u8, 5, 6]).expect("write attachment source");
        let attachment = store
            .add_attachment(&note.id, &attachment_source)
            .expect("add attachment");

        let snapshot = SyncService::new(store)
            .build_snapshot_for_test()
            .expect("build snapshot");

        assert_eq!(snapshot.schema_version, SNAPSHOT_SCHEMA_VERSION);
        assert!(snapshot
            .notes
            .iter()
            .any(|file| file.path == format!("work/{}", note.file_name)));
        assert!(snapshot
            .backgrounds
            .iter()
            .any(|file| file.path == "paper.bin"));
        let attachments = snapshot
            .attachments
            .as_ref()
            .expect("attachments in snapshot");
        assert!(attachments
            .iter()
            .any(|file| { file.path == format!("{}/{}", note.id, attachment.stored_file_name) }));
        assert!(attachments
            .iter()
            .any(|file| file.path == format!("{}/attachments.json", note.id)));
        assert_eq!(snapshot.metadata.notes.len(), 1);
        assert_eq!(snapshot.config.notes_dir, "notes");
        assert_eq!(snapshot.config.background_image_path, "paper.bin");
        assert_eq!(snapshot.config.webdav, WebdavConfig::default());
        assert_eq!(
            snapshot.config.object_storage,
            ObjectStorageConfig::default()
        );
    }

    #[test]
    fn restores_snapshot_without_overwriting_local_device_config() {
        let source_store = NoteStore::new(test_root("restore-source"));
        source_store
            .create_note(SaveNoteRequest {
                title: "远端".into(),
                content: "remote".into(),
                category: String::new(),
                reminder: None,
            })
            .expect("create remote note");
        let mut source_config = source_store.load_config().expect("load source config");
        source_config.webdav.endpoint = "https://remote.example/dav".into();
        source_config.webdav.username = "remote-user".into();
        source_config.webdav.password = "remote-pass".into();
        source_config.object_storage.enabled = true;
        source_config.object_storage.endpoint = "https://remote-r2.example.com".into();
        source_config.object_storage.bucket = "remote-bucket".into();
        source_config.object_storage.access_key_id = "remote-access".into();
        source_config.object_storage.secret_access_key = "remote-secret".into();
        source_config.object_storage.public_base_url = "https://remote-cdn.example.com".into();
        source_store
            .save_config(source_config)
            .expect("save source config");
        fs::create_dir_all(source_store.backgrounds_dir()).expect("create source backgrounds");
        let remote_background = source_store.backgrounds_dir().join("bg-remote.png");
        fs::write(&remote_background, b"remote background").expect("write remote background");
        let mut source_config = source_store.load_config().expect("reload source config");
        source_config.background_image_path = remote_background.to_string_lossy().to_string();
        source_store
            .save_config(source_config)
            .expect("save source background config");
        let snapshot = SyncService::new(source_store)
            .build_snapshot_for_test()
            .expect("build source snapshot");

        let target_store = NoteStore::new(test_root("restore-target"));
        let mut target_config = target_store.load_config().expect("load target config");
        target_config.notes_dir = target_store
            .base_dir()
            .join("device-notes")
            .to_string_lossy()
            .to_string();
        target_config.webdav.endpoint = "https://local.example/dav".into();
        target_config.webdav.username = "local-user".into();
        target_config.webdav.password = "local-pass".into();
        target_config.object_storage.enabled = true;
        target_config.object_storage.endpoint = "https://local-r2.example.com".into();
        target_config.object_storage.bucket = "local-bucket".into();
        target_config.object_storage.access_key_id = "local-access".into();
        target_config.object_storage.secret_access_key = "local-secret".into();
        target_config.object_storage.public_base_url = "https://local-cdn.example.com".into();
        let target_config = target_store
            .save_config(target_config.clone())
            .expect("save target config");

        SyncService::new(target_store.clone())
            .restore_snapshot_for_test(snapshot)
            .expect("restore snapshot");

        let restored_config = target_store.load_config().expect("reload config");
        assert_eq!(restored_config.notes_dir, target_config.notes_dir);
        assert_eq!(restored_config.webdav.endpoint, "https://local.example/dav");
        assert_eq!(
            restored_config.object_storage.endpoint,
            "https://local-r2.example.com"
        );
        assert_eq!(restored_config.object_storage.bucket, "local-bucket");
        assert_eq!(
            restored_config.object_storage.secret_access_key,
            "local-secret"
        );
        assert_eq!(
            restored_config.background_image_path,
            target_store
                .backgrounds_dir()
                .join("bg-remote.png")
                .to_string_lossy()
                .to_string()
        );
        assert_eq!(target_store.list_notes().expect("list notes").len(), 1);
    }

    #[test]
    fn restores_snapshot_attachments() {
        let source_store = NoteStore::new(test_root("attachment-restore-source"));
        let note = source_store
            .create_note(SaveNoteRequest {
                title: "带附件".into(),
                content: "remote".into(),
                category: String::new(),
                reminder: None,
            })
            .expect("create source note");
        let attachment_source = source_store.base_dir().join("receipt.pdf");
        fs::write(&attachment_source, b"pdf").expect("write source attachment");
        let attachment = source_store
            .add_attachment(&note.id, &attachment_source)
            .expect("add source attachment");
        let snapshot = SyncService::new(source_store)
            .build_snapshot_for_test()
            .expect("build source snapshot");

        let target_store = NoteStore::new(test_root("attachment-restore-target"));
        SyncService::new(target_store.clone())
            .restore_snapshot_for_test(snapshot)
            .expect("restore snapshot");

        let restored = target_store
            .list_attachments(&note.id)
            .expect("list restored attachments");
        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0].file_name, attachment.file_name);
        assert_eq!(
            fs::read(&restored[0].path).expect("read restored attachment"),
            b"pdf"
        );
    }

    #[test]
    fn rejects_incomplete_webdav_config() {
        let config = WebdavConfig {
            enabled: true,
            endpoint: String::new(),
            username: "user".into(),
            password: "pass".into(),
            remote_path: "floral".into(),
            sync_on_startup: false,
            conflict_strategy: "ask".into(),
            last_sync_signature: None,
        };

        let error = RemoteTarget::from_config(&config).expect_err("reject config");
        assert_eq!(error.code, "webdavConfigIncomplete");
    }

    #[test]
    fn rejects_unsafe_snapshot_paths() {
        let root = test_root("unsafe-path");
        let files = [SnapshotFile {
            path: "../outside.md".into(),
            content: "bad".into(),
            encoding: SnapshotEncoding::Utf8,
        }];

        let error = write_snapshot_files(&root, &files).expect_err("reject path");
        assert_eq!(error.code, "webdavSnapshotInvalid");
    }

    #[test]
    fn rejects_windows_style_snapshot_paths() {
        let root = test_root("windows-unsafe-path");
        let absolute_files = [SnapshotFile {
            path: "C:\\Users\\target\\outside.md".into(),
            content: "bad".into(),
            encoding: SnapshotEncoding::Utf8,
        }];
        let traversal_files = [SnapshotFile {
            path: "..\\outside.md".into(),
            content: "bad".into(),
            encoding: SnapshotEncoding::Utf8,
        }];

        let absolute_error =
            write_snapshot_files(&root, &absolute_files).expect_err("reject absolute path");
        let traversal_error =
            write_snapshot_files(&root, &traversal_files).expect_err("reject traversal path");

        assert_eq!(absolute_error.code, "webdavSnapshotInvalid");
        assert_eq!(traversal_error.code, "webdavSnapshotInvalid");
    }

    #[test]
    fn normalizes_webdav_remote_path_separators() {
        assert_eq!(
            normalize_remote_path(" /team\\floral/./notes/../sync "),
            "team/floral/notes/sync"
        );
    }

    #[test]
    fn snapshot_signature_ignores_generated_at() {
        let store = NoteStore::new(test_root("signature"));
        store
            .create_note(SaveNoteRequest {
                title: "签名".into(),
                content: "content".into(),
                category: String::new(),
                reminder: None,
            })
            .expect("create note");
        let service = SyncService::new(store);
        let mut first = service.build_snapshot_for_test().expect("first snapshot");
        let mut second = first.clone();
        first.generated_at = "2026-06-02T08:00:00Z".into();
        second.generated_at = "2026-06-02T09:00:00Z".into();

        assert_eq!(
            snapshot_signature(&first).expect("first signature"),
            snapshot_signature(&second).expect("second signature")
        );
    }

    #[test]
    fn detects_sync_change_flags_against_last_signature() {
        assert_eq!(
            sync_change_flags("same", Some("same"), Some("same")),
            (false, false)
        );
        assert_eq!(
            sync_change_flags("local", Some("base"), Some("base")),
            (true, false)
        );
        assert_eq!(
            sync_change_flags("base", Some("remote"), Some("base")),
            (false, true)
        );
        assert_eq!(
            sync_change_flags("local", Some("remote"), Some("base")),
            (true, true)
        );
        assert_eq!(sync_change_flags("local", None, None), (true, false));
    }

    #[test]
    fn recommends_sync_actions_from_change_flags() {
        assert_eq!(recommended_sync_action(true, true, false, false), "none");
        assert_eq!(recommended_sync_action(false, false, true, false), "upload");
        assert_eq!(recommended_sync_action(true, false, true, false), "upload");
        assert_eq!(
            recommended_sync_action(true, false, false, true),
            "download"
        );
        assert_eq!(recommended_sync_action(true, false, true, true), "ask");
    }

    #[test]
    fn persists_sync_signature_in_local_config() {
        let store = NoteStore::new(test_root("sync-signature"));
        let service = SyncService::new(store.clone());

        service
            .save_sync_signature_for_test("sig-1".into())
            .expect("save signature");

        assert_eq!(
            store
                .load_config()
                .expect("load config")
                .webdav
                .last_sync_signature,
            Some("sig-1".into())
        );
    }
}
