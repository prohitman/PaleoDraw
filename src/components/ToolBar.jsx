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
import GitHubIcon from "@mui/icons-material/GitHub"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"

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
  // Edit Menu Props
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onCut,
  // Z-Order Props
  onBringToFront,
  onBringForward,
  onSendToBack,
  onSendBackward,
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

  function MenuItemWithShortcut({ label, shortcut, onClick, color }) {
    return (
      <MenuItem onClick={onClick} sx={{ color }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            width: "200px",
          }}
        >
          <Typography>{label}</Typography>
          {shortcut && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right", minWidth: 10, lineHeight: 2 }}>
              {shortcut}
            </Typography>
          )}
        </Box>
      </MenuItem>
    )
  }

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="PaleoDraw Logo"
          sx={{ height: 32, mr: 0 }} // Adjust height as needed
        />
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
          <MenuItemWithShortcut
            label="New Project"
            shortcut="[Ctrl+N]"
            onClick={() => handleAction(onNewProject)}
          />

          <MenuItemWithShortcut
            label="Open Project"
            shortcut="[Ctrl+O]"
            onClick={() => handleAction(onOpenProject)}
          />

          <MenuItemWithShortcut
            label="Save Project"
            shortcut="[Ctrl+S]"
            onClick={() => handleAction(onSaveProject)}
          />

          <MenuItem onClick={() => handleAction(onSaveAs)}>Save As...</MenuItem>
          <Divider />
          <MenuItemWithShortcut
            label="Export SVG..."
            shortcut="[Ctrl+E]"
            onClick={() => handleAction(onExport)}
          />
          <Divider />
          <MenuItemWithShortcut
            label="Import new SVG"
            shortcut="[I]"
            onClick={() => handleAction(onImportSVG)}
          />
        </Menu>

        {/* --- EDIT MENU --- */}
        <Button
          color="inherit"
          endIcon={arrowIcon("edit")}
          onClick={(e) => handleMenuOpen(e, "edit")}
        >
          Edit
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={activeMenu === "edit"}
          onClose={handleMenuClose}
        >
          <MenuItemWithShortcut
            label="Undo"
            shortcut="[Ctrl+Z]"
            onClick={() => handleAction(onUndo)}
          />
          <MenuItemWithShortcut
            label="Redo"
            shortcut="[Ctrl+Y]"
            onClick={() => handleAction(onRedo)}
          />
          <Divider />
          <MenuItemWithShortcut
            label="Copy"
            shortcut="[Ctrl+C]"
            onClick={() => handleAction(onCopy)}
          />
          <MenuItemWithShortcut
            label="Paste"
            shortcut="[Ctrl+V]"
            onClick={() => handleAction(onPaste)}
          />
          <MenuItemWithShortcut
            label="Cut"
            shortcut="[Ctrl+X]"
            onClick={() => handleAction(onCut)}
          />
          <Divider />
          <MenuItemWithShortcut
            label="Send to Back"
            shortcut="[Ctrl+Shift+B]"
            onClick={() => handleAction(onSendToBack)}
          />
          <MenuItemWithShortcut
            label="Back One Step"
            shortcut="[Ctrl+B]"
            onClick={() => handleAction(onSendBackward)}
          />
          <MenuItemWithShortcut
            label="Send to Front"
            shortcut="[Ctrl+Shift+F]"
            onClick={() => handleAction(onBringToFront)}
          />
          <MenuItemWithShortcut
            label="Front One Step"
            shortcut="[Ctrl+F]"
            onClick={() => handleAction(onBringForward)}
          />
          <Divider />
          <MenuItemWithShortcut
            label="Delete Selected"
            shortcut="[Del]"
            onClick={() => handleAction(onDelete)}
            color="error.main"
          />
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
            Select Tool{" "}
            <Typography
              variant="caption"
              sx={{ ml: 2, color: "text.secondary" }}
            >
              T
            </Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(() => onSelectTool("curve"))}>
            Draw Curve{" "}
            <Typography
              variant="caption"
              sx={{ ml: 2, color: "text.secondary" }}
            >
              C
            </Typography>
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
          <MenuItem
            onClick={() => handleAction(() => onSelectTool("delete_spline"))}
          >
            Delete Spline Tool
          </MenuItem>
        </Menu>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="GitHub Repository">
          <IconButton
            color="inherit"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Help / Documentation">
          <IconButton color="inherit">
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Toggle light/dark theme">
          <IconButton onClick={onToggleTheme} color="inherit">
            {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  )
}
