// handlers/projectHandler.js
import { SVG } from "@svgdotjs/svg.js"
import { drawGrid } from "../utils/svgHelpers"
import { generateBSplinePath, generatePolylinePath } from "../utils/geometry"

const GRID_BASE_THICKNESS = 0.5

export function createNewProject(
  drawRef,
  canvasSizeRef,
  gridSizeRef,
  gridRef,
  fitToCanvas,
  splineManager,
  svgObjectManager,
  selectedRef
) {
  const draw = drawRef.current
  if (!draw) return

  draw.clear()
  const bg = draw
    .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
    .addClass("canvas-bg-rect")
    .id("canvas-bg")
  bg.node.style.pointerEvents = "none"

  const grid = draw.group().id("canvas-grid")
  gridRef.current = grid

  grid._drawGrid = (gSize = gridSizeRef.current) =>
    drawGrid(grid, canvasSizeRef.current, gSize)
  grid._drawGrid(gridSizeRef.current)
  fitToCanvas()

  // Clear splines
  splineManager.clearSelection()
  splineManager.splines.forEach((s) => s.remove())
  splineManager.splines.clear()

  // Clear imported SVGs
  svgObjectManager?.clearSelection?.()
  svgObjectManager?.getAllObjects?.().forEach((obj) => {
    try {
      obj.select?.(false)
      obj.resize?.(false)
      obj.remove?.()
    } catch {
      // ignore
    }
  })
  svgObjectManager?.clear?.()

  selectedRef.current = null
}

/**
 * Returns serialized project JSON.
 * Note: splines are stored as plain lists of points (x,y). We intentionally
 * do NOT serialize SVG group transforms or plugin internal state.
 */
export function getProjectJSON(
  drawRef,
  canvasSizeRef,
  gridSizeRef,
  splineManager,
  svgObjectManager
) {
  if (!drawRef.current) return null
  const project = {
    metadata: { version: "2.0", savedAt: new Date().toISOString() },
    canvas: canvasSizeRef.current,
    gridSize: gridSizeRef.current,
    // Save only raw points and minimal meta for splines (no transforms)
    splines: splineManager.getState(),
    // Keep imported SVGs as full SVG markup + transform (imported assets should keep transforms)
    importedSVGs: svgObjectManager?.getState?.() || [],
  }
  return JSON.stringify(project, null, 2)
}

