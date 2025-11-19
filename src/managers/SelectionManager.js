// src/managers/SelectionManager.js
import EventEmitter from "../utils/eventEmitter"

/**
 * SelectionManager: Manages multi-selection of splines and SVG objects
 * Supports:
 * - Drag-to-select (right-click drag creates selection box)
 * - Shift-click to add/remove from selection
 * - Group operations (delete, move, rotate, resize)
 * Emits events: 'selectionChanged', 'dragSelectionStart', 'dragSelectionMove', 'dragSelectionEnd'
 */
export default class SelectionManager extends EventEmitter {
  constructor({ splineManager, svgObjectManager }) {
    super()

    this.splineManager = splineManager
    this.svgObjectManager = svgObjectManager

    // Selection state
    this.selectedSplines = new Set() // Set of spline IDs
    this.selectedSvgObjects = new Set() // Set of SVG object IDs

    // Drag selection state
    this.isDragging = false
    this.dragStart = null
    this.dragCurrent = null
    this.selectionBox = null // SVG rect element for visual feedback
  }

  // ========== SELECTION QUERIES ==========

  /**
   * Check if any items are selected
   * @returns {boolean}
   */
  hasSelection() {
    return this.selectedSplines.size > 0 || this.selectedSvgObjects.size > 0
  }

  /**
   * Get count of selected items
   * @returns {number}
   */
  getSelectionCount() {
    return this.selectedSplines.size + this.selectedSvgObjects.size
  }

  /**
   * Check if a spline is selected
   * @param {string} splineId
   * @returns {boolean}
   */
  isSplineSelected(splineId) {
    return this.selectedSplines.has(splineId)
  }

  /**
   * Check if an SVG object is selected
   * @param {string} svgObjectId
   * @returns {boolean}
   */
  isSvgObjectSelected(svgObjectId) {
    return this.selectedSvgObjects.has(svgObjectId)
  }

  /**
   * Get all selected spline instances
   * @returns {Spline[]}
   */
  getSelectedSplines() {
    const splines = []
    this.selectedSplines.forEach((id) => {
      const spline = this.splineManager.getSpline(id)
      if (spline) splines.push(spline)
    })
    return splines
  }

  /**
   * Get all selected SVG object instances
   * @returns {object[]}
   */
  getSelectedSvgObjects() {
    const objects = []
    this.selectedSvgObjects.forEach((id) => {
      const obj = this.svgObjectManager?.getObjectById?.(id)
      if (obj) objects.push(obj)
    })
    return objects
  }

  // ========== SINGLE SELECTION ==========

  /**
   * Select a single spline (clears other selections unless shift is held)
   * @param {string} splineId
   * @param {boolean} additive - If true, adds to selection instead of replacing
   */
  selectSpline(splineId, additive = false) {
    if (!additive) {
      this.clearSelection()
    }

    if (this.selectedSplines.has(splineId)) {
      // Already selected, deselect if additive (toggle behavior)
      if (additive) {
        this.selectedSplines.delete(splineId)
        const spline = this.splineManager.getSpline(splineId)
        if (spline) spline.setSelected(false)
      }
    } else {
      this.selectedSplines.add(splineId)
      const spline = this.splineManager.getSpline(splineId)
      if (spline) spline.setSelected(true)
    }

    this.emit("selectionChanged", {
      splines: Array.from(this.selectedSplines),
      svgObjects: Array.from(this.selectedSvgObjects),
      hasSelection: this.hasSelection(),
    })
  }

  /**
   * Select a single SVG object (clears other selections unless shift is held)
   * @param {string} svgObjectId
   * @param {boolean} additive - If true, adds to selection instead of replacing
   */
  selectSvgObject(svgObjectId, additive = false) {
    if (!additive) {
      this.clearSelection()
    }

    if (this.selectedSvgObjects.has(svgObjectId)) {
      // Already selected, deselect if additive (toggle behavior)
      if (additive) {
        this.selectedSvgObjects.delete(svgObjectId)
        // TODO: Call svgObjectManager to deselect visual state
      }
    } else {
      this.selectedSvgObjects.add(svgObjectId)
      // TODO: Call svgObjectManager to select visual state
    }

    this.emit("selectionChanged", {
      splines: Array.from(this.selectedSplines),
      svgObjects: Array.from(this.selectedSvgObjects),
    })
  }

  // ========== MULTI-SELECTION ==========

