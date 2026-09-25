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
                Category: "History Result",
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
                Category: "History Type",
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
                Name: "Meeting Type Test",
                Category: "Type",
                Parent_Type: null,
                Sort_Order: 40,
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

    expect(getTypeOptionsFromConfig(config)).toEqual([
      "Appointment Type Test",
      "Meeting Type Test",
    ]);
    expect(config.typeResources).toEqual({
      "Appointment Type Test": 3,
      "Meeting Type Test": 4,
    });
    expect(getResultOptionsFromConfig("Appointment", config)).toEqual([
      "Appointment result 1",
      "Appointment result 2",
    ]);
    expect(getRegardingOptionsFromConfig("Appointment", config)).toEqual([
      "Appointment Test",
    ]);
    expect(getDurationOptionsFromConfig(config)).toEqual([45]);
    expect(getResultOptionsFromConfig("Missing", config)).toEqual([]);
    expect(getRegardingOptionsFromConfig("Missing", config)).toEqual([]);
    expect(config._source).toBe("custom_module");

    expect(
      getResultOptionsFromConfig("Appointment", {
        _source: "custom_module",
        results: { Appointment: [], _default: ["Default"] },
      })
    ).toEqual([]);
    expect(
      getRegardingOptionsFromConfig("Appointment", {
        _source: "custom_module",
        regarding: { Appointment: [], _default: ["Default"] },
      })
    ).toEqual([]);
  });

  test("keeps a reached module authoritative when it has no active rows", async () => {
    window.ZOHO = {
      CRM: {
        API: {
          getAllRecords: jest.fn().mockResolvedValue({
            data: [
              {
                Name: "Hidden",
                Category: "Type",
                Parent_Type: null,
                Sort_Order: 10,
                Active: false,
              },
            ],
            info: { more_records: false },
          }),
        },
      },
    };

    const config = await fetchPicklistConfig();

    expect(config._source).toBe("custom_module");
    expect(getTypeOptionsFromConfig(config)).toEqual([]);
    expect(getResultOptionsFromConfig("Appointment", config)).toEqual([]);
    expect(getRegardingOptionsFromConfig("Appointment", config)).toEqual([]);
    expect(getDurationOptionsFromConfig(config)).toEqual([]);
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

  test("retries the internal module name after a nested SDK error", async () => {
    const getAllRecords = jest.fn(({ Entity }) =>
      Entity === "Widget_Picklist_Config"
        ? Promise.resolve({
            data: [{ code: "INVALID_MODULE", status: "error" }],
          })
        : Promise.resolve({
            data: [
              {
                Name: "Alias Type",
                Category: "Type",
                Active: true,
              },
            ],
          })
    );
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config.types).toEqual(["Alias Type"]);
    expect(getAllRecords.mock.calls.map(([request]) => request.Entity)).toEqual([
      "Widget_Picklist_Config",
      "CustomModule15",
    ]);
  });

  test("does not accept records from an errored SDK wrapper", async () => {
    const getAllRecords = jest.fn(({ Entity }) =>
      Entity === "Widget_Picklist_Config"
        ? Promise.resolve({
            data: {
              code: "RATE_LIMIT_EXCEEDED",
              status: "error",
              data: [
                {
                  Name: "Must not leak",
                  Category: "Type",
                  Active: true,
                },
              ],
            },
          })
        : Promise.resolve({ data: [] })
    );
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config).toMatchObject({ _source: "custom_module", types: [] });
    expect(getAllRecords).toHaveBeenCalledTimes(2);
  });

  test("keeps earlier pages when NO_DATA terminates SDK pagination", async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      Name: `Configured ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const getAllRecords = jest
      .fn()
      .mockResolvedValueOnce({
        data: firstPage,
        info: { more_records: true },
      })
      .mockResolvedValueOnce({ code: "NO_DATA", status: "error" });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config.types).toHaveLength(200);
    expect(config.types[0]).toBe("Configured 0");
  });

  test("does not cache a malformed SDK response as authoritative empty", async () => {
    const getAllRecords = jest.fn().mockResolvedValue(undefined);
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config._source).toBe("fallback");
    expect(getAllRecords).toHaveBeenCalledTimes(2);
  });

  test("treats an explicit COQL NO_DATA response as authoritative empty", async () => {
    const invoke = jest.fn().mockResolvedValue({
      details: {
        statusMessage: JSON.stringify({
          code: "NO_DATA",
          status: "error",
        }),
      },
    });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const config = await fetchPicklistConfig();

    expect(config).toMatchObject({ _source: "custom_module", types: [] });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("continues SDK pagination beyond ten pages while more_records is true", async () => {
    const getAllRecords = jest.fn(({ page }) => {
      const records = Array.from({ length: 200 }, (_, index) => ({
        Name: `Page ${page} option ${index}`,
        Category: "Type",
        Sort_Order: (page - 1) * 200 + index + 1,
        Active: true,
      }));
      return Promise.resolve({
        data: records,
        info: { more_records: page < 11 },
      });
    });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config.types).toHaveLength(2200);
    expect(getAllRecords).toHaveBeenCalledTimes(11);
  });

  test("uses wrapped SDK records and pagination info", async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      Name: `Wrapped ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const getAllRecords = jest
      .fn()
      .mockResolvedValueOnce({
        data: { data: firstPage, info: { more_records: true } },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              Name: "Wrapped final",
              Category: "Type",
              Sort_Order: 201,
              Active: true,
            },
          ],
          info: { more_records: false },
        },
      });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config.types).toHaveLength(201);
    expect(config.types[200]).toBe("Wrapped final");
    expect(getAllRecords).toHaveBeenCalledTimes(2);
  });

  test("rejects repeating SDK pages instead of caching a partial config", async () => {
    const repeatedPage = Array.from({ length: 200 }, (_, index) => ({
      Name: `Repeated ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const getAllRecords = jest.fn().mockResolvedValue({
      data: repeatedPage,
      info: { more_records: true },
    });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const config = await fetchPicklistConfig();

    expect(config._source).toBe("fallback");
    expect(getAllRecords).toHaveBeenCalledTimes(4);
  });

  test("paginates COQL past the first 2000 records", async () => {
    const firstPage = Array.from({ length: 2000 }, (_, index) => ({
      Name: `COQL ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        details: { statusMessage: JSON.stringify({ data: firstPage }) },
      })
      .mockResolvedValueOnce({
        details: {
          statusMessage: JSON.stringify({
            data: [
              {
                Name: "COQL final",
                Category: "Type",
                Sort_Order: 2001,
                Active: true,
              },
            ],
          }),
        },
      });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const config = await fetchPicklistConfig();

    expect(config.types).toHaveLength(2001);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1].parameters.select_query).toContain(
      "LIMIT 2000, 2000"
    );
  });

  test("continues short COQL pages using parsed, details, and top-level info", async () => {
    const record = (name, sortOrder) => ({
      Name: name,
      Category: "Type",
      Sort_Order: sortOrder,
      Active: true,
    });
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        details: {
          statusMessage: JSON.stringify({
            data: [record("Parsed page", 1)],
            info: { more_records: true },
          }),
        },
      })
      .mockResolvedValueOnce({
        details: {
          data: [record("Details page", 2)],
          info: { more_records: "true" },
        },
      })
      .mockResolvedValueOnce({
        data: [record("Top-level page", 3)],
        info: { more_records: 1 },
      })
      .mockResolvedValueOnce({
        data: [record("Final page", 4)],
        info: { more_records: false },
      });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const config = await fetchPicklistConfig();

    expect(config.types).toEqual([
      "Parsed page",
      "Details page",
      "Top-level page",
      "Final page",
    ]);
    expect(invoke).toHaveBeenCalledTimes(4);
    const queries = invoke.mock.calls.map(
      ([, request]) => request.parameters.select_query
    );
    expect(queries[0]).toContain(
      "order by Sort_Order asc LIMIT 0, 2000"
    );
    expect(queries[1]).toContain("LIMIT 1, 2000");
    expect(queries[2]).toContain("LIMIT 2, 2000");
    expect(queries[3]).toContain("LIMIT 3, 2000");
  });
});
