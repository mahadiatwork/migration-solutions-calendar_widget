/**
 * Load and save Calendar filters in the User_Preferences module.
 * Calendar and All Activity use separate records for each user, distinguished
 * by Name, so neither widget reads or overwrites the other's filters.
 */

const ZOHO = typeof window !== "undefined" ? window.ZOHO : null;
const MODULE = "User_Preferences";
const FIELD_USER = "Preference_Of";
const FIELD_SAVED_FILTERS = "Saved_Filters";
const FIELD_LATEST_FILTER = "Latest_Filter";
const FIELD_NAME = "Name";
const CALENDAR_RECORD_NAME = "Calendar Preference";
const ALL_ACTIVITY_RECORD_NAME = "All Activity Preference";

const EMPTY_LATEST_FILTER = {
  priorityFilter: [],
  activityTypeFilter: [],
  userFilter: [],
};

function getRecords(response) {
  const records = response?.data ?? response?.details ?? [];
  return Array.isArray(records) ? records : [];
}

function getRecordId(record) {
  return record?.id ?? record?.Id ?? record?.record_id;
}

function findCalendarRecord(records) {
  return records.find(
    (record) => record?.[FIELD_NAME] === CALENDAR_RECORD_NAME
  );
}

function findLegacyRecord(records) {
  return records.find((record) => {
    const name = record?.[FIELD_NAME];
    return (
      typeof name === "string" &&
      name !== CALENDAR_RECORD_NAME &&
      name !== ALL_ACTIVITY_RECORD_NAME &&
      (name === "User - Preference" || name.endsWith(" - Preference"))
    );
  });
}

function parseCalendarSavedFilters(record) {
  try {
    const raw = record?.[FIELD_SAVED_FILTERS];
    const filters = raw ? JSON.parse(raw) : [];
    return Array.isArray(filters)
      ? filters.filter((filter) => filter && !filter.widget)
      : [];
  } catch {
    return [];
  }
}

function normalizeLatestFilter(value) {
  const filter =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    priorityFilter: Array.isArray(filter.priorityFilter)
      ? filter.priorityFilter
      : [],
    activityTypeFilter: Array.isArray(filter.activityTypeFilter)
      ? filter.activityTypeFilter
      : [],
    userFilter: Array.isArray(filter.userFilter) ? filter.userFilter : [],
  };
}

function parseCalendarLatestFilter(record) {
  try {
    const raw = record?.[FIELD_LATEST_FILTER];
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return normalizeLatestFilter(parsed);
  } catch {
    return null;
  }
}

function parseSavedFiltersValue(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed)
    ? parsed.filter((filter) => filter && !filter.widget)
    : [];
}

function searchUserPreferences(userId) {
  return ZOHO.CRM.API.searchRecord({
    Entity: MODULE,
    Type: "criteria",
    Query: `(${FIELD_USER}:equals:${userId})`,
  });
}

/**
 * Load saved and latest Calendar filters for a user. Dedicated Calendar data
 * wins; the former shared row is a read-only fallback during migration.
 * @param {string} userId - Current user id (e.g. loggedInUser.id)
 * @returns {Promise<{ savedFilters: Array, latestFilter: object | null }>}
 */
export function loadUserPreferences(userId) {
  if (!ZOHO?.CRM?.API?.searchRecord || !userId) {
    return Promise.resolve({
      savedFilters: [],
      latestFilter: null,
    });
  }
  return searchUserPreferences(userId)
    .then((response) => {
      const records = getRecords(response);
      const record =
        findCalendarRecord(records) ?? findLegacyRecord(records);
      if (!record) {
        return { savedFilters: [], latestFilter: null };
      }
      return {
        savedFilters: parseCalendarSavedFilters(record),
        latestFilter: parseCalendarLatestFilter(record),
      };
    })
    .catch(() => ({ savedFilters: [], latestFilter: null }));
}

/**
 * Load saved Calendar filters for the current user.
 * @param {string} userId - Current user id (e.g. loggedInUser.id)
 * @returns {Promise<Array>} Resolves to the array of saved filters (or [] on error/empty).
 */
export function loadSavedFiltersFromUserPreferences(userId) {
  return loadUserPreferences(userId).then(({ savedFilters }) => savedFilters);
}

