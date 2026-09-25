import React, { useState, useEffect, useRef } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
} from "@mui/material";
import { getRegardingOptions, shouldOfferManualOther } from "./helperFunc"; // Import the function

const RegardingField = ({
  formData,
  handleInputChange,
  picklistConfig = null,
  isEditMode = false,
}) => {
  const existingValue = formData?.Regarding ?? "";
  const activityType = formData?.Type_of_Activity;
  const configuredOptions = React.useMemo(
    () => getRegardingOptions(activityType, undefined, picklistConfig),
    [activityType, picklistConfig]
  );
  const predefinedOptions = React.useMemo(
    () =>
      getRegardingOptions(
        activityType,
        isEditMode ? existingValue : undefined,
        picklistConfig
      ),
    [activityType, existingValue, isEditMode, picklistConfig]
  ); // Get dynamic options based on type
  const manualOtherEnabled = shouldOfferManualOther(
    picklistConfig,
    configuredOptions
  );
  const selectOptions = manualOtherEnabled
    ? predefinedOptions.filter((option) => option !== "Other")
    : predefinedOptions;

  const [selectedValue, setSelectedValue] = useState(existingValue || "");
  const [manualInput, setManualInput] = useState("");
  const previousType = useRef(activityType);

  useEffect(() => {
    const typeChanged = previousType.current !== activityType;
    previousType.current = activityType;

    // Manual text is mirrored into formData. Keep the editor open while the
    // user types, but reset it when the activity Type changes.
    if (!typeChanged && manualOtherEnabled && selectedValue === "Other") return;

    // If existingValue is not in the predefined options, set it to "Other" and show manual input
    if (existingValue && !predefinedOptions.includes(existingValue)) {
      if (manualOtherEnabled) {
        setSelectedValue("Other");
        setManualInput(existingValue);
      } else {
        setSelectedValue("");
        setManualInput("");
      }
    } else {
      setSelectedValue(existingValue);
      setManualInput("");
    }
  }, [activityType, existingValue, manualOtherEnabled, predefinedOptions, selectedValue]);

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);

    if (value !== "Other" || !manualOtherEnabled) {
      setManualInput(""); // Clear manual input when a predefined option is selected
      handleInputChange("Regarding", value);
    } else {
      setManualInput(""); // Reset manual input when "Other" is selected
      handleInputChange("Regarding", "");
    }
  };

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange("Regarding", value);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <FormControl fullWidth size="small" variant="outlined">
        <InputLabel id="regarding-label" sx={{ fontSize: "9pt" }}>
          Regarding
        </InputLabel>
        <Select
          labelId="regarding-label"
          id="regarding-select"
          value={selectedValue}
          onChange={handleSelectChange}
          label="Regarding"
          sx={{ fontSize: "9pt" }}
        >
          {selectOptions.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          {manualOtherEnabled && (
            <MenuItem value="Other" sx={{ fontSize: "9pt" }}>
              Other (Manually enter)
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {manualOtherEnabled && selectedValue === "Other" && (
        <TextField
          label="Enter your custom regarding"
          fullWidth
          size="small"
          value={manualInput}
          onChange={handleManualInputChange}
          sx={{
            mt: 2,
            fontSize: "9pt",
          }}
        />
      )}
    </Box>
  );
};

export default RegardingField;
