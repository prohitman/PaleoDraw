// src/services/ProjectService.js
/**
 * Project file I/O operations
 * Pure functions for saving, loading, and exporting projects
 * @module services/ProjectService
 */
import { SVG } from "@svgdotjs/svg.js"
import { drawGrid } from "../utils/svgHelpers"
import { generateBSplinePath, generatePolylinePath } from "../utils/geometry"
import { downloadBlob } from "./FileService"

const GRID_BASE_THICKNESS = 0.5

/**
 * Validate that a parsed JSON object is a valid PaleoDraw project
 * @param {object} data - The parsed JSON data
 * @returns {object} { valid: boolean, error?: string }
 */
function validateProjectData(data) {
  // Must be an object
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, error: "Project file must be a JSON object" }
  }

  // Check for required structure - at least one of these should exist
  const hasSplines = Array.isArray(data.splines)
  const hasSvgs = Array.isArray(data.svgs)
  const hasCanvas = data.canvas && typeof data.canvas === "object"
  const hasGridSize = typeof data.gridSize === "number"

  // If none of the expected properties exist, it's likely not a PaleoDraw project
  if (!hasSplines && !hasSvgs && !hasCanvas && !hasGridSize) {
    return {
      valid: false,
      error: "File does not appear to be a valid PaleoDraw project",
    }
  }

  // Validate splines structure if present
  if (data.splines !== undefined) {
    if (!Array.isArray(data.splines)) {
      return { valid: false, error: "Invalid splines data format" }
    }
    // Check first spline has required structure
    if (data.splines.length > 0) {
      const firstSpline = data.splines[0]
      if (
        !firstSpline.id ||
        !Array.isArray(firstSpline.points) ||
        !firstSpline.type
      ) {
        return { valid: false, error: "Invalid spline data structure" }
      }
    }
  }

  // Validate SVGs structure if present
  if (data.svgs !== undefined && !Array.isArray(data.svgs)) {
    return { valid: false, error: "Invalid SVG objects data format" }
  }

  // Validate canvas structure if present
  if (data.canvas !== undefined) {
    if (
      typeof data.canvas !== "object" ||
      typeof data.canvas.width !== "number" ||
      typeof data.canvas.height !== "number"
    ) {
      return { valid: false, error: "Invalid canvas data format" }
    }
  }

  return { valid: true }
}

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

/**
 * Save the current project to a file using IPC bridge (Electron) or browser download (fallback)
 * @param {string} currentPath - Current project file path (if already saved)
 * @param {object} ref - Canvas ref containing getProjectJSON method
 * @returns {Promise<string|null>} - Returns the saved file path or null if cancelled
 */
export async function saveProject(currentPath, ref) {
  const jsonStr = ref.current?.getProjectJSON?.()
  if (!jsonStr) return null

  console.log("[saveProject] currentPath:", currentPath)

  // Use IPC bridge if available (Electron)
  if (window.api?.saveProjectFile) {
    try {
      // If currentPath exists, save directly without dialog
      if (currentPath) {
        console.log("[saveProject] Saving directly to:", currentPath)
        const result = await window.api.saveProjectFile(
          currentPath,
          jsonStr,
          true
        )
        if (result.success) {
          console.log("[saveProject] Direct save successful")
          addToRecentProjects(result.filePath)
          return result.filePath
        }
      } else {
        // No current path - show save dialog for new project
        console.log("[saveProject] No current path, showing dialog")
        const result = await window.api.saveProjectFile(
          "project.json",
          jsonStr,
          false
        )

        if (result.canceled || !result.filePath) {
          return null
        }

        if (result.success) {
          addToRecentProjects(result.filePath)
          return result.filePath
        }
      }
    } catch (err) {
      console.error("Failed to save project:", err)
      alert("Failed to save project: " + err.message)
      return null
    }
  } else {
    // Fallback to browser download
    const filename = currentPath?.split(/[/\\]/).pop() || "project.json"
    downloadBlob(filename, jsonStr, "application/json")
    return null // Can't track path in browser mode
  }
}
/**
 * Save as JSON (always prompts for new location)
 * This is "Save As" functionality - always shows dialog
 */
export async function saveAsJSON(filename, ref) {
  const jsonStr = ref.current?.getProjectJSON?.()
  if (!jsonStr) return null

  // Use IPC bridge if available (Electron)
  if (window.api?.saveProjectFile) {
    try {
      const defaultPath = filename || "project.json"
      const result = await window.api.saveProjectFile(
        defaultPath,
        jsonStr,
        false
      )

      if (result.canceled || !result.filePath) {
        return null
      }

      if (result.success) {
        addToRecentProjects(result.filePath)
        return result.filePath
      }
    } catch (err) {
      console.error("Failed to save project:", err)
      alert("Failed to save project: " + err.message)
      return null
    }
  } else {
    // Fallback to browser download
    downloadBlob(filename || "project.json", jsonStr, "application/json")
    return null // Can't track path in browser mode
  }
}

/**
 * Load a project JSON file and reconstruct the canvas.
 * Uses SplineManager to handle spline reconstruction with proper handlers attached.
 * @returns {Promise<string|null>} - Returns the loaded file path or null if cancelled
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
  if (!drawRef.current) return null

  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) {
        resolve(null)
        return
      }

      const filePath = file.path || null // Electron provides file.path

      // If in Electron, save path to recent projects
      if (filePath) {
        addToRecentProjects(filePath)
      }

      const text = await file.text()
      let data

      try {
        data = JSON.parse(text)
      } catch (err) {
        console.error("Invalid JSON project file:", err)
        alert("Error: The selected file is not a valid JSON file.")
        resolve(null)
        return
      }

      // Validate project structure
      const validation = validateProjectData(data)
      if (!validation.valid) {
        console.error("Invalid project file:", validation.error)
        alert(
          `Error: ${validation.error}\n\nThis file cannot be opened as a PaleoDraw project.`
        )
        resolve(null)
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
      resolve(filePath)
    }

    input.click()
  })
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
    } catch (err) {
      console.error("Invalid JSON project file:", err)
      alert(`Error: The file "${path}" is not a valid JSON file.`)
      return
    }

    // Validate project structure
    const validation = validateProjectData(data)
    if (!validation.valid) {
      console.error("Invalid project file:", validation.error)
      alert(
        `Error: ${validation.error}\n\nThe file "${path}" cannot be opened as a PaleoDraw project.`
      )
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
 * @returns {Promise<boolean>} - Returns true if export succeeded, false otherwise
 */
export async function exportAsSVG(
  filename,
  drawRef,
  canvasSizeRef,
  splineManager,
  svgObjectManager,
  includePoints = false
) {
  const draw = drawRef.current
  if (!draw) return false

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

  // Use IPC bridge if available (Electron)
  if (window.api?.exportSVGFile) {
    try {
      const result = await window.api.exportSVGFile(filename, svgContent)

      if (result.canceled || !result.filePath) {
        return false
      }

      return result.success
    } catch (err) {
      console.error("Failed to export SVG:", err)
      alert("Failed to export SVG: " + err.message)
      return false
    }
  } else {
    // Fallback to browser download
    downloadBlob(filename, svgContent, "image/svg+xml;charset=utf-8")
    return true
  }
}
