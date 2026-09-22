/**
 * Loads the calendar widget's Type, Result, Regarding, and Duration options
 * from Widget_Picklist_Config. The existing in-code values remain the fallback
 * whenever the module is unavailable or has no active records.
 */
import {
  PICKLIST_CATEGORIES,
  PICKLIST_CONFIG_FIELDS,
  PICKLIST_CONFIG_MODULE,
  ZOHO_API_BASE_URL,
  ZOHO_CONNECTION_NAME,
} from "../config/picklistConfig";
import {
  activityResultMapping as defaultResultOptions,
  activityType as defaultActivityTypes,
  durationOptions as defaultDurationOptions,
} from "../component/helperFunction";

const MODULE_API_NAMES = [PICKLIST_CONFIG_MODULE, "CustomModule15"];
const defaultTypeOptions = defaultActivityTypes.map(({ type }) => type);
const defaultResultMapping = Object.fromEntries(
  Object.entries(defaultResultOptions).map(([type, results]) => [
    type,
    results[0],
  ])
);

let cachedConfig = null;
let fetchPromise = null;

const getZoho = () =>
  typeof window !== "undefined" ? window.ZOHO : undefined;

export const fetchPicklistConfig = async () => {
  if (cachedConfig?._source === "custom_module") return cachedConfig;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetchConfig();
  try {
    const config = await fetchPromise;
    // Do not cache fallback data. This lets a later call recover if the first
    // call happened before the embedded Zoho SDK was fully ready.
    if (config?._source === "custom_module") cachedConfig = config;
    return config;
  } finally {
    fetchPromise = null;
  }
};

export const clearPicklistConfigCache = () => {
  cachedConfig = null;
  fetchPromise = null;
};

const fetchConfig = async () => {
  try {
    const zoho = getZoho();
    if (!zoho?.CRM) {
      console.warn("Widget_Picklist_Config: ZOHO.CRM is not ready yet.");
      return buildFallbackConfig();
    }

    let records = await fetchViaSdk(zoho);
    if (!records.length) records = await fetchViaCoql(zoho);

    const activeRecords = records.filter(isActive);
    if (!activeRecords.length) {
      console.warn(
        "Widget_Picklist_Config: No active records returned. Using hard-coded defaults."
      );
      return buildFallbackConfig();
    }

    console.info(
      `Widget_Picklist_Config: Loaded ${activeRecords.length} option(s) from CRM.`
    );
    return groupRecords(activeRecords);
  } catch (error) {
    console.warn(
      "Widget_Picklist_Config: Failed to fetch. Using hard-coded defaults.",
      error
    );
    return buildFallbackConfig();
  }
};

const fieldValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    return (
      value.display_value ||
      value.actual_value ||
      value.name ||
      value.Name ||
      ""
    );
  }
  return String(value);
};

const isActive = (record) => {
  const value = record?.[PICKLIST_CONFIG_FIELDS.active];
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "Yes"
  );
};

const recordArray = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const fetchViaSdk = async (zoho) => {
  for (const entity of MODULE_API_NAMES) {
    const records = await paginateSdk(zoho, entity);
    if (records.length) return records;
  }
  return [];
};

const paginateSdk = async (zoho, entity) => {
  const all = [];
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    let response;
    try {
      if (typeof zoho.CRM.API?.getAllRecords === "function") {
        response = await zoho.CRM.API.getAllRecords({
          Entity: entity,
          sort_order: "asc",
          per_page: perPage,
          page,
        });
      } else if (typeof zoho.CRM.API?.getRecords === "function") {
        response = await zoho.CRM.API.getRecords({
          Entity: entity,
          sort_order: "asc",
          per_page: perPage,
          page,
        });
      } else {
        return [];
      }
    } catch (error) {
      console.warn(
        `Widget_Picklist_Config SDK fetch failed for ${entity} page ${page}:`,
        error
      );
      return [];
    }

    if (response?.status === "error" || response?.code === "INVALID_MODULE") {
      return [];
    }

    const chunk = recordArray(response);
    all.push(...chunk);
    const moreRecords =
      response?.info?.more_records === true ||
      response?.info?.more_records === "true";
    if (chunk.length < perPage || !moreRecords) break;
  }

  return all;
};

const parseCoqlResponse = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;

  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }

  const candidates = [parsedStatusMessage, response?.details, response].filter(
    (candidate) => candidate && typeof candidate === "object"
  );
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data) && candidate.data.length) {
      return candidate.data;
    }
  }
  return [];
};

