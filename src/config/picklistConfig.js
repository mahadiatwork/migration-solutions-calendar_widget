// Zoho CRM module used to manage the widget's Type, Result, Regarding, and
// Duration options without requiring a new widget build.
export const PICKLIST_CONFIG_MODULE = "Widget_Picklist_Config";

export const PICKLIST_CONFIG_FIELDS = {
  name: "Name",
  category: "Category",
  parentType: "Parent_Type",
  sortOrder: "Sort_Order",
  active: "Active",
};

export const PICKLIST_CATEGORIES = {
  TYPE: ["Type", "History Type"],
  RESULT: ["Result", "History Result"],
  REGARDING: ["Regarding"],
  DURATION: ["Duration"],
};

export const ZOHO_API_BASE_URL = "https://www.zohoapis.com.au";
export const ZOHO_CONNECTION_NAME = "zoho_crm_conn";