  /**
   * Select multiple splines at once
   * @param {string[]} splineIds
   * @param {boolean} additive
   */
  selectSplines(splineIds, additive = false) {
    if (!additive) {
      this.clearSelection()
    }

    splineIds.forEach((id) => {
      this.selectedSplines.add(id)
      const spline = this.splineManager.getSpline(id)
      if (spline) spline.setSelected(true)
    })

    this.emit("selectionChanged", {
      splines: Array.from(this.selectedSplines),
      svgObjects: Array.from(this.selectedSvgObjects),
      hasSelection: this.hasSelection(),
    })

    console.log(
      "[SelectionManager.selectSplines] Selected:",
      splineIds.length,
      "splines, hasSelection:",
      this.hasSelection()
    )
  }

  /**
   * Select multiple SVG objects at once
   * @param {string[]} svgObjectIds
   * @param {boolean} additive
   */
  selectSvgObjects(svgObjectIds, additive = false) {
    if (!additive) {
      this.clearSelection()
    }

    svgObjectIds.forEach((id) => {
      this.selectedSvgObjects.add(id)
      // TODO: Call svgObjectManager to select visual state
    })

    this.emit("selectionChanged", {
      splines: Array.from(this.selectedSplines),
      svgObjects: Array.from(this.selectedSvgObjects),
      hasSelection: this.hasSelection(),
    })

    console.log(
      "[SelectionManager.selectSvgObjects] Selected:",
      svgObjectIds.length,
      "objects, hasSelection:",
      this.hasSelection()
    )
  }

  // ========== CLEAR SELECTION ==========

  /**
   * Clear all selections
   */
  clearSelection() {
    // Deselect all splines
    this.selectedSplines.forEach((id) => {
      const spline = this.splineManager.getSpline(id)
      if (spline) spline.setSelected(false)
    })

    // Deselect all SVG objects
    this.selectedSvgObjects.forEach((id) => {
      // TODO: Call svgObjectManager to deselect visual state
    })

    this.selectedSplines.clear()
    this.selectedSvgObjects.clear()

    this.emit("selectionChanged", {
      splines: [],
      svgObjects: [],
      hasSelection: false,
    })
  }

  // ========== OPERATIONS ON SELECTED ITEMS ==========

  // ========== DRAG SELECTION ==========

  /**
   * Start drag selection (right-click drag)
   * @param {number} x - Starting x coordinate
   * @param {number} y - Starting y coordinate
   * @param {object} drawInstance - SVG.js draw instance for creating selection box
   */
  startDragSelection(x, y, drawInstance) {
    this.isDragging = true
    this.dragStart = { x, y }
    this.dragCurrent = { x, y }

    // Create visual selection box
    if (drawInstance) {
      this.selectionBox = drawInstance
        .rect(0, 0)
        .fill("rgba(0, 123, 255, 0.1)")
        .stroke({ color: "#007bff", width: 1, dasharray: "5,5" })
        .move(x, y)

      // Ensure selection box is on top
      this.selectionBox.front()
    }

    this.emit("dragSelectionStart", { x, y })
  }

  /**
   * Update drag selection as mouse moves
   * @param {number} x - Current x coordinate
   * @param {number} y - Current y coordinate
   */
  updateDragSelection(x, y) {
    if (!this.isDragging) return

    this.dragCurrent = { x, y }

    // Update visual selection box
    if (this.selectionBox) {
      const minX = Math.min(this.dragStart.x, x)
      const minY = Math.min(this.dragStart.y, y)
      const width = Math.abs(x - this.dragStart.x)
      const height = Math.abs(y - this.dragStart.y)

      this.selectionBox.move(minX, minY).size(width, height)
    }

    this.emit("dragSelectionMove", { x, y })
  }

  /**
   * End drag selection and select all items within the box
   * @param {number} x - Final x coordinate
   * @param {number} y - Final y coordinate
   * @param {boolean} additive - If true, adds to existing selection
   */
  endDragSelection(x, y, additive = false) {
    if (!this.isDragging) return

    this.dragCurrent = { x, y }

    // Calculate selection box bounds
    const minX = Math.min(this.dragStart.x, x)
    const maxX = Math.max(this.dragStart.x, x)
    const minY = Math.min(this.dragStart.y, y)
    const maxY = Math.max(this.dragStart.y, y)

    const selectionBounds = { minX, maxX, minY, maxY }

    // Find splines within bounds
    const splinesInBounds = this.findSplinesInBounds(selectionBounds)
    const svgObjectsInBounds = this.findSvgObjectsInBounds(selectionBounds)

    // Select found items
    if (splinesInBounds.length > 0 || svgObjectsInBounds.length > 0) {
      if (!additive) {
        this.clearSelection()
      }

      // Pass true for additive since we already cleared if needed
      this.selectSplines(splinesInBounds, true)
      this.selectSvgObjects(svgObjectsInBounds, true)
    }

    // Clean up
    if (this.selectionBox) {
      this.selectionBox.remove()
      this.selectionBox = null
    }

    this.isDragging = false
    this.dragStart = null
    this.dragCurrent = null

    this.emit("dragSelectionEnd", {
      bounds: selectionBounds,
      selectedSplines: splinesInBounds,
      selectedSvgObjects: svgObjectsInBounds,
    })
  }

