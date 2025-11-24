import React, { useState } from "react"
import {
  AppBar,
  Toolbar,
  Button,
  Menu,
  MenuItem,
  TextField,
  Box,
  Divider,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import Brightness4Icon from "@mui/icons-material/Brightness4"
import Brightness7Icon from "@mui/icons-material/Brightness7"

export default function ToolBar({
  onSelectTool,
  onZoom,
  onImportSVG,
  onDelete,
  onApplyGridSize,
  onApplyCanvasSize,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveAs,
  onExport,
  isDarkMode,
  onToggleTheme,
}) {
  // State for menus
  const [anchorEl, setAnchorEl] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)

  // State for inputs
  const [gridSize, setGridSize] = useState(25)
  const [canvasW, setCanvasW] = useState(1200)
  const [canvasH, setCanvasH] = useState(800)

  const handleMenuOpen = (event, menuName) => {
    setAnchorEl(event.currentTarget)
    setActiveMenu(menuName)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setActiveMenu(null)
  }

  const handleAction = (action) => {
    action?.()
    handleMenuClose()
  }

  // Helper to render the arrow icon with rotation based on menu state
  const arrowIcon = (menuName) => (
    <KeyboardArrowDownIcon
      sx={{
        transform: activeMenu === menuName ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s",
      }}
    />
  )

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{ mr: 2, fontWeight: "bold", color: "inherit" }}
        >
          PaleoDraw
        </Typography>

        {/* --- FILE MENU --- */}
        <Button
          color="inherit"
          endIcon={arrowIcon("file")}
          onClick={(e) => handleMenuOpen(e, "file")}
        >
          File
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={activeMenu === "file"}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleAction(onNewProject)}>
            New Project
          </MenuItem>
          <MenuItem onClick={() => handleAction(onOpenProject)}>
            Open Project
          </MenuItem>
          <MenuItem onClick={() => handleAction(onSaveProject)}>
            Save Project
          </MenuItem>
          <MenuItem onClick={() => handleAction(onSaveAs)}>Save As...</MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(onExport)}>
            Export SVG...
          </MenuItem>
        </Menu>

        {/* --- VIEW MENU --- */}
        <Button
          color="inherit"
          endIcon={arrowIcon("view")}
          onClick={(e) => handleMenuOpen(e, "view")}
        >
          View
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={activeMenu === "view"}
          onClose={handleMenuClose}
          PaperProps={{ sx: { width: 320, p: 1 } }}
        >
          <MenuItem onClick={() => handleAction(() => onZoom("in"))}>
            Zoom In
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onZoom("out"))}>
            Zoom Out
          </MenuItem>
          <Divider sx={{ my: 1 }} />

          <Box sx={{ px: 2, py: 1 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 0.5 }}
            >
              Grid Size
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                type="number"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                sx={{ width: 80 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => onApplyGridSize(gridSize)}
              >
                Apply
              </Button>
            </Box>
          </Box>

          <Box sx={{ px: 2, py: 1 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 0.5 }}
            >
              Canvas Size
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                type="number"
                value={canvasW}
                onChange={(e) => setCanvasW(Number(e.target.value))}
                sx={{ width: 80 }}
              />
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography>x</Typography>
              </Box>
              <TextField
                size="small"
                type="number"
                value={canvasH}
                onChange={(e) => setCanvasH(Number(e.target.value))}
                sx={{ width: 80 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => onApplyCanvasSize(canvasW, canvasH)}
              >
                Apply
              </Button>
            </Box>
          </Box>
        </Menu>

        {/* --- OBJECT MENU --- */}
        <Button
          color="inherit"
          endIcon={arrowIcon("object")}
          onClick={(e) => handleMenuOpen(e, "object")}
        >
          Object
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={activeMenu === "object"}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleAction(onImportSVG)}>
            Import SVG
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => handleAction(onDelete)}
            sx={{ color: "error.main" }}
          >
            Delete Selected
          </MenuItem>
        </Menu>

        {/* --- TOOLS MENU --- */}
        <Button
          color="inherit"
          endIcon={arrowIcon("tools")}
          onClick={(e) => handleMenuOpen(e, "tools")}
        >
          Tools
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={activeMenu === "tools"}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleAction(() => onSelectTool("select"))}>
            Select Tool
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(() => onSelectTool("curve"))}>
            Draw Curve
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onSelectTool("nurbs"))}>
            Draw NURBS
          </MenuItem>
          <MenuItem
            onClick={() => handleAction(() => onSelectTool("straight"))}
          >
            Draw Straight Line
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(() => onSelectTool("pan"))}>
            Pan Tool
          </MenuItem>
        </Menu>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Toggle light/dark theme">
          <IconButton onClick={onToggleTheme} color="inherit">
            {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  )
}
