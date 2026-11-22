import { describe, expect, it } from "vitest";
import { addDays, diffDays, isValidTimezone, localDate, startOfWeek, weekdayIndex } from "./days";

describe("localDate", () => {
  it("23:59 in Seoul is already the next day there but not in UTC", () => {
    // 2026-11-22 23:59 KST = 2026-11-22 14:59 UTC
    const t = new Date("2026-11-22T14:59:00Z");
    expect(localDate(t, "Asia/Seoul")).toBe("2026-11-22");
    expect(localDate(t, "UTC")).toBe("2026-11-22");
    // one minute later, Seoul rolls over, UTC does not
    const t2 = new Date("2026-11-22T15:00:00Z");
    expect(localDate(t2, "Asia/Seoul")).toBe("2026-11-23");
    expect(localDate(t2, "UTC")).toBe("2026-11-22");
  });

  it("23:59 UTC is the next morning in Seoul", () => {
    const t = new Date("2026-11-22T23:59:00Z");
    expect(localDate(t, "UTC")).toBe("2026-11-22");
    expect(localDate(t, "Asia/Seoul")).toBe("2026-11-23");
  });

  it("handles DST in Europe/Paris", () => {
    // Spring forward 2026-03-29 (UTC+1 → UTC+2) at 01:00 UTC.
    expect(localDate(new Date("2026-03-28T22:59:00Z"), "Europe/Paris")).toBe("2026-03-28");
    expect(localDate(new Date("2026-03-28T23:00:00Z"), "Europe/Paris")).toBe("2026-03-29");
    // After the switch, midnight is 22:00 UTC.
    expect(localDate(new Date("2026-03-29T21:59:00Z"), "Europe/Paris")).toBe("2026-03-29");
    expect(localDate(new Date("2026-03-29T22:00:00Z"), "Europe/Paris")).toBe("2026-03-30");
    // Fall back 2026-10-25 (UTC+2 → UTC+1).
    expect(localDate(new Date("2026-10-24T21:59:00Z"), "Europe/Paris")).toBe("2026-10-24");
    expect(localDate(new Date("2026-10-24T22:00:00Z"), "Europe/Paris")).toBe("2026-10-25");
    expect(localDate(new Date("2026-10-25T22:59:00Z"), "Europe/Paris")).toBe("2026-10-25");
    expect(localDate(new Date("2026-10-25T23:00:00Z"), "Europe/Paris")).toBe("2026-10-26");
  });

  it("unknown timezone falls back to UTC", () => {
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("Asia/Seoul")).toBe(true);
    expect(localDate(new Date("2026-11-22T23:59:00Z"), "Mars/Olympus")).toBe("2026-11-22");
  });
});

describe("day arithmetic", () => {
  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // across DST, still whole days
  });

  it("diffDays", () => {
    expect(diffDays("2026-11-01", "2026-11-22")).toBe(21);
    expect(diffDays("2026-11-22", "2026-11-21")).toBe(-1);
  });

  it("weekdays start on Monday", () => {
    expect(weekdayIndex("2026-11-23")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-22")).toBe(6); // Sunday
    expect(startOfWeek("2026-11-22")).toBe("2026-11-16");
    expect(startOfWeek("2026-11-23")).toBe("2026-11-23");
  });
});
