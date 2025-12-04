import { useState, useRef, useEffect } from "react"
import { ThemeProvider, CssBaseline } from "@mui/material"
import Toolbar from "./components/ToolBar"
import TitleBar from "./components/TitleBar"
import Canvas from "./components/Canvas"
import WelcomeScreen from "./components/WelcomeScreen"
import RecentProjectsDialog from "./components/RecentProjectsDialog"
import HelpDialog from "./components/HelpDialog"
import eventBus from "./core/EventBus"
import "./styles/theme.css"
import { lightTheme, darkTheme } from "./styles/muiThemes"
import packageJson from "../package.json"

export default function App() {
  const canvasRef = useRef()
  const [zoomSignal, setZoomSignal] = useState(null)
  const [selectedTool, setSelectedTool] = useState("select")
  const [showWelcome, setShowWelcome] = useState(true)
  const [showRecentProjects, setShowRecentProjects] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // State tracking for menu item enabled/disabled states
  const [toolbarState, setToolbarState] = useState({
    hasSelection: false,
    hasClipboard: false,
    canUndo: false,
    canRedo: false,
    hasSplineSelection: false,
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  // Listen to EventBus for state changes
  useEffect(() => {
    const handleSelectionChange = (data) => {
      setToolbarState((prev) => ({
        ...prev,
        hasSelection: data.hasSelection || false,
        hasSplineSelection: data.hasSplineSelection || false,
      }))
    }

    const handleClipboardChange = (data) => {
      setToolbarState((prev) => ({ ...prev, hasClipboard: data.hasClipboard }))
    }

    const handleHistoryChange = (data) => {
      setToolbarState((prev) => ({
        ...prev,
        canUndo: data.canUndo || false,
        canRedo: data.canRedo || false,
      }))
    }

    eventBus.on("app:selectionChanged", handleSelectionChange)
    eventBus.on("app:clipboardChanged", handleClipboardChange)
    eventBus.on("app:historyChanged", handleHistoryChange)

    return () => {
      eventBus.off("app:selectionChanged", handleSelectionChange)
      eventBus.off("app:clipboardChanged", handleClipboardChange)
      eventBus.off("app:historyChanged", handleHistoryChange)
    }
  }, [])

  const toggleTheme = () => setIsDarkMode((prev) => !prev)

  // Edit Menu Handlers
  const handleUndo = () => canvasRef.current?.undo?.()
  const handleRedo = () => canvasRef.current?.redo?.()
  const handleCopy = () => canvasRef.current?.copy?.()
  const handlePaste = () => canvasRef.current?.paste?.()
  const handleCut = () => canvasRef.current?.cut?.()
  const handleDelete = () => canvasRef.current?.deleteSelected?.()
  const handleBringToFront = () => canvasRef.current?.bringToFront?.()
  const handleBringForward = () => canvasRef.current?.bringForward?.()
  const handleSendToBack = () => canvasRef.current?.sendToBack?.()
  const handleSendBackward = () => canvasRef.current?.sendBackward?.()
  const handleTogglePointDirection = () =>
    canvasRef.current?.togglePointDirection?.()

  // Tool Menu Handler
  const selectTool = (tool) => {
    console.log("[App] selectTool called with:", tool)
    setSelectedTool(tool)
    setTimeout(() => {
      console.log("[App] selectedTool state after set:", tool)
      canvasRef.current?.updateCanvasOnToolChange?.(tool)
    }, 0)
    console.log("Selected tool:", tool)
  }

  // View Menu Handlers
  /** Unique signal for zoom action, store timestamp to ensure re-render */
  const handleZoom = (type) => setZoomSignal({ type, timestamp: Date.now() })
  const applyGridSize = (size) => canvasRef.current?.setGridSize?.(size)
  const applyCanvasSize = (w, h) => canvasRef.current?.resizeCanvas?.(w, h)

  // File Menu Handlers
  /** Create a new blank project */
  const handleNewProject = () => {
    if (showWelcome) {
      setShowWelcome(false)
      // Canvas is already blank on init, but ensure it's reset
      setTimeout(() => canvasRef.current?.newProject?.(), 100)
    } else {
      if (confirm("Start a new project? Unsaved changes will be lost.")) {
        canvasRef.current?.newProject?.()
      }
    }
  }

  /** Save to current project file (or prompt for location if new) */
  const handleSaveProject = async () => await canvasRef.current?.saveProject?.()

  /** Save as .json file (always prompts for new location as it represents a project copy) */
  const handleSaveAs = async () =>
    await canvasRef.current?.saveAsJSON?.("project.json")

  /** Load a project from .json */
  const handleOpenProject = () => {
    setShowWelcome(false)
    // Small delay to allow modal to close before file picker opens (UI smoothness)
    setTimeout(() => {
      canvasRef.current?.loadFromJSON?.()
    }, 100)
  }

  const handleExport = () => canvasRef.current?.exportAsSVG?.("drawing.svg")
  const handleImportSVG = () => canvasRef.current?.importSVG?.()

  const handleOpenRecent = (path) => {
    setShowWelcome(false)
    setShowRecentProjects(false)
    console.log("[App] Opening recent project:", path)
    canvasRef.current?.loadProjectFromPath?.(path)
  }

  const handleShowRecentProjects = () => {
    // Warn user if opening from menu (not from welcome screen)
    if (!showWelcome) {
      if (
        confirm(
          "Opening a recent project will replace your current work. Any unsaved changes will be lost. Continue?"
        )
      ) {
        setShowRecentProjects(true)
      }
    } else {
      setShowRecentProjects(true)
    }
  }

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <div
        className="app-container"
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Background Decorations Layer */}
        <div
          className="app-background-decorations"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        <WelcomeScreen
          open={showWelcome}
          onClose={() => setShowWelcome(false)}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onOpenRecent={handleOpenRecent}
        />

        <RecentProjectsDialog
          open={showRecentProjects}
          onClose={() => setShowRecentProjects(false)}
          onOpenRecent={handleOpenRecent}
        />

        <HelpDialog
          open={showHelp}
          onClose={() => setShowHelp(false)}
          isDarkMode={isDarkMode}
        />

        {/* Main Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <TitleBar isDarkMode={isDarkMode} />
          <Toolbar
            onSelectTool={selectTool}
            onZoom={handleZoom}
            onImportSVG={handleImportSVG}
            onDelete={handleDelete}
            onApplyGridSize={applyGridSize}
            onApplyCanvasSize={applyCanvasSize}
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
            onOpenRecent={handleShowRecentProjects}
            onSaveProject={handleSaveProject}
            onSaveAs={handleSaveAs}
            onExport={handleExport}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            onShowHelp={() => setShowHelp(true)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onCut={handleCut}
            onBringToFront={handleBringToFront}
            onBringForward={handleBringForward}
            onSendToBack={handleSendToBack}
            onSendBackward={handleSendBackward}
            onTogglePointDirection={handleTogglePointDirection}
            // Disabled states
            canUndo={toolbarState.canUndo}
            canRedo={toolbarState.canRedo}
            canCopy={toolbarState.hasSelection}
            canPaste={toolbarState.hasClipboard}
            canCut={toolbarState.hasSelection}
            canDelete={toolbarState.hasSelection}
            canReorder={toolbarState.hasSelection}
            canTogglePointDirection={toolbarState.hasSplineSelection}
          />
          <Canvas
            ref={canvasRef}
            zoomSignal={zoomSignal}
            selectedTool={selectedTool}
            onShowRecentProjects={handleShowRecentProjects}
          />

          {/* Version Overlay */}
          <div className="version-overlay">v{packageJson.version}</div>
        </div>
      </div>
    </ThemeProvider>
  )
}
