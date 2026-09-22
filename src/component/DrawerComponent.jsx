import React, { useState, useEffect } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  ListItemButton,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { activityType as fallbackActivityTypes } from "./helperFunction";

const DrawerComponent = ({
  open,
  setOpen,
  priorityFilter,
  setPriorityFilter,
  activityTypeFilter,
  setActivityTypeFilter,
  users,
  userFilter,
  setUserFilter,
  selectedColumns,
  setSelectedColumns,
  savedFilters = [],
  onApplyFilter,
  onClearFilter,
  onSaveCurrentFilter,
  onUpdateSavedFilter,
  onDeleteSavedFilter,
  filterSaveInProgress = false,
  activityTypes = [],
}) => {
  const [saveFilterName, setSaveFilterName] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPriority, setEditPriority] = useState([]);
  const [editActivityType, setEditActivityType] = useState([]);
  const [editUser, setEditUser] = useState([]);
  const theme = useTheme();

  useEffect(() => {
    if (editIndex !== null && savedFilters[editIndex]) {
      const f = savedFilters[editIndex];
      setEditName(f.name || "");
      setEditPriority(Array.isArray(f.priorityFilter) ? f.priorityFilter : []);
      setEditActivityType(
        Array.isArray(f.activityTypeFilter) ? f.activityTypeFilter : []
      );
      setEditUser(Array.isArray(f.userFilter) ? f.userFilter : []);
    }
  }, [editIndex, savedFilters]);

  const handleOpenEdit = (e, index) => {
    e.stopPropagation();
    setEditIndex(index);
  };

  const handleCloseEdit = () => {
    setEditIndex(null);
  };

  const handleSaveEdit = () => {
    if (editIndex === null || !onUpdateSavedFilter) return;
    const matchingCols = Array.isArray(users)
      ? users.filter((u) => editUser.includes(u.full_name)).map((u) => u.id)
      : [];
    const updated = {
      name: editName.trim() || "Unnamed filter",
      priorityFilter: editPriority,
      activityTypeFilter: editActivityType,
      userFilter: editUser,
      selectedColumns: matchingCols,
    };
    onUpdateSavedFilter(editIndex, updated);
    if (onApplyFilter) onApplyFilter(updated);
    handleCloseEdit();
  };

  const handleDelete = (e, index) => {
    e.stopPropagation();
    if (onDeleteSavedFilter) onDeleteSavedFilter(index);
  };

  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: 48 * 4.5 + 8,
        width: 250,
      },
    },
  };
  const priority = ["Low", "Medium", "High"];
  const activityType = activityTypes.length
    ? activityTypes
    : fallbackActivityTypes;

  const handleChange = (event) => {
    const {
      target: { value },
    } = event;
    setPriorityFilter(typeof value === "string" ? value.split(",") : value);
  };

  const handleActivityTypeChange = (event) => {
    const {
      target: { value },
    } = event;
    setActivityTypeFilter(typeof value === "string" ? value.split(",") : value);
  };

  const handleUserChange = (event) => {
    const {
      target: { value },
    } = event;
    const nextUsers = typeof value === "string" ? value.split(",") : value;
    setUserFilter(nextUsers);
    if (setSelectedColumns && Array.isArray(users)) {
      if (nextUsers.length === 0) {
        setSelectedColumns([]);
      } else {
        const matchingIds = users
          .filter((u) => nextUsers.includes(u.full_name))
          .map((u) => u.id);
        setSelectedColumns(matchingIds);
      }
    }
  };

  const handleColumnChange = (event) => {
    const {
      target: { value },
    } = event;
    const nextCols = typeof value === "string" ? value.split(",") : value;
    setSelectedColumns(nextCols);
    if (setUserFilter && Array.isArray(users)) {
      if (nextCols.length === 0) {
        setUserFilter([]);
      } else {
        const matchingNames = users
          .filter((u) => nextCols.includes(u.id))
          .map((u) => u.full_name);
        setUserFilter(matchingNames);
      }
    }
  };
  return (
    <Drawer
      sx={{
        width: 300,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 300,
        },
      }}
      variant="persistent"
      anchor="right"
      open={open}
      onClose={() => setOpen(false)}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          padding: theme.spacing(0, 1),
          // necessary for content to be below app bar
          ...theme.mixins.toolbar,
          justifyContent: "flex-start",
        }}
      >
        <IconButton onClick={() => setOpen(false)}>
          {theme.direction === "rtl" ? (
            <ChevronLeftIcon />
          ) : (
            <ChevronRightIcon />
          )}
        </IconButton>
      </Box>
      <Divider />
      <Box p={2}>
        {/* Saved filters */}
        {savedFilters.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Saved filters
            </Typography>
            {savedFilters.map((filter, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ListItemButton
                  onClick={() => onApplyFilter && onApplyFilter(filter)}
                  dense
                  sx={{ flex: 1, py: 0.5 }}
                >
                  <ListItemText
                    primary={filter.name || "Unnamed filter"}
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItemButton>
                <IconButton
                  size="small"
                  onClick={(e) => handleOpenEdit(e, index)}
                  aria-label="Edit filter"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => handleDelete(e, index)}
                  aria-label="Delete filter"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={() => onClearFilter && onClearFilter()}
          sx={{ mb: 2 }}
        >
          Clear filter
        </Button>

        <FormControl fullWidth size="small">
          <InputLabel id="demo-simple-select-standard-label">
            Priority
          </InputLabel>
          <Select
            labelId="demo-simple-select-standard-label"
            id="demo-simple-select-standard"
            multiple
            value={priorityFilter} // Make sure value is an array
            onChange={handleChange} // Correct onChange handler
            MenuProps={MenuProps}
            input={<OutlinedInput label="Priority" />}
            renderValue={(selected) => selected.join(", ")}
          >
            {priority.map((item, index) => (
              <MenuItem value={item} key={index}>
                <Checkbox checked={priorityFilter.includes(item)} />
                <ListItemText primary={item} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mt: 3 }}>
          <InputLabel id="activity-type-select-label">Activity Type</InputLabel>
          <Select
            labelId="activity-type-select-label"
            id="activity-type-select"
            multiple
            value={activityTypeFilter}
            onChange={handleActivityTypeChange}
            MenuProps={MenuProps}
            input={<OutlinedInput label="Activity Type" />}
            renderValue={(selected) => selected.join(", ")}
          >
            {activityType.map((activity, index) => (
              <MenuItem value={activity.type} key={index}>
                <Checkbox
                  checked={activityTypeFilter.includes(activity.type)}
                />
                <ListItemText primary={activity.type} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* User Filter */}
        <FormControl fullWidth size="small" sx={{ mt: 3 }}>
          <InputLabel>Schedule For</InputLabel>
          <Select
            multiple
            value={userFilter}
            onChange={handleUserChange}
            MenuProps={MenuProps}
            input={<OutlinedInput label="Schedule For" />}
            renderValue={(selected) => selected.join(", ")}
          >
            {users.map((user, index) => (
              <MenuItem key={index} value={user.full_name}>
                <Checkbox checked={userFilter.includes(user.full_name)} />
                <ListItemText primary={user.full_name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Visible Columns filter */}
        <FormControl fullWidth size="small" sx={{ mt: 3 }}>
          <InputLabel>Visible Columns</InputLabel>
          <Select
            multiple
            value={selectedColumns || []}
            onChange={handleColumnChange}
            MenuProps={MenuProps}
            input={<OutlinedInput label="Visible Columns" />}
            renderValue={(selected) => {
              if (!Array.isArray(users) || selected.length === 0)
                return "All users";
              return users
                .filter((u) => selected.includes(u.id))
                .map((u) => u.full_name)
                .join(", ");
            }}
          >
            {Array.isArray(users) &&
              users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <Checkbox
                    checked={
                      Array.isArray(selectedColumns) &&
                      selectedColumns.includes(user.id)
                    }
                  />
                  <ListItemText primary={user.full_name} />
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {/* Save current filter */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Save current filter
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Filter name"
            value={saveFilterName}
            onChange={(e) => setSaveFilterName(e.target.value)}
            disabled={filterSaveInProgress}
            sx={{ mb: 1 }}
          />
          <Box sx={{ position: "relative" }}>
            <Button
              variant="contained"
              size="small"
              fullWidth
              disabled={filterSaveInProgress}
              onClick={() => {
                if (onSaveCurrentFilter) {
                  onSaveCurrentFilter(
                    saveFilterName.trim() || "Unnamed filter"
                  );
                  setSaveFilterName("");
                }
              }}
            >
              Save
            </Button>
            {filterSaveInProgress && (
              <CircularProgress
                size={24}
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  marginTop: "-12px",
                  marginLeft: "-12px",
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Edit saved filter dialog */}
      <Dialog open={editIndex !== null} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit filter</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Filter name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              multiple
              value={editPriority}
              onChange={(e) =>
                setEditPriority(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value
                )
            }
              MenuProps={MenuProps}
              input={<OutlinedInput label="Priority" />}
              renderValue={(selected) => selected.join(", ")}
            >
              {priority.map((item, idx) => (
                <MenuItem value={item} key={idx}>
                  <Checkbox checked={editPriority.includes(item)} />
                  <ListItemText primary={item} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Activity Type</InputLabel>
            <Select
              multiple
              value={editActivityType}
              onChange={(e) =>
                setEditActivityType(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value
                )
            }
              MenuProps={MenuProps}
              input={<OutlinedInput label="Activity Type" />}
              renderValue={(selected) => selected.join(", ")}
            >
              {activityType.map((activity, idx) => (
                <MenuItem value={activity.type} key={idx}>
                  <Checkbox
                    checked={editActivityType.includes(activity.type)}
                  />
                  <ListItemText primary={activity.type} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Schedule For</InputLabel>
            <Select
              multiple
              value={editUser}
              onChange={(e) =>
                setEditUser(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value
                )
            }
              MenuProps={MenuProps}
              input={<OutlinedInput label="Schedule For" />}
              renderValue={(selected) => selected.join(", ")}
            >
              {users.map((user, idx) => (
                <MenuItem key={idx} value={user.full_name}>
                  <Checkbox checked={editUser.includes(user.full_name)} />
                  <ListItemText primary={user.full_name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default DrawerComponent;
