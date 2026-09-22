import "./App.css";
import TaskScheduler from "./component/TaskScheduler";
import { useEffect, useState, useCallback } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Alert, Box, CircularProgress, Snackbar } from "@mui/material";
import {
  loadUserPreferences,
  persistLatestFilterToUserPreferences,
  saveFiltersToUserPreferences,
} from "./helpers/userPreferencesFilters";
import { fetchPicklistConfig } from "./services/picklistConfigService";
const ZOHO = window.ZOHO;

dayjs.extend(utc);
dayjs.extend(timezone);

function App() {
  const [startDateTime, setStartDateTime] = useState(
    dayjs().startOf("month").format("YYYY-MM-DD") + "T00:00:00+10:30"
  );
  const [endDateTime, setEndDateTime] = useState(
    dayjs().endOf("month").format("YYYY-MM-DD") + "T23:59:59+10:30"
  );
  const [myEvents, setMyEvents] = useState([]);
  const [zohoLoaded, setZohoLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [loader, setLoader] = useState(false);
  const [recentColor, setRecentColor] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [savedFilters, setSavedFilters] = useState([]);
  const [initialFilter, setInitialFilter] = useState(null);
  const [filterSaveInProgress, setFilterSaveInProgress] = useState(false);
  const [filterSaveSnackbarOpen, setFilterSaveSnackbarOpen] = useState(false);
  const [filterSnackbarMessage, setFilterSnackbarMessage] = useState(
    "Filter saved successfully"
  );
  const [filterSnackbarSeverity, setFilterSnackbarSeverity] = useState(
    "success"
  );
  const [picklistConfig, setPicklistConfig] = useState(null);

  // Persist saved filters to User_Preferences module (Preference_Of = user, Saved_Filters = value, Name = "username - Preference").
  const persistSavedFilters = useCallback(
    (value) => {
      if (!loggedInUser?.id) return Promise.reject(new Error("User not loaded"));
      return saveFiltersToUserPreferences(
        value,
        loggedInUser.id,
        loggedInUser.full_name
      );
    },
    [loggedInUser?.id, loggedInUser?.full_name]
  );

  // Save filter button: save to User_Preferences, then show loading and success snackbar.
  const saveFiltersWithFeedback = useCallback(
    (value) => {
      if (!loggedInUser?.id) return;
      setFilterSaveInProgress(true);
      saveFiltersToUserPreferences(
        value,
        loggedInUser.id,
        loggedInUser.full_name
      )
        .then(() => {
          setFilterSaveInProgress(false);
          setFilterSnackbarMessage("Filter saved successfully");
          setFilterSnackbarSeverity("success");
          setFilterSaveSnackbarOpen(true);
        })
        .catch(() => setFilterSaveInProgress(false));
    },
    [loggedInUser?.id, loggedInUser?.full_name]
  );

  const showFilterUpdateSuccessSnackbar = useCallback(() => {
    setFilterSnackbarMessage("Filter updated successfully");
    setFilterSnackbarSeverity("success");
    setFilterSaveSnackbarOpen(true);
  }, []);

  const showFilterUpdateErrorSnackbar = useCallback((message) => {
    setFilterSnackbarMessage(
      message || "Failed to update filter in CRM. Check console for details."
    );
    setFilterSnackbarSeverity("error");
    setFilterSaveSnackbarOpen(true);
  }, []);

  const persistLatestFilter = useCallback(
    (value) => {
      if (!loggedInUser?.id) return Promise.resolve();
      return persistLatestFilterToUserPreferences(loggedInUser.id, value);
    },
    [loggedInUser?.id]
  );

  const getUserDataAndColor = async () => {
    try {
      ZOHO.CRM.CONFIG.getCurrentUser().then(function (data) {
        ZOHO.CRM.API.getRecord({
          Entity: "users",
          approved: "both",
          RecordID: data?.users[0]?.id,
        }).then(function (userData) {
          const user = userData?.users?.[0];
          setLoggedInUser(user);
          if (user?.id) {
            const emptyFilter = {
              priorityFilter: [],
              activityTypeFilter: [],
              userFilter: [],
            };
            loadUserPreferences(user.id).then(({ savedFilters, latestFilter }) => {
              setSavedFilters(savedFilters);
              setInitialFilter(
                latestFilter != null ? latestFilter : emptyFilter
              );
            });
          }
        });
      });

      ZOHO.CRM.API.getAllRecords({
        Entity: "users",
        sort_order: "asc",
        per_page: 100,
        page: 1,
      }).then((usersResponse) => {
        let temp = usersResponse?.users?.filter((user, index) => {
          return user.status === "active";
          // if (user.status === "active") {
          //   setUsers((prev) => [...prev, user]);
          // }
        });
        setUsers(temp);
      });

      // Get organization variable
      ZOHO.CRM.API.getOrgVariable("recent_colors").then(function (data) {
        // Parse the string to an array and store it in the state
        const colorsArray = JSON.parse(data?.Success?.Content || "[]");
        setRecentColor(colorsArray);
      });

    } catch (error) {}
  };

  const searchDataByDate = useCallback(async () => {
    setLoader(true);
    setMyEvents([]);
    
    // Implement pagination to fetch all records
    let allEventsData = [];
    let currentPage = 1;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      const req_data_meetings = {
        url: `https://www.zohoapis.com.au/crm/v3/Events/search?criteria=((Start_DateTime:greater_equal:${encodeURIComponent(
          startDateTime
        )})and(End_DateTime:less_equal:${encodeURIComponent(
          endDateTime
        )}))&per_page=200&page=${currentPage}`,
        method: "GET",
        param_type: 1,
      };

      try {
        // Fetching data with custom search criteria for current page
        const searchResp = await ZOHO.CRM.CONNECTION.invoke(
          "zoho_crm_conn",
          req_data_meetings
        );

        console.log(`Page ${currentPage} response:`, searchResp);

        const pageEventsData = searchResp?.details?.statusMessage?.data || [];
        const moreRecords = searchResp?.details?.statusMessage?.info?.more_records || false;

        // Add current page data to all events
        allEventsData = [...allEventsData, ...pageEventsData];

        // Check if there are more records to fetch
        hasMoreRecords = moreRecords;
        currentPage++;

        console.log(`Fetched page ${currentPage - 1}, more records: ${moreRecords}, total events so far: ${allEventsData.length}`);

      } catch (error) {
        console.error(`Error fetching page ${currentPage}:`, error);
        hasMoreRecords = false; // Stop pagination on error
      }
    }

    console.log(`Total events fetched from search: ${allEventsData.length}`);

    // Use the accumulated data instead of single page data
    const eventsData = allEventsData;

    const allMeetings = await ZOHO.CRM.API.getAllRecords({
      Entity: "Events",
      sort_order: "desc",
      sort_by: "Modified_Time",
      per_page: 200,
      page: 1,
    });

    const allMeetingsData = allMeetings?.data || [];

    // Filter meetings within date range
    const meetingsWithinRange = allMeetingsData.filter((meeting) => {
      const meetingStart = meeting.Start_DateTime;
      return meetingStart >= startDateTime && meetingStart <= endDateTime;
    });

    // Create a Set of existing IDs for quick lookup
    const existingIds = new Set(eventsData.map((event) => event.id));

    // Combine unique meetings that don't already exist
    const uniqueNewMeetings = meetingsWithinRange.filter(
      (meeting) => !existingIds.has(meeting.id)
    );

    // Combine into a final array
    const combinedEvents = [...eventsData, ...uniqueNewMeetings];

    const eventsDataResult = combinedEvents.map((item, index) => {
      return {
        id: item.id,
        title: item.Event_Title,
        startTime: "",
        endTime: "",
        duration: item.Duration_Min,
        associateWith: {
          Account_Name: item?.What_Id?.name,
          id: item?.What_Id?.id,
        },
        Type_of_Activity: item.Type_of_Activity,
        resource: item.resource,
        scheduleFor: item.Owner,
        scheduledWith: item?.Participants.map((participant) => ({
          Full_Name: participant.name,
          participant: participant.participant,
          type: participant.type,
          status: participant.status,
        })),
        location: item.Venue,
        priority: item.Event_Priority,
        Remind_At: item.Remind_At,
        occurrence: item.Recurring_Activity,
        start: item.Start_DateTime,
        end: item.End_DateTime,
        noEndDate: false,
        color: item.Colour,
        Banner: item.Banner,
        Description: item?.Description,
        Regarding: item?.Regarding,
        Reminder_Text: item?.Reminder_Text,
        send_notification: item?.$send_notification,
        Send_Reminders: item?.Send_Reminders,
        Event_Status: item?.Event_Status,
      };
    });

    setMyEvents(eventsDataResult);
    setLoader(false);
  }, [startDateTime, endDateTime]);

  useEffect(() => {
    ZOHO.embeddedApp.on("PageLoad", async function (data) {
      // setRecordId(data.EntityId[0]);
      // setModuleName(data.Entity);
    });
    ZOHO.embeddedApp.init().then(() => {
      setZohoLoaded(true);
    });
  }, []);

  // Load user data (logged in user, saved filters, latest filter, users, colors) only once.
  // Kept separate from searchDataByDate so that moving between days does not re-run
  // getUserDataAndColor, which re-sets initialFilter and resets the applied saved filter.
  useEffect(() => {
    if (zohoLoaded) {
      getUserDataAndColor();
    }
  }, [zohoLoaded]);

  useEffect(() => {
    if (!zohoLoaded) return undefined;

    let cancelled = false;
    fetchPicklistConfig()
      .then((config) => {
        if (!cancelled) setPicklistConfig(config);
      })
      .catch((error) => {
        console.warn("Failed to load Widget_Picklist_Config:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [zohoLoaded]);

  useEffect(() => {
    if (zohoLoaded) {
      searchDataByDate();
    }
  }, [zohoLoaded, searchDataByDate]);

  if (loggedInUser === null || picklistConfig === null) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <div>
      <TaskScheduler
        myEvents={myEvents}
        setMyEvents={setMyEvents}
        users={users}
        startDateTime={startDateTime}
        setStartDateTime={setStartDateTime}
        endDateTime={endDateTime}
        setEndDateTime={setEndDateTime}
        loader={loader}
        setLoader={setLoader}
        recentColor={recentColor}
        setRecentColor={setRecentColor}
        loggedInUser={loggedInUser}
        savedFilters={savedFilters}
        setSavedFilters={setSavedFilters}
        initialFilter={initialFilter}
        persistSavedFilters={persistSavedFilters}
        persistSavedFiltersWithFeedback={saveFiltersWithFeedback}
        persistLatestFilter={persistLatestFilter}
        filterSaveInProgress={filterSaveInProgress}
        onFilterUpdateSuccess={showFilterUpdateSuccessSnackbar}
        onFilterUpdateError={showFilterUpdateErrorSnackbar}
        picklistConfig={picklistConfig}
      />
      <Snackbar
        open={filterSaveSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setFilterSaveSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setFilterSaveSnackbarOpen(false)}
          severity={filterSnackbarSeverity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {filterSnackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default App;
