// Function to check if a date falls within a specific range
export const isDateInRange = (date, rangeType) => {
  const today = new Date();
  const targetDate = new Date(date);
  let startDate, endDate;

  switch (rangeType) {
    case "Current Week":
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay()); // Start of the week (Sunday)
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // End of the week (Saturday)
      break;
    case "Current Month":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "Last 7 Days":
      startDate = new Date();
      startDate.setDate(today.getDate() - 7);
      endDate = today;
      break;
    case "Last 30 Days":
      startDate = new Date();
      startDate.setDate(today.getDate() - 30);
      endDate = today;
      break;
    case "Last 90 Days":
      startDate = new Date();
      startDate.setDate(today.getDate() - 90);
      endDate = today;
      break;
    case "Next Week":
      startDate = new Date();
      startDate.setDate(today.getDate() + (7 - today.getDay())); // Start of next week
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // End of next week
      break;
    case "Default":
    default:
      startDate = new Date();
      startDate.setDate(today.getDate() - 14); // Last 14 days
      endDate = null;
      break;
  }

  return targetDate >= startDate && targetDate <= endDate;
};



export const typeOptions = [
  "Call Attempted",
  "Call Completed",
  "Call Left Message",
  "Call Received",
  "Meeting Held",
  "Meeting Not Held",
  "To-do Done",
  "To-do Not Done",
  "Appointment Completed",
  "Appointment Not Completed",
  "Boardroom - Completed",
  "Boardroom - Not Completed",
  "Call Billing - Completed",
  "Initial Consultation - Completed",
  "Initial Consultation - Not Completed",
  "Mail - Completed",
  "Mail - Not Completed",
  "Meeting Billing - Completed",
  "Meeting Billing - Not Completed",
  "Personal Activity - Completed",
  "Personal Activity - Not Completed",
  "Note",
  "Mail Received",
  "Mail Sent",
  "Email Received",
  "Courier Sent",
  "Email Sent",
  "Payment Received",
  "Room 1 - Completed",
  "Room 1 - Not Completed",
  "Room 2 - Completed",
  "Room 2 - Not Completed",
  "Room 3 - Completed",
  "Room 3 - Not Completed",
  "To Do Billing - Completed",
  "To Do Billing - Not Completed",
  "Vacation - Completed",
  "Vacation - Not Completed",
  "Vacation Cancelled",
  "Attachment",
  "E-mail Attachment",
];

export const activityResultMapping = {
  "Call": ["Call Attempted", "Call Completed", "Call Left Message", "Call Received"],
  "Meeting": ["Meeting Held", "Meeting Not Held"],
  "To-Do": ["To-do Done", "To-do Not Done"],
  "Appointment": ["Appointment Completed", "Appointment Not Completed"],
  "Boardroom": ["Boardroom - Completed", "Boardroom - Not Completed"],
  "Call Billing": ["Call Billing - Completed", "Call Billing - Not Completed"],
  "Email Billing": ["Email Billing - Completed", "Email Billing - Not Completed"],
  "Initial Consultation": ["Initial Consultation - Completed", "Initial Consultation - Not Completed"],
  "Mail": ["Mail - Completed", "Mail - Not Completed"],
  "Meeting Billing": ["Meeting Billing - Completed", "Meeting Billing - Not Completed"],
  "Personal Activity": [
    "Personal Activity - Completed", "Personal Activity - Not Completed",
    "Note", "Mail Received", "Mail Sent", "Email Received", "Courier Sent", "Email Sent", "Payment Received"
  ],
  "Room 1": ["Room 1 - Completed", "Room 1 - Not Completed"],
  "Room 2": ["Room 2 - Completed", "Room 2 - Not Completed"],
  "Room 3": ["Room 3 - Completed", "Room 3 - Not Completed"],
  "To Do Billing": ["To Do Billing - Completed", "To Do Billing - Not Completed"],
  "Vacation": ["Vacation - Completed", "Vacation - Not Completed", "Vacation Cancelled"],
  "Other": ["Attachment", "E-mail Attachment", "E-mail Auto Attached", "E-mail Sent"]
};

export const durationOptions = Array.from(
  { length: 24 },
  (_, index) => (index + 1) * 10
);

export const getResultBasedOnActivityType2 = (activityType, config = null) => {
  if (config?._source === "custom_module") {
    const results = config.results || {};
    if (Object.prototype.hasOwnProperty.call(results, activityType)) {
      return Array.isArray(results[activityType]) ? results[activityType] : [];
    }
    if (Object.prototype.hasOwnProperty.call(results, "_default")) {
      return Array.isArray(results._default) ? results._default : [];
    }
    return [];
  }
  return activityResultMapping[activityType] || ["Note"];
};

export const getResultBasedOnActivityType = (activityType, config = null) => {
  const configuredDefault = getResultBasedOnActivityType2(activityType, config)[0];
  return configuredDefault || (config?._source === "custom_module" ? "" : "Note");
};


export const getRegardingOptions = (type, existingValue, config = null) => {
  if (config?._source === "custom_module") {
    const regarding = config.regarding || {};
    const configuredOptions = Object.prototype.hasOwnProperty.call(regarding, type)
      ? (Array.isArray(regarding[type]) ? regarding[type] : [])
      : Object.prototype.hasOwnProperty.call(regarding, "_default")
        ? (Array.isArray(regarding._default) ? regarding._default : [])
        : [];
    const options = [...configuredOptions];
    const safeExistingValue =
      typeof existingValue === "string" ? existingValue : "";
    if (
      safeExistingValue.trim() !== "" &&
      !options.includes(safeExistingValue)
    ) {
      options.unshift(safeExistingValue);
    }
    return options;
  }

  const options = {
    Call: [
      "2nd Followup", "3rd Followup", "4th Followup", "5th Followup",
      "Cold call", "Confirm appointment", "Discuss legal points", "Follow up",
      "New Client", "Nomination and Visa Lodgement", "Payment Made?",
      "Returning call", "Schedule a meeting"
    ],
    Meeting: [
      "Hourly Consult $220", "Initial Consultation Fee $165.00",
      "No appointments today (check with Mark)", "No Appointments Tonight",
      "No clients or appointments 4.00-5.00pm"
    ],
    "To-Do": [
      "Assemble catalogs", "DEADLINE REMINDER", "Deadline to lodge app",
      "Deadline to provide additional docu", "Deadline to respond",
      "DEADLINE TODAY - Email received", "Make travel arrangements",
      "Send contract", "Send follow-up letter", "Send literature",
      "Send proposal", "Send quote", "Send SMS reminder"
    ],
    Appointment: [
      "Appointment", "Call", "Dentist Appointment", "Doctor Appointment",
      "Eye Doctor Appointment", "Make Appointment", "Meeting",
      "Parent-Teacher Conference", "Shopping", "Time Off", "Workout"
    ]
  };

  let predefinedOptions = options[type] || ["General"];

  // Only add existingValue if it's not empty and not already in the options
  const safeExistingValue =
    typeof existingValue === "string" ? existingValue : "";
  if (
    safeExistingValue.trim() !== "" &&
    !predefinedOptions.includes(safeExistingValue)
  ) {
    predefinedOptions = [safeExistingValue, ...predefinedOptions];
  }

  return predefinedOptions;
};


export const reminderMapping = {
  "120 minutes before": 120,
  "60 minutes before": 60,
  "30 minutes before": 30,
  "5 minutes before": 5,
  "None": 0,
};


export const activityType = [
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
