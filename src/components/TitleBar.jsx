import React, { useEffect, useState } from "react"
import { Box, Typography } from "@mui/material"
import eventBus from "../utils/EventBus"

const TitleBar = ({ isDarkMode }) => {
  const [projectName, setProjectName] = useState(null)
  const [isDirty, setIsDirty] = useState(false)

  const bgColor = isDarkMode ? "#181818" : "#f5f5f5"
  const textColor = isDarkMode ? "#ffffff" : "#000000"
  const borderColor = isDarkMode ? "#333" : "#e0e0e0"

  useEffect(() => {
    if (window.api && window.api.updateTitleBarOverlay) {
      window.api.updateTitleBarOverlay({
        color: bgColor,
        symbolColor: textColor,
        height: 30,
      })
    }
  }, [isDarkMode, bgColor, textColor])

  // Listen to project state changes
  useEffect(() => {
    const handlePathChanged = ({ name }) => {
      setProjectName(name)
    }

    const handleDirtyChanged = ({ isDirty: dirty }) => {
      setIsDirty(dirty)
    }

    eventBus.on("project:path-changed", handlePathChanged)
    eventBus.on("project:dirty-changed", handleDirtyChanged)

    return () => {
      eventBus.off("project:path-changed", handlePathChanged)
      eventBus.off("project:dirty-changed", handleDirtyChanged)
    }
  }, [])

  // Build title text
  const titleText = projectName
    ? `${projectName}${isDirty ? " *" : ""} - PaleoDraw`
    : "PaleoDraw"

  return (
    <Box
      sx={{
        height: "30px",
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        paddingLeft: "10px",
        WebkitAppRegion: "drag",
        userSelect: "none",
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        zIndex: 9999,
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      <img
        src="logo.png"
        alt="logo"
        style={{ height: "18px", marginRight: "8px" }}
      />
      <Typography
        variant="caption"
        sx={{ fontWeight: "bold", fontFamily: "Avenir" }}
      >
        {titleText}
      </Typography>
    </Box>
  )
}

export default TitleBar
