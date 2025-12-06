// src/managers/SelectionManager.js
import eventBus from "../core/EventBus"
import { selectionOptions } from "../utils/selectionConfig"

/**
 * SelectionManager: Manages multi-selection of splines and SVG objects
 *
 * Features:
 * - Drag-to-select: Right-click drag creates selection box
 * - Shift-click: Add/remove items from selection (toggle)
 * - Group operations: Delete, move in canvas coordinate space
 * - Overlay: Visual rectangle for dragging multiple selected items
 * - Coordinate System: All operations use canvas coordinate space
 *
 * Emits events via EventBus:
 *  - selection:changed: When selection state changes
 *  - drag-selection:start/move/end: During box selection
 *  - selection:moved: When selected items are moved
 */
export default class SelectionManager {
  constructor({ splineManager, svgObjectManager }) {
    this.splineManager = splineManager
    this.svgObjectManager = svgObjectManager

    // Selection state: Sets of IDs for selected items
    this.selectedSplines = new Set()
    this.selectedSvgObjects = new Set()

    // Drag selection state: For right-click box selection
    this.isDragging = false
    this.dragStart = null // { x, y } start position
    this.dragCurrent = null // { x, y } current position
    this.selectionBox = null // SVG rect element for visual selection box

    // Overlay state: For group selection rectangle and dragging
    this.groupOverlay = null // SVG rect element for multi-selection overlay
    this.overlayDragState = { dragging: false, lastX: 0, lastY: 0 }
    this.draw = null // SVG.js draw instance
    this.selectedToolRef = null // Reference to current tool

    // Clear selection when tool changes to prevent stale selections
    eventBus.on("tool:changed", () => {
      this.clearSelection()
      this.updateOverlay()
    })
  }

