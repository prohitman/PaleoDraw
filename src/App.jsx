import React, { useState, useRef, useEffect } from "react"
import Toolbar from "./components/ToolBar"
import Canvas from "./components/Canvas"
import WelcomeScreen from "./components/WelcomeScreen"
import "./styles/theme.css"
import { HotkeysProvider } from "./hooks/HotkeysProvider"
import { loadProjectFromPath } from "./handlers/projectHandler"

export default function App() {
  const canvasRef = useRef()
  const [zoomSignal, setZoomSignal] = useState(null)
  const [selectedTool, setSelectedTool] = useState("select")
  const [showWelcome, setShowWelcome] = useState(true)

  const handleZoom = (type) => {
    setZoomSignal({ type, timestamp: Date.now() })
  }
  const handleImportSVG = () => canvasRef.current.importSVG()
  const handleDelete = () => {
    canvasRef.current?.deleteSelected()
  }
  const selectTool = (tool) => {
    console.log("[App] selectTool called with:", tool)
    setSelectedTool(tool)
    setTimeout(() => {
      console.log("[App] selectedTool state after set:", tool)
      canvasRef.current?.updateCanvasOnToolChange(tool)
    }, 0)
    console.log("Selected tool:", tool)
  }

  const applyGridSize = (size) => {
    canvasRef.current?.setGridSize(size)
  }

  const applyCanvasSize = (w, h) => {
    canvasRef.current?.resizeCanvas(w, h)
  }

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

  /** Save to localStorage (optional quick-save) */
  const handleSaveProject = () => {
    const json = canvasRef.current?.getProjectJSON?.()
    if (!json) return
    localStorage.setItem("savedProject", json)
    alert("Project saved locally (JSON)!")
  }

  /** Save as .json file */
  const handleSaveAs = () => {
    canvasRef.current?.saveAsJSON?.("project.json")
  }

  /** Load a project from .json */
  const handleOpenProject = () => {
    setShowWelcome(false)
    // Small delay to allow modal to close before file picker opens (UI smoothness)
    setTimeout(() => {
      canvasRef.current?.loadFromJSON?.()
    }, 100)
  }

  const handleOpenRecent = (path) => {
    setShowWelcome(false)
    // We need to access internal refs from Canvas, which is tricky via ref.
    // But we exposed _restoreState. However, loadProjectFromPath needs raw refs.
    // Ideally, we should move loadProjectFromPath INTO Canvas or expose a method on Canvas ref.
    // Let's use the exposed method on Canvas ref if possible, or pass the refs if we had them.
    // Since we don't have direct access to Canvas internal refs here, we should expose a method on Canvas.

    // Actually, let's call a method on the canvas ref that delegates to the handler
    canvasRef.current?.loadProjectFromPath?.(path)
  }

  /** Export SVG (excluding grid/background) */
  const handleExport = () => {
    canvasRef.current?.exportAsSVG?.("drawing.svg")
  }

  return (
    <div className="app-container">
      <WelcomeScreen
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onOpenRecent={handleOpenRecent}
      />
      <Toolbar
        onSelectTool={selectTool}
        onZoom={handleZoom}
        onImportSVG={handleImportSVG}
        onDelete={handleDelete}
        onApplyGridSize={applyGridSize}
        onApplyCanvasSize={applyCanvasSize}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onSaveAs={handleSaveAs}
        onExport={handleExport}
      />
      <HotkeysProvider>
        <Canvas
          ref={canvasRef}
          zoomSignal={zoomSignal}
          selectedTool={selectedTool}
        />
      </HotkeysProvider>
    </div>
  )
}
