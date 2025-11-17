// src/utils/svgHelpers.js
export const GRID_BASE_THICKNESS = 0.5

export function drawGrid(
  grid,
  canvasSize,
  gSize = 25,
  baseThickness = GRID_BASE_THICKNESS
) {
  if (!grid || !canvasSize) return
  grid.clear()
  const { width: w, height: h } = canvasSize
  for (let x = 0; x <= w; x += gSize) {
    grid.line(x, 0, x, h).stroke({ color: "#333", width: baseThickness })
  }
  for (let y = 0; y <= h; y += gSize) {
    grid.line(0, y, w, y).stroke({ color: "#333", width: baseThickness })
  }
}

export function updateGridLineThickness(
  grid,
  zoom,
  baseThickness = GRID_BASE_THICKNESS
) {
  if (!grid) return
  const newThickness = baseThickness / (zoom || 1)
  grid.each((i, children) => children.stroke({ width: newThickness }))
}

export function resetGroupTransform(el) {
  if (!el) return
  try {
    if (typeof el.untransform === "function") el.untransform()
    else if (el.node && el.node.removeAttribute)
      el.node.removeAttribute("transform")
  } catch (err) {
    console.warn("[svgHelpers] resetGroupTransform failed:", err)
  }
}

/** small helper to create a styled point circle inside a group */
export function createPointCircle(group, x, y, radius = 6, color = "#ffcc00") {
  if (!group) return null
  return group.circle(radius).fill(color).center(x, y).show()
}
/** Fit the SVG drawing to the container by adjusting viewbox and zoom */
export function fitToCanvas(
  drawRef,
  canvasSizeRef,
  container,
  panZoomRef,
  panZoomOptionsRef,
  updateGridThickness
) {
  const draw = drawRef.current
  if (!draw || !container) return

  const { width, height } = canvasSizeRef.current

  // Ensure viewbox matches the canvas size
  draw.viewbox(0, 0, width, height)

  const containerRect = container.getBoundingClientRect()

  // Compute best uniform scale
  const scaleX = containerRect.width / width
  const scaleY = containerRect.height / height
  const maxZoom = panZoomOptionsRef.current?.zoomMax || 5

  const scale = Math.min(scaleX, scaleY, maxZoom)

  // Zoom centered on the screen midpoint
  const center = draw.point(
    containerRect.width / 2,
    containerRect.height / 2
  )

  const panZoom = panZoomRef.current

  if (panZoom && typeof panZoom.zoom === "function") {
    panZoom.zoom(scale, center)
  } else {
    draw.zoom(scale)
  }

  if (typeof updateGridThickness === "function") {
    updateGridThickness(scale)
  }
}