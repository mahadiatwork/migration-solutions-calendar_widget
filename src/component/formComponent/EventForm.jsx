import { useEffect } from "react";
import "@mobiscroll/react/dist/css/mobiscroll.min.css";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Link,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
  Select as MuiSelect,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useState } from "react";
import "react-quill/dist/quill.snow.css";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import FirstComponent from "./FirstComponent";
import ThirdComponent from "./ThirdComponent";
import { transformFormSubmission } from "../handleDataFormatting";
import {
  getResultBasedOnActivityType,
  getResultBasedOnActivityType2,
} from "../helperFunction";

const ZOHO = window.ZOHO;

const EventForm = ({
  myEvents,
  setEvents,
  setOpen,
  onClose,
  activityType,
  setActivityType,
  selectedDate,
  setSelectedDate,
  formData,
  setFormData,
  handleInputChange,
  users,
  recentColor,
  setRecentColor,
  clickedEvent,
  setClickedEvent,
  argumentLoader,
  snackbarOpen,
  setSnackbarOpen,
  loggedInUser,
  picklistConfig = null,
}) => {
  const [value, setValue] = useState(0);
  const [edited, setEdited] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");
  const [eraseChecked, setEraseChecked] = useState(false);
  const descriptionText = formData.Description?.trim() || "";

  const [activityDetails, setActivityDetails] = useState(descriptionText);
  const [addActivityToHistory, setAddActivityToHistory] = useState(true);
  const [result, setResult] = useState(formData.result || "");
  const [isActivityDetailsUpdated, setIsActivityDetailsUpdated] =
    useState(false);
  const [existingHistory, setExistingHistory] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [clearChecked, setClearChecked] = useState(
    formData?.Event_Status === "Closed"
  );

  const [loading, setLoading] = useState(false);

  dayjs.extend(utc);
  dayjs.extend(timezone);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  // Handlers for Next and Back buttons
  const handleNext = () => {
    if (value < 2) setValue(value + 1); // Increment to next tab
  };

  const handleBack = () => {
    if (value > 0) setValue(value - 1); // Decrement to previous tab
  };

  const handleClose = () => {
    setFormData({
      id: "",
      title: "",
      startTime: "",
      endTime: "",
      duration: 0,
      associateWith: null,
      Type_of_Activity: "",
      resource: 0,
      scheduleFor: "",
      scheduledWith: [],
      location: "",
      priority: "",
      Remind_At: "",
      occurrence: "once",
      start: "",
      end: "",
      noEndDate: false,
      color: "#d1891f",
      Banner: false,
      Description: "",
      send_notification: false,
      Send_Reminders: false,
    });
    onClose();
    setOpen(false);
  };

  // Check for existing history only when Clear tab is active
  useEffect(() => {
    if (formData.id && value === 3) {
      // Fetch existing history for this event
      const fetchHistory = async () => {
        try {
          const historyResponse = await ZOHO.CRM.API.searchRecord({
            Entity: "History1",
            Type: "criteria",
            Query: `(Event_ID:equals:${formData.id})`,
          });

          if (
            historyResponse &&
            historyResponse.data &&
            historyResponse.data.length > 0
          ) {
            setExistingHistory(historyResponse.data);
            // If there's existing history, pre-populate the activity details
            if (historyResponse.data[0].History_Details_Plain) {
              setActivityDetails(historyResponse.data[0].History_Details_Plain);
              setAddActivityToHistory(true);
            }
            if (historyResponse.data[0].History_Result) {
              setResult(historyResponse.data[0].History_Result);
            }
          } else {
            // Default to checked for "Add Activity Details to History" when clearing activity
            setAddActivityToHistory(true);
            if (formData.Description && formData.Description.trim() !== "") {
              setActivityDetails(formData.Description);
            }
          }
        } catch (error) {
          console.error("Error fetching history:", error);
        }
      };

      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Description sync intentional
  }, [formData.id, value]);

  const logResponse = async ({
    name,
    payload,
    response,
    result,
    trigger,
    meetingType,
    Widget_Source,
    errorDetails = null,
  }) => {
    const timeOccurred = dayjs()
      .tz("Australia/Adelaide")
      .format("YYYY-MM-DDTHH:mm:ssZ");

    try {
      await ZOHO.CRM.API.insertRecord({
        Entity: "Log_Module",
        APIData: {
          Name: name,
          Payload_2: JSON.stringify(payload),
          Response: JSON.stringify(response),
          Result: result,
          Trigger: trigger,
          Time_Occured: timeOccurred,
          Meeting_Type: meetingType,
          Widget_Source: Widget_Source,
          Error_Details: errorDetails ? JSON.stringify(errorDetails) : null,
        },
      });
    } catch (logError) {
      // Even log the logging errors
      console.error("Failed to log response:", logError);
    }
  };

  const handleApiError = async (
    error,
    operation,
    transformedData,
    formData
  ) => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      operation: operation,
    };

    await logResponse({
      name: `${operation}: ${formData.title || formData.id || "Unnamed"}`,
      Payload_2: transformedData,
      response: { error: error.message },
      result: "Error",
      trigger: operation.includes("Update") ? "Record Update" : "Record Create",
      meetingType: formData.Type_of_Activity || "",
      Widget_Source: "Calendar Widget",
      errorDetails: errorDetails,
    });

    console.error(`Error in ${operation}:`, error);
  };

  // ========================================
  // HANDLE SUBMIT FOR FIRST THREE TABS (General, Details, Recurrence)
  // ========================================
  const handleSubmit = async () => {
    // setLoading(true);
    try {
      // UPDATE EXISTING EVENT
      if (formData.id !== "") {
        const transformedData = transformFormSubmission(formData);

        const config = {
          Entity: "Events",
          APIData: transformedData,
          Trigger: ["workflow"],
        };

        formData.start = new Date(formData.start);
        formData.end = new Date(formData.end);

        const data = await ZOHO.CRM.API.updateRecord(config);
        const wasSuccessful = data.data[0].code === "SUCCESS";

        await logResponse({
          name: `Update Event: ${formData.title || formData.id}`,
          Payload_2: transformedData,
          response: data,
          result: wasSuccessful ? "Success" : "Error",
          trigger: "Record Update",
          meetingType: formData.Type_of_Activity || "",
          Widget_Source: "Calendar Widget",
        });

        if (wasSuccessful) {
          setSnackbarMessage("Event updated successfully!");
          setSnackbarSeverity("success");
          setSnackbarOpen(true);
          const start = formData.start instanceof Date ? formData.start : new Date(formData.start);
          const end = formData.end instanceof Date ? formData.end : new Date(formData.end);
          setEvents((prevEvents) =>
            prevEvents.map((event) => {
              if (String(event.id) !== String(formData.id)) return event;
              const scheduleFor = formData.scheduleFor
                ? {
                    ...formData.scheduleFor,
                    name: formData.scheduleFor.name ?? formData.scheduleFor.full_name ?? event.scheduleFor?.name,
                  }
                : event.scheduleFor;
              return {
                ...event,
                ...formData,
                id: event.id,
                start,
                end,
                scheduleFor,
                color: formData.color ?? event.color,
              };
            })
          );
          resetFormState();
        } else {
          setSnackbarMessage("Failed to update event.");
          setSnackbarSeverity("error");
          setSnackbarOpen(true);
        }
      }

      // CREATE NEW EVENT
      if (formData.id === "") {
        // CREATE SEPARATE CONTACTS
        if (formData.create_sperate_contact) {
          const promises = formData?.scheduledWith.map(async (item) => {
            const transformedData = transformFormSubmission(formData, item);
            try {
              const data = await ZOHO.CRM.API.insertRecord({
                Entity: "Events",
                APIData: transformedData,
                Trigger: ["workflow"],
              });

              const wasSuccessful = data.data[0].code === "SUCCESS";

              await logResponse({
                name: `Create Event for ${item.name}`,
                Payload_2: transformedData,
                response: data,
                result: wasSuccessful ? "Success" : "Error",
                trigger: "Record Create",
                meetingType: formData.Type_of_Activity || "",
                Widget_Source: "Calendar Widget",
              });

              if (wasSuccessful) {
                handleInputChange("id", data?.data[0]?.details?.id);
                setEvents((prev) => [
                  ...prev,
                  {
                    ...formData,
                    id: data?.data[0].details?.id,
                    scheduleFor: {
                      name: item.Full_Name,
                      id: item.participant,
                      email: item.Email,
                    },
                  },
                ]);
                console.log({
                  ...formData,
                  id: data?.data[0].details?.id,
                  scheduleFor: {
                    name: item.Full_Name,
                    id: item.participant,
                    email: item.Email,
                  },
                });
                resetFormState();
                return { success: true, data };
              }
              return { success: false, data };
            } catch (error) {
              await handleApiError(
                error,
                `Create Event for ${item.name}`,
                transformedData,
                formData
              );
              return { success: false, error };
            }
          });

          const results = await Promise.all(promises);
          const successCount = results.filter((r) => r.success).length;

          if (successCount > 0) {
            setSnackbarMessage(
              `${successCount} event(s) created successfully!`
            );
            setSnackbarSeverity("success");
            setSnackbarOpen(true);
          } else {
            setSnackbarMessage("Failed to create events.");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
          }

          resetFormState();
        } else {
          // CREATE SINGLE EVENT
          const transformedData = transformFormSubmission(formData);

          formData.start = new Date(formData.start);
          formData.end = new Date(formData.end);
          formData.endTime = new Date(formData.endTime);
          formData.Recurring_Activity = transformedData.Recurring_Activity;

          const data = await ZOHO.CRM.API.insertRecord({
            Entity: "Events",
            APIData: transformedData,
            Trigger: ["workflow"],
          });

          const wasSuccessful = data.data[0].code === "SUCCESS";

          await logResponse({
            name: `Create Event: ${formData.title || "Unnamed"}`,
            Payload_2: transformedData,
            response: data,
            result: wasSuccessful ? "Success" : "Error",
            trigger: "Record Create",
            meetingType: formData.Type_of_Activity || "",
            Widget_Source: "Calendar Widget",
          });

          if (wasSuccessful) {
            setSnackbarMessage("Event created successfully!");
            setSnackbarSeverity("success");
            setSnackbarOpen(true);
            handleInputChange("id", data?.data[0]?.details?.id);
            setEvents((prev) => [
              ...prev,
              {
                ...formData,
                id: data?.data[0].details?.id,
                scheduleFor: {
                  name: formData.scheduleFor.full_name,
                  id: formData.scheduleFor.id,
                  email: formData.scheduleFor.email,
                },
              },
            ]);
            resetFormState();
          } else {
            setSnackbarMessage("Failed to create event.");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
          }
        }
      }
    } catch (error) {
      await handleApiError(
        error,
        formData.id ? "Update Event" : "Create Event",
        formData.id ? transformFormSubmission(formData) : formData,
        formData
      );
      setSnackbarMessage("An unexpected error occurred!");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
    setLoading(false);
  };

  // Helper to create or update history
  const createOrUpdateHistory = async () => {
    // Prepare record data for history
    const recordData = {
      Name: formData.title || "Unnamed Event",
      Duration: String(formData.duration),
      History_Type: formData.Type_of_Activity,
      ...(formData.associateWith?.id && {
        Stakeholder: { id: formData.associateWith.id },
      }),
      Regarding: formData.Regarding,
      Date: dayjs(formData.start)
        .tz("Australia/Adelaide")
        .format("YYYY-MM-DDTHH:mm:ssZ"),
      ...(addActivityToHistory && { History_Details_Plain: activityDetails }),
      History_Result: result,
      Event_ID: formData.id,
    };

    if (existingHistory.length > 0) {
      return await updateHistoryOnly();
    } else {
      const historyResponse = await ZOHO.CRM.API.insertRecord({
        Entity: "History1",
        APIData: recordData,
        Trigger: ["workflow"],
      });

      if (historyResponse.data[0].code === "SUCCESS") {
        // Handle participants if available
        if (formData.scheduledWith && formData.scheduledWith.length > 0) {
          for (const participant of formData.scheduledWith) {
            const historyXContactRecordData = {
              Contact_Details: { id: participant.id },
              Contact_History_Info: {
                id: historyResponse?.data[0]?.details?.id,
              },
            };

            try {
              await ZOHO.CRM.API.insertRecord({
                Entity: "History_X_Contacts",
                APIData: historyXContactRecordData,
                Trigger: ["workflow"],
              });

              console.log(
                `Record inserted for participant ${
                  participant.name || participant.id
                }`
              );
            } catch (error) {
              console.error(
                `Error inserting record for ${
                  participant.name || participant.id
                }:`,
                error
              );
              await handleApiError(
                error,
                `Create Contact History for ${
                  participant.name || participant.id
                }`,
                historyXContactRecordData,
                formData
              );
            }
          }
        }

        setSnackbarMessage("New history created successfully!");
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage("Failed to create new history.");
        setSnackbarSeverity("warning");
        setSnackbarOpen(true);
        return false;
      }
      return true;
    }
  };

  // Helper to update only the history record
  const updateHistoryOnly = async () => {
    const historyRecordId = existingHistory[0]?.id;
    const updatedHistoryData = {
      History_Details_Plain: activityDetails,
      History_Result: result,
      id: historyRecordId,
    };

    const updateResponse = await ZOHO.CRM.API.updateRecord({
      Entity: "History1",
      RecordID: historyRecordId,
      APIData: updatedHistoryData,
    });

    await logResponse({
      name: `Update History: ${historyRecordId}`,
      Payload_2: updatedHistoryData,
      response: updateResponse,
      result: updateResponse.data[0].code === "SUCCESS" ? "Success" : "Error",
      trigger: "History Update",
      meetingType: formData.Type_of_Activity || "",
      Widget_Source: "Calendar Widget",
    });

    if (updateResponse.data[0].code === "SUCCESS") {
      setSnackbarMessage("History updated successfully!");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } else {
      setSnackbarMessage("Failed to update history.");
      setSnackbarSeverity("warning");
      setSnackbarOpen(true);
      return false;
    }
    return true;
  };

  // ========================================
  // HANDLE CLEAR UPDATE FOR CLEAR TAB ONLY
  // ========================================
  const handleClearUpdate = async (e) => {
    if (e) e.preventDefault();

    try {
      // CASE 1: "Clear" checked and "Erase" unchecked → Close the event
      if (clearChecked && !eraseChecked) {
        const updateResponse = await ZOHO.CRM.API.updateRecord({
          Entity: "Events",
          RecordID: formData.id,
          APIData: {
            id: formData.id,
            Event_Status: "Closed",
            result: result,
          },
        });

        if (updateResponse.data[0].code === "SUCCESS") {
          setSnackbarMessage("Event marked as cleared successfully!");
          setSnackbarSeverity("success");
          setSnackbarOpen(true);

          setEvents((prevEvents) =>
            prevEvents.map((event) =>
              event.id === formData.id
                ? { ...event, Event_Status: "Closed", result: result }
                : event
            )
          );

          // // Always create or update history, regardless of addActivityToHistory
          await createOrUpdateHistory();
        } else {
          throw new Error("Failed to update the event.");
        }
      }

      // CASE 2: Both "Clear" and "Erase" unchecked → Open the event
      if (!clearChecked && !eraseChecked) {
        const eventResponse = await ZOHO.CRM.API.getRecord({
          Entity: "Events",
          approved: "both",
          RecordID: formData.id,
        });

        if (eventResponse.data.length > 0) {
          const updateResponse = await ZOHO.CRM.API.updateRecord({
            Entity: "Events",
            RecordID: formData.id,
            APIData: {
              id: formData.id,
              Event_Status: "Open",
            },
          });

          if (updateResponse.data[0].code === "SUCCESS") {
            setSnackbarMessage("Event status updated to Open.");
            setSnackbarSeverity("success");
            setSnackbarOpen(true);

            setEvents((prevEvents) =>
              prevEvents.map((event) =>
                event.id === formData.id
                  ? {
                      ...event,
                      Event_Status: "Open",
                    }
                  : event
              )
            );

            // Always create or update history, regardless of addActivityToHistory
            // await createOrUpdateHistory();
          } else {
            throw new Error("Failed to update the event status.");
          }
        } else {
          setSnackbarMessage("No event found to update.");
          setSnackbarSeverity("info");
          setSnackbarOpen(true);
        }
      }

      // CASE 3: "Erase" checked → Delete the event
      if (!clearChecked && eraseChecked) {
        // Always create or update history before deleting, regardless of addActivityToHistory
        await createOrUpdateHistory();

        const deleteResponse = await ZOHO.CRM.API.deleteRecord({
          Entity: "Events",
          RecordID: formData.id,
        });

        if (deleteResponse.data[0].code === "SUCCESS") {
          setSnackbarMessage("Event erased successfully!");
          setSnackbarSeverity("success");
          setSnackbarOpen(true);

          setEvents((prevEvents) =>
            prevEvents.filter((event) => event.id !== formData.id)
          );
        } else {
          throw new Error("Failed to delete the event.");
        }
      }

      // Handle only history update when event data is unchanged
      if (
        !clearChecked &&
        !eraseChecked &&
        isActivityDetailsUpdated &&
        existingHistory.length > 0
      ) {
        await updateHistoryOnly();
      }

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (error) {
      console.error("Error during clear operation:", error);
      await handleApiError(
        error,
        "Clear/Update Event",
        { id: formData.id },
        formData
      );
      setSnackbarMessage("An unexpected error occurred, try again!");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // ========================================
  // COMBINED SUBMIT FOR ALL TABS
  // ========================================
  const handleCombinedSubmit = async () => {
    try {
      // First, handle the event creation/update (first three tabs)
      await handleSubmit();

      // Then, if we're on the Clear tab, handle the clear operations
      if (value === 3) {
        await handleClearUpdate();
      }
    } catch (error) {
      console.error("Error in combined submit:", error);
      setSnackbarMessage("An unexpected error occurred during submission!");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // Delete existing history
  const handleDeleteHistory = async () => {
    const historyRecordId = existingHistory[0]?.id;

    try {
      const getAllHistoryXcontacts = await ZOHO.CRM.API.getRelatedRecords({
        Entity: "History1",
        RecordID: historyRecordId,
        RelatedList: "Contacts3",
        page: 1,
        per_page: 200,
      });

      const deleteResponse = await ZOHO.CRM.API.deleteRecord({
        Entity: "History1",
        RecordID: historyRecordId,
      });

      if (deleteResponse.data[0].code === "SUCCESS") {
        setActivityDetails("");
        if (
          getAllHistoryXcontacts.data &&
          getAllHistoryXcontacts.data.length > 0
        ) {
          for (const participant of getAllHistoryXcontacts.data) {
            const relatedRecordsDelete = await ZOHO.CRM.API.deleteRecord({
              Entity: "History1",
              RecordID: participant?.id,
            });

            await logResponse({
              name: `Delete Related History: ${participant?.id}`,
              Payload_2: { id: participant?.id },
              response: relatedRecordsDelete,
              result:
                relatedRecordsDelete.data[0].code === "SUCCESS"
                  ? "Success"
                  : "Error",
              trigger: "Related History Delete",
              meetingType: formData.Type_of_Activity || "",
              Widget_Source: "Calendar Widget",
            });
          }
        }
        setSnackbarMessage("History deleted successfully!");
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
        setExistingHistory([]);
        setTimeout(() => {
          handleClose();
        }, 1000);
      } else {
        setSnackbarMessage("Failed to delete history.");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    } catch (error) {
      await handleApiError(
        error,
        "Delete History",
        { id: historyRecordId },
        formData
      );
      console.error("Error deleting history:", error);
      setSnackbarMessage("Failed to delete history.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // Optional helper
  const resetFormState = () => {
    setFormData({
      id: "",
      title: "",
      startTime: "",
      endTime: "",
      duration: 0,
      associateWith: null,
      Type_of_Activity: "",
      resource: 0,
      scheduleFor: "",
      scheduleWith: [],
      location: "",
      priority: "",
      Remind_At: "",
      occurrence: "once",
      start: "",
      end: "",
      noEndDate: false,
      color: "#d1891f",
      Banner: false,
      Description: "",
      send_notification: false,
      Send_Reminders: false,
    });
    setClickedEvent(null);
    setOpen(false);
  };

  useEffect(() => {
    if (formData.id !== "") {
      setEdited(true);
    }
  }, [formData]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);

  const handleDelete = (eventID) => {
    setEventToDelete(eventID);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const deleteResponse = await ZOHO.CRM.API.deleteRecord({
        Entity: "Events",
        RecordID: eventToDelete,
      });

      await logResponse({
        name: `Delete Event: ${eventToDelete}`,
        Payload_2: { id: eventToDelete },
        response: deleteResponse,
        result: deleteResponse.data[0].code === "SUCCESS" ? "Success" : "Error",
        trigger: "Event Delete",
        meetingType: formData.Type_of_Activity || "",
        Widget_Source: "Calendar Widget",
      });

      console.log("Event deleted successfully:", deleteResponse);

      setEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== eventToDelete)
      );
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      handleClose(); // If you're closing a parent modal too
    } catch (error) {
      await handleApiError(
        error,
        "Delete Event",
        { id: eventToDelete },
        formData
      );
      console.error("Error deleting event:", error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  // Update filtered activities when activity type changes
  useEffect(() => {
    if (formData?.Type_of_Activity) {
      const filteredOptions = getResultBasedOnActivityType2(
        formData.Type_of_Activity,
        picklistConfig
      );
      setFilteredActivities(filteredOptions);

      // Keep a valid existing selection; otherwise use the configured default
      // (the first option by Sort_Order).
      setResult((currentResult) =>
        currentResult && filteredOptions.includes(currentResult)
          ? currentResult
          : filteredOptions[0] || ""
      );
    }
  }, [formData?.Type_of_Activity, picklistConfig]);

  // Handle result selection change
  const handleResultChange = (e) => {
    setResult(e.target.value);
  };

  // Handle clear checkbox change
  const handleClearChange = (event) => {
    setClearChecked(event.target.checked);
    if (event.target.checked) {
      setEraseChecked(false);
      setResult(
        getResultBasedOnActivityType(
          formData.Type_of_Activity,
          picklistConfig
        ) || ""
      );
    }
  };

  // Handle erase checkbox change
  const handleEraseChange = (event) => {
    setEraseChecked(event.target.checked);
    if (event.target.checked) {
      setClearChecked(false);
      setResult(
        getResultBasedOnActivityType(
          formData.Type_of_Activity,
          picklistConfig
        ) || ""
      );
    }
  };

  const displayedResultOptions =
    result &&
    existingHistory.length > 0 &&
    !filteredActivities.includes(result)
      ? [result, ...filteredActivities]
      : filteredActivities;

  // Handle activity to history checkbox change
  const handleActivityToHistory = (e) => {
    setAddActivityToHistory(e.target.checked);
    if (!e.target.checked) {
      setActivityDetails("");
    } else {
      setActivityDetails(formData.Description || "");
    }
  };

  // Handle activity details change
  const handleActivityDetailsChange = (e) => {
    setActivityDetails(e.target.value);
    setIsActivityDetailsUpdated(true);
  };

  if (argumentLoader) {
    return (
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 650,
          bgcolor: "background.paper",
          border: "2px solid #000",
          boxShadow: 24,
          p: 2,
          borderRadius: 5,
        }}
      >
        <Box height={15}>
          <Button
            variant="outlined"
            onClick={() => handleClose()}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
            }}
            startIcon={<CloseIcon />}
          >
            Cancel
          </Button>
          <IconButton aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="h3" color="primary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Determine if we should show the Clear tab (only for editing, not for creation)
  const showClearTab = formData.id !== "";

  if (loading) {
    return (
      <Box
        sx={{
          position: "fixed", // Use fixed to center relative to viewport
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1300, // Above modal/dialogs
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(255, 255, 255, 0.8)", // Optional overlay
        }}
      >
        <CircularProgress size={40} color="primary" />
      </Box>
    );
  }

   const recurrence = clickedEvent?.Recurring_Activity ? clickedEvent?.Recurring_Activity : formData?.occurrence;


  return (
    <Box
      sx={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90%",
        maxWidth: "750px",
        bgcolor: "background.paper",
        borderRadius: 4,
        boxShadow: 24,
        overflowY: "auto",
        maxHeight: "90vh", // Ensure the modal is scrollable if content exceeds the viewport
        zIndex: 100,
        p: "15px 30px 20px 30px",
      }}
    >
      <Box display="flex" justifyContent="space-between" sx={{ padding: 0 }}>
        <Box></Box>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={handleClose}
          endIcon={<CloseIcon />}
        >
          Cancel
        </Button>
      </Box>
      <Box>
        <Tabs
          value={value}
          onChange={handleChange}
          textColor="inherit"
          aria-label="simple tabs example"
          size="small"
        >
          <Tab label="General" sx={{ fontSize: "9pt" }} />
          <Tab label="Details" sx={{ fontSize: "9pt" }} />
          <Tab
            label="Reccurence"
            sx={{
              fontSize: "9pt",
              ...(recurrence && typeof recurrence === "object" && recurrence.RRULE && {
                  color: "white",
                  backgroundColor: "#1976d2",
                  borderRadius: 1,
                }),
            }}
          />
          {showClearTab && <Tab label="Clear" sx={{ fontSize: "9pt" }} />}
        </Tabs>
      </Box>

      {/* GENERAL TAB */}
      {value === 0 && (
        <Box sx={{ p: 0, borderRadius: 1 }}>
          <FirstComponent
            formData={formData}
            handleInputChange={handleInputChange}
            selectedDate={selectedDate}
            activityType={activityType}
            setActivityType={setActivityType}
            users={users}
            recentColor={recentColor}
            setRecentColor={setRecentColor}
            clickedEvent={clickedEvent}
            picklistConfig={picklistConfig}
          />
          <Box display="flex" justifyContent="space-between" mt={2}>
            <Box>
              <Button size="small" disabled>
                Back
              </Button>{" "}
              {clickedEvent?.id && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleDelete(clickedEvent?.id)}
                >
                  Delete
                </Button>
              )}
            </Box>
            <Box>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handleNext}
                sx={{ mr: 2 }}
              >
                Next
              </Button>
              <Button
                size="small"
                disabled={
                  formData?.scheduledWith?.length > 0 || edited ? false : true
                }
                variant="contained"
                color="secondary"
                onClick={handleSubmit}
              >
                Ok
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* DETAILS TAB */}
      {value === 1 && (
        <Box sx={{ p: 1, borderRadius: 1 }}>
          <TextField
            multiline
            rows={10}
            fullWidth
            defaultValue={formData.Description}
            onChange={(e) => handleInputChange("Description", e.target.value)}
          />
          <Box display="flex" justifyContent="space-between" mt={2}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleBack}
            >
              Back
            </Button>
            <Box>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handleNext}
                sx={{ mr: 2 }}
              >
                Next
              </Button>
              <Button
                size="small"
                disabled={
                  formData?.scheduledWith?.length > 0 || edited ? false : true
                }
                variant="contained"
                color="secondary"
                onClick={handleSubmit}
              >
                Ok
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* RECURRENCE TAB */}
      {value === 2 && (
        <Box sx={{ p: 2, borderRadius: 1 }}>
          <ThirdComponent
            formData={formData}
            handleInputChange={handleInputChange}
            clickedEvent={clickedEvent}
          />
          <Box display="flex" justifyContent="space-between" mt={2}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              size="small"
              disabled={
                formData?.scheduledWith?.length > 0 || edited ? false : true
              }
              variant="contained"
              color="secondary"
              onClick={handleSubmit}
            >
              Ok
            </Button>
          </Box>
        </Box>
      )}

      {/* CLEAR TAB */}
      {value === 3 && showClearTab && (
        <Box sx={{ p: 2 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", fontSize: "9pt" }}
          >
            Results:
          </Typography>

          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox checked={clearChecked} onChange={handleClearChange} />
              }
              label="Clear"
            />
            <FormControlLabel
              control={
                <Checkbox checked={eraseChecked} onChange={handleEraseChange} />
              }
              label="Erase"
            />
            <MuiSelect
              value={result}
              onChange={handleResultChange}
              size="small"
              sx={{ marginLeft: 2, minWidth: 150, fontSize: "9pt" }}
              displayEmpty
            >
              <MenuItem value="" disabled>
                <em>Select a result</em>
              </MenuItem>
              {displayedResultOptions.map((option) => (
                <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
                  {option}
                </MenuItem>
              ))}
            </MuiSelect>
          </FormGroup>

          {existingHistory.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                Existing History:
                <Link
                  href={`https://crm.zoho.com.au/crm/org7004396182/tab/CustomModule4/${existingHistory[0].id}`}
                  target="_blank"
                  rel="noopener"
                  sx={{ ml: 1 }}
                >
                  View
                </Link>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ ml: 2 }}
                  onClick={handleDeleteHistory}
                >
                  Delete History
                </Button>
              </Typography>
            </Box>
          ) : (
            <FormControlLabel
              control={
                <Checkbox
                  checked={addActivityToHistory}
                  onChange={handleActivityToHistory}
                />
              }
              label="Add Activity Details to History"
            />
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Activity Details
            </Typography>
            <TextField
              fullWidth
              value={activityDetails}
              onChange={handleActivityDetailsChange}
              multiline
              rows={4}
              size="small"
              disabled={!addActivityToHistory && existingHistory.length === 0}
            />
          </Box>

          <Box display="flex" justifyContent="flex-end" mt={3}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={handleClose}
              sx={{ mr: 2 }}
            >
              CANCEL
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleCombinedSubmit}
            >
              UPDATE
            </Button>
          </Box>
        </Box>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete Event</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this event? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%", fontSize: "9pt" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EventForm;
