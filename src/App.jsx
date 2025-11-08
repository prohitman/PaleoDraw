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

  const handleNewProject = () => {
    if (confirm("Start a new project? Unsaved changes will be lost.")) {
      canvasRef.current?.newProject()
    }
  }

  // Save project to localStorage as JSON
  const handleSaveProject = () => {
    const json = canvasRef.current?.getProjectJSON?.()
    if (!json) return
    localStorage.setItem("savedProject", json)
    alert("Project saved locally (JSON)!")
  }

  // Save As -> download .json
  const handleSaveAs = () => {
    const json = canvasRef.current?.getProjectJSON?.()
    if (!json) return
    const filename = "project" // default filename
    const blob = new Blob([json], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${filename}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Export (prompt for filename + format)
  const handleExport = async () => {
    const filename = "project"
    const format = "png" // default format
    if (format === "svg") {
      canvasRef.current?.exportAsSVG?.(`${filename}.svg`)
    } else {
      canvasRef.current?.exportAsPNG?.(`${filename}.png`)
    }
  }

  // Open project: read .json and load
  const handleOpenProject = () => {
    // Use Canvas.loadFromJSON file picker method
    canvasRef.current?.loadFromJSON?.()
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
