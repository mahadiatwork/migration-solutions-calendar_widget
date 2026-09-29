export const NEW_ACTIVITY_TITLE = "New Activity";

export const getCreateActivityDefaults = () => ({
  title: NEW_ACTIVITY_TITLE,
  Type_of_Activity: "",
  Regarding: "",
});

export const getActivityTypeSelection = (selectedActivity) => ({
  Type_of_Activity: selectedActivity.type,
  resource: selectedActivity.resource,
  Regarding: "",
});
