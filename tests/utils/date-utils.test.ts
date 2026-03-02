import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  todayISO,
  nowISO,
  nowDatetime,
  isToday,
  isThisWeek,
  isPast,
  isTomorrow,
  formatDate,
} from "../../src/utils/date-utils";

describe("date-utils", () => {
  const FIXED_DATE = "2026-03-02";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("todayISO", () => {
    it("returns the current date as YYYY-MM-DD", () => {
      expect(todayISO()).toBe(FIXED_DATE);
    });
  });

  describe("nowISO", () => {
    it("returns a full ISO datetime string", () => {
      expect(nowISO()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("nowDatetime", () => {
    it("returns YYYY-MM-DDTHH:mm:ss format", () => {
      expect(nowDatetime()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("isToday", () => {
    it("returns true for today's date", () => {
      expect(isToday(FIXED_DATE)).toBe(true);
    });

    it("returns false for a past date", () => {
      expect(isToday("2026-03-01")).toBe(false);
    });

    it("returns false for a future date", () => {
      expect(isToday("2026-03-03")).toBe(false);
    });
  });

  describe("isThisWeek", () => {
    it("returns true for today", () => {
      expect(isThisWeek(FIXED_DATE)).toBe(true);
    });

    it("returns true for a date 6 days away", () => {
      expect(isThisWeek("2026-03-08")).toBe(true);
    });

    it("returns false for a date 8 days away", () => {
      expect(isThisWeek("2026-03-10")).toBe(false);
    });

    it("returns false for a past date", () => {
      expect(isThisWeek("2026-02-28")).toBe(false);
    });
  });

  describe("isPast", () => {
    it("returns false for today", () => {
      expect(isPast(FIXED_DATE)).toBe(false);
    });

    it("returns true for yesterday", () => {
      expect(isPast("2026-03-01")).toBe(true);
    });

    it("returns false for a future date", () => {
      expect(isPast("2026-03-03")).toBe(false);
    });
  });

  describe("isTomorrow", () => {
    it("returns true for tomorrow's date", () => {
      expect(isTomorrow("2026-03-03")).toBe(true);
    });

    it("returns false for today", () => {
      expect(isTomorrow(FIXED_DATE)).toBe(false);
    });
  });

  describe("formatDate", () => {
    it("returns empty string for null", () => {
      expect(formatDate(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(formatDate(undefined)).toBe("");
    });

    it("formats a valid ISO date string", () => {
      const result = formatDate("2026-03-02");
      expect(result).toBeTruthy();
      // Should contain "2026" and some month representation
      expect(result).toContain("2026");
    });
  });
});