const fetchViaCoql = async (zoho) => {
  if (typeof zoho.CRM.CONNECTION?.invoke !== "function") return [];

  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;

  for (const moduleApiName of MODULE_API_NAMES) {
    const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${moduleApiName} where ${active} = true order by ${sortOrder} asc LIMIT 0, 2000`;
    try {
      const response = await zoho.CRM.CONNECTION.invoke(
        ZOHO_CONNECTION_NAME,
        {
          url: `${ZOHO_API_BASE_URL}/crm/v8/coql`,
          method: "POST",
          param_type: 2,
          parameters: { select_query: selectQuery },
        }
      );
      const data = parseCoqlResponse(response);
      if (data.length) return data;
    } catch (error) {
      console.warn(
        `COQL picklist fetch failed for ${moduleApiName}:`,
        error
      );
    }
  }
  return [];
};

const pushUnique = (list, value) => {
  if (value && !list.includes(value)) list.push(value);
};

const groupRecords = (records) => {
  const { name, category, parentType, sortOrder } = PICKLIST_CONFIG_FIELDS;
  const { TYPE, RESULT, REGARDING, DURATION } = PICKLIST_CATEGORIES;
  const types = [];
  const typeResources = {};
  const results = {};
  const regarding = {};
  const durations = [];

  const sorted = [...records].sort(
    (a, b) =>
      (Number(a[sortOrder]) || 9999) - (Number(b[sortOrder]) || 9999)
  );

  for (const record of sorted) {
    const itemCategory = fieldValue(record[category]);
    const value = fieldValue(record[name]);
    const parent = fieldValue(record[parentType]) || "_default";
    if (!value) continue;

    switch (itemCategory) {
      case TYPE:
        pushUnique(types, value);
        {
          const orderedResource = Number(record[sortOrder]) / 10;
          if (Number.isInteger(orderedResource) && orderedResource > 0) {
            typeResources[value] = orderedResource;
          }
        }
        break;
      case RESULT:
        if (!results[parent]) results[parent] = [];
        pushUnique(results[parent], value);
        break;
      case REGARDING:
        if (!regarding[parent]) regarding[parent] = [];
        pushUnique(regarding[parent], value);
        break;
      case DURATION: {
        const minutes = parseInt(value, 10);
        if (!Number.isNaN(minutes) && !durations.includes(minutes)) {
          durations.push(minutes);
        }
        break;
      }
      default:
        console.warn(
          `Unknown Widget_Picklist_Config category: ${itemCategory} for "${value}"`
        );
    }
  }

  const resultMapping = {};
  Object.entries(results).forEach(([parent, options]) => {
    if (parent !== "_default" && options.length) {
      resultMapping[parent] = options[0];
    }
  });

  const hasAdminOptions =
    types.length > 0 ||
    Object.keys(results).length > 0 ||
    Object.keys(regarding).length > 0 ||
    durations.length > 0;

  return {
    types: types.length ? types : defaultTypeOptions,
    typeResources,
    results: Object.keys(results).length ? results : null,
    resultMapping: Object.keys(resultMapping).length
      ? resultMapping
      : defaultResultMapping,
    regarding: Object.keys(regarding).length ? regarding : null,
    durations: durations.length ? durations : defaultDurationOptions,
    _fromAdmin: hasAdminOptions,
    _source: hasAdminOptions ? "custom_module" : "fallback",
  };
};

const buildFallbackConfig = () => ({
  types: defaultTypeOptions,
  typeResources: Object.fromEntries(
    defaultActivityTypes.map(({ type, resource }) => [type, resource])
  ),
  results: null,
  resultMapping: defaultResultMapping,
  regarding: null,
  durations: defaultDurationOptions,
  _fromAdmin: false,
  _source: "fallback",
});

export const getTypeOptionsFromConfig = (config) =>
  config?.types?.length ? config.types : defaultTypeOptions;

export const getResultOptionsFromConfig = (type, config) => {
  if (!config?.results) return null;
  return config.results[type]?.length
    ? config.results[type]
    : config.results._default?.length
      ? config.results._default
      : null;
};

export const getRegardingOptionsFromConfig = (type, config) => {
  if (!config?.regarding) return null;
  return config.regarding[type]?.length
    ? config.regarding[type]
    : config.regarding._default?.length
      ? config.regarding._default
      : null;
};

export const getDurationOptionsFromConfig = (config) =>
  config?.durations?.length ? config.durations : defaultDurationOptions;

export const getResultMappingFromConfig = (config) =>
  config?.resultMapping && Object.keys(config.resultMapping).length
    ? config.resultMapping
    : defaultResultMapping;
