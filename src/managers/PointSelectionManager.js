// src/managers/PointSelectionManager.js
/**
 * Point Selection Manager
 * Manages multi-selection of points within splines for curve tool
 * Enables moving and deleting multiple points at once
 */

import EventEmitter from "../utils/eventEmitter"

export class PointSelectionManager extends EventEmitter {
  constructor() {
    super()

    // Set of selected points: {splineId}_{pointIndex}
    this.selectedPoints = new Set()

    // Reference to SplineManager for accessing splines
    this.splineManager = null

    // Visual highlight color for selected points
    this.selectedColor = "#ff00ff" // Magenta for point selection
    this.normalColor = "#ffffff" // White for normal points
  }

  /**
   * Initialize with SplineManager reference
   * @param {object} splineManager - SplineManager instance
   */
  initialize(splineManager) {
    this.splineManager = splineManager
    console.log("[PointSelectionManager] Initialized")
  }

  /**
   * Check if any points are selected
   * @returns {boolean}
   */
  hasSelection() {
    return this.selectedPoints.size > 0
  }

  /**
   * Get count of selected points
   * @returns {number}
   */
  getSelectionCount() {
    return this.selectedPoints.size
  }

  /**
   * Select a point (with optional additive mode for multi-select)
   * @param {string} splineId - ID of the spline
   * @param {number} pointIndex - Index of the point in the spline
   * @param {boolean} additive - If true, adds to selection; if false, replaces selection
   */
  selectPoint(splineId, pointIndex, additive = false) {
    const pointKey = `${splineId}_${pointIndex}`

    if (!additive) {
      this.clearSelection()
    }

    if (this.selectedPoints.has(pointKey)) {
      // Toggle off if already selected and additive
      if (additive) {
        this.deselectPoint(splineId, pointIndex)
        return
      }
    } else {
      this.selectedPoints.add(pointKey)
      this.highlightPoint(splineId, pointIndex, true)
    }

    this.emit("selectionChanged", {
      selectedPoints: Array.from(this.selectedPoints),
      count: this.selectedPoints.size,
      hasSelection: this.hasSelection(),
    })

    console.log(
      `[PointSelectionManager] Selected point ${pointIndex} in spline ${splineId}, total: ${this.selectedPoints.size}`
    )
  }

  /**
   * Deselect a specific point
   * @param {string} splineId
   * @param {number} pointIndex
   */
  deselectPoint(splineId, pointIndex) {
    const pointKey = `${splineId}_${pointIndex}`

    if (this.selectedPoints.has(pointKey)) {
      this.selectedPoints.delete(pointKey)
      this.highlightPoint(splineId, pointIndex, false)

      this.emit("selectionChanged", {
        selectedPoints: Array.from(this.selectedPoints),
        count: this.selectedPoints.size,
        hasSelection: this.hasSelection(),
      })

      console.log(
        `[PointSelectionManager] Deselected point ${pointIndex} in spline ${splineId}`
      )
    }
  }

  /**
   * Clear all point selections
   */
  clearSelection() {
    if (this.selectedPoints.size === 0) return

    // Remove highlights from all selected points
    this.selectedPoints.forEach((pointKey) => {
      const [splineId, pointIndex] = pointKey.split("_")
      this.highlightPoint(splineId, parseInt(pointIndex), false)
    })

    this.selectedPoints.clear()

    this.emit("selectionChanged", {
      selectedPoints: [],
      count: 0,
      hasSelection: false,
    })

    console.log("[PointSelectionManager] Cleared all point selections")
  }

  /**
   * Highlight or unhighlight a point visually
   * @param {string} splineId
   * @param {number} pointIndex
   * @param {boolean} highlighted
   */
  highlightPoint(splineId, pointIndex, highlighted) {
    if (!this.splineManager) return

    const spline = this.splineManager.getSpline(splineId)
    if (!spline || !spline.points[pointIndex]) return

    const point = spline.points[pointIndex]
    if (!point.circle) return

    // Change circle fill color
    const color = highlighted ? this.selectedColor : this.normalColor
    point.circle.fill(color)

    console.log(
      `[PointSelectionManager] ${
        highlighted ? "Highlighted" : "Unhighlighted"
      } point ${pointIndex} in spline ${splineId}`
    )
  }

  /**
   * Move all selected points by delta
   * @param {number} dx - Delta x
   * @param {number} dy - Delta y
   */
  moveSelectedPoints(dx, dy) {
    if (!this.hasSelection() || !this.splineManager) return

    console.log(
      `[PointSelectionManager] Moving ${this.selectedPoints.size} points by dx:${dx}, dy:${dy}`
    )

    const affectedSplines = new Set()

    this.selectedPoints.forEach((pointKey) => {
      const [splineId, pointIndex] = pointKey.split("_")
      const spline = this.splineManager.getSpline(splineId)

      if (spline && spline.points[parseInt(pointIndex)]) {
        const point = spline.points[parseInt(pointIndex)]
        point.x += dx
        point.y += dy

        if (point.circle) {
          point.circle.center(point.x, point.y)
        }

        affectedSplines.add(splineId)
      }
    })

    // Replot all affected splines
    affectedSplines.forEach((splineId) => {
      const spline = this.splineManager.getSpline(splineId)
      if (spline) spline.plot()
    })

    this.emit("pointsMoved", { dx, dy, count: this.selectedPoints.size })
    console.log(
      `[PointSelectionManager] Moved ${this.selectedPoints.size} points across ${affectedSplines.size} splines`
    )
  }

  /**
   * Delete all selected points
   * Note: Deleting points may affect spline validity (need at least 2 points)
   */
  deleteSelectedPoints() {
    if (!this.hasSelection() || !this.splineManager) return

    console.log(
      `[PointSelectionManager] Deleting ${this.selectedPoints.size} points`
    )

    // Group points by spline for efficient deletion
    const pointsBySpline = new Map()

    this.selectedPoints.forEach((pointKey) => {
      const [splineId, pointIndex] = pointKey.split("_")
      if (!pointsBySpline.has(splineId)) {
        pointsBySpline.set(splineId, [])
      }
      pointsBySpline.get(splineId).push(parseInt(pointIndex))
    })

    // Delete points from each spline (in reverse order to maintain indices)
    pointsBySpline.forEach((indices, splineId) => {
      const spline = this.splineManager.getSpline(splineId)
      if (!spline) return

      // Sort indices in descending order to delete from end to start
      indices.sort((a, b) => b - a)

      indices.forEach((pointIndex) => {
        const point = spline.points[pointIndex]
        if (point) {
          this.splineManager.deletePointFromSpline(splineId, point)
        }
      })
    })

    this.clearSelection()
    this.emit("pointsDeleted", { count: this.selectedPoints.size })
    console.log("[PointSelectionManager] Deleted selected points")
  }

  /**
   * Get all selected point data
   * @returns {Array} - Array of {splineId, pointIndex, point}
   */
  getSelectedPointsData() {
    if (!this.splineManager) return []

    const pointsData = []

    this.selectedPoints.forEach((pointKey) => {
      const [splineId, pointIndex] = pointKey.split("_")
      const spline = this.splineManager.getSpline(splineId)

      if (spline && spline.points[parseInt(pointIndex)]) {
        pointsData.push({
          splineId,
          pointIndex: parseInt(pointIndex),
          point: spline.points[parseInt(pointIndex)],
        })
      }
    })

    return pointsData
  }
}
