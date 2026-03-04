// src/utils/svgHelpers.js
/**
 * SVG manipulation helpers for grid, transformations, and canvas utilities
 * @module utils/svgHelpers
 */
import logger from "./logger.js"

/** Base thickness for grid lines (adjusted by zoom level) */
export const GRID_BASE_THICKNESS = 0.5

/**
 * Draw a grid of lines on an SVG group element
 * Creates horizontal and vertical lines at regular intervals
 * @param {object} grid - SVG.js group element to draw grid lines into
 * @param {object} canvasSize - Canvas dimensions { width, height }
 * @param {number} [gSize=25] - Grid spacing in pixels
 * @param {number} [baseThickness=GRID_BASE_THICKNESS] - Line stroke width
 */
export function drawGrid(
  grid,
  canvasSize,
  gSize = 25,
  baseThickness = GRID_BASE_THICKNESS,
) {
  if (!grid || !canvasSize) return
  grid.clear()
  const { width: w, height: h } = canvasSize
  for (let x = 0; x <= w; x += gSize) {
    grid.line(x, 0, x, h).addClass("grid-line").stroke({ width: baseThickness })
  }
  for (let y = 0; y <= h; y += gSize) {
    grid.line(0, y, w, y).addClass("grid-line").stroke({ width: baseThickness })
  }
}

/**
 * Update grid line thickness based on current zoom level
 * Maintains visual consistency by scaling line width inversely with zoom
 * @param {object} grid - SVG.js group element containing grid lines
 * @param {number} zoom - Current zoom level (1 = 100%)
 * @param {number} [baseThickness=GRID_BASE_THICKNESS] - Base line stroke width
 */
export function updateGridLineThickness(
  grid,
  zoom,
  baseThickness = GRID_BASE_THICKNESS,
) {
  if (!grid) return
  const newThickness = baseThickness / (zoom || 1)
  grid.each((i, children) => children.stroke({ width: newThickness }))
}

/**
 * Reset all transformations on an SVG element to identity
 * Removes transform attribute or calls untransform() if available
 * @param {object} el - SVG.js element or native SVG element
 */
export function resetGroupTransform(el) {
  if (!el) return
  try {
    if (typeof el.untransform === "function") el.untransform()
    else if (el.node && el.node.removeAttribute)
      el.node.removeAttribute("transform")
  } catch (err) {
    logger.warn("[svgHelpers] resetGroupTransform failed:", err)
  }
}

/**
 * Fit SVG drawing to container by adjusting viewbox and zoom level
 * Calculates optimal zoom to fit canvas within container while respecting max zoom
 * Centers the view and updates grid line thickness
 * @param {object} drawRef - React ref containing SVG.js draw instance
 * @param {object} canvasSizeRef - React ref containing canvas size { width, height }
 * @param {HTMLElement} container - DOM element containing the canvas
 * @param {object} panZoomRef - React ref containing pan/zoom plugin instance
 * @param {object} panZoomOptionsRef - React ref containing zoom options { zoomMax, etc }
 * @param {Function} updateGridThickness - Callback to update grid line thickness
 */
export function fitToCanvas(
  drawRef,
  canvasSizeRef,
  container,
  panZoomRef,
  panZoomOptionsRef,
  updateGridThickness,
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
  const center = draw.point(containerRect.width / 2, containerRect.height / 2)

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

/**
 * Create a styled control point circle within an SVG group
 * @param {object} group - SVG.js group element to add circle to
 * @param {number} x - X coordinate for circle center
 * @param {number} y - Y coordinate for circle center
 * @param {number} [radius=6] - Circle radius
 * @returns {object|null} SVG.js circle element or null if no group provided
 * @deprecated Use Spline.addPoint() instead, which handles point creation internally
 */
export function createPointCircle(group, x, y, radius = 6) {
  if (!group) return null
  return group.circle(radius).addClass("spline-point").center(x, y).show()
}
