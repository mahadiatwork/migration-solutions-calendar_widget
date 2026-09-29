import React, { useState, useEffect, useRef } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
} from "@mui/material";
import {
  CUSTOM_REGARDING_LABEL,
  CUSTOM_REGARDING_OPTION,
  getPersistedRegardingValue,
  getRegardingOptions,
} from "./helperFunc";

const RegardingField = ({
  formData,
  handleInputChange,
  picklistConfig = null,
  isEditMode = false,
}) => {
  const existingValue = formData?.Regarding ?? "";
  const activityType = formData?.Type_of_Activity;
  const predefinedOptions = React.useMemo(
    () =>
      getRegardingOptions(
        activityType,
        isEditMode ? existingValue : undefined,
        picklistConfig
      ),
    [activityType, existingValue, isEditMode, picklistConfig]
  ); // Get dynamic options based on type
  const [selectedValue, setSelectedValue] = useState(existingValue || "");
  const [manualInput, setManualInput] = useState("");
  const previousType = useRef(activityType);

  useEffect(() => {
    const typeChanged = previousType.current !== activityType;
    previousType.current = activityType;

    // Manual text is mirrored into formData. Keep the editor open while the
    // user types, but reset it when the activity Type changes.
    if (!typeChanged && selectedValue === CUSTOM_REGARDING_OPTION) return;

    // Existing free text belongs in the always-available Custom editor.
    if (existingValue && !predefinedOptions.includes(existingValue)) {
      setSelectedValue(CUSTOM_REGARDING_OPTION);
      setManualInput(existingValue);
    } else {
      setSelectedValue(existingValue);
      setManualInput("");
    }
  }, [activityType, existingValue, predefinedOptions, selectedValue]);

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);

    setManualInput("");
    handleInputChange("Regarding", getPersistedRegardingValue(value));
  };

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange(
      "Regarding",
      getPersistedRegardingValue(CUSTOM_REGARDING_OPTION, value)
    );
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
          {predefinedOptions.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM_REGARDING_OPTION} sx={{ fontSize: "9pt" }}>
            {CUSTOM_REGARDING_LABEL}
          </MenuItem>
        </Select>
      </FormControl>

      {selectedValue === CUSTOM_REGARDING_OPTION && (
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
