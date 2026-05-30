import type { Reminder } from "../notes/types";

export type ReminderPresetId =
  | "later"
  | "tonight"
  | "tomorrowMorning"
  | "tomorrowAfternoon"
  | "nextMonday"
  | "weeklyMonday"
  | "monthlyFifth"
  | "workdays";

export interface ReminderPreset {
  id: ReminderPresetId;
  input: string;
  labelKey: string;
  defaultLabel: string;
}

interface TimeOfDay {
  hour: number;
  minute: number;
}

const DEFAULT_TIME: TimeOfDay = { hour: 9, minute: 0 };
const PERIOD_DEFAULTS: Record<string, TimeOfDay> = {
  凌晨: { hour: 6, minute: 0 },
  早上: { hour: 9, minute: 0 },
  早: { hour: 9, minute: 0 },
  上午: { hour: 9, minute: 0 },
  中午: { hour: 12, minute: 0 },
  下午: { hour: 16, minute: 0 },
  晚上: { hour: 20, minute: 0 },
  晚: { hour: 20, minute: 0 },
  今晚: { hour: 20, minute: 0 },
};

const DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

export const REMINDER_PRESETS: ReminderPreset[] = [
  { id: "later", input: "稍后", labelKey: "main.reminder.presets.later", defaultLabel: "稍后" },
  {
    id: "tonight",
    input: "今晚八点",
    labelKey: "main.reminder.presets.tonight",
    defaultLabel: "今晚",
  },
  {
    id: "tomorrowMorning",
    input: "明早九点",
    labelKey: "main.reminder.presets.tomorrowMorning",
    defaultLabel: "明早",
  },
  {
    id: "tomorrowAfternoon",
    input: "明天下午四点",
    labelKey: "main.reminder.presets.tomorrowAfternoon",
    defaultLabel: "明天下午",
  },
  {
    id: "nextMonday",
    input: "下周一上午九点",
    labelKey: "main.reminder.presets.nextMonday",
    defaultLabel: "下周一",
  },
  {
    id: "weeklyMonday",
    input: "每周一上午九点",
    labelKey: "main.reminder.presets.weeklyMonday",
    defaultLabel: "每周一",
  },
  {
    id: "monthlyFifth",
    input: "每月五号上午10点",
    labelKey: "main.reminder.presets.monthlyFifth",
    defaultLabel: "每月五号",
  },
  {
    id: "workdays",
    input: "每个工作日上午九点",
    labelKey: "main.reminder.presets.workdays",
    defaultLabel: "工作日",
  },
];

export function parseReminderInput(input: string, now = new Date()): Reminder | null {
  const normalized = normalizeInput(input);
  if (!normalized) return null;

  if (normalized === "稍后" || normalized === "晚点" || normalized === "稍等提醒") {
    const nextAt = new Date(now);
    nextAt.setHours(now.getHours() + 2, 0, 0, 0);
    return reminder("once", input, nextAt, timeOfDayFromDate(nextAt));
  }

  const workday = parseWorkdayReminder(normalized, input, now);
  if (workday) return workday;

  const weekly = parseWeeklyReminder(normalized, input, now);
  if (weekly) return weekly;

  const monthly = parseMonthlyReminder(normalized, input, now);
  if (monthly) return monthly;

  const oneTime = parseOneTimeReminder(normalized, input, now);
  if (oneTime) return oneTime;

  return null;
}

export function formatReminderSummary(reminder: Reminder, locale = "zh-CN"): string {
  const time = reminder.timeOfDay;
  if (locale.startsWith("en")) {
    if (reminder.kind === "weekly") return `Every ${weekdayName(reminder.weekday, locale)} ${time}`;
    if (reminder.kind === "monthly") return `Monthly on day ${reminder.dayOfMonth} ${time}`;
    if (reminder.kind === "workday") return `Every workday ${time}`;
    return new Intl.DateTimeFormat(locale, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(reminder.nextAt));
  }

  if (reminder.kind === "weekly") return `每${weekdayName(reminder.weekday, locale)} ${time}`;
  if (reminder.kind === "monthly") return `每月${reminder.dayOfMonth}号 ${time}`;
  if (reminder.kind === "workday") return `每个工作日 ${time}`;
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(reminder.nextAt));
}

