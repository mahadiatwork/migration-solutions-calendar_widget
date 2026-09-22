import {
  clearPicklistConfigCache,
  fetchPicklistConfig,
  getDurationOptionsFromConfig,
  getRegardingOptionsFromConfig,
  getResultOptionsFromConfig,
  getTypeOptionsFromConfig,
} from "./picklistConfigService";

describe("picklistConfigService", () => {
  let consoleInfo;
  let consoleWarn;

  beforeEach(() => {
    clearPicklistConfigCache();
    consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfo.mockRestore();
    consoleWarn.mockRestore();
    delete window.ZOHO;
  });

  test("groups active CRM records by category and Sort_Order", async () => {
    window.ZOHO = {
      CRM: {
        API: {
          getAllRecords: jest.fn().mockResolvedValue({
            data: [
              {
                Name: "Appointment result 2",
                Category: "Result",
                Parent_Type: "Appointment",
                Sort_Order: 20,
                Active: true,
              },
              {
                Name: "Appointment result 1",
                Category: "Result",
                Parent_Type: "Appointment",
                Sort_Order: 10,
                Active: true,
              },
              {
                Name: "Appointment Test",
                Category: "Regarding",
                Parent_Type: "Appointment",
                Sort_Order: 10,
                Active: true,
              },
              {
                Name: "Appointment Type Test",
                Category: "Type",
                Parent_Type: null,
                Sort_Order: 30,
                Active: true,
              },
              {
                Name: "45",
                Category: "Duration",
                Parent_Type: null,
                Sort_Order: 10,
                Active: true,
              },
              {
                Name: "Hidden",
                Category: "Type",
                Parent_Type: null,
                Sort_Order: 20,
                Active: false,
              },
            ],
            info: { more_records: false },
          }),
        },
      },
    };

    const config = await fetchPicklistConfig();

    expect(getTypeOptionsFromConfig(config)).toEqual(["Appointment Type Test"]);
    expect(config.typeResources).toEqual({ "Appointment Type Test": 3 });
    expect(getResultOptionsFromConfig("Appointment", config)).toEqual([
      "Appointment result 1",
      "Appointment result 2",
    ]);
    expect(getRegardingOptionsFromConfig("Appointment", config)).toEqual([
      "Appointment Test",
    ]);
    expect(getDurationOptionsFromConfig(config)).toEqual([45]);
    expect(config._source).toBe("custom_module");
  });

  test("uses the calendar widget's original values when CRM is unavailable", async () => {
    delete window.ZOHO;

    const config = await fetchPicklistConfig();

    expect(getTypeOptionsFromConfig(config)).toEqual([
      "Meeting",
      "To-Do",
      "Appointment",
      "Boardroom",
      "Call Billing",
      "Email Billing",
      "Initial Consultation",
      "Call",
      "Mail",
      "Meeting Billing",
      "Personal Activity",
      "Room 1",
      "Room 2",
      "Room 3",
      "To Do Billing",
      "Vacation",
    ]);
    expect(getDurationOptionsFromConfig(config)).toHaveLength(24);
    expect(config._source).toBe("fallback");
  });
});
