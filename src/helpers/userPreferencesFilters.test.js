describe("Calendar user preference isolation", () => {
  let api;

  beforeEach(() => {
    jest.resetModules();
    api = {
      searchRecord: jest.fn(),
      updateRecord: jest.fn().mockResolvedValue({
        data: [{ code: "SUCCESS" }],
      }),
      insertRecord: jest.fn().mockResolvedValue({
        data: [{ code: "SUCCESS" }],
      }),
    };
    // The helper captures ZOHO when it is imported.
    window.ZOHO = { CRM: { API: api } };
  });

  afterEach(() => {
    delete window.ZOHO;
  });

  test("loads the dedicated Calendar row when All Activity is returned first", async () => {
    const calendarPreset = {
      name: "My meetings",
      activityTypeFilter: ["Meeting"],
    };
    const calendarLatest = {
      priorityFilter: ["High"],
      activityTypeFilter: ["Meeting"],
      userFilter: ["user-2"],
    };
    api.searchRecord.mockResolvedValue({
      data: [
        {
          id: "all-activity-preference",
          Name: "All Activity Preference",
          Saved_Filters: JSON.stringify([{ name: "My calls" }]),
          Latest_Filter: JSON.stringify({ type: ["Call"] }),
        },
        {
          id: "calendar-preference",
          Name: "Calendar Preference",
          Saved_Filters: JSON.stringify([calendarPreset]),
          Latest_Filter: JSON.stringify(calendarLatest),
        },
      ],
    });
    const { loadUserPreferences } = require("./userPreferencesFilters");

    await expect(loadUserPreferences("user-1")).resolves.toEqual({
      savedFilters: [calendarPreset],
      latestFilter: calendarLatest,
    });
  });

  test("reads only Calendar data from the legacy shared row", async () => {
    const calendarPreset = {
      name: "My meetings",
      activityTypeFilter: ["Meeting"],
    };
    const allActivityPreset = {
      name: "Urgent tasks",
      widget: "allActivity",
      filters: { priority: ["High"] },
    };
    const calendarLatest = {
      priorityFilter: ["Low"],
      activityTypeFilter: ["Call"],
      userFilter: [],
    };
    api.searchRecord.mockResolvedValue({
      data: [
        {
          id: "legacy-preference",
          Name: "A User - Preference",
          Saved_Filters: JSON.stringify([
            calendarPreset,
            allActivityPreset,
          ]),
          Latest_Filter: JSON.stringify({
            ...calendarLatest,
            allActivity: { type: ["Meeting"] },
          }),
        },
      ],
    });
    const { loadUserPreferences } = require("./userPreferencesFilters");

    await expect(loadUserPreferences("user-1")).resolves.toEqual({
      savedFilters: [calendarPreset],
      latestFilter: calendarLatest,
    });
  });

  test("updates only the dedicated Calendar row with a direct preset array", async () => {
    const newCalendarPreset = {
      name: "New Calendar",
      priorityFilter: ["High"],
    };
    api.searchRecord.mockResolvedValue({
      data: [
        { id: "all-activity-preference", Name: "All Activity Preference" },
        { id: "calendar-preference", Name: "Calendar Preference" },
        { id: "legacy-preference", Name: "A User - Preference" },
      ],
    });
    const { saveFiltersToUserPreferences } = require("./userPreferencesFilters");

    await saveFiltersToUserPreferences([newCalendarPreset], "user-1");

    expect(api.updateRecord).toHaveBeenCalledWith({
      Entity: "User_Preferences",
      RecordID: "calendar-preference",
      APIData: {
        id: "calendar-preference",
        Saved_Filters: JSON.stringify([newCalendarPreset]),
      },
    });
    expect(api.insertRecord).not.toHaveBeenCalled();
  });

  test("creates a Calendar row without modifying legacy or All Activity rows", async () => {
    const newCalendarPreset = {
      name: "New Calendar",
      priorityFilter: ["High"],
    };
    const legacyLatest = {
      priorityFilter: ["Low"],
      activityTypeFilter: ["Call"],
      userFilter: ["user-2"],
    };
    api.searchRecord.mockResolvedValue({
      data: [
        { id: "all-activity-preference", Name: "All Activity Preference" },
        {
          id: "legacy-preference",
          Name: "A User - Preference",
          Latest_Filter: JSON.stringify({
            ...legacyLatest,
            allActivity: { type: ["Call"] },
          }),
        },
      ],
    });
    const { saveFiltersToUserPreferences } = require("./userPreferencesFilters");

    await saveFiltersToUserPreferences([newCalendarPreset], "user-1");

    expect(api.updateRecord).not.toHaveBeenCalled();
    expect(api.insertRecord).toHaveBeenCalledWith({
      Entity: "User_Preferences",
      APIData: {
        Name: "Calendar Preference",
        Preference_Of: "user-1",
        Saved_Filters: JSON.stringify([newCalendarPreset]),
        Latest_Filter: JSON.stringify(legacyLatest),
      },
    });
  });

  test("updates latest filters only on the dedicated Calendar row", async () => {
    const calendarLatest = {
      priorityFilter: ["High"],
      activityTypeFilter: ["Meeting"],
      userFilter: ["user-2"],
    };
    api.searchRecord.mockResolvedValue({
      data: [
        { id: "all-activity-preference", Name: "All Activity Preference" },
        { id: "calendar-preference", Name: "Calendar Preference" },
      ],
    });
    const {
      persistLatestFilterToUserPreferences,
    } = require("./userPreferencesFilters");

    await persistLatestFilterToUserPreferences("user-1", calendarLatest);

    expect(api.updateRecord).toHaveBeenCalledWith({
      Entity: "User_Preferences",
      RecordID: "calendar-preference",
      APIData: {
        id: "calendar-preference",
        Latest_Filter: JSON.stringify(calendarLatest),
      },
    });
    expect(api.insertRecord).not.toHaveBeenCalled();
  });

  test("latest-filter migration carries legacy Calendar presets into the new row", async () => {
    const calendarPreset = {
      name: "My meetings",
      activityTypeFilter: ["Meeting"],
    };
    const allActivityPreset = {
      name: "Urgent tasks",
      widget: "allActivity",
      filters: { priority: ["High"] },
    };
    const calendarLatest = {
      priorityFilter: ["High"],
      activityTypeFilter: ["Meeting"],
      userFilter: [],
    };
    api.searchRecord.mockResolvedValue({
      data: [
        { id: "all-activity-preference", Name: "All Activity Preference" },
        {
          id: "legacy-preference",
          Name: "A User - Preference",
          Saved_Filters: JSON.stringify([
            calendarPreset,
            allActivityPreset,
          ]),
        },
      ],
    });
    const {
      persistLatestFilterToUserPreferences,
    } = require("./userPreferencesFilters");

    await persistLatestFilterToUserPreferences("user-1", calendarLatest);

    expect(api.updateRecord).not.toHaveBeenCalled();
    expect(api.insertRecord).toHaveBeenCalledWith({
      Entity: "User_Preferences",
      APIData: {
        Name: "Calendar Preference",
        Preference_Of: "user-1",
        Saved_Filters: JSON.stringify([calendarPreset]),
        Latest_Filter: JSON.stringify(calendarLatest),
      },
    });
  });
});
