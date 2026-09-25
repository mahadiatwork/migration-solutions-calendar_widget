/**
 * Loads the calendar widget's Type, Result, Regarding, and Duration options
 * from Widget_Picklist_Config. A reached module is authoritative even when a
 * category is empty; in-code values are used only when the module is unavailable.
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

    let fetchResult = await fetchViaSdk(zoho);
    if (!fetchResult.reached) fetchResult = await fetchViaCoql(zoho);

    if (!fetchResult.reached) {
      console.warn(
        "Widget_Picklist_Config: module unavailable. Using hard-coded defaults."
      );
      return buildFallbackConfig();
    }

    const activeRecords = fetchResult.records.filter(isActive);

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
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const hasRecordPayload = (response) =>
  Array.isArray(response?.data) ||
  Array.isArray(response) ||
  Array.isArray(response?.data?.data);

const responseEntries = (response) => [
  response,
  ...(response?.data &&
  typeof response.data === "object" &&
  !Array.isArray(response.data)
    ? [response.data]
    : []),
  ...(Array.isArray(response?.data) ? response.data : []),
  ...(Array.isArray(response?.data?.data) ? response.data.data : []),
].filter((entry) => entry && typeof entry === "object");

const isUnavailableResponse = (response) =>
  responseEntries(response).some(
    (entry) =>
      entry?.code === "INVALID_MODULE" ||
      entry?.code === "INVALID_MODULE_API_NAME"
  );

const isSuccessfulEmptyResponse = (response) =>
  responseEntries(response).some(
    (entry) => entry?.code === "NO_DATA" || entry?.code === "NO_CONTENT"
  );

const fetchViaSdk = async (zoho) => {
  for (const entity of MODULE_API_NAMES) {
    const result = await paginateSdk(zoho, entity);
    if (result.reached) return result;
  }
  return { records: [], reached: false };
};

const paginateSdk = async (zoho, entity) => {
  const all = [];
  const perPage = 200;
  const seenPageSignatures = new Set();

  for (let page = 1; ; page += 1) {
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
        return { records: [], reached: false };
      }
    } catch (error) {
      console.warn(
        `Widget_Picklist_Config SDK fetch failed for ${entity} page ${page}:`,
        error
      );
      return { records: [], reached: false };
    }

    if (isUnavailableResponse(response)) {
      return { records: [], reached: false };
    }

    if (isSuccessfulEmptyResponse(response)) {
      return { records: all, reached: true };
    }

    if (hasFetchError(response)) {
      return { records: [], reached: false };
    }

    if (!hasRecordPayload(response)) {
      return { records: [], reached: false };
    }

    const chunk = recordArray(response);
    const moreRecords =
      response?.info?.more_records === true ||
      response?.info?.more_records === "true" ||
      response?.data?.info?.more_records === true ||
      response?.data?.info?.more_records === "true";
    const pageSignature = JSON.stringify(chunk);
    if (
      moreRecords &&
      (chunk.length === 0 || seenPageSignatures.has(pageSignature))
    ) {
      console.warn(
        `Widget_Picklist_Config SDK pagination made no progress for ${entity} page ${page}.`
      );
      return { records: [], reached: false };
    }
    seenPageSignatures.add(pageSignature);
    all.push(...chunk);
    if (!moreRecords) break;
  }

  return { records: all, reached: true };
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
    if (Array.isArray(candidate.data)) {
      return candidate.data;
    }
  }
  return null;
};

const hasFetchError = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }
  const candidates = [
    response,
    response?.data,
    response?.details,
    parsedStatusMessage,
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(parsedStatusMessage?.data)
      ? parsedStatusMessage.data
      : []),
  ].filter((candidate) => candidate && typeof candidate === "object");
  return candidates.some((candidate) => {
    const code = candidate.code;
    return (
      candidate.status === "error" ||
      candidate.status === "failure" ||
      Number(candidate.statusCode) >= 400 ||
      (typeof code === "string" &&
        code !== "SUCCESS" &&
        code !== "NO_DATA" &&
        code !== "NO_CONTENT" &&
        code !== "200")
    );
  });
};

const hasSuccessfulEmptyCoqlResponse = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }
  const candidates = [
    response,
    response?.data,
    response?.details,
    parsedStatusMessage,
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(parsedStatusMessage?.data)
      ? parsedStatusMessage.data
      : []),
  ].filter((candidate) => candidate && typeof candidate === "object");
  return candidates.some(
    (candidate) =>
      candidate?.code === "NO_DATA" || candidate?.code === "NO_CONTENT"
  );
};

const coqlMoreRecords = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }

  const candidates = [
    parsedStatusMessage,
    response?.details,
    response,
  ].filter((candidate) => candidate && typeof candidate === "object");

  for (const candidate of candidates) {
    const value = candidate?.info?.more_records;
    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }
    if (
      value === false ||
      value === "false" ||
      value === 0 ||
      value === "0"
    ) {
      return false;
    }
  }
  return null;
};

const fetchViaCoql = async (zoho) => {
  if (typeof zoho.CRM.CONNECTION?.invoke !== "function") {
    return { records: [], reached: false };
  }

  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;
  const pageSize = 2000;

  for (const moduleApiName of MODULE_API_NAMES) {
    const all = [];
    const seenPageSignatures = new Set();
    let offset = 0;

    while (true) {
      const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${moduleApiName} where ${active} = true order by ${sortOrder} asc LIMIT ${offset}, ${pageSize}`;
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
        if (isUnavailableResponse(response)) break;
        if (hasSuccessfulEmptyCoqlResponse(response)) {
          return { records: all, reached: true };
        }
        if (hasFetchError(response)) break;
        const data = parseCoqlResponse(response);
        if (data === null) break;
        const moreRecords = coqlMoreRecords(response);
        if (data.length === 0) {
          if (moreRecords === true) {
            console.warn(
              `Widget_Picklist_Config COQL pagination made no progress for ${moduleApiName} at offset ${offset}.`
            );
            break;
          }
          return { records: all, reached: true };
        }

        const pageSignature = JSON.stringify(data);
        if (seenPageSignatures.has(pageSignature)) {
          console.warn(
            `Widget_Picklist_Config COQL pagination made no progress for ${moduleApiName} at offset ${offset}.`
          );
          break;
        }
        seenPageSignatures.add(pageSignature);
        all.push(...data);
        if (
          moreRecords === false ||
          (moreRecords !== true && data.length < pageSize)
        ) {
          return { records: all, reached: true };
        }
        offset += data.length;
      } catch (error) {
        console.warn(
          `COQL picklist fetch failed for ${moduleApiName}:`,
          error
        );
        break;
      }
    }
  }
  return { records: [], reached: false };
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
    const itemCategory = fieldValue(record[category]).trim();
    const value = fieldValue(record[name]);
    const parent = fieldValue(record[parentType]) || "_default";
    if (!value) continue;

    const categoryMatches = (aliases) =>
      aliases.some(
        (alias) => alias.toLowerCase() === itemCategory.toLowerCase()
      );

    if (categoryMatches(TYPE)) {
      pushUnique(types, value);
      const orderedResource = Number(record[sortOrder]) / 10;
      if (Number.isInteger(orderedResource) && orderedResource > 0) {
        typeResources[value] = orderedResource;
      }
    } else if (categoryMatches(RESULT)) {
      if (!results[parent]) results[parent] = [];
      pushUnique(results[parent], value);
    } else if (categoryMatches(REGARDING)) {
      if (!regarding[parent]) regarding[parent] = [];
      pushUnique(regarding[parent], value);
    } else if (categoryMatches(DURATION)) {
      const minutes = parseInt(value, 10);
      if (!Number.isNaN(minutes) && !durations.includes(minutes)) {
        durations.push(minutes);
      }
    } else {
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

  return {
    types,
    typeResources,
    results,
    resultMapping,
    regarding,
    durations,
    _fromAdmin: true,
    _source: "custom_module",
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
  config?._source === "custom_module"
    ? Array.isArray(config.types)
      ? config.types
      : []
    : defaultTypeOptions;

export const getResultOptionsFromConfig = (type, config) => {
  if (config?._source !== "custom_module") return null;
  const results = config.results || {};
  if (Object.prototype.hasOwnProperty.call(results, type)) {
    return Array.isArray(results[type]) ? results[type] : [];
  }
  if (Object.prototype.hasOwnProperty.call(results, "_default")) {
    return Array.isArray(results._default) ? results._default : [];
  }
  return [];
};

export const getRegardingOptionsFromConfig = (type, config) => {
  if (config?._source !== "custom_module") return null;
  const regarding = config.regarding || {};
  if (Object.prototype.hasOwnProperty.call(regarding, type)) {
    return Array.isArray(regarding[type]) ? regarding[type] : [];
  }
  if (Object.prototype.hasOwnProperty.call(regarding, "_default")) {
    return Array.isArray(regarding._default) ? regarding._default : [];
  }
  return [];
};

export const getDurationOptionsFromConfig = (config) =>
  config?._source === "custom_module"
    ? Array.isArray(config.durations)
      ? config.durations
      : []
    : defaultDurationOptions;

export const getResultMappingFromConfig = (config) =>
  config?._source === "custom_module"
    ? config.resultMapping || {}
    : defaultResultMapping;
