// src/managers/PointSelectionManager.js
/**
 * Point Selection Manager
 * Manages multi-selection of points within splines for curve tool
 * Enables moving and deleting multiple points at once
 * Emits events via EventBus:
 *  - point-selection:changed
 *  - points:moved
 *  - points:deleted
 */

import eventBus from "../core/EventBus"

export class PointSelectionManager {
  constructor() {
    // Set of selected points: {splineId}_{pointIndex}
    this.selectedPoints = new Set()

    // Reference to SplineManager for accessing splines
    this.splineManager = null

    // Cached bounds of current selection (compute lazily)
    this._cachedBounds = null

    // Overlay state
    this.pointGroupOverlay = null
    this.overlayDragState = { dragging: false, lastX: 0, lastY: 0 }
    this.draw = null
    this.selectedToolRef = null

    // Listen to EventBus for point selection clear requests
    eventBus.on("point-selection:clear-requested", () => {
      this.clearSelection()
      this.updateOverlay()
    })
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
   * Initialize overlay system with draw instance and tool ref
   * @param {object} draw - SVG.js draw instance
   * @param {object} selectedToolRef - Ref to current tool
   */
  initializeOverlay(draw, selectedToolRef) {
    this.draw = draw
    this.selectedToolRef = selectedToolRef
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
    console.log("[PointSelectionManager.selectPoint] invoked", {
      splineId,
      pointIndex,
      additive,
      alreadySelected: this.selectedPoints.has(pointKey),
      currentCount: this.selectedPoints.size,
    })

    if (!additive) {
      this.clearSelection()
    }

    if (this.selectedPoints.has(pointKey)) {
      // Previously: toggle off on additive shift-click.
      // New behavior: ignore duplicate additive selection to keep point selected.
      if (additive) {
        return
      }
    } else {
      this.selectedPoints.add(pointKey)
      this.highlightPoint(splineId, pointIndex, true)
    }

    // Invalidate bounds if growing selection
    if (this.selectedPoints.size >= 2) {
      this._cachedBounds = null
    }
    const bounds =
      this.selectedPoints.size >= 2 ? this.getSelectionBounds() : null

    eventBus.emit("point-selection:changed", {
      selectedPoints: Array.from(this.selectedPoints),
      count: this.selectedPoints.size,
      hasSelection: this.hasSelection(),
      type: "single",
      bounds,
    })

    console.log(
      `[PointSelectionManager] Selected point ${pointIndex} in spline ${splineId}, total: ${this.selectedPoints.size}`
    )
  }

  /**
   * Select all points within rectangular bounds
   * @param {number} x1 - start x
   * @param {number} y1 - start y
   * @param {number} x2 - end x
   * @param {number} y2 - end y
   * @param {boolean} additive - additive selection flag
   */
  selectPointsInRect(x1, y1, x2, y2, additive = false) {
    if (!this.splineManager) return
    const minX = Math.min(x1, x2)
    const minY = Math.min(y1, y2)
    const maxX = Math.max(x1, x2)
    const maxY = Math.max(y1, y2)

    if (!additive) {
      this.clearSelection()
    }

    const newlySelected = []

    this.splineManager.getAllSplines().forEach((spline) => {
      // Only select points from selected splines
      if (!spline.selected) return

      spline.points.forEach((pt, idx) => {
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          const key = `${spline.id}_${idx}`
          if (!this.selectedPoints.has(key)) {
            this.selectedPoints.add(key)
            this.highlightPoint(spline.id, idx, true)
            newlySelected.push(key)
          }
        }
      })
    })

    // Precompute bounds immediately for rectangle selection visibility
    this._cachedBounds = null
    const bounds = this.getSelectionBounds()
    eventBus.emit("point-selection:changed", {
      selectedPoints: Array.from(this.selectedPoints),
      count: this.selectedPoints.size,
      hasSelection: this.hasSelection(),
      added: newlySelected,
      rect: { x1, y1, x2, y2 },
      type: "rect",
      bounds,
    })
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

      eventBus.emit("point-selection:changed", {
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
      const parts = pointKey.split("_")
      const idx = parseInt(parts.pop())
      const splineIdRecovered = parts.join("_")
      this.highlightPoint(splineIdRecovered, idx, false)
    })

    this.selectedPoints.clear()
    this._cachedBounds = null

    eventBus.emit("point-selection:changed", {
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

    // Toggle selected class
    if (highlighted) {
      point.circle.addClass("selected")
    } else {
      point.circle.removeClass("selected")
    }

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
      const parts = pointKey.split("_")
      const idx = parseInt(parts.pop())
      const splineIdRecovered = parts.join("_")
      const spline = this.splineManager.getSpline(splineIdRecovered)

      if (spline && spline.points[idx]) {
        const point = spline.points[idx]
        point.x += dx
        point.y += dy

        if (point.circle) {
          point.circle.center(point.x, point.y)
        }

        affectedSplines.add(splineIdRecovered)
      }
    })

    // Replot all affected splines
    affectedSplines.forEach((splineId) => {
      const spline = this.splineManager.getSpline(splineId)
      if (spline) spline.plot()
    })

    eventBus.emit("points:moved", { dx, dy, count: this.selectedPoints.size })
    console.log(
      `[PointSelectionManager] Moved ${this.selectedPoints.size} points across ${affectedSplines.size} splines`
    )

    // Invalidate cached bounds after move
    this._cachedBounds = null
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

    const deleteCount = this.selectedPoints.size

    // Group points by spline for efficient deletion
    const pointsBySpline = new Map()

    this.selectedPoints.forEach((pointKey) => {
      const parts = pointKey.split("_")
      const idx = parseInt(parts.pop())
      const splineIdRecovered = parts.join("_")
      if (!pointsBySpline.has(splineIdRecovered)) {
        pointsBySpline.set(splineIdRecovered, [])
      }
      pointsBySpline.get(splineIdRecovered).push(idx)
    })

    // Delete points from each spline (in reverse order to maintain indices)
    pointsBySpline.forEach((indices, splineIdRecovered) => {
      const spline = this.splineManager.getSpline(splineIdRecovered)
      if (!spline) return

      // Sort indices in descending order to delete from end to start
      indices.sort((a, b) => b - a)

      indices.forEach((pointIndex) => {
        const point = spline.points[pointIndex]
        if (point) {
          this.splineManager.deletePointFromSpline(splineIdRecovered, point)
        }
      })
    })

    this.clearSelection()
    eventBus.emit("points:deleted", { count: deleteCount })
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
      const parts = pointKey.split("_")
      const idx = parseInt(parts.pop())
      const splineIdRecovered = parts.join("_")
      const spline = this.splineManager.getSpline(splineIdRecovered)

      if (spline && spline.points[idx]) {
        pointsData.push({
          splineId: splineIdRecovered,
          pointIndex: idx,
          point: spline.points[idx],
        })
      }
    })

    return pointsData
  }

  /**
   * Compute bounding box of all selected points
   * @returns {{x:number,y:number,width:number,height:number}|null}
   */
  getSelectionBounds() {
    if (!this.hasSelection() || !this.splineManager) {
      console.log(
        "[PointSelectionManager.getSelectionBounds] No selection or manager"
      )
      return null
    }

    if (this._cachedBounds) {
      console.log(
        "[PointSelectionManager.getSelectionBounds] Using cached",
        this._cachedBounds
      )
      return this._cachedBounds
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    this.selectedPoints.forEach((pointKey) => {
      const parts = pointKey.split("_")
      const idx = parseInt(parts.pop())
      const splineIdRecovered = parts.join("_")
      const spline = this.splineManager.getSpline(splineIdRecovered)
      const point = spline?.points?.[idx]
      if (!point) {
        console.log(
          "[PointSelectionManager.getSelectionBounds] Missing point",
          { splineId: splineIdRecovered, idx }
        )
        return
      }
      if (typeof point.x !== "number" || typeof point.y !== "number") {
        console.log(
          "[PointSelectionManager.getSelectionBounds] Invalid point coords",
          { splineId: splineIdRecovered, idx, x: point.x, y: point.y }
        )
        return
      }
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    })

    if (minX === Infinity) {
      console.log(
        "[PointSelectionManager.getSelectionBounds] Computation failed (minX Infinity)"
      )
      return null
    }

    const padding = 4
    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
    this._cachedBounds = bounds
    console.log("[PointSelectionManager.getSelectionBounds] Computed", bounds)
    return bounds
  }

  // ========== OVERLAY MANAGEMENT ==========

  /**
   * Create or update multi-point selection overlay
   */
  updateOverlay() {
    if (!this.draw || !this.selectedToolRef) return

    const count = this.getSelectionCount()
    const inEditTool = ["curve", "line", "straight", "nurbs"].includes(
      this.selectedToolRef.current
    )
    const bounds = this.getSelectionBounds()
    const shouldShow = inEditTool && bounds && count >= 2

    console.log("[PointSelectionManager.updateOverlay]", {
      count,
      inEditTool,
      hasBounds: !!bounds,
      shouldShow,
      bounds,
    })

    if (!shouldShow) {
      this.removeOverlay()
      return
    }

    const { x, y, width, height } = bounds

    if (!this.pointGroupOverlay) {
      this.pointGroupOverlay = this.draw
        .rect(width, height)
        .move(x, y)
        .addClass("point-group-selection-overlay")
        .id("point-group-selection-overlay")

      console.log("[PointSelectionManager.updateOverlay] created overlay", {
        width,
        height,
        x,
        y,
      })

      this.pointGroupOverlay.on(
        "pointerdown",
        this.handleOverlayPointerDown.bind(this)
      )
    } else {
      this.pointGroupOverlay.size(width, height).move(x, y)
      console.log("[PointSelectionManager.updateOverlay] updated overlay", {
        width,
        height,
        x,
        y,
      })
    }

    try {
      this.pointGroupOverlay.front()
    } catch {
      /* ignore front errors */
    }
  }

  /**
   * Remove the overlay if it exists
   */
  removeOverlay() {
    if (this.pointGroupOverlay) {
      try {
        this.pointGroupOverlay.remove()
      } catch {
        /* ignore removal errors */
      }
      this.pointGroupOverlay = null
      console.log("[PointSelectionManager.removeOverlay] removed overlay")
    }
  }

  /**
   * Handle overlay pointerdown event
   */
  handleOverlayPointerDown(e) {
    if (
      !["curve", "line", "straight", "nurbs"].includes(
        this.selectedToolRef.current
      ) ||
      e.button !== 0
    )
      return
    e.stopPropagation()
    e.preventDefault()

    const { x, y } = this.draw.point(e.clientX, e.clientY)
    this.overlayDragState = {
      dragging: true,
      lastX: x,
      lastY: y,
    }

    window.addEventListener(
      "pointermove",
      this.handleOverlayDragMove.bind(this)
    )
    window.addEventListener("pointerup", this.handleOverlayDragUp.bind(this), {
      once: true,
    })
  }

  /**
   * Handle overlay drag movement
   */
  handleOverlayDragMove(e) {
    if (!this.overlayDragState.dragging) return

    const { x, y } = this.draw.point(e.clientX, e.clientY)

    const dx = x - this.overlayDragState.lastX
    const dy = y - this.overlayDragState.lastY
    if (dx === 0 && dy === 0) return

    this.overlayDragState.lastX = x
    this.overlayDragState.lastY = y

    this.moveSelectedPoints(dx, dy)
    this.updateOverlay()
  }

  /**
   * Handle overlay drag end
   */
  handleOverlayDragUp() {
    this.overlayDragState.dragging = false
    window.removeEventListener(
      "pointermove",
      this.handleOverlayDragMove.bind(this)
    )
    // AutoHistoryPlugin handles history save via points:moved event
  }
}
