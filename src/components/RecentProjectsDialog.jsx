import { useState, useEffect } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import DescriptionIcon from "@mui/icons-material/Description"
import FolderOpenIcon from "@mui/icons-material/FolderOpen"

export default function RecentProjectsDialog({ open, onClose, onOpenRecent }) {
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
        setRecentProjects([])
      }
    }
  }, [open])

  const handleProjectClick = (path) => {
    onOpenRecent(path)
    onClose()
  }

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
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            minHeight: "400px",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 1,
        }}
      >
        <Typography variant="h6">Open Recent Project</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {recentProjects.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "200px",
              color: "text.secondary",
            }}
          >
            <Typography>No recent projects found</Typography>
          </Box>
        ) : (
          <List>
            {recentProjects.map((project, index) => (
              <ListItemButton
                key={index}
                onClick={() => handleProjectClick(project.path)}
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
                  secondary={
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "70%",
                        }}
                      >
                        {project.path}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", ml: 2 }}
                      >
                        {new Date(project.lastOpened).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                  slotProps={{
                    primary: { color: "text.primary" },
                  }}
                />
                <Tooltip title="Show in folder" placement="left">
                  <IconButton
                    size="small"
                    onClick={(e) => handleShowInExplorer(e, project.path)}
                    sx={{
                      ml: 1,
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
      </DialogContent>
    </Dialog>
  )
}
