// src/utils/geometry.js
/**
 * Geometry utilities for spline path generation and distance calculations
 * @module utils/geometry
 */

/** Epsilon value for floating-point comparisons */
export const EPS = 1e-4

/**
 * Calculate the shortest distance from a point to a line segment
 * @param {number} px - Point X coordinate
 * @param {number} py - Point Y coordinate
 * @param {number} x1 - Segment start X
 * @param {number} y1 - Segment start Y
 * @param {number} x2 - Segment end X
 * @param {number} y2 - Segment end Y
 * @returns {number} Distance from point to segment
 */
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
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

/**
 * Generate SVG path string for a B-spline curve through given points
 * Uses Catmull-Rom spline algorithm for smooth curves
 * @param {Array<{x: number, y: number}>} points - Control points for the spline
 * @returns {string} SVG path data string
 */
export function generateBSplinePath(points) {
  if (!points || points.length < 2) return ""
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

/**
 * Generate SVG path string for straight line segments (polyline)
 * Creates C0 continuous path with sharp corners at each point
 * @param {Array<{x: number, y: number}>} points - Points to connect with straight lines
 * @returns {string} SVG path data string
 */
export function generatePolylinePath(points) {
  if (!points || points.length === 0) return ""
  if (points.length === 1) {
    const p = points[0]
    return `M${p.x},${p.y} L${p.x + 0.1},${p.y + 0.1}`
  }
  const parts = [`M${points[0].x},${points[0].y}`]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    parts.push(`L${p.x},${p.y}`)
  }
  return parts.join(" ")
}

/**
 * Generate SVG path string with mixed smooth and sharp points
 * Supports per-point smoothness control via isSharp property
 * If a point has isSharp=true, creates C0 continuity (sharp corner)
 * Otherwise creates C1 continuity (smooth curve) using Catmull-Rom tangents
 * @param {Array<{x: number, y: number, isSharp?: boolean}>} points - Points with optional sharpness flag
 * @returns {string} SVG path data string
 */
export function generateHybridPath(points) {
  if (!points || points.length < 2) return ""
  const d = [`M${points[0].x},${points[0].y}`]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    // Calculate Control Point 1 (associated with p1)
    let cp1x, cp1y
    if (p1.isSharp) {
      // Sharp corner at start of segment: no tangent from previous
      cp1x = p1.x
      cp1y = p1.y
    } else {
      // Smooth: Catmull-Rom tangent
      cp1x = p1.x + (p2.x - p0.x) / 6
      cp1y = p1.y + (p2.y - p0.y) / 6
    }

    // Calculate Control Point 2 (associated with p2)
    let cp2x, cp2y
    if (p2.isSharp) {
      // Sharp corner at end of segment: no tangent to next
      cp2x = p2.x
      cp2y = p2.y
    } else {
      // Smooth: Catmull-Rom tangent
      cp2x = p2.x - (p3.x - p1.x) / 6
      cp2y = p2.y - (p3.y - p1.y) / 6
    }

    d.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`)
  }
  return d.join(" ")
}

/**
 * Generate NURBS (Non-Uniform Rational B-Spline) path
 * Currently implemented as an alias to generateHybridPath for mixed smooth/sharp support
 * @param {Array<{x: number, y: number, isSharp?: boolean}>} points - Control points
 * @returns {string} SVG path data string
 */
export function generateNurbsPath(points) {
  return generateHybridPath(points)
}