  /**
   * Initialize overlay system - must be called before overlay can be used
   * @param {object} draw - SVG.js draw instance for creating overlay elements
   * @param {object} selectedToolRef - React ref to current active tool name
   */
  initializeOverlay(draw, selectedToolRef) {
    this.draw = draw
    this.selectedToolRef = selectedToolRef
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
      const obj = this.svgObjectManager?.getObject?.(id)
      if (obj) objects.push(obj)
    })
    return objects
  }

  // ========== SINGLE SELECTION ==========

  /**
   * Select a single spline
   * @param {string} splineId - ID of spline to select
   * @param {boolean} additive - If true, toggles selection; if false, clears others first
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

    eventBus.emit("selection:changed", {
      splines: Array.from(this.selectedSplines),
      svgObjects: Array.from(this.selectedSvgObjects),
      hasSelection: this.hasSelection(),
    })
  }

  /**
   * Select a single SVG object
   * @param {string} svgObjectId - ID of SVG object to select
   * @param {boolean} additive - If true, toggles selection; if false, clears others first
   */
  selectSvgObject(svgObjectId, additive = false) {
    if (!additive) {
      this.clearSelection()
    }

    if (this.selectedSvgObjects.has(svgObjectId)) {
      if (additive) {
        this.selectedSvgObjects.delete(svgObjectId)
        const obj = this.svgObjectManager?.getObject?.(svgObjectId)
        if (obj) {
          // Re-enable individual draggable when removing from group selection
          if (typeof obj.draggable === "function") {
            obj.draggable(true)
          }
          obj.select?.(false)
          obj.resize?.(false)
        }
      }
    } else {
      this.selectedSvgObjects.add(svgObjectId)
      const obj = this.svgObjectManager?.getObject?.(svgObjectId)
      if (obj) {
        // Disable individual draggable to prevent conflict with group selection drag
        if (typeof obj.draggable === "function") {
          obj.draggable(false)
        }
        obj.select?.(selectionOptions)
        obj.resize?.({ rotationPoint: true })
      }
    }

    eventBus.emit("selection:changed", {
      splines: Array.from(this.selectedSplines),
      svgObjects: Array.from(this.selectedSvgObjects),
    })
  }

  // ========== MULTI-SELECTION ==========

  /**
   * Select multiple splines at once (from box selection)
   * @param {string[]} splineIds - Array of spline IDs to select
   * @param {boolean} additive - If true, adds to existing selection; if false, replaces
   */
  selectSplines(splineIds, additive = false) {
    if (!additive) {
      this.clearSelection()
    } else if (this.getSelectionCount() > 0 || splineIds.length > 0) {
      // If adding to selection, ensure any single-spline transform box is removed
      // so we don't have a mix of multi-selection overlay and single-spline resize box
      this.splineManager.clearTransformSelection()
    }

    splineIds.forEach((id) => {
      this.selectedSplines.add(id)
      const spline = this.splineManager.getSpline(id)
      if (spline) spline.setSelected(true)
    })

    eventBus.emit("selection:changed", {
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
   * Select multiple SVG objects at once (from box selection)
   * @param {string[]} svgObjectIds - Array of SVG object IDs to select
   * @param {boolean} additive - If true, adds to existing selection; if false, replaces
   */
  selectSvgObjects(svgObjectIds, additive = false) {
    if (!additive) {
      this.clearSelection()
    } else if (this.getSelectionCount() > 0 || svgObjectIds.length > 0) {
      // If adding to selection, ensure any single-spline transform box is removed
      this.splineManager.clearTransformSelection()
    }

    svgObjectIds.forEach((id) => {
      this.selectedSvgObjects.add(id)
      // Disable individual draggable to prevent conflict with group selection drag
      const obj = this.svgObjectManager?.getObject?.(id)
      if (obj && typeof obj.draggable === "function") {
        obj.draggable(false)
      }
    })

    // Only show selection box if single object is selected
    if (svgObjectIds.length === 1) {
      const obj = this.svgObjectManager?.getObject?.(svgObjectIds[0])
      if (obj) {
        try {
          obj.select?.(selectionOptions)
          obj.resize?.({ rotationPoint: true })
        } catch {
          // ignore
        }
      }
    } else {
      // Remove lingering selection boxes from all selected objects
      svgObjectIds.forEach((id) => {
        const obj = this.svgObjectManager?.getObject?.(id)
        if (obj && obj.node) {
          const selBox = obj.node.querySelector(".svg-select-box")
          if (selBox) selBox.remove()
        }

        obj?.select?.(false)
        obj?.resize?.(false)
      })
    }

    eventBus.emit("selection:changed", {
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
   * Clear all selections - deselects items, removes overlays, re-enables draggable
   */
  clearSelection() {
    // Deselect all splines
    this.selectedSplines.forEach((id) => {
      const spline = this.splineManager.getSpline(id)
      if (spline) spline.setSelected(false)
    })

    // Deselect all SVG objects, re-enable draggable, and remove overlays
    this.selectedSvgObjects.forEach((id) => {
      const obj = this.svgObjectManager?.getObject?.(id)
      if (obj) {
        // Re-enable individual draggable
        if (typeof obj.draggable === "function") {
          obj.draggable(true)
        }
        // Remove lingering selection box overlays
        if (obj.node) {
          const selBox = obj.node.querySelector(".svg-select-box")
          if (selBox) selBox.remove()
        }
        obj.select?.(false)
        obj.resize?.(false)
      }
    })

    this.selectedSplines.clear()
    this.selectedSvgObjects.clear()

    // Remove any lingering drag selection box (even if dragging)
    if (this.selectionBox) {
      try {
        this.selectionBox.remove()
      } catch {
        // ignore removal errors
      }
      this.selectionBox = null
    }

    // Reset drag state
    this.isDragging = false
    this.dragStart = null
    this.dragCurrent = null

    eventBus.emit("selection:changed", {
      splines: [],
      svgObjects: [],
      hasSelection: false,
    })
  }

  // ========== OPERATIONS ON SELECTED ITEMS ==========

  // ========== DRAG SELECTION ==========

  /**
   * Start drag selection box (right-click drag)
   * @param {number} x - Starting x coordinate in canvas space
   * @param {number} y - Starting y coordinate in canvas space
   * @param {object} drawInstance - SVG.js draw instance for creating visual selection box
   */
  startDragSelection(x, y, drawInstance) {
    this.isDragging = true
    this.dragStart = { x, y }
    this.dragCurrent = { x, y }

    // Create visual selection box
    if (drawInstance) {
      this.selectionBox = drawInstance
        .rect(0, 0)
        .addClass("drag-selection-box")
        .move(x, y)

      // Ensure selection box is on top
      this.selectionBox.front()
    }

    eventBus.emit("drag-selection:start", { x, y })
  }

  /**
   * Update drag selection box as mouse moves
   * @param {number} x - Current x coordinate in canvas space
   * @param {number} y - Current y coordinate in canvas space
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
      try {
        this.selectionBox.front()
      } catch {
        // ignore
      }
    }

    eventBus.emit("drag-selection:move", { x, y })
  }

  /**
   * End drag selection - selects all items intersecting the box
   * @param {number} x - Final x coordinate in canvas space
   * @param {number} y - Final y coordinate in canvas space
   * @param {boolean} additive - If true, adds to existing selection; if false, replaces
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

    eventBus.emit("drag-selection:end", {
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

    eventBus.emit("drag-selection:end", { cancelled: true })
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
   * Check if a spline intersects with selection bounds
   * @param {Spline} spline - Spline instance to check
   * @param {object} bounds - {minX, maxX, minY, maxY} selection bounds in canvas coordinates
   * @returns {boolean} True if spline's bbox or any point intersects bounds
   */
  isSplineInBounds(spline, bounds) {
    // Use rbox() to get bounding box in canvas coordinates (after transforms)
    // This ensures correct detection even after drag/resize/rotate operations
    const rbox = spline.group?.rbox?.()

    if (rbox) {
      // Check if bounding box intersects with selection bounds
      const bboxIntersects =
        rbox.x < bounds.maxX &&
        rbox.x + rbox.width > bounds.minX &&
        rbox.y < bounds.maxY &&
        rbox.y + rbox.height > bounds.minY

      return bboxIntersects
    }

    // Fallback: check if any point is within bounds
    // Points are in canvas coordinates, so this should still work
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
   * @param {object} bounds - {minX, maxX, minY, maxY} in canvas coordinates
   * @returns {string[]} - Array of SVG object IDs
   */
  findSvgObjectsInBounds(bounds) {
    if (!this.svgObjectManager) return []
    const objectsInBounds = []
    const allObjects = this.svgObjectManager.getAllObjects?.() || []
    allObjects.forEach((obj) => {
      try {
        // Use rbox() instead of bbox() to get bounding box in canvas coordinates
        // bbox() returns local coords (before transforms), rbox() returns after transforms
        const rbox = obj.rbox?.()
        if (!rbox) return

        // Check intersection with selection bounds
        const intersects =
          rbox.x < bounds.maxX &&
          rbox.x + rbox.width > bounds.minX &&
          rbox.y < bounds.maxY &&
          rbox.y + rbox.height > bounds.minY

        if (intersects) {
          objectsInBounds.push(obj._objectId)
        }
      } catch (err) {
        console.warn(
          "[SelectionManager] Error checking SVG object bounds:",
          err
        )
      }
    })
    return objectsInBounds
  }

  // ========== GROUP OPERATIONS ==========

  /**
   * Delete all selected items (splines and SVG objects) then clear selection
   */
  deleteSelected() {
    // Delete selected splines
    this.selectedSplines.forEach((id) => {
      this.splineManager.deleteSpline(id)
    })

    // Delete selected SVG objects
    this.selectedSvgObjects.forEach((id) => {
      // Delete svg objects via manager
      this.svgObjectManager?.deleteObject?.(id)
    })

    this.clearSelection()
  }

  /**
   * Move all selected items by delta in canvas coordinate space
   * @param {number} dx - Delta x in canvas coordinates
   * @param {number} dy - Delta y in canvas coordinates
   */
  moveSelected(dx, dy) {
    console.log(
      `[SelectionManager.moveSelected] Moving ${this.selectedSplines.size} splines and ${this.selectedSvgObjects.size} objects by dx:${dx}, dy:${dy}`
    )

    // Move selected splines (canvas coordinates)
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

    // Move selected SVG objects by applying translation
    this.selectedSvgObjects.forEach((objId) => {
      const obj = this.svgObjectManager?.getObject?.(objId)
      if (obj) {
        // Apply translation using translate() method which works in canvas space
        obj.translate(dx, dy)
      }
    })

    // Don't emit event here - only emit once at dragend
    console.log("[SelectionManager.moveSelected] Move complete")
  }

  /**
   * Get bounding box of all selected items in canvas coordinate space
   * @returns {object|null} - {x, y, width, height} in canvas coordinates
   */
  getSelectionBounds() {
    if (!this.hasSelection()) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    // Include selected splines (already in canvas coordinates)
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

    // Include selected SVG objects using rbox() for canvas-space coordinates
    this.selectedSvgObjects.forEach((id) => {
      const obj = this.svgObjectManager?.getObject?.(id)
      if (obj) {
        // Get bounding box in canvas coordinate space
        // rbox() returns position relative to the SVG canvas, accounting for transforms
        const rbox = obj.rbox?.(this.draw)
        if (rbox) {
          minX = Math.min(minX, rbox.x)
          minY = Math.min(minY, rbox.y)
          maxX = Math.max(maxX, rbox.x + rbox.width)
          maxY = Math.max(maxY, rbox.y + rbox.height)
        }
      }
    })

    if (minX === Infinity) return null

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  // ========== OVERLAY MANAGEMENT ==========

  /**
   * Create or update the multi-selection overlay rectangle
   * Only shows when in select tool with 2+ items selected
   */
  updateOverlay() {
    if (!this.draw || !this.selectedToolRef) return

    const count = this.getSelectionCount()
    const inSelectTool = this.selectedToolRef.current === "select"
    const bounds = this.getSelectionBounds()

    const shouldShow = inSelectTool && bounds && count >= 2

    if (!shouldShow) {
      this.removeOverlay()
      return
    }

    const { x, y, width, height } = bounds

    if (!this.groupOverlay) {
      this.groupOverlay = this.draw
        .rect(width, height)
        .move(x, y)
        .addClass("group-selection-overlay")
        .id("group-selection-overlay")

      this.groupOverlay.on(
        "pointerdown",
        this.handleOverlayPointerDown.bind(this)
      )
    } else {
      this.groupOverlay.size(width, height).move(x, y)
    }

    try {
      this.groupOverlay.front()
    } catch {
      // ignore front errors
    }
  }

  /**
   * Remove the group selection overlay from canvas
   */
  removeOverlay() {
    if (this.groupOverlay) {
      try {
        this.groupOverlay.remove()
      } catch {
        // ignore removal errors
      }
      this.groupOverlay = null
    }
  }

  /**
   * Handle overlay pointerdown event - initiates group drag
   */
  handleOverlayPointerDown(e) {
    if (this.selectedToolRef.current !== "select" || e.button !== 0) return
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
   * Handle overlay drag movement - moves selected items and updates overlay position
   */
  handleOverlayDragMove(e) {
    if (!this.overlayDragState.dragging) return

    const { x, y } = this.draw.point(e.clientX, e.clientY)

    const dx = x - this.overlayDragState.lastX
    const dy = y - this.overlayDragState.lastY
    if (dx === 0 && dy === 0) return

    this.overlayDragState.lastX = x
    this.overlayDragState.lastY = y

    // Move selected items
    this.moveSelected(dx, dy)

    // Update overlay to reflect new position (provides visual feedback during drag)
    this.updateOverlay()
  }

  /**
   * Handle overlay drag end - cleanup listeners and finalize overlay position
   */
  handleOverlayDragUp() {
    this.overlayDragState.dragging = false
    window.removeEventListener(
      "pointermove",
      this.handleOverlayDragMove.bind(this)
    )

    // Final overlay update to ensure correct position
    this.updateOverlay()

    // Emit selection:moved event ONCE at dragend for history save
    if (this.hasSelection()) {
      eventBus.emit("selection:moved", {
        splineCount: this.selectedSplines.size,
        svgCount: this.selectedSvgObjects.size,
      })
      console.log(
        "[SelectionManager] Group drag completed, emitting selection:moved event"
      )
    }
  }
}
