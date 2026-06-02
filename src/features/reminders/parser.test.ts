import { describe, expect, it } from "vitest";
import { extractReminderFromTitle, formatReminderSummary, parseReminderInput } from "./parser";

const base = new Date(2026, 4, 30, 8, 30, 0, 0); // Saturday

function localParts(value: string) {
  const date = new Date(value);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

describe("reminder parser", () => {
  it("parses one-time natural reminders", () => {
    const reminder = parseReminderInput("明天下午四点", base);

    expect(reminder?.kind).toBe("once");
    expect(reminder?.timeOfDay).toBe("16:00");
    expect(localParts(reminder?.nextAt ?? "")).toEqual({
      year: 2026,
      month: 5,
      day: 31,
      hour: 16,
      minute: 0,
    });
  });

  it("parses tonight and standalone time reminders as upcoming one-time reminders", () => {
    const tonight = parseReminderInput("今晚八点", base);
    const standalone = parseReminderInput("下午四点半", new Date(2026, 4, 30, 17, 0, 0, 0));

    expect(tonight?.kind).toBe("once");
    expect(tonight?.timeOfDay).toBe("20:00");
    expect(localParts(tonight?.nextAt ?? "")).toMatchObject({
      year: 2026,
      month: 5,
      day: 30,
      hour: 20,
      minute: 0,
    });
    expect(standalone?.kind).toBe("once");
    expect(standalone?.timeOfDay).toBe("16:30");
    expect(localParts(standalone?.nextAt ?? "")).toMatchObject({
      year: 2026,
      month: 5,
      day: 31,
      hour: 16,
      minute: 30,
    });
  });

  it("parses weekly reminders", () => {
    const reminder = parseReminderInput("每周一", base);

    expect(reminder?.kind).toBe("weekly");
    expect(reminder?.weekday).toBe(1);
    expect(reminder?.timeOfDay).toBe("09:00");
    expect(localParts(reminder?.nextAt ?? "").day).toBe(1);
  });

  it("parses monthly reminders with explicit time", () => {
    const reminder = parseReminderInput("每月五号上午10点", base);

    expect(reminder?.kind).toBe("monthly");
    expect(reminder?.dayOfMonth).toBe(5);
    expect(reminder?.timeOfDay).toBe("10:00");
    expect(localParts(reminder?.nextAt ?? "")).toEqual({
      year: 2026,
      month: 6,
      day: 5,
      hour: 10,
      minute: 0,
    });
  });

  it("parses workday reminders", () => {
    const reminder = parseReminderInput("每个工作日", base);

    expect(reminder?.kind).toBe("workday");
    expect(reminder?.timeOfDay).toBe("09:00");
    expect(localParts(reminder?.nextAt ?? "")).toMatchObject({
      year: 2026,
      month: 6,
      day: 1,
      hour: 9,
      minute: 0,
    });
  });

  it("formats reminder summaries", () => {
    const reminder = parseReminderInput("每月五号上午10点", base);

    expect(reminder && formatReminderSummary(reminder, "zh-CN")).toBe("每月5号 10:00");
    expect(reminder && formatReminderSummary(reminder, "en-US")).toBe("Monthly on day 5 10:00");
  });

  it("extracts smart reminders from note titles", () => {
    const extracted = extractReminderFromTitle("明早九点开会", base);

    expect(extracted?.sourceText).toBe("明早九点");
    expect(extracted?.reminder.input).toBe("明早九点");
    expect(extracted?.reminder.kind).toBe("once");
    expect(extracted?.reminder.timeOfDay).toBe("09:00");
    expect(localParts(extracted?.reminder.nextAt ?? "")).toEqual({
      year: 2026,
      month: 5,
      day: 31,
      hour: 9,
      minute: 0,
    });
  });

  it("extracts recurring reminder phrases from mixed titles", () => {
    const weekly = extractReminderFromTitle("写周报每周一", base);
    const monthly = extractReminderFromTitle("交房租每月五号上午10点", base);
    const workday = extractReminderFromTitle("站会每个工作日", base);

    expect(weekly?.sourceText).toBe("每周一");
    expect(weekly?.reminder.kind).toBe("weekly");
    expect(weekly?.reminder.weekday).toBe(1);
    expect(monthly?.sourceText).toBe("每月五号上午10点");
    expect(monthly?.reminder.kind).toBe("monthly");
    expect(monthly?.reminder.dayOfMonth).toBe(5);
    expect(workday?.sourceText).toBe("每个工作日");
    expect(workday?.reminder.kind).toBe("workday");
  });

  it("does not extract reminders from plain titles", () => {
    expect(extractReminderFromTitle("整理花笺提醒功能")).toBeNull();
  });
});
