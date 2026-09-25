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

export const shouldOfferManualOther = (config, configuredOptions = []) =>
  config?._source !== "custom_module" || configuredOptions.includes("Other");
