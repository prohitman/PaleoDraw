// src/utils/geometry.js
export const EPS = 1e-4

export function pointsAreSame(aPoints, bPoints, eps = EPS) {
  if (!aPoints || !bPoints) return false
  if (aPoints.length !== bPoints.length) return false
  for (let i = 0; i < aPoints.length; i++) {
    const a = aPoints[i]
    const b = bPoints[i]
    if (Math.abs(a.x - b.x) > eps || Math.abs(a.y - b.y) > eps) return false
  }
  return true
}

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

// Simple polyline path generator (straight segments)
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
 * Generates a Hybrid path string from a set of points.
 * Supports mixed smooth and sharp points.
 * If a point has isSharp=true, it creates a C0 continuity (sharp corner).
 *
 * @param {Array<{x: number, y: number, isSharp?: boolean}>} points - Array of points
 * @returns {string} - SVG path data
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
 * Generates a NURBS path string from a set of points.
 * Uses the hybrid generator to support mixed sharp/smooth edges.
 *
 * @param {Array<{x: number, y: number}>} points - Array of points
 * @returns {string} - SVG path data
 */
export function generateNurbsPath(points) {
  return generateHybridPath(points)
}

export function maxBoxFromPoints(points) {
  let x = Infinity
  let y = Infinity
  let x2 = -Infinity
  let y2 = -Infinity

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    x = Math.min(x, p[0])
    y = Math.min(y, p[1])
    x2 = Math.max(x2, p[0])
    y2 = Math.max(y2, p[1])
  }

  return { x, y, width: x2 - x, height: y2 - y, x2, y2 }
}
