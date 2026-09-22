import {
  CalendarNav,
  CalendarNext,
  CalendarPrev,
  CalendarToday,
  Datepicker,
  Eventcalendar,
  Popup,
  Segmented,
  SegmentedGroup,
  setOptions,
  Toast,
  momentTimezone,
} from "@mobiscroll/react";
import moment from "moment-timezone";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@mobiscroll/react/dist/css/mobiscroll.min.css";
import "./test.css";
// import EventForm from "./formComponent/EventForm";
import EventForm from "./formComponent/EventForm";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Modal,
  Snackbar,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import DrawerComponent from "./DrawerComponent";
import { activityType as activityTypeMapping } from "./helperFunction";
import { getTypeOptionsFromConfig } from "../services/picklistConfigService";

momentTimezone.moment = moment;
dayjs.extend(utc);
dayjs.extend(timezone);


setOptions({
  theme: "ios",
  themeVariant: "light",
});

const now = new Date();
const today = now.toISOString().slice(0, 16);

const EMPTY_FILTER = {
  priorityFilter: [],
  activityTypeFilter: [],
  userFilter: [],
};

// Activity types / keywords treated as absences (vacation, time off, etc.)
const ABSENCE_ACTIVITY_TYPES = ["vacation", "holiday"];

// Determines whether an event represents a full-day absence.
const isAbsenceEvent = (original) => {
  const type = String(original?.Type_of_Activity || "").toLowerCase();
  const title = String(original?.title || "").toLowerCase();
  return (
    original?.allDay === true ||
    ABSENCE_ACTIVITY_TYPES.includes(type) ||
    title.includes("vacation") ||
    title.includes("time off") ||
    title.includes("leave") ||
    title.includes("holiday")
  );
};

