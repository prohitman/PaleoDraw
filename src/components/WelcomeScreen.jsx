import { useState, useEffect } from "react"
import {
  Dialog,
  Box,
  Typography,
  Button,
  List,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material"
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder"
import FolderOpenIcon from "@mui/icons-material/FolderOpen"
import HistoryIcon from "@mui/icons-material/History"
import CloseIcon from "@mui/icons-material/Close"
import DescriptionIcon from "@mui/icons-material/Description"

export default function WelcomeScreen({
  open,
  onClose,
  onNewProject,
  onOpenProject,
  onOpenRecent,
}) {
  const [recentProjects, setRecentProjects] = useState([])

  useEffect(() => {
    if (open) {
      try {
        const recent = JSON.parse(
          localStorage.getItem("recentProjects") || "[]"
        )
        setRecentProjects(recent)
      } catch (e) {
        console.error("Failed to load recent projects", e)
      }
    }
  }, [open])

  const handleOpenRecent = (path) => onOpenRecent(path)

  const handleShowInExplorer = async (event, path) => {
    // Stop propagation to prevent triggering the list item click
    event.stopPropagation()
    try {
      await window.api.showFileInExplorer(path)
    } catch (error) {
      console.error("Failed to show file in explorer:", error)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason !== "backdropClick" && reason !== "escapeKeyDown") {
          onClose()
        }
      }}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            minHeight: "500px",
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
          },
        },
      }}
    >
      {/* Left Panel: Actions */}
      <Box
        sx={{
          width: "40%",
          bgcolor: "background.default",
          p: 3,
          display: "flex",
          flexDirection: "column",
          borderRight: 1,
          borderColor: "divider",
          position: "relative", // For decorations
        }}
      >
        {/* Decorations Container */}
        <Box
          className="welcome-decorations"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", mb: 4, zIndex: 1 }}>
          <Box
            component="img"
            src="logo.png"
            alt="PaleoDraw Logo"
            sx={{ height: 40, mr: 2 }}
          />
          <Typography
            variant="h5"
            sx={{ fontWeight: "bold", color: "primary.main" }}
          >
            PaleoDraw
          </Typography>
        </Box>

        <Typography
          variant="subtitle2"
          sx={{ mb: 2, color: "text.secondary", zIndex: 1 }}
        >
          Get Started
        </Typography>

        <Button
          variant="contained"
          color="inherit"
          startIcon={<CreateNewFolderIcon sx={{ fontSize: 40 }} />}
          onClick={onNewProject}
          sx={{
            justifyContent: "flex-start",
            mb: 2,
            py: 2,
            bgcolor: "action.hover",
            "&:hover": { bgcolor: "action.selected" },
            textTransform: "none",
            boxShadow: "none",
            zIndex: 1,
          }}
        >
          <Box sx={{ textAlign: "left", ml: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              New Project
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Create a blank canvas
            </Typography>
          </Box>
        </Button>

        <Button
          variant="contained"
          color="inherit"
          startIcon={<FolderOpenIcon sx={{ fontSize: 40 }} />}
          onClick={onOpenProject}
          sx={{
            justifyContent: "flex-start",
            py: 2,
            bgcolor: "action.hover",
            "&:hover": { bgcolor: "action.selected" },
            textTransform: "none",
            boxShadow: "none",
          }}
        >
          <Box sx={{ textAlign: "left", ml: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              Open Project
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Browse local files
            </Typography>
          </Box>
        </Button>
      </Box>

      {/* Right Panel: Recent */}
      <Box
        sx={{ width: "60%", p: 3, display: "flex", flexDirection: "column" }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <HistoryIcon /> Recent
          </Typography>
          {/* Optional close button if user wants to just dismiss and see empty canvas, 
              though usually they should pick an option. We'll allow closing to empty canvas. */}
          <IconButton onClick={onClose} sx={{ color: "text.secondary" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {recentProjects.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
            }}
          >
            <Typography>No recent projects found</Typography>
          </Box>
        ) : (
          <List sx={{ overflow: "auto", flex: 1 }}>
            {recentProjects.map((project, index) => (
              <ListItemButton
                key={index}
                onClick={() => handleOpenRecent(project.path)}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ListItemIcon>
                  <DescriptionIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={project.name}
                  secondary={project.path}
                  slotProps={{
                    primary: { color: "text.primary" },
                    secondary: {
                      color: "text.secondary",
                      style: {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", mr: 1 }}
                >
                  {new Date(project.lastOpened).toLocaleDateString()}
                </Typography>
                <Tooltip title="Show in folder" placement="left">
                  <IconButton
                    size="small"
                    onClick={(e) => handleShowInExplorer(e, project.path)}
                    sx={{
                      "&:hover": { bgcolor: "action.selected" },
                    }}
                  >
                    <FolderOpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  )
}
