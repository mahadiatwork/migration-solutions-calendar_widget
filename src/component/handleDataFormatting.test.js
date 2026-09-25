import { transformFormSubmission } from "./handleDataFormatting";

const formData = (duration) => ({
  start: "2026-01-02T10:00:00Z",
  end: "2026-01-02T11:00:00Z",
  startTime: "2026-01-02T10:00:00Z",
  endTime: "2026-01-02T11:00:00Z",
  duration,
  scheduleFor: { id: "owner-1" },
  scheduledWith: [],
  occurrence: "once",
});

test("omits Duration_Min when the configured Duration picklist is empty", () => {
  expect(transformFormSubmission(formData(""))).not.toHaveProperty(
    "Duration_Min"
  );
});

test("preserves a configured zero-minute duration", () => {
  expect(transformFormSubmission(formData(0))).toMatchObject({
    Duration_Min: "0",
  });
});