  /**
   * Cancel drag selection without selecting anything
   */
  cancelDragSelection() {
    if (this.selectionBox) {
      this.selectionBox.remove()
      this.selectionBox = null
    }

    this.isDragging = false
    this.dragStart = null
    this.dragCurrent = null

    this.emit("dragSelectionEnd", { cancelled: true })
  }

  /**
   * Find splines within selection bounds
   * @param {object} bounds - {minX, maxX, minY, maxY}
   * @returns {string[]} - Array of spline IDs
   */
  findSplinesInBounds(bounds) {
    const splinesInBounds = []
    const allSplines = this.splineManager.getAllSplines()

    allSplines.forEach((spline) => {
      if (this.isSplineInBounds(spline, bounds)) {
        splinesInBounds.push(spline.id)
      }
    })

    return splinesInBounds
  }

  /**
   * Check if a spline is within bounds
   * @param {Spline} spline
   * @param {object} bounds
   * @returns {boolean}
   */
  isSplineInBounds(spline, bounds) {
    // Check if any point is within bounds
    // OR if the entire bounding box is within bounds
    const bbox = spline.group?.bbox?.()

    if (bbox) {
      // Check if bounding box intersects with selection bounds
      const bboxIntersects =
        bbox.x < bounds.maxX &&
        bbox.x + bbox.width > bounds.minX &&
        bbox.y < bounds.maxY &&
        bbox.y + bbox.height > bounds.minY

      return bboxIntersects
    }

    // Fallback: check if any point is within bounds
    return spline.points.some(
      (pt) =>
        pt.x >= bounds.minX &&
        pt.x <= bounds.maxX &&
        pt.y >= bounds.minY &&
        pt.y <= bounds.maxY
    )
  }

  /**
   * Find SVG objects within selection bounds
   * @param {object} bounds - {minX, maxX, minY, maxY}
   * @returns {string[]} - Array of SVG object IDs
   */
  findSvgObjectsInBounds(bounds) {
    const objectsInBounds = []
    // TODO: Implement when SVGObjectManager has proper object tracking
    return objectsInBounds
  }

  // ========== GROUP OPERATIONS ==========

  /**
   * Delete all selected items
   */
  deleteSelected() {
    // Delete selected splines
    this.selectedSplines.forEach((id) => {
      this.splineManager.deleteSpline(id)
    })

    // Delete selected SVG objects
    this.selectedSvgObjects.forEach((id) => {
      // TODO: Call svgObjectManager to delete
    })

    this.clearSelection()
  }

  /**
   * Move all selected items by delta
   * @param {number} dx - Delta x
   * @param {number} dy - Delta y
   */
  moveSelected(dx, dy) {
    console.log(
      `[SelectionManager.moveSelected] Moving ${this.selectedSplines.size} splines and ${this.selectedSvgObjects.size} objects by dx:${dx}, dy:${dy}`
    )

    // Move selected splines
    this.selectedSplines.forEach((id) => {
      const spline = this.splineManager.getSpline(id)
      if (spline) {
        spline.points.forEach((pt) => {
          pt.x += dx
          pt.y += dy
          pt.circle?.center(pt.x, pt.y)
        })
        spline.plot()
      }
    })

    // Move selected SVG objects
    this.selectedSvgObjects.forEach((id) => {
      const obj = this.svgObjectManager?.getObjectById?.(id)
      if (obj?.element) {
        const currentX = obj.element.x() || 0
        const currentY = obj.element.y() || 0
        obj.element.move(currentX + dx, currentY + dy)
      }
    })

    this.emit("selectionMoved", { dx, dy })
    console.log("[SelectionManager.moveSelected] Move complete")
  }

  /**
   * Get bounding box of all selected items
   * @returns {object|null} - {x, y, width, height}
   */
  getSelectionBounds() {
    if (!this.hasSelection()) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    // Include selected splines
    this.selectedSplines.forEach((id) => {
      const spline = this.splineManager.getSpline(id)
      if (spline && spline.group) {
        const bbox = spline.group.bbox()
        minX = Math.min(minX, bbox.x)
        minY = Math.min(minY, bbox.y)
        maxX = Math.max(maxX, bbox.x + bbox.width)
        maxY = Math.max(maxY, bbox.y + bbox.height)
      }
    })

    // Include selected SVG objects
    this.selectedSvgObjects.forEach((id) => {
      // TODO: Include SVG object bounds
    })

    if (minX === Infinity) return null

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }
}