const TaskScheduler = ({
  myEvents,
  setMyEvents,
  users,
  startDateTime,
  setStartDateTime,
  endDateTime,
  setEndDateTime,
  loader,
  setLoader,
  recentColor,
  setRecentColor,
  loggedInUser,
  savedFilters = [],
  setSavedFilters,
  initialFilter,
  persistSavedFilters,
  persistSavedFiltersWithFeedback,
  persistLatestFilter,
  filterSaveInProgress = false,
  onFilterUpdateSuccess,
  onFilterUpdateError,
  picklistConfig = null,
}) => {
  const [activityType, setActivityType] = useState(activityTypeMapping);
  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD")
  );
  const [myView, setMyView] = useState({
    schedule: {
      type: "day",
      allDay: false,
      startTime: "06:00",
      endTime: "24:00",
    },
  });

  const [view, setView] = useState("day");
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [activityTypeFilter, setActivityTypeFilter] = useState([]);
  const [userFilter, setUserFilter] = useState([]);
  // State for controlling which user columns are visible (empty = show all)
  const [selectedColumns, setSelectedColumns] = useState([]);

  const [clickedEvent, setClickedEvent] = useState(null);
  const [argumentLoader, setArgumentLoader] = useState(false);
  const [myColors, setColors] = useState([]);
  const [open, setOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isToastOpen, setToastOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filteredEvents, setFilteredEvents] = useState(myEvents);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isTooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState(null);
  const [hoverInEvents, setHoverInEvents] = useState();
  const newEvent = clickedEvent?.event;
  const [formData, setFormData] = useState({
    id: newEvent?.id || "",
    title: newEvent?.title || "New Meeting",
    startTime: "",
    endTime: "",
    duration: parseInt(newEvent?.duration) || 0,
    associateWith: newEvent?.associateWith || null,
    Type_of_Activity: newEvent?.Type_of_Activity?.toLowerCase() || "",
    resource: newEvent?.resource || 0,
    scheduleFor: loggedInUser || "",
    scheduledWith: [],
    location: newEvent?.location || "",
    priority: newEvent?.priority?.toLowerCase() || "medium",
    Remind_At: newEvent?.Remind_At || null,
    occurrence: newEvent?.occurrence || "once",
    start: newEvent?.start || "",
    end: newEvent?.end || "",
    noEndDate: false,
    color: newEvent?.color || "#d1891f",
    Banner: newEvent?.Banner || false,
    Description: newEvent?.Description || "",
    create_sperate_contact: false,
    Regarding: newEvent?.Regarding || "",
    Reminder_Text: newEvent?.Reminder_Text || "",
    send_notification: newEvent?.send_notification || false,
    Send_Reminders: newEvent?.Send_Reminders || false,
    Event_Status: newEvent?.Event_Status,
  });
  const timer = useRef(null);

  useEffect(() => {
    const configuredTypes = getTypeOptionsFromConfig(picklistConfig);
    setActivityType(
      configuredTypes.map((type, index) => {
        const matchingFallback = activityTypeMapping.find(
          (item) => item.type === type
        );
        const positionalFallback = activityTypeMapping[index];
        const configuredResource = picklistConfig?.typeResources?.[type];
        return {
          type,
          // Sort_Order in the seeded config follows the legacy resource order.
          // Name matching handles unchanged values; Sort_Order preserves the
          // numeric resource when an administrator renames a Type.
          resource:
            matchingFallback?.resource ??
            configuredResource ??
            positionalFallback?.resource ??
            index + 1,
        };
      })
    );
  }, [picklistConfig]);

  const filterActivityTypes = useMemo(() => {
    const mergedTypes = [...activityType];
    const knownTypes = new Set(mergedTypes.map((item) => item.type));

    myEvents.forEach((event) => {
      const type = event?.Type_of_Activity;
      if (type && !knownTypes.has(type)) {
        knownTypes.add(type);
        mergedTypes.push({ type, resource: event?.resource ?? 0 });
      }
    });

    return mergedTypes;
  }, [activityType, myEvents]);

  useEffect(() => {
    let filtered = myEvents;

    if (priorityFilter.length > 0) {
      filtered = filtered.filter((obj) => {
        return priorityFilter.includes(obj.priority);
      });
    }

    if (activityTypeFilter.length > 0) {
      filtered = filtered.filter((obj) => {
        return activityTypeFilter.includes(obj.Type_of_Activity);
      });
    }

    if (userFilter.length > 0) {
      filtered = filtered.filter((obj) => {
        const name = obj.scheduleFor?.name ?? obj.scheduleFor?.full_name;
        return name != null && userFilter.includes(name);
      });
    }

    // Map each event's resource to its owner's user ID for user-based column display
    setFilteredEvents(
      filtered.map((event) => ({
        ...event,
        resource: event.scheduleFor?.id ?? null,
      }))
    );
  }, [priorityFilter, activityTypeFilter, myEvents, userFilter]);

  useEffect(() => {
    if (initialFilter != null) {
      setPriorityFilter(
        Array.isArray(initialFilter.priorityFilter)
          ? initialFilter.priorityFilter
          : []
      );
      setActivityTypeFilter(
        Array.isArray(initialFilter.activityTypeFilter)
          ? initialFilter.activityTypeFilter
          : []
      );
      const uf = Array.isArray(initialFilter.userFilter)
        ? initialFilter.userFilter
        : [];
      setUserFilter(uf);

      let sc = Array.isArray(initialFilter.selectedColumns)
        ? initialFilter.selectedColumns
        : [];
      if (sc.length === 0 && uf.length > 0 && Array.isArray(users)) {
        sc = users.filter((u) => uf.includes(u.full_name)).map((u) => u.id);
      }
      setSelectedColumns(sc);
    } else if (loggedInUser?.full_name) {
      setUserFilter([loggedInUser.full_name]);
      if (loggedInUser?.id) {
        setSelectedColumns([loggedInUser.id]);
      } else if (Array.isArray(users)) {
        const match = users.find((u) => u.full_name === loggedInUser.full_name);
        if (match) setSelectedColumns([match.id]);
      }
    }
  }, [initialFilter, loggedInUser?.full_name, loggedInUser?.id, users]);

  const applyFilter = useCallback(
    (savedFilter) => {
      if (!savedFilter) return;
      const pf = Array.isArray(savedFilter.priorityFilter)
        ? savedFilter.priorityFilter
        : [];
      const af = Array.isArray(savedFilter.activityTypeFilter)
        ? savedFilter.activityTypeFilter
        : [];
      const uf = Array.isArray(savedFilter.userFilter)
        ? savedFilter.userFilter
        : [];
      setPriorityFilter(pf);
      setActivityTypeFilter(af);
      setUserFilter(uf);

      let sc = Array.isArray(savedFilter.selectedColumns)
        ? savedFilter.selectedColumns
        : [];
      if (sc.length === 0 && uf.length > 0 && Array.isArray(users)) {
        sc = users.filter((u) => uf.includes(u.full_name)).map((u) => u.id);
      }
      setSelectedColumns(sc);

      if (persistLatestFilter) {
        persistLatestFilter({
          priorityFilter: pf,
          activityTypeFilter: af,
          userFilter: uf,
          selectedColumns: sc,
        }).catch((err) => console.warn("Could not persist latest filter", err));
      }
    },
    [persistLatestFilter, users]
  );

  const clearFilter = useCallback(() => {
    setPriorityFilter([]);
    setActivityTypeFilter([]);
    setUserFilter([]);
    setSelectedColumns([]);
    if (persistLatestFilter) {
      persistLatestFilter(EMPTY_FILTER).catch((err) =>
        console.warn("Could not persist latest filter", err)
      );
    }
  }, [persistLatestFilter]);

  const saveCurrentFilter = useCallback(
    (name) => {
      let sc = [...selectedColumns];
      if (sc.length === 0 && userFilter.length > 0 && Array.isArray(users)) {
        sc = users.filter((u) => userFilter.includes(u.full_name)).map((u) => u.id);
      }
      const newFilter = {
        name: name || "Unnamed filter",
        priorityFilter: [...priorityFilter],
        activityTypeFilter: [...activityTypeFilter],
        userFilter: [...userFilter],
        selectedColumns: sc,
      };
      const next = [...savedFilters, newFilter];
      setSavedFilters(next);
      if (persistSavedFiltersWithFeedback) {
        persistSavedFiltersWithFeedback(next);
      } else if (persistSavedFilters) {
        persistSavedFilters(next);
      }
    },
    [
      priorityFilter,
      activityTypeFilter,
      userFilter,
      selectedColumns,
      users,
      savedFilters,
      setSavedFilters,
      persistSavedFiltersWithFeedback,
      persistSavedFilters,
    ]
  );

  const updateSavedFilter = useCallback(
    (index, updatedFilter) => {
      if (index < 0 || !updatedFilter) return;
      setSavedFilters((prev) => {
        const next = prev.slice();
        const uf = Array.isArray(updatedFilter.userFilter)
          ? updatedFilter.userFilter
          : prev[index]?.userFilter ?? [];
        let sc = Array.isArray(updatedFilter.selectedColumns)
          ? updatedFilter.selectedColumns
          : prev[index]?.selectedColumns ?? [];
        if (sc.length === 0 && uf.length > 0 && Array.isArray(users)) {
          sc = users.filter((u) => uf.includes(u.full_name)).map((u) => u.id);
        }
        next[index] = {
          name: updatedFilter.name ?? prev[index]?.name ?? "Unnamed filter",
          priorityFilter: Array.isArray(updatedFilter.priorityFilter)
            ? updatedFilter.priorityFilter
            : prev[index]?.priorityFilter ?? [],
          activityTypeFilter: Array.isArray(updatedFilter.activityTypeFilter)
            ? updatedFilter.activityTypeFilter
            : prev[index]?.activityTypeFilter ?? [],
          userFilter: uf,
          selectedColumns: sc,
        };
        if (persistSavedFilters) {
          persistSavedFilters(next)
            .then(() => onFilterUpdateSuccess?.())
            .catch((err) => {
              console.warn("Failed to persist saved filters after update", err);
              const msg =
                err?.message ?? (typeof err === "object" ? JSON.stringify(err) : String(err));
              onFilterUpdateError?.(msg);
            });
        }
        return next;
      });
    },
    [setSavedFilters, persistSavedFilters, onFilterUpdateSuccess, onFilterUpdateError, users]
  );

  const deleteSavedFilter = useCallback(
    (index) => {
      if (index < 0) return;
      setSavedFilters((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (persistSavedFilters) {
          persistSavedFilters(next).catch((err) => {
            console.warn("Failed to persist saved filters after delete", err);
          });
        }
        return next;
      });
    },
    [setSavedFilters, persistSavedFilters]
  );

  useEffect(() => {
    for (const event of myEvents) {
      event.start = event.start ? new Date(event.start) : event.start;
      event.end = event.end ? new Date(event.end) : event.end;
      event.editable = !!(event.start && today < event.start);
    }
  }, [myEvents]);

  const changeView = useCallback((event) => {
    let myView;

    switch (event.target.value) {
      case "month":
        // setStartDateTime(
        //   dayjs().startOf("month").format("YYYY-MM-DD") + "T00:00:00+10:30"
        // );
        // setEndDateTime(
        //   dayjs().endOf("month").format("YYYY-MM-DD") + "T23:59:59+10:30"
        // );
        myView = {
          // schedule: {
          //   type: "month",
          // },
          calendar: { type: "month", labels: true },
          // agenda: { type: "month" },
        };

        break;
      case "week":
        // setStartDateTime(
        //   dayjs().day(1).startOf("week").format("YYYY-MM-DD") +
        //     "T00:00:00+10:30"
        // );
        // setEndDateTime(
        //   dayjs().day(1).startOf("week").endOf("week").format("YYYY-MM-DD") +
        //     "T23:59:59+10:30"
        // );
        myView = {
          schedule: {
            type: "week",
            allDay: false,
            startTime: "06:00",
            endTime: "24:00",
            startDay: 1,
            endDay: 5,
          },
          // calendar: { type: "week" },
          // calendar: { type: "week", labels: true },
          // calendar: { labels: true, type: "week", size: 1 },
          // agenda: { type: "week" },
        };

        break;
      case "day":
        // setStartDateTime(dayjs().format("YYYY-MM-DD") + "T00:00:00+10:30");
        // setEndDateTime(dayjs().format("YYYY-MM-DD") + "T23:59:59+10:30");
        myView = {
          schedule: {
            type: "day",
            allDay: false,
            startTime: "06:00",
            endTime: "24:00",
          },
        };

        break;
      default:
        myView = {
          schedule: {
            type: "day",
            allDay: false,
            startTime: "06:00",
            endTime: "24:00",
          },
        };
        break;
    }

    setView(event.target.value);
    setMyView(myView);
  }, []);

  const myInvalid = useMemo(
    () => [
      {
        start: "06:00",
        end: "08:00",
        // title: 'Lunch break',
        type: "lunch",
        recurring: {
          repeat: "daily",
          // weekDays: 'MO,TU,WE,TH,FR',
        },
      },
    ],
    []
  );

  const handleEventCreate = useCallback((args) => {
    const event = args.event;
    event.unscheduled = false;
    setColors([]);
    setOpen(true);
  }, []);

  const handleEventCreated = useCallback(
    (args) => {
      setToastMessage(args.event.title + " added");
      setToastOpen(true);
      setMyEvents((prevEvents) => [...prevEvents, args.event]);
    },
    [setMyEvents]
  );

  const handleFailed = useCallback((event) => {
    if (event.start <= today) {
      setToastMessage("Can't add event in the past");
    } else {
      setToastMessage("Make sure not to double book");
    }
    setToastOpen(true);
  }, []);

  const handleEventCreateFailed = useCallback(
    (args) => {
      handleFailed(args.event);
    },
    [handleFailed]
  );

  const handleEventUpdateFailed = useCallback(
    (args) => {
      handleFailed(args.event);
    },
    [handleFailed]
  );

  const handleEventDelete = useCallback(
    (args) => {
      setToastMessage(args.event.title + " unscheduled");
      setToastOpen(true);
      setMyEvents((prevEvents) =>
        prevEvents.filter((item) => item.id !== args.event.id)
      );
    },
    [setMyEvents]
  );

  const handleEventDragEnter = useCallback(() => {
    setColors([
      {
        background: "#f1fff24d",
        start: "08:00",
        end: "20:00",
        recurring: {
          repeat: "daily",
        },
      },
    ]);
  }, []);

  const handleEventDragLeave = useCallback(() => {
    setColors([]);
  }, []);

  const handleCloseToast = useCallback(() => {
    setToastOpen(false);
  }, []);

  ////my code
  const handleInputChange = (field, value) => {
    if (field === "resource") {
      value = parseInt(value, 10); // Convert the input to an integer
    }

    if (field === "scheduleWith") {
      setFormData((prev) => {
        return {
          ...prev,
          [field]: Array.isArray(value) ? [...value] : value, // Spread array values for multiple selections
        };
      });
    }
    setFormData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  const handleCellDoubleClick = (args) => {
    console.log(args);
    handleInputChange("start", args.date);
    handleInputChange("title", "new meeting");
    handleInputChange(
      "end",
      new Date(dayjs(args.date).add(1, "hour").toDate())
    );
    handleInputChange("duration", 60);
    handleInputChange("priority", "medium");
    let date = new Date(args.date);

    date.setMinutes(date.getMinutes() - parseInt(5, 10));

    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );

    const modifiedDate = localDate.toISOString().slice(0, 16);

    handleInputChange("Remind_At", modifiedDate);
    handleInputChange("Reminder_Text", "");

    // Pre-fill scheduleFor from the clicked user column
    const clickedUser = Array.isArray(users)
      ? users.find((u) => u.id === args.resource)
      : null;
    handleInputChange("scheduleFor", clickedUser || loggedInUser);

    setOpen(true);
  };

  // Build resources from the users list — each user becomes a column
  const userResources = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.map((user) => ({
      id: user.id,
      name: user.full_name,
    }));
  }, [users]);

  // Filter visible resources by selectedColumns (empty = show all)
  const visibleResources = useMemo(() => {
    if (selectedColumns.length > 0) {
      return userResources.filter((r) => selectedColumns.includes(r.id));
    }
    return userResources;
  }, [userResources, selectedColumns]);

  const customWithNavButtons = useCallback(() => {
    const props = { placeholder: "Select date...", inputStyle: "box" };
    const handleDatepickerDates = (e) => {
      let currentDate = dayjs(e.value).format("YYYY-MM-DD");
      const beginDate =
        dayjs(currentDate).startOf("day").format("YYYY-MM-DD") +
        "T00:00:00+10:30";
      const closeDate =
        dayjs(currentDate).endOf("day").format("YYYY-MM-DD") +
        "T23:59:59+10:30";
      setSelectedDate(e.value);
      setStartDateTime(beginDate);
      setEndDateTime(closeDate);
      setView("day");
      setMyView({
        schedule: {
          type: "day",
          allDay: false,
          startTime: "06:00",
          endTime: "24:00",
        },
      });
    };

    return (
      <span
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        <span
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          <CalendarNav className="cal-header-nav" />

          <SegmentedGroup value={view} onChange={changeView}>
            <Segmented value="month">Month</Segmented>
            <Segmented value="week">Week</Segmented>
            <Segmented value="day">Day</Segmented>
          </SegmentedGroup>
          <CalendarPrev className="cal-header-prev" />
          <CalendarToday className="cal-header-today" />
          <CalendarNext className="cal-header-next" />
        </span>

        <span
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          <Datepicker
            // controls={["calendar"]}
            calendarType="month"
            dateFormat="DD/MM/YYYY"
            display="top"
            calendarScroll={"vertical"}
            pages={3}
            className="mbsc-textfield"
            inputProps={props}
            onChange={handleDatepickerDates}
            value={selectedDate}
          />

          <Button
            variant="contained"
            size="small"
            onClick={() => {
              setDrawerOpen(true);
            }}
            sx={{ right: 8 }}
          >
            Filter
          </Button>
        </span>
      </span>
    );
  }, [view, changeView, selectedDate, setEndDateTime, setStartDateTime]);

  const onClose = () => {
    setOpen(false);
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
    });
    setClickedEvent(null);
  };

  const handleEventClick = (args) => {
    setArgumentLoader(true);
    setClickedEvent(args?.event);
    console.log("mehedi", args?.event)
    const eventType = args?.event?.Type_of_Activity;
    const eventResource = args?.event?.resource;
    let mappedResource = eventResource;

    // If resource is missing but Type_of_Activity exists, find resource from helperFunction
    // Check for null, undefined, or 0 (0 is not a valid resource ID in helperFunction)
    if ((mappedResource == null || mappedResource === 0) && eventType) {
      // Case-insensitive comparison to find matching activity type
      const eventTypeLower = typeof eventType === 'string' ? eventType.toLowerCase().trim() : '';
      
      if (eventTypeLower) {
        const foundActivity = activityType.find((a) =>
          a.type.toLowerCase() === eventTypeLower
        );
        
        if (foundActivity) {
          mappedResource = foundActivity.resource;
          console.log(`Mapped resource ${mappedResource} for Type_of_Activity: ${eventType}`);
        }
      }
    }

    // Resolve scheduleFor to a user object from users so the "Schedule for" Autocomplete displays correctly
    const eventOwner = args?.event?.scheduleFor;
    let scheduleForValue = eventOwner
      ? { ...eventOwner, full_name: eventOwner.full_name ?? eventOwner.name }
      : null;
    if (scheduleForValue && Array.isArray(users) && users.length > 0) {
      const matchedUser = users.find(
        (u) =>
          u.id === scheduleForValue.id ||
          String(u.id) === String(scheduleForValue.id)
      );
      if (matchedUser) {
        scheduleForValue = {
          ...matchedUser,
          full_name: matchedUser.full_name ?? matchedUser.name,
        };
      }
    }

    setFormData({
      id: args?.event?.id,
      title: args?.event?.title,
      startTime: "",
      endTime: "",
      duration: parseInt(args?.event?.duration) || 0,
      associateWith: args?.event?.associateWith,
      Type_of_Activity: eventType,
      resource: mappedResource,
      scheduleFor: scheduleForValue,
      scheduledWith: args?.event?.scheduledWith,
      location: args?.event?.location,
      priority: args?.event?.priority?.toLowerCase(),
      Remind_At: args?.event?.Remind_At,
      occurrence: args?.event?.occurrence,
      start: dayjs(args?.event?.start).format("YYYY-MM-DDTHH:mm"),
      end: dayjs(args?.event?.end).format("YYYY-MM-DDTHH:mm"),
      noEndDate: false,
      color: args?.event?.color,
      Banner: args?.event?.Banner,
      Description: args?.event?.Description,
      Reminder_Text: args?.event?.Reminder_Text,
      send_notification: args?.event?.send_notification,
      Send_Invites: args?.event?.send_notification,
      Regarding: args?.event?.Regarding,
      Event_Status: args?.event?.Event_Status,
      Send_Reminders: args?.event?.Send_Reminders,
    });
    setOpen(true);
    setArgumentLoader(false);
  };

  const onPageChange = async (e) => {
    let newStartDate = dayjs(e.month).format("YYYY-MM-DD");
    setSelectedDate(newStartDate);

    if (view === "day") {
      const beginDate =
        dayjs(newStartDate).startOf("day").format("YYYY-MM-DD") +
        "T00:00:00+10:30";
      const closeDate =
        dayjs(newStartDate).endOf("day").format("YYYY-MM-DD") +
        "T23:59:59+10:30";
      setStartDateTime(beginDate);
      setEndDateTime(closeDate);
    }

    if (view === "week") {
      const beginDate =
        dayjs(newStartDate).startOf("day").format("YYYY-MM-DD") +
        "T00:00:00+10:30";
      const closeDate =
        dayjs(newStartDate).add(4, "day").format("YYYY-MM-DD") +
        "T23:59:59+10:30";
      setStartDateTime(beginDate);
      setEndDateTime(closeDate);
    }

    if (view === "month") {
      const beginDate =
        dayjs(newStartDate).startOf("day").format("YYYY-MM-DD") +
        "T00:00:00+10:30";
      const closeDate =
        dayjs(newStartDate).endOf("month").format("YYYY-MM-DD") +
        "T23:59:59+10:30";
      setStartDateTime(beginDate);
      setEndDateTime(closeDate);
    }
  };

  const openTooltip = useCallback((args) => {
    const event = args.event;
    // const time = formatDate('hh:mm A', new Date(event.start)) + ' - ' + formatDate('hh:mm A', new Date(event.end));

    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    // if (event.confirmed) {
    //   setAppointmentStatus('Confirmed');
    //   setButtonText('Cancel appointment');
    //   setButtonType('warning');
    // } else {
    //   setAppointmentStatus('Canceled');
    //   setButtonText('Confirm appointment');
    //   setButtonType('success');
    // }

    // setAppointment(event);
    setHoverInEvents(event);
    // setAppointmentInfo(event.title + ', Age: ' + event.age);
    // setAppointmentLocation(event.location);
    // setAppointmentTime(time);
    // setAppointmentReason(event.reason);
    // setTooltipColor(doctor.color);
    setTooltipAnchor(args.domEvent.target.closest(".mbsc-schedule-event"));
    setTooltipOpen(true);
  }, []);

  const handleTooltipClose = useCallback(() => {
    setTooltipOpen(false);
  }, []);

  const handleEventHoverIn = useCallback(
    (args) => {
      // setHoverInEvents(args.event)
      openTooltip(args);
    },
    [openTooltip]
  );

  const handleEventHoverOut = useCallback(() => {
    if (!timer.current) {
      timer.current = setTimeout(() => {
        setTooltipOpen(false);
      }, 200);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    timer.current = setTimeout(() => {
      setTooltipOpen(false);
    }, 200);
  }, []);

  const renderEvent = useCallback((data) => {
    const isClosed = data.original.Event_Status === "Closed"; // Check if the event is closed
    const isAllDay = data.allDay;
    const isAbsence = isAbsenceEvent(data.original);
    const eventColor = data.style?.background || data.original?.color || "#757575";
    const theme = "mbsc-ios"; // your theme name
    return (
      <>
        <div
          className={
            "mbsc-schedule-event-background mbsc-timeline-event-background " +
            (isAllDay ? " mbsc-schedule-event-all-day-background" : "") +
            theme
          }
          style={{ background: eventColor }}
        />
        {isAbsence ? (
          <div
            className={
              "mbsc-schedule-event-inner mbsc-absence-event-inner " +
              theme +
              (isAllDay ? " mbsc-schedule-event-all-day-inner" : "") +
              (data.cssClass || "")
            }
            style={{ color: "white" }}
          >
            <BeachAccessIcon fontSize="small" className="mbsc-absence-icon" />
          </div>
        ) : (
          <div
            className={
              "mbsc-schedule-event-inner " +
              theme +
              (isAllDay ? " mbsc-schedule-event-all-day-inner" : "") +
              (data.cssClass || "")
            }
            style={{ color: "black" }}
          >
            <div
              className={
                "mbsc-schedule-event-title " +
                (isAllDay ? " mbsc-schedule-event-all-day-title " : "") +
                theme
              }
              style={{ textDecoration: isClosed ? "line-through" : "none" }}
            >
              {data.title}
            </div>
            {!isAllDay && (
              <div className={"mbsc-schedule-event-range " + theme}>
                {data.start} - {data.end}
              </div>
            )}
          </div>
        )}
      </>
    );
  }, []);

  // if (loader) {
  //   return <Box> Fetching data ....</Box>;
  // }

  if (!loggedInUser) {
    return <>...</>;
  }

  return (
    <div style={{ padding: "1em" }}>
      <div
        // className="mbsc-grid mbsc-no-padding"
        style={{
          borderTop: "1px solid #ccc",
          borderLeft: "1px solid #ccc",
          borderRight: "1px solid #ccc",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div className="mbsc-row">
          <div className="mbsc-col-sm-12 docs-appointment-calendar">
            {/* {console.log({ filteredEvents, myView, resources, myInvalid })} */}
            <Eventcalendar
              timezonePlugin={momentTimezone}
              dataTimezone="utc"
              // displayTimezone="Australia/Adelaide"
              data={filteredEvents}
              view={myView}
              resources={visibleResources}
              renderHeader={customWithNavButtons}
              invalid={myInvalid}
              renderScheduleEvent={renderEvent}
              onPageChange={onPageChange}
              dragToMove={true}
              dragToCreate={true}
              eventOverlap={false}
              externalDrop={true}
              externalDrag={true}
              selectedDate={selectedDate}
              colors={myColors}
              onCellDoubleClick={handleCellDoubleClick}
              onEventClick={handleEventClick}
              onEventCreate={handleEventCreate}
              onEventCreated={handleEventCreated}
              onEventCreateFailed={handleEventCreateFailed}
              onEventUpdateFailed={handleEventUpdateFailed}
              onEventDelete={handleEventDelete}
              onEventDragEnter={handleEventDragEnter}
              onEventDragLeave={handleEventDragLeave}
              onEventHoverIn={handleEventHoverIn}
              onEventHoverOut={handleEventHoverOut}
              className="mbsc-schedule-date-header-text mbsc-schedule-resource-title"
            />
            <Popup
              anchor={tooltipAnchor}
              contentPadding={false}
              display="anchored"
              isOpen={isTooltipOpen}
              scrollLock={false}
              showOverlay={false}
              touchUi={false}
              width={350}
              onClose={handleTooltipClose}
            >
              <div
                className="mds-tooltip"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                  mt={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    minWidth={"120px"}
                  >
                    Activity Title
                  </Typography>
                  <Typography variant="p">{hoverInEvents?.title}</Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    maxWidth={"120px"}
                  >
                    Activity Type
                  </Typography>
                  <Typography
                    variant="p"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: "8",
                      WebkitBoxOrient: "vertical",
                      ml: 2,
                      textAlign: "right",
                    }}
                  >
                    {hoverInEvents?.Type_of_Activity}
                  </Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    maxWidth={"120px"}
                  >
                    Priority
                  </Typography>
                  <Typography variant="p">{hoverInEvents?.priority}</Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    maxWidth={"120px"}
                  >
                    Start time
                  </Typography>
                  <Typography variant="p">
                    {dayjs(hoverInEvents?.start).format("DD/MM/YYYY hh:mm A")}
                  </Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    maxWidth={"120px"}
                  >
                    End time
                  </Typography>
                  <Typography variant="p">
                    {dayjs(hoverInEvents?.end).format("DD/MM/YYYY hh:mm A")}
                  </Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    maxWidth={"120px"}
                  >
                    Description
                  </Typography>
                  <Typography
                    variant="p"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: "8",
                      WebkitBoxOrient: "vertical",
                      ml: 2,
                      textAlign: "right",
                    }}
                  >
                    {hoverInEvents?.Description}
                  </Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    minWidth={"120px"}
                  >
                    Regarding
                  </Typography>
                  <Typography variant="p">
                    {hoverInEvents?.Regarding}
                  </Typography>
                </Box>
                <Box
                  display={"flex"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                  mb={2}
                  px={1.5}
                >
                  <Typography
                    variant="p"
                    sx={{
                      fontSize: "medium",
                      fontWeight: "bolder",
                      textAlign: "left",
                    }}
                    display={"inline-block"}
                    minWidth={"120px"}
                  >
                    Scheduled With
                  </Typography>
                  <ul style={{ width: "100%" }}>
                    {hoverInEvents?.scheduledWith?.length > 0 &&
                      hoverInEvents.scheduledWith.map((item, index) => {
                        const contactId = item?.id || item?.participant; // fallback logic
                        return (
                          <li key={index}>
                            <a
                              href={`https://crm.zoho.com.au/crm/org7004396182/tab/Contacts/${contactId}/canvas/76775000000287551`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item?.Full_Name}
                            </a>
                          </li>
                        );
                      })}
                  </ul>
                </Box>
              </div>
            </Popup>
            <Toast
              isOpen={isToastOpen}
              message={toastMessage}
              onClose={handleCloseToast}
            />
          </div>
          <DrawerComponent
            open={drawerOpen}
            setOpen={setDrawerOpen}
            users={users}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            activityTypeFilter={activityTypeFilter}
            setActivityTypeFilter={setActivityTypeFilter}
            userFilter={userFilter}
            setUserFilter={setUserFilter}
            selectedColumns={selectedColumns}
            setSelectedColumns={setSelectedColumns}
            savedFilters={savedFilters}
            onApplyFilter={applyFilter}
            onClearFilter={clearFilter}
            onSaveCurrentFilter={saveCurrentFilter}
            onUpdateSavedFilter={updateSavedFilter}
            onDeleteSavedFilter={deleteSavedFilter}
            filterSaveInProgress={filterSaveInProgress}
            activityTypes={filterActivityTypes}
          />

          <Dialog
            open={open}
            onClose={onClose}
            fullWidth // ✅ Makes it responsive
            maxWidth="md" // ✅ Adjust max width (options: 'xs', 'sm', 'md', 'lg', 'xl')
          >
            <DialogContent sx={{ padding: 0 }}>
              <EventForm
                myEvents={myEvents}
                setEvents={setMyEvents}
                setOpen={setOpen}
                onClose={onClose}
                activityType={activityType}
                setActivityType={setActivityType}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                formData={formData}
                handleInputChange={handleInputChange}
                setFormData={setFormData}
                users={users}
                recentColor={recentColor}
                setRecentColor={setRecentColor}
                clickedEvent={clickedEvent}
                setClickedEvent={setClickedEvent}
                argumentLoader={argumentLoader}
                snackbarOpen={snackbarOpen}
                setSnackbarOpen={setSnackbarOpen}
                loggedInUser={loggedInUser}
                picklistConfig={picklistConfig}
              />
            </DialogContent>
          </Dialog>
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={(even, reason) => {
              if (reason === "clickaway") {
                return;
              }

              setSnackbarOpen(false);
            }}
          >
            <Alert
              onClose={(even, reason) => {
                if (reason === "clickaway") {
                  return;
                }

                setSnackbarOpen(false);
              }}
              severity="success"
              variant="filled"
              sx={{ width: "100%" }}
            >
              Event created successfully !
            </Alert>
          </Snackbar>
          <Modal
            open={loader}
            onClose={() => setLoader(false)}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 400,
                bgcolor: "background.paper",
                border: "2px solid #000",
                boxShadow: 24,
                p: 4,
              }}
            >
              <Typography
                id="modal-modal-title"
                variant="h6"
                component="h2"
                textAlign={"center"}
              >
                Fetching data ...
              </Typography>
              <Box textAlign={"center"} mt={3}>
                <CircularProgress />
              </Box>
            </Box>
          </Modal>
          {/* {loader && } */}
        </div>
      </div>
    </div>
  );
};

export default TaskScheduler;
