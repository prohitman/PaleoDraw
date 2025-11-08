import React, { useState } from "react"
import "./../styles/toolbar.css"

export default function Toolbar({
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
}) {
  const [gridSize, setGridSize] = useState(25)
  const [canvasW, setCanvasW] = useState(1200)
  const [canvasH, setCanvasH] = useState(800)

  const [openMenu, setOpenMenu] = useState(null)

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu)
  }

  return (
    <div className="toolbar">
      {/* FILE MENU */}
      <div className="menu-group">
        <button className="menu-btn" onClick={() => toggleMenu("file")}>
          File ▾
        </button>
        {openMenu === "file" && (
          <div className="dropdown">
            <button onClick={onNewProject}>New Project</button>
            <button onClick={onOpenProject}>Open Project</button>
            <button onClick={onSaveProject}>Save Project</button>
            <button onClick={onSaveAs}>Save As...</button>
            <button onClick={onExport}>Export...</button>
          </div>
        )}
      </div>

      {/* VIEW MENU */}
      <div className="menu-group">
        <button className="menu-btn" onClick={() => toggleMenu("view")}>
          View ▾
        </button>
        {openMenu === "view" && (
          <div className="dropdown wide">
            <button onClick={() => onZoom("in")}>Zoom In</button>
            <button onClick={() => onZoom("out")}>Zoom Out</button>
            <div className="divider" />
            <div className="dropdown-section">
              <label>
                Grid Size:
                <input
                  type="number"
                  min="5"
                  step="1"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                />
              </label>
              <button onClick={() => onApplyGridSize(gridSize)}>Apply</button>
            </div>
            <div className="dropdown-section">
              <label>
                Canvas Size:
                <input
                  type="number"
                  value={canvasW}
                  onChange={(e) => setCanvasW(Number(e.target.value))}
                />
                ×
                <input
                  type="number"
                  value={canvasH}
                  onChange={(e) => setCanvasH(Number(e.target.value))}
                />
              </label>
              <button onClick={() => onApplyCanvasSize(canvasW, canvasH)}>
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OBJECT MENU */}
      <div className="menu-group">
        <button className="menu-btn" onClick={() => toggleMenu("object")}>
          Object ▾
        </button>
        {openMenu === "object" && (
          <div className="dropdown">
            <button onClick={onImportSVG}>Import SVG</button>
            <button onClick={onDelete}>Delete Selected</button>
          </div>
        )}
      </div>

      {/* TOOLS MENU */}
      <div className="menu-group">
        <button className="menu-btn" onClick={() => toggleMenu("tools")}>
          Tools ▾
        </button>
        {openMenu === "tools" && (
          <div className="dropdown">
            <button onClick={() => onSelectTool("curve")}>Draw Curve</button>
            <button onClick={() => onSelectTool("straight")}>
              Draw Straight
            </button>
            <button onClick={() => onSelectTool("select")}>Select</button>
            <button onClick={() => onSelectTool("delete_spline")}>
              Delete B-Spline
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
