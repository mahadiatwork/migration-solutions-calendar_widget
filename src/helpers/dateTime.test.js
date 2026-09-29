import {
  buildCalendarRange,
  formatInstantForDateTimeInput,
  getCalendarDate,
  isDateOnly,
  isFutureInstant,
  isInstantInRange,
  serializeDateTimeInZone,
} from "./dateTime";

describe("device timezone date handling", () => {
  test("uses Adelaide's date-specific summer and winter offsets", () => {
    expect(
      buildCalendarRange("2026-01-15", "day", "Australia/Adelaide")
    ).toEqual({
      start: "2026-01-15T00:00:00+10:30",
      end: "2026-01-15T23:59:59+10:30",
    });

    expect(
      buildCalendarRange("2026-07-15", "day", "Australia/Adelaide")
    ).toEqual({
      start: "2026-07-15T00:00:00+09:30",
      end: "2026-07-15T23:59:59+09:30",
    });
  });

  test("recalculates the offset at both ends of a DST-changing month", () => {
    expect(
      buildCalendarRange("2026-10-15", "month", "Australia/Adelaide")
    ).toEqual({
      start: "2026-10-01T00:00:00+09:30",
      end: "2026-10-31T23:59:59+10:30",
    });
  });

  test("builds the visible Monday-Friday week in the device zone", () => {
    expect(
      buildCalendarRange("2026-07-13", "week", "Australia/Adelaide")
    ).toEqual({
      start: "2026-07-13T00:00:00+09:30",
      end: "2026-07-17T23:59:59+09:30",
    });
  });

  test("uses another device zone and its own daylight-saving rules", () => {
    expect(
      buildCalendarRange("2026-01-15", "day", "America/New_York")
    ).toEqual({
      start: "2026-01-15T00:00:00-05:00",
      end: "2026-01-15T23:59:59-05:00",
    });

    expect(
      buildCalendarRange("2026-07-15", "day", "America/New_York")
    ).toEqual({
      start: "2026-07-15T00:00:00-04:00",
      end: "2026-07-15T23:59:59-04:00",
    });
  });

  test("preserves an instant when editing it in the device zone", () => {
    const original = "2026-07-15T09:00:00+09:30";
    const deviceValue = formatInstantForDateTimeInput(
      original,
      "America/New_York"
    );
    const saved = serializeDateTimeInZone(deviceValue, "America/New_York");

    expect(deviceValue).toBe("2026-07-14T19:30");
    expect(saved).toBe("2026-07-14T19:30:00-04:00");
    expect(Date.parse(saved)).toBe(Date.parse(original));
  });

  test("keeps date-only values as date-only strings", () => {
    expect(serializeDateTimeInZone("2026-07-15", "America/New_York")).toBe(
      "2026-07-15"
    );
    expect(formatInstantForDateTimeInput("2026-07-15", "America/New_York")).toBe(
      "2026-07-15"
    );
  });

  test.each([undefined, null, "", "   "])(
    "does not turn a missing date value into now (%p)",
    (value) => {
      expect(serializeDateTimeInZone(value, "America/New_York")).toBe("");
      expect(formatInstantForDateTimeInput(value, "America/New_York")).toBe("");
      expect(getCalendarDate(value, "America/New_York")).toBe("");
      expect(
        isInstantInRange(
          value,
          "2026-01-01T00:00:00-05:00",
          "2026-12-31T23:59:59-05:00"
        )
      ).toBe(false);
    }
  );

  test("rejects impossible date-only values instead of rolling them forward", () => {
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-02-31")).toBe(false);
    expect(serializeDateTimeInZone("2026-02-31", "America/New_York")).toBe("");
    expect(getCalendarDate("2026-02-31", "America/New_York")).toBe("");
    expect(
      buildCalendarRange("2026-02-31", "day", "America/New_York")
    ).toEqual({ start: "", end: "" });
  });

  test("compares instants numerically instead of comparing offset strings", () => {
    expect(
      isInstantInRange(
        "2025-12-31T13:30:00Z",
        "2026-01-01T00:00:00+10:30",
        "2026-01-01T23:59:59+10:30"
      )
    ).toBe(true);
  });

  test("checks future events as instants rather than UTC-derived date text", () => {
    const now = "2025-12-31T13:59:00Z";

    expect(isFutureInstant("2026-01-01T00:30:00+10:30", now)).toBe(true);
    expect(isFutureInstant("2026-01-01T00:00:00+10:30", now)).toBe(false);
  });
});
