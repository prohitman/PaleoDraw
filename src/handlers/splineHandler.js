// handlers/splinesHandler.js
import { SVG } from "@svgdotjs/svg.js"

/** --- CONFIG --- **/
const SPLINE_COLORS = {
  SELECTED: "#00ffff",
  UNSELECTED: "#16689fff",
  HOVER: "#e3f6f6ff",
}

const POINT_COLOR = "#ffcc00"

/** --- UTILITY HELPERS --- **/

export function generateBSplinePath(points) {
  if (points.length < 2) return ""
  const d = [`M${points[0].x},${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`)
  }
  return d.join(" ")
}

export function updateSplineVisualState(spline) {
  spline.path.stroke({
    color: spline.selected ? SPLINE_COLORS.SELECTED : SPLINE_COLORS.UNSELECTED,
    width: 2,
  })

  spline.points.forEach((p) =>
    spline.selected ? p.circle.show() : p.circle.hide()
  )
}

/** --- CREATION & HANDLING --- **/
export function handleSplineClick(spline, e, selectedTool, isDraggingPoint, splinesRef, activeSplineRef) {
  e?.stopPropagation()

  if (selectedTool.current === "curve" && !isDraggingPoint.current) {
    // Deselect others
    splinesRef.current.forEach((s) => {
      if (s !== spline) {
        s.selected = false
        updateSplineVisualState(s)
      }
    })

    // Toggle this spline
    spline.selected = !spline.selected
    activeSplineRef.current = spline.selected ? spline : null
    updateSplineVisualState(spline)
  }

  if (selectedTool.current === "delete_spline") {
    deleteSpline(spline, splinesRef, activeSplineRef)
  }
}

export function createSpline(
  draw,
  selectedTool,
  drawRef,
  isDraggingRef,
  splinesRef,
  activeSplineRef
) {
  const newSpline = {
    points: [],
    path: draw
      .path("")
      .stroke({ color: SPLINE_COLORS.SELECTED, width: 2 })
      .fill("none"),
    selected: true,
  }

  newSpline.path.on("click", (ev) => {
    ev.stopPropagation()
    if (selectedTool?.current === "curve" && newSpline.selected && !ev.altKey) {
      const { x, y } = drawRef.current.point(ev.clientX, ev.clientY)
      addPointToSpline(
        draw,
        newSpline,
        x,
        y,
        isDraggingRef,
        splinesRef,
        activeSplineRef
      )
    }
    handleSplineClick(newSpline, ev, selectedTool, isDraggingRef, splinesRef, activeSplineRef)
  })

  newSpline.path.on("mouseover", () => {
    if (!newSpline.selected)
      newSpline.path.stroke({ color: SPLINE_COLORS.HOVER, width: 3 })
  })

  newSpline.path.on("mouseout", () => {
    if (!newSpline.selected)
      newSpline.path.stroke({ color: SPLINE_COLORS.UNSELECTED, width: 2 })
  })

  return newSpline
}

export function addPointToSpline(
  draw,
  spline,
  x,
  y,
  isDraggingRef,
  splinesRef,
  activeSplineRef
) {
  const point = draw.circle(6).fill(POINT_COLOR).center(x, y).show()
  const newPt = { x, y, circle: point }
  spline.points.push(newPt)
  setupPointHandlers(point, spline, isDraggingRef, splinesRef, activeSplineRef)
  drawOrUpdateSpline(spline)
}

export function drawOrUpdateSpline(spline) {
  const pts = spline.points
  if (pts.length < 2) return
  const pathData = generateBSplinePath(pts)
  spline.path.plot(pathData)
}

/** --- POINT MANIPULATION --- **/

export function deletePointFromSpline(
  spline,
  point,
  splinesRef,
  activeSplineRef
) {
  point.circle.remove()
  spline.points = spline.points.filter((p) => p !== point)
  drawOrUpdateSpline(spline)
  if (spline.points.length < 2) {
    deleteSpline(spline, splinesRef, activeSplineRef)
  }
}

export function setupPointHandlers(
  point,
  spline,
  isDraggingRef,
  splinesRef,
  activeSplineRef
) {
  point.draggable()

  point.on("dragmove", () => {
    const cx = point.cx()
    const cy = point.cy()
    const p = spline.points.find((pt) => pt.circle === point)
    if (p) {
      p.x = cx
      p.y = cy
      drawOrUpdateSpline(spline)
    }
    isDraggingRef.current = true
  })

  point.on("dragend", () => {
    setTimeout(() => (isDraggingRef.current = false), 100)
  })

  point.on("contextmenu", (e) => {
    e.preventDefault()
    e.stopPropagation()
    const p = spline.points.find((pt) => pt.circle === point)
    if (p) deletePointFromSpline(spline, p, splinesRef, activeSplineRef)
  })
}

/** --- SPLINE DELETION --- **/
export function deleteSpline(spline, splinesRef, activeSplineRef) {
  spline.path.remove()
  spline.points.forEach((p) => p.circle.remove())
  splinesRef.current = splinesRef.current.filter((s) => s !== spline)
  if (activeSplineRef.current === spline) activeSplineRef.current = null
}

/** --- ALT+CLICK INSERT --- **/

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1)

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(px - projX, py - projY)
}

export function insertPointByProximity(
  draw,
  spline,
  x,
  y,
  isDraggingRef,
  splinesRef,
  activeSplineRef
) {
  if (spline.points.length < 2) return

  let minDist = Infinity
  let insertIndex = spline.points.length

  for (let i = 0; i < spline.points.length - 1; i++) {
    const p1 = spline.points[i]
    const p2 = spline.points[i + 1]
    const dist = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y)
    if (dist < minDist) {
      minDist = dist
      insertIndex = i + 1
    }
  }

  const point = draw.current.circle(6).fill(POINT_COLOR).center(x, y).show()
  const newPt = { x, y, circle: point }
  spline.points.splice(insertIndex, 0, newPt)

  setupPointHandlers(point, spline, isDraggingRef, splinesRef, activeSplineRef)
  drawOrUpdateSpline(spline)
  updateSplineVisualState(spline)
}

/** --- FINISHING --- **/
export function finishActiveSpline(activeSplineRef) {
  if (activeSplineRef.current) {
    activeSplineRef.current.selected = false
    updateSplineVisualState(activeSplineRef.current)
    activeSplineRef.current = null
  }
}
