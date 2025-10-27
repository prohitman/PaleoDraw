// frontend/src/components/Toolbar.jsx
import React from "react"
import "./../styles/toolbar.css"

export default function Toolbar({ onZoom, onImportSVG, onDelete }) {
  return (
    <div className="toolbar">
      <button>New</button>
      <button>Open</button>
      <button onClick={onImportSVG}>Import SVG</button>
      <button onClick={() => onZoom("in")}>＋</button>
      <button onClick={() => onZoom("out")}>−</button>
      <button onClick={onDelete}>Delete</button>
    </div>
  )
}
