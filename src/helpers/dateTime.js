import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXPLICIT_ZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const API_DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

export function getDeviceTimeZone() {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) return resolved;
  } catch {
    // Fall through to Day.js' Intl-backed guess.
  }

  return dayjs.tz.guess() || "UTC";
}

export function isDateOnly(value) {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const parsedDate = dayjs.utc(value);
  return parsedDate.isValid() && parsedDate.format("YYYY-MM-DD") === value;
}

function parseInTimeZone(value, timeZone) {
  if (
    value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value === "string" &&
      DATE_ONLY_PATTERN.test(value) &&
      !isDateOnly(value))
  ) {
    return null;
  }

  if (
    typeof value === "string" &&
    !isDateOnly(value) &&
    !EXPLICIT_ZONE_PATTERN.test(value)
  ) {
    return dayjs.tz(value, timeZone);
  }

  return dayjs(value).tz(timeZone);
}

export function serializeDateTimeInZone(
  value,
  timeZone = getDeviceTimeZone()
) {
  if (isDateOnly(value)) return value;

  const zonedValue = parseInTimeZone(value, timeZone);
  return zonedValue?.isValid() ? zonedValue.format(API_DATE_TIME_FORMAT) : "";
}

export function formatInstantForDateTimeInput(
  value,
  timeZone = getDeviceTimeZone()
) {
  if (isDateOnly(value)) return value;

  const zonedValue = parseInTimeZone(value, timeZone);
  return zonedValue?.isValid() ? zonedValue.format("YYYY-MM-DDTHH:mm") : "";
}

export function getCalendarDate(value, timeZone = getDeviceTimeZone()) {
  if (isDateOnly(value)) return value;

  const zonedValue = parseInTimeZone(value, timeZone);
  return zonedValue?.isValid() ? zonedValue.format("YYYY-MM-DD") : "";
}

export function buildCalendarRange(
  anchor,
  view,
  timeZone = getDeviceTimeZone()
) {
  const anchorDate = getCalendarDate(anchor, timeZone);
  if (!anchorDate) return { start: "", end: "" };

  const calendarDate = dayjs.utc(anchorDate);
  let startDate = anchorDate;
  let endDate = anchorDate;

  if (view === "month") {
    startDate = calendarDate.startOf("month").format("YYYY-MM-DD");
    endDate = calendarDate.endOf("month").format("YYYY-MM-DD");
  } else if (view === "week") {
    // The calendar's week view is configured as a Monday-Friday work week.
    endDate = calendarDate.add(4, "day").format("YYYY-MM-DD");
  }

  // Parse the two calendar dates independently so each boundary receives the
  // offset in effect on that date (including a DST change within the range).
  return {
    start: dayjs
      .tz(`${startDate}T00:00:00`, timeZone)
      .format(API_DATE_TIME_FORMAT),
    end: dayjs
      .tz(`${endDate}T23:59:59`, timeZone)
      .format(API_DATE_TIME_FORMAT),
  };
}

export function toEpochMilliseconds(value) {
  if (
    value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value === "string" &&
      DATE_ONLY_PATTERN.test(value) &&
      !isDateOnly(value))
  ) {
    return Number.NaN;
  }

  const epoch = dayjs(value).valueOf();
  return Number.isFinite(epoch) ? epoch : Number.NaN;
}

export function isInstantInRange(value, start, end) {
  const valueTime = toEpochMilliseconds(value);
  const startTime = toEpochMilliseconds(start);
  const endTime = toEpochMilliseconds(end);

  return (
    Number.isFinite(valueTime) &&
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    valueTime >= startTime &&
    valueTime <= endTime
  );
}

export function isFutureInstant(value, now = Date.now()) {
  const valueTime = toEpochMilliseconds(value);
  const nowTime =
    typeof now === "number" ? now : toEpochMilliseconds(now);
  return (
    Number.isFinite(valueTime) &&
    Number.isFinite(nowTime) &&
    valueTime > nowTime
  );
}
