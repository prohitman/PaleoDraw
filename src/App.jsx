import React, { useState, useRef } from "react"
import Toolbar from "./components/ToolBar"
import Canvas from "./components/Canvas"
import "./styles/theme.css"

export default function App() {
  const canvasRef = useRef()
  const [zoomSignal, setZoomSignal] = useState(null)

  const handleZoom = (type) => {
    setZoomSignal({ type, timestamp: Date.now() })
  }
  const handleImportSVG = () => canvasRef.current.importSVG()
  const handleDelete = () => {
    canvasRef.current?.deleteSelected()
  }

  return (
    <div className="app-container">
      <Toolbar onZoom={handleZoom} onImportSVG={handleImportSVG} onDelete={handleDelete} />
      <Canvas ref={canvasRef} zoomSignal={zoomSignal} />
    </div>
  )
}
