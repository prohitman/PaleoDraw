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
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import DescriptionIcon from "@mui/icons-material/Description"
import logger from "../utils/logger.js"

export default function TemplatesDialog({ open, onClose, onLoadTemplate }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadTemplatesList()
    }
  }, [open])

  const loadTemplatesList = async () => {
    setLoading(true)
    try {
      const response = await fetch("/templates/templates.json")
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      logger.error("Failed to load templates list:", error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }
  const handleTemplateClick = async (templateFile) => {
    try {
      const response = await fetch(templateFile)
      const templateData = await response.json()
      onLoadTemplate(templateData)
      onClose()
    } catch (error) {
      logger.error("Failed to load template:", error)
      alert("Failed to load template. Please try again.")
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
        <Typography variant="h6">Templates</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "200px",
              color: "text.secondary",
            }}
          >
            <Typography>Loading templates...</Typography>
          </Box>
        ) : templates.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "200px",
              color: "text.secondary",
            }}
          >
            <Typography>No templates available</Typography>
          </Box>
        ) : (
          <List>
            {templates.map((template, index) => (
              <ListItemButton
                key={index}
                onClick={() => handleTemplateClick(template.file)}
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
                  primary={template.name}
                  slotProps={{
                    primary: { color: "text.primary" },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
