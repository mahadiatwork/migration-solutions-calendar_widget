import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid2 as Grid,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Datepicker, momentTimezone } from "@mobiscroll/react";
import moment from "moment-timezone";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import CustomTextField from "../atom/CustomTextField";
import {
  getDeviceTimeZone,
  serializeDateTimeInZone,
} from "../../helpers/dateTime";

momentTimezone.moment = moment;
dayjs.extend(utc);
dayjs.extend(timezone);

const ThirdComponent = ({ formData, handleInputChange, clickedEvent }) => {
  const [openStartDatepicker, setOpenStartDatepicker] = useState(false);
  const [openEndDatepicker, setOpenEndDatepicker] = useState(false);
  const [deviceTimeZone] = useState(() => getDeviceTimeZone());

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const recurrence = clickedEvent?.Recurring_Activity
      ? clickedEvent?.Recurring_Activity
      : formData?.occurrence;

    if (!formData.startTime) {
      const currentTime = serializeDateTimeInZone(
        new Date(),
        deviceTimeZone
      );
      handleInputChange("startTime", currentTime);
      handleInputChange(
        "endTime",
        serializeDateTimeInZone(
          dayjs(currentTime).add(1, "year"),
          deviceTimeZone
        )
      );
    }

    if (recurrence && typeof recurrence === "object" && recurrence.RRULE) {
      const ruleParts = recurrence.RRULE.split(";").reduce((acc, part) => {
        const [key, val] = part.split("=");
        acc[key] = val;
        return acc;
      }, {});

      if (ruleParts.DTSTART) {
        const datePart = dayjs.tz(ruleParts.DTSTART, deviceTimeZone);

        const timeStart = clickedEvent?.start
          ? dayjs(clickedEvent.start).tz(deviceTimeZone)
          : null;
        const timeEnd = clickedEvent?.end
          ? dayjs(clickedEvent.end).tz(deviceTimeZone)
          : null;

        const mergedStart = timeStart
          ? datePart.hour(timeStart.hour()).minute(timeStart.minute()).second(0)
          : datePart;

        const mergedEnd = timeEnd
          ? dayjs(ruleParts.UNTIL)
              .hour(timeEnd.hour())
              .minute(timeEnd.minute())
              .second(0)
          : datePart.add(1, "hour");

        handleInputChange(
          "startTime",
          serializeDateTimeInZone(mergedStart, deviceTimeZone)
        );
        handleInputChange(
          "endTime",
          serializeDateTimeInZone(mergedEnd, deviceTimeZone)
        );

        const freqMap = {
          DAILY: "daily",
          WEEKLY: "weekly",
          MONTHLY: "monthly",
          YEARLY: "yearly",
        };
        const freq = ruleParts.FREQ;
        if (freq && freqMap[freq]) {
          handleInputChange("occurrence", freqMap[freq]);
        }
      }
    } else {
      const timeStart = dayjs(formData.start).tz(deviceTimeZone);
      const timeEnd = dayjs(formData.end).tz(deviceTimeZone);
      handleInputChange("startTime", timeStart);
      handleInputChange("endTime", timeEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init recurrence from clickedEvent only
  }, []);

  const CustomInputComponent = useCallback(({ field, formattedDate }) => {
    return (
      <CustomTextField
        fullWidth
        size="small"
        label=""
        variant="outlined"
        value={formattedDate}
        onClick={() => {
          if (field === "startTime") {
            setOpenStartDatepicker(true);
          } else {
            setOpenEndDatepicker(true);
          }
        }}
      />
    );
  }, []);

  const minDate = dayjs("2024-01-01").format("YYYY-MM-DD");
  const maxDate = dayjs(formData.startTime).add(1, "year").format("YYYY-MM-DD");

  return (
    <Box>
      <FormControl>
        <FormLabel id="frequency-radio-group" sx={{ fontSize: "9pt" }}>
          Frequency
        </FormLabel>
        <RadioGroup
          aria-labelledby="frequency-radio-group"
          name="occurrence"
          value={formData.occurrence || "once"}
          onChange={(e) => handleInputChange("occurrence", e.target.value)}
        >
          <FormControlLabel
            value="once"
            control={<Radio size="small" />}
            label="Once (This activity occurs only once)"
            sx={{ "& .MuiTypography-root": { fontSize: "9pt" } }}
          />
          <FormControlLabel
            value="daily"
            control={<Radio size="small" />}
            label="Daily (This activity occurs daily)"
            sx={{ "& .MuiTypography-root": { fontSize: "9pt" } }}
          />
          <FormControlLabel
            value="weekly"
            control={<Radio size="small" />}
            label="Weekly (This activity occurs weekly)"
            sx={{ "& .MuiTypography-root": { fontSize: "9pt" } }}
          />
          <FormControlLabel
            value="monthly"
            control={<Radio size="small" />}
            label="Monthly (This activity occurs monthly)"
            sx={{ "& .MuiTypography-root": { fontSize: "9pt" } }}
          />
          <FormControlLabel
            value="yearly"
            control={<Radio size="small" />}
            label="Yearly (This activity occurs yearly)"
            sx={{ "& .MuiTypography-root": { fontSize: "9pt" } }}
          />
        </RadioGroup>
      </FormControl>

      <Grid container spacing={2} sx={{ mt: 1, py: 1 }}>
        <Grid size={6}>
          <Box display="flex" alignItems="center">
            <Typography
              variant="body1"
              sx={{ fontSize: "9pt", minWidth: "80px" }}
            >
              Starts:
            </Typography>
            <Datepicker
              controls={["calendar", "time"]}
              calendarType="month"
              display="center"
              calendarScroll="vertical"
              timezonePlugin={momentTimezone}
              dataTimezone={deviceTimeZone}
              displayTimezone={deviceTimeZone}
              inputComponent={() => {
                const dateValue = formData?.startTime;
                const formattedDate =
                  dateValue && dayjs(dateValue).isValid()
                    ? dayjs(dateValue)
                        .tz(deviceTimeZone)
                        .format("DD/MM/YYYY hh:mm A")
                    : "";
                return (
                  <CustomInputComponent
                    field="startTime"
                    formattedDate={formattedDate}
                  />
                );
              }}
              onClose={() => setOpenStartDatepicker(false)}
              onChange={(e) => {
                handleInputChange(
                  "startTime",
                  serializeDateTimeInZone(e.value, deviceTimeZone)
                );
              }}
              isOpen={openStartDatepicker}
            />
          </Box>
        </Grid>
        <Grid size={6}>
          <Box display="flex" alignItems="center">
            <Typography
              variant="body1"
              sx={{ fontSize: "9pt", minWidth: "80px" }}
            >
              Ends:
            </Typography>
            <Datepicker
              controls={["calendar", "time"]}
              calendarType="month"
              display="center"
              disabled={formData.noEndDate}
              calendarScroll="vertical"
              timezonePlugin={momentTimezone}
              dataTimezone={deviceTimeZone}
              displayTimezone={deviceTimeZone}
              min={minDate}
              max={maxDate}
              inputComponent={() => {
                const dateValue = formData?.endTime;
                const formattedDate =
                  dateValue && dayjs(dateValue).isValid()
                    ? dayjs(dateValue)
                        .tz(deviceTimeZone)
                        .format("DD/MM/YYYY hh:mm A")
                    : "";
                return (
                  <CustomInputComponent
                    field="endTime"
                    formattedDate={formattedDate}
                  />
                );
              }}
              onClose={() => setOpenEndDatepicker(false)}
              onChange={(e) => {
                const selectedDate = dayjs(e.value); // Only take the date part
                const currentTime = dayjs(formData?.endTime); // Only take the time part

                // Merge: use the date from selectedDate, and time from currentTime
                const mergedDateTime = selectedDate
                  .hour(currentTime.hour())
                  .minute(currentTime.minute())
                  .second(currentTime.second());

                handleInputChange(
                  "endTime",
                  serializeDateTimeInZone(mergedDateTime, deviceTimeZone)
                );
              }}
              isOpen={openEndDatepicker}
            />
          </Box>
        </Grid>
      </Grid>
      <Typography
        variant="caption"
        sx={{ display: "block", textAlign: "right", color: "text.secondary" }}
      >
        Timezone: {deviceTimeZone}
      </Typography>
    </Box>
  );
};

export default ThirdComponent;
