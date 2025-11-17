// handlers/projectHandler.js
import { SVG } from "@svgdotjs/svg.js"
import { drawGrid } from "../utils/svgHelpers"
import { generateBSplinePath } from "../utils/geometry"

const GRID_BASE_THICKNESS = 0.5

export function createNewProject(
  drawRef,
  canvasSizeRef,
  gridSizeRef,
  gridRef,
  fitToCanvas,
  svgObjects,
  splinesRef,
  activeSplineRef,
  selectedRef,
  splineTransformRef,
  selectedTool,
  isDraggingPoint,
  setupSplineTransformations
) {
  const draw = drawRef.current
  if (!draw) return
  draw.clear()
  const bg = draw
    .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
    .fill("#222")
    .id("canvas-bg")
  bg.node.style.pointerEvents = "none"

  const grid = draw.group().id("canvas-grid")
  gridRef.current = grid

  grid._drawGrid = (gSize = gridSizeRef.current) =>
    drawGrid(grid, canvasSizeRef.current, gSize)
  grid._drawGrid(gridSizeRef.current)
  fitToCanvas()

  svgObjects.current = []
  splinesRef.current = []
  activeSplineRef.current = null
  selectedRef.current = null

  // rebind transforms so API remains valid
  splineTransformRef.current = setupSplineTransformations(
    drawRef.current,
    splinesRef,
    selectedTool,
    isDraggingPoint
  )
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
  svgObjects,
  splinesRef
) {
  if (!drawRef.current) return null
  const project = {
    metadata: { version: "2.0", savedAt: new Date().toISOString() },
    canvas: canvasSizeRef.current,
    gridSize: gridSizeRef.current,
    // Save only raw points and minimal meta for splines (no transforms)
    splines: (splinesRef.current || []).map((s) => ({
      id: s.id || null,
      color: s.color || "#00ffff",
      points: (s.points || []).map((p) => ({ x: p.x, y: p.y })),
      selected: false,
    })),
    // Keep imported SVGs as full SVG markup + transform (imported assets should keep transforms)
    importedSVGs: (svgObjects.current || []).map((obj) => ({
      svg: obj.svg(),
      transform: obj.transform ? obj.transform() : null,
    })),
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
 * Important: We reconstruct splines by calling the supplied createSpline and
 * setupPointHandlers. We explicitly clear any transform attributes on groups so
 * splines are treated as fresh objects.
 */
export async function loadFromJSON(
  drawRef,
  canvasSizeRef,
  gridSizeRef,
  gridRef,
  fitToCanvas,
  svgObjects,
  splinesRef,
  activeSplineRef,
  splineTransformRef,
  selectedRef,
  selectedTool,
  isDraggingPoint,
  createSpline,
  setupPointHandlers,
  drawOrUpdateSpline,
  updateSplineVisualState,
  setupSplineTransformations
) {
  if (!drawRef.current) return
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    let data
    try {
      data = JSON.parse(text)
    } catch (err) {
      console.error("Invalid JSON project file", err)
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
      .fill("#222")
      .id("canvas-bg")
    bg.node.style.pointerEvents = "none"
    const grid = draw.group().id("canvas-grid")
    gridRef.current = grid
    grid._drawGrid = (gSize = data.gridSize || gridSizeRef.current) =>
      drawGrid(grid, canvasSizeRef.current, gSize)
    grid._drawGrid(data.gridSize || gridSizeRef.current)
    gridSizeRef.current = data.gridSize || gridSizeRef.current
    fitToCanvas()

    // Restore splines
    splinesRef.current = []
    if (Array.isArray(data.splines)) {
      for (const s of data.splines) {
        // create spline (this sets up group + path)
        const spline = createSpline(
          draw,
          selectedTool,
          drawRef,
          isDraggingPoint,
          splinesRef,
          activeSplineRef
        )

        // ensure no leftover transform on group
        try {
          if (spline.group && spline.group.node) {
            // remove any transform attribute so the group is identity
            spline.group.node.removeAttribute("transform")
          }
        } catch (err) {
          // ignore
        }

        // create points inside spline.group using raw coordinates
        spline.points = (s.points || []).map(({ x, y }) => {
          const circle = spline.group
            .circle(6)
            .fill("#ffcc00")
            .center(x, y)
            .show()
          // Hook up handlers so the loaded points behave like fresh points
          setupPointHandlers(
            circle,
            spline,
            isDraggingPoint,
            splinesRef,
            activeSplineRef,
            selectedTool
          )
          return { x, y, circle }
        })

        spline.color = s.color || spline.color
        spline.selected = false

        // Ensure path reflects points
        drawOrUpdateSpline(spline)

        // Add to array
        splinesRef.current.push(spline)

        // Keep visual state consistent
        updateSplineVisualState(spline)
      }
    }

    // Restore imported SVGs (preserve their transform and draggable behavior)
    svgObjects.current = []
    if (Array.isArray(data.importedSVGs)) {
      data.importedSVGs.forEach((objData) => {
        try {
          const group = draw.group().svg(objData.svg)
          if (objData.transform) {
            try {
              group.transform(objData.transform)
            } catch (err) {
              // if transform parsing fails, ignore
              console.warn("Failed to apply transform to imported SVG", err)
            }
          }
          group.draggable()
          svgObjects.current.push(group)
        } catch (err) {
          console.warn("Failed to restore imported SVG", err)
        }
      })
    }

    // Attach transform handlers to the newly restored splines (important)
    splineTransformRef.current = setupSplineTransformations(
      drawRef.current,
      splinesRef,
      selectedTool,
      isDraggingPoint
    )
    splineTransformRef.current?.attachToAll?.()

    activeSplineRef.current = null
    selectedRef.current = null
  }
  input.click()
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
 * @param {object} splinesRef
 * @param {boolean} includePoints - optional; default false. If true, include point circles.
 */
export function exportAsSVG(
  filename,
  drawRef,
  canvasSizeRef,
  svgObjects,
  splinesRef,
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
  ;(splinesRef.current || []).forEach((s) => {
    try {
      const pts = s.points || []
      if (!pts || pts.length === 0) return

      const group = temp.group()

      // draw the path using points (this ensures no transform attributes are copied)
      if (pts.length >= 2) {
        const pathData = generateBSplinePath(pts)
        /*         // If the spline was selected in the UI, override color to unselected color
        const strokeColor =
          s.selected === true
            ? DEFAULT_UNSELECTED_STROKE
            : s.color || DEFAULT_UNSELECTED_STROKE */

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
          } catch {}
        })
      }
    } catch (err) {
      console.warn("Failed to export spline", s?.id, err)
    }
  })

  // clone imported SVGs (these are external assets, keep their transforms)
  ;(svgObjects.current || []).forEach((obj) => {
    try {
      temp.add(obj.clone())
    } catch (err) {
      console.warn("Failed to clone imported SVG for export", err)
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