function parseWorkdayReminder(normalized: string, input: string, now: Date): Reminder | null {
  if (!/(每个工作日|每工作日|工作日)/.test(normalized)) return null;
  const time = parseTimeOfDay(normalized, DEFAULT_TIME);
  const nextAt = nextWorkdayAt(now, time);
  return reminder("workday", input, nextAt, formatTime(time));
}

function parseWeeklyReminder(normalized: string, input: string, now: Date): Reminder | null {
  const match = /每(?:周|星期|礼拜)([一二三四五六日天1-7])/.exec(normalized);
  if (!match) return null;
  const weekday = parseWeekday(match[1]);
  if (!weekday) return null;
  const time = parseTimeOfDay(normalized, DEFAULT_TIME);
  const nextAt = nextWeeklyAt(now, weekday, time);
  return reminder("weekly", input, nextAt, formatTime(time), { weekday });
}

function parseMonthlyReminder(normalized: string, input: string, now: Date): Reminder | null {
  const match = /每(?:月|个月)([0-3]?\d|[零〇一二两三四五六七八九十]{1,4})(?:号|日)/.exec(
    normalized,
  );
  if (!match) return null;
  const dayOfMonth = parseNumber(match[1]);
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return null;
  const time = parseTimeOfDay(normalized, DEFAULT_TIME);
  const nextAt = nextMonthlyAt(now, dayOfMonth, time);
  return reminder("monthly", input, nextAt, formatTime(time), { dayOfMonth });
}

function parseOneTimeReminder(normalized: string, input: string, now: Date): Reminder | null {
  const nextWeekday = /下(?:周|星期|礼拜)([一二三四五六日天1-7])/.exec(normalized);
  if (nextWeekday) {
    const weekday = parseWeekday(nextWeekday[1]);
    if (!weekday) return null;
    const time = parseTimeOfDay(normalized, defaultTimeFromText(normalized));
    const nextAt = nextWeeklyAt(now, weekday, time, true);
    return reminder("once", input, nextAt, formatTime(time));
  }

  const offset = relativeDayOffset(normalized);
  if (
    offset == null &&
    !/(今晚|明早|明天下午|明天上午|今天|明天|后天)/.test(normalized) &&
    !hasTimeOfDay(normalized)
  ) {
    return null;
  }

  const time = parseTimeOfDay(normalized, defaultTimeFromText(normalized));
  const nextAt = new Date(now);
  nextAt.setDate(now.getDate() + (offset ?? 0));
  nextAt.setHours(time.hour, time.minute, 0, 0);
  if (nextAt <= now) nextAt.setDate(nextAt.getDate() + 1);
  return reminder("once", input, nextAt, formatTime(time));
}

function parseTimeOfDay(text: string, fallback: TimeOfDay): TimeOfDay {
  const period = periodFromText(text);
  const match =
    /(凌晨|早上|上午|中午|下午|晚上|晚间|晚)?([0-2]?\d|[零〇一二两三四五六七八九十]{1,4})(?:点|时)(半|[0-5]?\d分?)?/.exec(
      text,
    );
  if (!match) return period ? PERIOD_DEFAULTS[period] : fallback;

  let hour = parseNumber(match[2]);
  if (hour == null || hour > 24) return period ? PERIOD_DEFAULTS[period] : fallback;
  let minute = 0;
  if (match[3] === "半") {
    minute = 30;
  } else if (match[3]) {
    const parsedMinute = parseInt(match[3].replace("分", ""), 10);
    minute = Number.isNaN(parsedMinute) ? 0 : parsedMinute;
  }

  const p = match[1] || period;
  if ((p === "下午" || p === "晚上" || p === "晚间" || p === "晚" || p === "今晚") && hour < 12)
    hour += 12;
  if ((p === "凌晨" || p === "早上" || p === "上午") && hour === 12) hour = 0;
  if (p === "中午" && hour < 11) hour += 12;

  return { hour: hour % 24, minute };
}

