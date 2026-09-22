import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);


const activityType = [
  { type: "Meeting", resource: 1 },
  { type: "To-Do", resource: 2 },
  { type: "Appointment", resource: 3 },
  { type: "Boardroom", resource: 4 },
  { type: "Call Billing", resource: 5 },
  { type: "Email Billing", resource: 6 },
  { type: "Initial Consultation", resource: 7 },
  { type: "Call", resource: 8 },
  { type: "Mail", resource: 9 },
  { type: "Meeting Billing", resource: 10 },
  { type: "Personal Activity", resource: 11 },
  { type: "Room 1", resource: 12 },
  { type: "Room 2", resource: 13 },
  { type: "Room 3", resource: 14 },
  { type: "To Do Billing", resource: 15 },
  { type: "Vacation", resource: 16 },
];

function getResourceByType(type) {
  const match = activityType.find(item => item.type === type);
  return match ? match.resource : null;
}

export function transformFormSubmission(data, individualParticipant = null) {
  const localTimezone = dayjs.tz.guess();

  const transformScheduleWithToParticipants = (scheduleWith) => {
    return scheduleWith.map((contact) => ({
      Full_Name: contact?.Full_Name || null,
      type: "contact",
      participant: contact?.participant ?? contact?.id ?? null,
      status: contact.status,
    }));
  };

  const customEndTime =
    data.noEndDate && data.occurrence === "daily"
      ? dayjs(data?.startTime).add(70, "day").format("YYYY-MM-DD")
      : data?.noEndDate && data?.occurrence === "weekly"
        ? dayjs(data?.startTime).add(10, "month").format("YYYY-MM-DD")
        : data?.noEndDate && data?.occurrence === "monthly"
          ? dayjs(data?.startTime).add(12, "month").format("YYYY-MM-DD")
          : data?.noEndDate && data?.occurrence === "yearly"
            ? dayjs(data?.startTime).add(2, "year").format("YYYY-MM-DD")
            : dayjs(data?.endTime).format("YYYY-MM-DD");

  const participants = individualParticipant
    ? [{
        Full_Name: individualParticipant?.Full_Name || null,
        type: "contact",
        participant: individualParticipant?.participant || null,
        status: individualParticipant.status,
      }]
    : transformScheduleWithToParticipants(data?.scheduledWith || []);

  let transformedData = {
    ...data,
    Event_Title: data?.title,
    Start_DateTime: dayjs(data?.start)
      .tz(localTimezone)
      .format("YYYY-MM-DDTHH:mm:ssZ"),
    End_DateTime: dayjs(data?.end)
      .tz(localTimezone)
      .format("YYYY-MM-DDTHH:mm:ssZ"),
    Description: data?.Description,
    Event_Priority: data?.priority,
    Owner: {
      id: data.scheduleFor?.id,
    },
    $send_notification: data?.send_notification,
    se_module: "Accounts",
    Participants: participants,
    Duration_Min: data.duration.toString(),
    Venue: data.location,
    Colour: data.color,
    Send_Reminders: data.Send_Reminders
  };

  if (data.associateWith?.id) {
    transformedData.What_Id = {
      id: data.associateWith.id,
    };
  }

  const resourceValue = getResourceByType(data.Type_of_Activity);
  // Configured Type labels can be renamed. In that case the legacy name map
  // no longer matches, so retain the resource resolved by the form's ordered
  // config options instead of dropping it from the payload.
  transformedData.resource = resourceValue ?? data.resource ?? null;

  const startTime = dayjs(data.start).tz(localTimezone);

  if (data.Send_Reminders) {
    let modifiedReminderDate = null;

    if (data.Reminder_Text === "At time of meeting") {
      modifiedReminderDate = startTime.format("YYYY-MM-DDTHH:mm:ssZ");
    } else {
      const offsetMin = parseInt(data?.Reminder_Text.split(" ")[0], 10);
      modifiedReminderDate = startTime
        .subtract(offsetMin, "minute")
        .format("YYYY-MM-DDTHH:mm:ssZ");
    }

    transformedData.Remind_At = modifiedReminderDate;
    transformedData.User_Reminder = modifiedReminderDate;
    transformedData.Send_Reminders = true;
  }

  if (data.Send_Invites) {
    let inviteReminderDate = null;

    if (data.Reminder_Text === "At time of meeting") {
      inviteReminderDate = startTime.format("YYYY-MM-DDTHH:mm:ssZ");
    } else {
      const offsetMin = parseInt(data?.Reminder_Text.split(" ")[0], 10);
      inviteReminderDate = startTime
        .subtract(offsetMin, "minute")
        .format("YYYY-MM-DDTHH:mm:ssZ");
    }

    transformedData.Remind_At = inviteReminderDate;
    transformedData.User_Reminder = inviteReminderDate;
    transformedData.send_notification = true;
  }

  // Recurring Activity
  const validOccurrences = ["daily", "weekly", "monthly", "yearly"];
  if (
    typeof data?.occurrence === "string" &&
    validOccurrences.includes(data.occurrence.toLowerCase())
  ) {
    const freq = data.occurrence.toUpperCase();
    const interval = 1;
    const until = dayjs(customEndTime).format("YYYY-MM-DD");
    const dtstart = dayjs(data?.startTime).format("YYYY-MM-DD");
    const byDay = dayjs(data?.startTime).format("dd").toUpperCase();

    let rrule = `FREQ=${freq};INTERVAL=${interval};UNTIL=${until}`;

    if (freq === "WEEKLY") {
      rrule += `;BYDAY=${byDay}`;
    } else if (freq === "MONTHLY") {
      rrule += `;BYMONTHDAY=${dayjs(data?.startTime).date()}`;
    } else if (freq === "YEARLY") {
      rrule += `;BYMONTH=${dayjs(data?.startTime).month() + 1};BYMONTHDAY=${dayjs(data?.startTime).date()}`;
    }

    rrule += `;DTSTART=${dtstart}`;
    transformedData.Recurring_Activity = { RRULE: rrule };
  }

  // Cleanup
  if (
    transformedData.Remind_At == null ||
    transformedData.Remind_At === "Invalid Date" ||
    transformedData.Remind_At === "" ||
    transformedData.Reminder_Text === ""
  ) {
    delete transformedData.Remind_At;
    delete transformedData.Reminder_Text;
  }

  Object.keys(transformedData).forEach((key) => {
    if (transformedData[key] === null || transformedData[key] === undefined) {
      delete transformedData[key];
    }
  });

  return transformedData;
}