/**
 * Persist the latest Calendar filter to the dedicated Calendar record. When
 * migrating, copy Calendar presets from the old shared record into the new row.
 * @param {string} userId - Current user id
 * @param {object} value - { priorityFilter, activityTypeFilter, userFilter }
 * @returns {Promise<void>}
 */
export function persistLatestFilterToUserPreferences(userId, value) {
  if (!ZOHO?.CRM?.API || !userId) {
    return Promise.resolve();
  }
  const parsedValue = typeof value === "string" ? JSON.parse(value) : value;
  const valueStr = JSON.stringify(
    normalizeLatestFilter(parsedValue || EMPTY_LATEST_FILTER)
  );

  return searchUserPreferences(userId).then((response) => {
    const records = getRecords(response);
    const calendarRecord = findCalendarRecord(records);
    if (calendarRecord) {
      const recordId = getRecordId(calendarRecord);
      if (!recordId) return;
      return ZOHO.CRM.API.updateRecord({
        Entity: MODULE,
        RecordID: String(recordId),
        APIData: {
          id: String(recordId),
          [FIELD_LATEST_FILTER]: valueStr,
        },
      });
    }

    const legacyRecord = findLegacyRecord(records);
    return ZOHO.CRM.API.insertRecord({
      Entity: MODULE,
      APIData: {
        [FIELD_NAME]: CALENDAR_RECORD_NAME,
        [FIELD_USER]: userId,
        [FIELD_SAVED_FILTERS]: JSON.stringify(
          parseCalendarSavedFilters(legacyRecord)
        ),
        [FIELD_LATEST_FILTER]: valueStr,
      },
    });
  });
}

/**
 * Save Calendar presets to the dedicated Calendar record. The legacy shared
 * record and the All Activity record are never updated.
 * @param {Array} filtersArray - Array of filter objects to persist
 * @param {string} userId - Current user id (e.g. loggedInUser.id)
 * @returns {Promise<void>}
 */
export function saveFiltersToUserPreferences(filtersArray, userId) {
  if (!ZOHO?.CRM?.API || !userId) {
    return Promise.reject(new Error("User id required"));
  }
  const value = JSON.stringify(parseSavedFiltersValue(filtersArray));

  return searchUserPreferences(userId)
    .then((response) => {
      const records = getRecords(response);
      const calendarRecord = findCalendarRecord(records);
      if (calendarRecord) {
        const recordId = getRecordId(calendarRecord);
        if (!recordId) {
          return Promise.reject(
            new Error("Calendar preference record has no id")
          );
        }
        return ZOHO.CRM.API.updateRecord({
          Entity: MODULE,
          RecordID: String(recordId),
          APIData: {
            id: String(recordId),
            [FIELD_SAVED_FILTERS]: value,
          },
        }).then((updateResponse) => {
          const code = updateResponse?.data?.[0]?.code;
          if (code && code !== "SUCCESS") {
            const msg =
              updateResponse?.data?.[0]?.details?.message ??
              updateResponse?.data?.[0]?.message ??
              "Update failed";
            return Promise.reject(new Error(msg));
          }
        });
      }

      const legacyLatestFilter = parseCalendarLatestFilter(
        findLegacyRecord(records)
      );
      const apiData = {
        [FIELD_NAME]: CALENDAR_RECORD_NAME,
        [FIELD_USER]: userId,
        [FIELD_SAVED_FILTERS]: value,
      };
      if (legacyLatestFilter) {
        apiData[FIELD_LATEST_FILTER] = JSON.stringify(legacyLatestFilter);
      }

      return ZOHO.CRM.API.insertRecord({
        Entity: MODULE,
        APIData: apiData,
      }).then((insertResponse) => {
        const code = insertResponse?.data?.[0]?.code;
        if (code && code !== "SUCCESS") {
          const msg =
            insertResponse?.data?.[0]?.details?.message ??
            insertResponse?.data?.[0]?.message ??
            "Insert failed";
          return Promise.reject(new Error(msg));
        }
      });
    })
    .catch((err) => {
      const message =
        err?.message ??
        (typeof err?.details === "string" ? err.details : null) ??
        (typeof err === "object" ? JSON.stringify(err) : String(err));
      return Promise.reject(new Error(message || "Failed to save filters"));
    });
}
