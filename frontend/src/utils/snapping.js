// utils/snapping.js
/**
 * Snapping utilities for point-to-point snapping during drag operations
 */

const SNAP_DISTANCE = 15 // pixels

/**
 * Find the nearest point to snap to within snap distance
 * @param {number} x - Current point x coordinate
 * @param {number} y - Current point y coordinate
 * @param {object} splineManager - SplineManager instance
 * @param {object} excludePoint - Point to exclude from snap search (the point being dragged)
 * @returns {object|null} - { x, y, distance, splineId, pointIndex } or null if no snap target
 */
export function findNearestSnapPoint(x, y, splineManager, excludePoint = null) {
  let nearestPoint = null
  let minDistance = SNAP_DISTANCE

  const allSplines = splineManager.getAllSplines()

  for (const spline of allSplines) {
    for (let i = 0; i < spline.points.length; i++) {
      const point = spline.points[i]

      // Skip if this is the point being dragged
      if (excludePoint && point.circle === excludePoint.circle) {
        continue
      }

      const dx = point.x - x
      const dy = point.y - y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < minDistance) {
        minDistance = distance
        nearestPoint = {
          x: point.x,
          y: point.y,
          distance,
          splineId: spline.id,
          pointIndex: i,
          point,
        }
      }
    }
  }

  return nearestPoint
}

/**
 * Get snap distance threshold
 * @returns {number} - Snap distance in pixels
 */
export function getSnapDistance() {
  return SNAP_DISTANCE
}