function hasTimeOfDay(text: string): boolean {
  return /(凌晨|早上|上午|中午|下午|晚上|晚间|晚)?([0-2]?\d|[零〇一二两三四五六七八九十]{1,4})(?:点|时)(半|[0-5]?\d分?)?/.test(
    text,
  );
}

function defaultTimeFromText(text: string): TimeOfDay {
  const period = periodFromText(text);
  return period ? PERIOD_DEFAULTS[period] : DEFAULT_TIME;
}

function periodFromText(text: string): string | null {
  if (text.includes("今晚")) return "今晚";
  if (text.includes("明早")) return "早";
  for (const key of ["凌晨", "早上", "上午", "中午", "下午", "晚上", "晚"] as const) {
    if (text.includes(key)) return key;
  }
  return null;
}

function relativeDayOffset(text: string): number | null {
  if (text.includes("后天")) return 2;
  if (text.includes("明天") || text.includes("明早")) return 1;
  if (text.includes("今天") || text.includes("今晚")) return 0;
  return null;
}

function nextWeeklyAt(now: Date, weekday: number, time: TimeOfDay, forceNext = false): Date {
  const current = jsDayToWeekday(now.getDay());
  let days = (weekday - current + 7) % 7;
  if (forceNext && days === 0) days = 7;
  const nextAt = new Date(now);
  nextAt.setDate(now.getDate() + days);
  nextAt.setHours(time.hour, time.minute, 0, 0);
  if (nextAt <= now) nextAt.setDate(nextAt.getDate() + 7);
  return nextAt;
}

function nextMonthlyAt(now: Date, dayOfMonth: number, time: TimeOfDay): Date {
  let year = now.getFullYear();
  let month = now.getMonth();
  let nextAt = monthlyDate(year, month, dayOfMonth, time);
  if (nextAt <= now) {
    month += 1;
    if (month > 11) {
      year += 1;
      month = 0;
    }
    nextAt = monthlyDate(year, month, dayOfMonth, time);
  }
  return nextAt;
}

function nextWorkdayAt(now: Date, time: TimeOfDay): Date {
  const nextAt = new Date(now);
  nextAt.setHours(time.hour, time.minute, 0, 0);
  while (isWeekend(nextAt) || nextAt <= now) {
    nextAt.setDate(nextAt.getDate() + 1);
    nextAt.setHours(time.hour, time.minute, 0, 0);
  }
  return nextAt;
}

function monthlyDate(year: number, month: number, dayOfMonth: number, time: TimeOfDay): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return new Date(year, month, day, time.hour, time.minute, 0, 0);
}

function reminder(
  kind: Reminder["kind"],
  input: string,
  nextAt: Date,
  timeOfDay: string,
  extra: Pick<Reminder, "weekday" | "dayOfMonth"> = {},
): Reminder {
  return {
    kind,
    input: input.trim(),
    nextAt: nextAt.toISOString(),
    timeOfDay,
    ...extra,
  };
}

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "")
    .replace(/周天/g, "周日")
    .replace(/星期天/g, "星期日");
}

function formatTime(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function timeOfDayFromDate(date: Date): string {
  return formatTime({ hour: date.getHours(), minute: date.getMinutes() });
}

function parseWeekday(value: string): number | null {
  if (/^[1-7]$/.test(value)) return Number(value);
  if (value === "一") return 1;
  if (value === "二") return 2;
  if (value === "三") return 3;
  if (value === "四") return 4;
  if (value === "五") return 5;
  if (value === "六") return 6;
  if (value === "日" || value === "天") return 7;
  return null;
}

function weekdayName(value: number | undefined, locale: string): string {
  const names = locale.startsWith("en")
    ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return names[(value ?? 1) - 1] ?? names[0];
}

function parseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;

  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const before = value.slice(0, tenIndex);
    const after = value.slice(tenIndex + 1);
    const tens = before ? DIGITS[before] : 1;
    const ones = after ? DIGITS[after] : 0;
    if (tens == null || ones == null) return null;
    return tens * 10 + ones;
  }

  let result = 0;
  for (const ch of value) {
    const digit = DIGITS[ch];
    if (digit == null) return null;
    result = result * 10 + digit;
  }
  return result;
}

function jsDayToWeekday(day: number): number {
  return day === 0 ? 7 : day;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
