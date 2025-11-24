import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Paper,
  Divider,
  IconButton,
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

  const handleOpenRecent = (path) => {
    onOpenRecent(path)
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
      PaperProps={{
        sx: {
          bgcolor: "#1e1e1e",
          color: "#fff",
          minHeight: "500px",
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        },
      }}
    >
      {/* Left Panel: Actions */}
      <Box
        sx={{
          width: "40%",
          bgcolor: "#252526",
          p: 3,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #333",
        }}
      >
        <Typography
          variant="h5"
          sx={{ mb: 4, fontWeight: "bold", color: "#90caf9" }}
        >
          PaleoDraw
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 2, color: "#aaa" }}>
          Get Started
        </Typography>

        <Button
          variant="contained"
          startIcon={<CreateNewFolderIcon sx={{ fontSize: 40 }} />}
          onClick={onNewProject}
          sx={{
            justifyContent: "flex-start",
            mb: 2,
            py: 2,
            bgcolor: "#333",
            "&:hover": { bgcolor: "#444" },
            textTransform: "none",
          }}
        >
          <Box sx={{ textAlign: "left", ml: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              New Project
            </Typography>
            <Typography variant="caption" sx={{ color: "#aaa" }}>
              Create a blank canvas
            </Typography>
          </Box>
        </Button>

        <Button
          variant="contained"
          startIcon={<FolderOpenIcon sx={{ fontSize: 40 }} />}
          onClick={onOpenProject}
          sx={{
            justifyContent: "flex-start",
            py: 2,
            bgcolor: "#333",
            "&:hover": { bgcolor: "#444" },
            textTransform: "none",
          }}
        >
          <Box sx={{ textAlign: "left", ml: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              Open Project
            </Typography>
            <Typography variant="caption" sx={{ color: "#aaa" }}>
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
          <IconButton onClick={onClose} sx={{ color: "#aaa" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ bgcolor: "#333", mb: 2 }} />

        {recentProjects.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
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
                  "&:hover": { bgcolor: "#333" },
                }}
              >
                <ListItemIcon>
                  <DescriptionIcon sx={{ color: "#90caf9" }} />
                </ListItemIcon>
                <ListItemText
                  primary={project.name}
                  secondary={project.path}
                  primaryTypographyProps={{ color: "#fff" }}
                  secondaryTypographyProps={{
                    color: "#aaa",
                    style: {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
                <Typography variant="caption" sx={{ color: "#666" }}>
                  {new Date(project.lastOpened).toLocaleDateString()}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  )
}