export function saveAsJSON(filename, ref) {
  const jsonStr = ref.current?.getProjectJSON?.()
  if (!jsonStr) return
  const blob = new Blob([jsonStr], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Load a project JSON file and reconstruct the canvas.
 * Uses SplineManager to handle spline reconstruction with proper handlers attached.
 */
export async function loadFromJSON(
  drawRef,
  canvasSizeRef,
  gridSizeRef,
  gridRef,
  fitToCanvas,
  splineManager,
  svgObjectManager,
  selectedRef
) {
  if (!drawRef.current) return

  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // If in Electron, save path to recent projects
    if (file.path) {
      addToRecentProjects(file.path)
    }

    const text = await file.text()
    let data

    try {
      data = JSON.parse(text)
    } catch {
      console.error("Invalid JSON project file")
      return
    }

    const draw = drawRef.current
    draw.clear()

    // Restore canvas size if present
    if (data.canvas) {
      canvasSizeRef.current = data.canvas
      draw.size(data.canvas.width, data.canvas.height)
      draw.viewbox(0, 0, data.canvas.width, data.canvas.height)
    }

    // Background + grid
    const bg = draw
      .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
      .addClass("canvas-bg-rect")
      .id("canvas-bg")
    bg.node.style.pointerEvents = "none"

    const grid = draw.group().id("canvas-grid")
    gridRef.current = grid
    grid._drawGrid = (gSize = data.gridSize || gridSizeRef.current) =>
      drawGrid(grid, canvasSizeRef.current, gSize)
    grid._drawGrid(data.gridSize || gridSizeRef.current)
    gridSizeRef.current = data.gridSize || gridSizeRef.current
    fitToCanvas()

    // Restore splines using SplineManager
    if (Array.isArray(data.splines)) {
      splineManager.loadState(data.splines)
      // Ensure all splines are deselected and points hidden on import
      splineManager.clearSelection()
      splineManager.getAllSplines().forEach((spline) => {
        spline.setSelected(false)
      })
    }

    // Restore imported SVGs using SVGObjectManager
    if (Array.isArray(data.importedSVGs)) {
      if (svgObjectManager?.loadState) {
        svgObjectManager.loadState(data.importedSVGs, draw)
      }
    }

    selectedRef.current = null
  }

  input.click()
}

/**
 * Load a project from a specific file path (Electron only).
 */
export async function loadProjectFromPath(
  path,
  drawRef,
  canvasSizeRef,
  gridSizeRef,
  gridRef,
  fitToCanvas,
  splineManager,
  svgObjectManager,
  selectedRef
) {
  if (!window.api?.readProjectFile) {
    console.error("File system API not available")
    return
  }

  try {
    const text = await window.api.readProjectFile(path)
    let data
    try {
      data = JSON.parse(text)
    } catch {
      console.error("Invalid JSON project file")
      return
    }

    const draw = drawRef.current
    if (!draw) return
    draw.clear()

    // Restore canvas size if present
    if (data.canvas) {
      canvasSizeRef.current = data.canvas
      draw.size(data.canvas.width, data.canvas.height)
      draw.viewbox(0, 0, data.canvas.width, data.canvas.height)
    }

    // Background + grid
    const bg = draw
      .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
      .addClass("canvas-bg-rect")
      .id("canvas-bg")
    bg.node.style.pointerEvents = "none"

    const grid = draw.group().id("canvas-grid")
    gridRef.current = grid
    grid._drawGrid = (gSize = data.gridSize || gridSizeRef.current) =>
      drawGrid(grid, canvasSizeRef.current, gSize)
    grid._drawGrid(data.gridSize || gridSizeRef.current)
    gridSizeRef.current = data.gridSize || gridSizeRef.current
    fitToCanvas()

    // Restore splines using SplineManager
    if (Array.isArray(data.splines)) {
      splineManager.loadState(data.splines)
      // Ensure all splines are deselected and points hidden on import
      splineManager.clearSelection()
      splineManager.getAllSplines().forEach((spline) => {
        spline.setSelected(false)
      })
    }

    // Restore imported SVGs using SVGObjectManager
    if (Array.isArray(data.importedSVGs)) {
      if (svgObjectManager?.loadState) {
        svgObjectManager.loadState(data.importedSVGs, draw)
      }
    }

    selectedRef.current = null

    // Update recent projects
    addToRecentProjects(path)
  } catch (err) {
    console.error("Failed to load project from path:", err)
    alert("Failed to load project: " + err.message)
  }
}

function addToRecentProjects(path) {
  try {
    const name = path.split(/[/\\]/).pop()
    const recent = JSON.parse(localStorage.getItem("recentProjects") || "[]")

    // Remove if exists (to move to top)
    const filtered = recent.filter((p) => p.path !== path)

    // Add to top
    filtered.unshift({
      name,
      path,
      lastOpened: new Date().toISOString(),
    })

    // Keep max 10
    const trimmed = filtered.slice(0, 10)

    localStorage.setItem("recentProjects", JSON.stringify(trimmed))
  } catch (e) {
    console.error("Error updating recent projects", e)
  }
}

/**
 * Export an SVG consisting of:
 *  - fresh groups built from each spline's raw points (no lingering transforms)
 *  - cloned/imported SVG objects (kept as-is)
 *
 * By default we DO NOT export point circles and we ensure paths are exported
 * using the "unselected" visual style so selection UI doesn't appear in the file.
 *
 * @param {string} filename
 * @param {object} drawRef
 * @param {object} canvasSizeRef
 * @param {object} svgObjects
 * @param {SplineManager} splineManager
 * @param {boolean} includePoints - optional; default false. If true, include point circles.
 */
export function exportAsSVG(
  filename,
  drawRef,
  canvasSizeRef,
  splineManager,
  svgObjectManager,
  includePoints = false
) {
  const draw = drawRef.current
  if (!draw) return

  // create offscreen temp document sized to canvas
  const temp = SVG()
    .size(canvasSizeRef.current.width, canvasSizeRef.current.height)
    .viewbox(0, 0, canvasSizeRef.current.width, canvasSizeRef.current.height)

  // Default "unselected" stroke color for exports (prevents selected visuals leaking)
  const DEFAULT_UNSELECTED_STROKE = "#16689f"

  // For each spline: create a new group + path using the raw points
  splineManager.getAllSplines().forEach((spline) => {
    try {
      const pts = spline.points || []
      if (!pts || pts.length === 0) return

      const group = temp.group()

      // draw the path using points (this ensures no transform attributes are copied)
      if (pts.length >= 2) {
        // Respect original spline type when exporting
        const pathData =
          spline.type === "polyline"
            ? generatePolylinePath(pts)
            : generateBSplinePath(pts)
        group
          .path(pathData)
          .stroke({ color: DEFAULT_UNSELECTED_STROKE, width: 2 })
          .fill("none")
      }

      // Optionally include point circles (default: false -> do NOT export circles)
      if (includePoints) {
        pts.forEach((p) => {
          try {
            group
              .circle(6)
              .center(p.x ?? 0, p.y ?? 0)
              .fill("#ffcc00")
              .stroke({ width: 0 })
          } catch {
            // ignore
          }
        })
      }
    } catch (err) {
      console.warn("Failed to export spline", spline?.id, err)
    }
  })

  // clone imported SVGs (these are external assets, keep their transforms)
  const objectsToExport = svgObjectManager?.getAllObjects?.() || []
  objectsToExport.forEach((obj) => {
    try {
      temp.add(obj.clone())
    } catch {
      // ignore clone errors
    }
  })

  const svgContent = temp.svg()
  temp.remove()

  const blob = new Blob([svgContent], {
    type: "image/svg+xml;charset=utf-8",
  })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
