import React, { useState, useRef } from "react"
import Toolbar from "./components/ToolBar"
import Canvas from "./components/Canvas"
import "./styles/theme.css"

export default function App() {
  const canvasRef = useRef()
  const [zoomSignal, setZoomSignal] = useState(null)
  const selectedTool = useRef("select")

  const handleZoom = (type) => {
    setZoomSignal({ type, timestamp: Date.now() })
  }
  const handleImportSVG = () => canvasRef.current.importSVG()
  const handleDelete = () => {
    canvasRef.current?.deleteSelected()
  }
  const selectTool = (tool) => {
    selectedTool.current = tool
  }

  const applyGridSize = (size) => {
    canvasRef.current?.setGridSize(size)
  }

  const applyCanvasSize = (w, h) => {
    canvasRef.current?.resizeCanvas(w, h)
  }

  /** Create a new blank project */
  const handleNewProject = () => {
    if (confirm("Start a new project? Unsaved changes will be lost.")) {
      canvasRef.current?.newProject?.()
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
    canvasRef.current?.loadFromJSON?.()
  }

  /** Export SVG (excluding grid/background) */
  const handleExport = () => {
    canvasRef.current?.exportAsSVG?.("drawing.svg")
  }

  return (
    <div className="app-container">
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
      <Canvas
        ref={canvasRef}
        zoomSignal={zoomSignal}
        selectedTool={selectedTool}
      />
    </div>
  )
}
