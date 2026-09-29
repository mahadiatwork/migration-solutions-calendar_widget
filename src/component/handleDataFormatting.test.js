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

test("saves the same instant with the device zone's date-specific offset", () => {
  expect(
    transformFormSubmission(formData(30), null, "Australia/Adelaide")
  ).toMatchObject({
    Start_DateTime: "2026-01-02T20:30:00+10:30",
    End_DateTime: "2026-01-02T21:30:00+10:30",
  });
});

test.each(["Send_Reminders", "Send_Invites"])(
  "%s keeps the correct instant and offset across spring-forward",
  (notificationFlag) => {
    const transformed = transformFormSubmission(
      {
        ...formData(30),
        start: "2026-03-08T03:30:00-04:00",
        end: "2026-03-08T04:00:00-04:00",
        Reminder_Text: "60 minutes before",
        [notificationFlag]: true,
      },
      null,
      "America/New_York"
    );

    expect(transformed.Remind_At).toBe("2026-03-08T01:30:00-05:00");
    expect(transformed.User_Reminder).toBe("2026-03-08T01:30:00-05:00");
    expect(Date.parse(transformed.Remind_At)).toBe(
      Date.parse("2026-03-08T03:30:00-04:00") - 60 * 60 * 1000
    );
  }
);
