import { useEffect, useRef } from "react"
import { Dialog, DialogContent, IconButton, Box } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"

export default function HelpDialog({ open, onClose, isDarkMode }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    if (open && iframeRef.current) {
      // Send theme to iframe when dialog opens or theme changes
      const sendTheme = () => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: "theme-change",
              theme: isDarkMode ? "dark" : "light",
            },
            "*"
          )
        }
      }

      // Send immediately and after a short delay to ensure iframe is loaded
      sendTheme()
      const timeout = setTimeout(sendTheme, 100)

      return () => clearTimeout(timeout)
    }
  }, [open, isDarkMode])

  // Listen for theme requests from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === "request-theme" && iframeRef.current) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "theme-change",
            theme: isDarkMode ? "dark" : "light",
          },
          "*"
        )
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [isDarkMode])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            height: "85vh",
            maxHeight: "850px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            bgcolor: "background.paper",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent
        sx={{
          p: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        <iframe
          ref={iframeRef}
          src="docs/help.html"
          title="PaleoDraw Help Documentation"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            flex: 1,
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
