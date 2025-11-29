// src/managers/SplineManager.js
import eventBus from "../utils/EventBus"
import Spline from "../models/Spline"
import { pointToSegmentDistance } from "../utils/geometry"
import { setupPointHandlers } from "../handlers/pointHandlers"
import { selectionOptions } from "../utils/selectionConfig"

/**
 * SplineManager: Centralized API for all spline CRUD operations and transformations
 * Emits events via EventBus:
 *  - spline:created
 *  - spline:deleted
 *  - spline:selected
 *  - spline:modified
 *  - spline:moved
 *  - spline:transformed
 *  - point:added
 *  - point:removed
 */
export default class SplineManager {
  constructor({
    draw,
    selectedToolRef,
    isDraggingRef,
    historyManager = null,
    linkedSvgManager = null,
  } = {}) {
    this.draw = draw
    this.splines = new Map() // id -> Spline
    this.selectedSplineId = null
    this.selectedToolRef = selectedToolRef
    this.isDraggingRef = isDraggingRef
    this.historyManager = historyManager // HistoryManager instance for undo/redo
    this.linkedSvgManager = linkedSvgManager // Reference to SVGObjectManager for unified history

    // Optional external reference set by Canvas for point multi-selection
    this.pointSelectionManager = null

    // Transform API (set up by setupSplineTransformations)
    this._transformAPI = null
  }

  // ========== SPLINE CRUD ==========

  /**
   * Create a new spline
   * @param {boolean} autoSelect - Whether to automatically select the new spline (default: true)
   * @returns {Spline}
   */
  createSpline(autoSelect = true, type = "bspline") {
    console.log("[SplineManager] Creating new spline")
    const spline = new Spline({ draw: this.draw, type })
    console.log("[SplineManager] Spline instance created:", spline.id)
    this.splines.set(spline.id, spline)
    console.log(
      "[SplineManager] Spline added to collection, total:",
      this.splines.size
    )

    // Attach hover listeners for visual feedback
    spline.path.on("mouseover", () => spline.setHovering(true))
    spline.path.on("mouseout", () => spline.setHovering(false))
    spline.group.on("mouseover", () => spline.setHovering(true))
    spline.group.on("mouseout", () => spline.setHovering(false))

    // Attach click handlers for tool interactions
    const clickHandler = (e) => {
      const tool = this.selectedToolRef?.current

      // Delete tool
      if (tool === "delete_spline") {
        e.stopPropagation()
        this.deleteSpline(spline.id)
        return
      }

      // Select tool - select the spline
      if (tool === "select") {
        e.stopPropagation()
        this.selectSpline(spline.id)
        return
      }

      // Curve/Line/Straight/NURBS tools - select if not already selected
      if (
        tool === "curve" ||
        tool === "line" ||
        tool === "straight" ||
        tool === "nurbs"
      ) {
        if (this.selectedSplineId !== spline.id) {
          e.stopPropagation()
          this.selectSpline(spline.id)
          return
        }
        // If already selected, let point handlers manage it (don't stop propagation)
      }
    }

    spline.path.on("click.toolHandler", clickHandler)
    spline.group.on("click.toolHandler", clickHandler)

    // Only auto-select if requested
    if (autoSelect) {
      this.selectSpline(spline.id)
      console.log("[SplineManager] Spline selected and marked as active")
    }
    eventBus.emit("spline:created", { spline })
    console.log("[SplineManager] Events emitted, createSpline complete")
    return spline
  }

  /**
   * Delete a spline by ID
   * @param {string} splineId
   */
  deleteSpline(splineId) {
    const spline = this.splines.get(splineId)
    if (!spline) return

    // Clear selection state before removing
    spline.setSelected(false)
    spline.remove()
    this.splines.delete(splineId)

    if (this.selectedSplineId === splineId) {
      this.selectedSplineId = null
      eventBus.emit("spline:selected", { spline: null })
    }

    eventBus.emit("spline:deleted", { splineId })
  }

  /**
   * Get spline by ID
   * @param {string} splineId
   * @returns {Spline|null}
   */
  getSpline(splineId) {
    return this.splines.get(splineId) || null
  }

  /**
   * Get all splines as array
   * @returns {Spline[]}
   */
  getAllSplines() {
    return Array.from(this.splines.values())
  }

  // ========== POINT MANIPULATION ==========

  /**
   * Add a point to a spline
   * @param {string} splineId
   * @param {number} x
   * @param {number} y
   * @param {boolean} isSharp - Whether the point is a sharp corner
   * @returns {object} - The point object
   */
  addPointToSpline(splineId, x, y, isSharp = false) {
    console.log("[SplineManager.addPointToSpline] Adding point", {
      splineId,
      x,
      y,
      isSharp,
    })
    const spline = this.splines.get(splineId)
    if (!spline) {
      console.error(
        "[SplineManager.addPointToSpline] Spline not found:",
        splineId
      )
      return null
    }

    console.log(
      "[SplineManager.addPointToSpline] Spline found, calling addPoint"
    )
    const point = spline.addPoint(x, y, true, isSharp)
    console.log(
      "[SplineManager.addPointToSpline] Point created, has circle:",
      !!point?.circle
    )

    if (point && point.circle) {
      console.log("[SplineManager.addPointToSpline] Setting up point handlers")
      // Pass historyManager to point handlers for batching
      setupPointHandlers(
        point.circle,
        spline,
        this.isDraggingRef,
        this,
        this.selectedToolRef,
        this.pointSelectionManager,
        this.historyManager
      )
    }

    console.log("[SplineManager.addPointToSpline] Calling spline.plot()")
    spline.plot()
    eventBus.emit("point:added", { splineId, point })

    // Push to history after adding point
    console.log("[SplineManager.addPointToSpline] Checking historyManager:", {
      hasHistoryManager: !!this.historyManager,
      historyManager: this.historyManager,
    })

    console.log(
      "[SplineManager.addPointToSpline] Complete, spline has",
      spline.points.length,
      "points"
    )
    return point
  }

  /**
   * Insert a point at a specific position along the spline (by proximity to segment)
   * @param {string} splineId
   * @param {number} x
   * @param {number} y
   * @param {boolean} isSharp - Whether the point is a sharp corner
   * @returns {object} - The inserted point object
   */
  insertPointByProximity(splineId, x, y, isSharp = false) {
    const spline = this.splines.get(splineId)
    if (!spline || spline.points.length < 2) return null

    // Find closest segment
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

    // Insert at closest segment
    const point = spline.insertPointAt(insertIndex, x, y, isSharp)

    if (point && point.circle) {
      setupPointHandlers(
        point.circle,
        spline,
        this.isDraggingRef,
        this,
        this.selectedToolRef,
        this.pointSelectionManager,
        this.historyManager
      )
    }

    spline.plot()
    eventBus.emit("point:added", { splineId, point })

    return point
  }

  /**
   * Delete a point from a spline
   * @param {string} splineId
   * @param {object} pointRef - The point object to delete
   */
  deletePointFromSpline(splineId, pointRef) {
    const spline = this.splines.get(splineId)
    if (!spline) return

    spline.removePointByRef(pointRef)
    spline.plot()

    // Delete spline if fewer than 2 points
    if (spline.points.length < 2) {
      this.deleteSpline(splineId)
    } else {
      eventBus.emit("point:removed", { splineId, point: pointRef })
    }
  }

  // ========== POINT MANIPULATION METHODS ==========

  /**
   * Move all points of a spline by delta
   * Centralizes point movement logic to avoid direct array access
   * @param {string} splineId - ID of the spline
   * @param {number} dx - Delta x
   * @param {number} dy - Delta y
   * @returns {boolean} - True if successful
   */
  moveSplinePoints(splineId, dx, dy) {
    const spline = this.getSpline(splineId)
    if (!spline) {
      console.warn(
        "[SplineManager.moveSplinePoints] Spline not found:",
        splineId
      )
      return false
    }

    spline.points.forEach((point) => {
      point.x += dx
      point.y += dy
      if (point.circle) {
        point.circle.center(point.x, point.y)
      }
    })

    spline.plot()
    return true
  }

  /**
   * Offset all points of a spline (for copy/paste operations)
   * @param {string} splineId - ID of the spline
   * @param {number} offsetX - X offset
   * @param {number} offsetY - Y offset
   * @returns {boolean} - True if successful
   */
  offsetSplinePoints(splineId, offsetX, offsetY) {
    return this.moveSplinePoints(splineId, offsetX, offsetY)
  }

  /**
   * Update selection box position for a spline (used after point movement)
   * @param {string} splineId - ID of the spline
   * @param {object} selectionOptions - SVG.js selection options
   */
  updateSplineSelectionBox(splineId, selectionOptions) {
    const spline = this.getSpline(splineId)
    if (!spline || !spline.group) return

    try {
      // Re-apply selection to update box position
      if (typeof spline.group.select === "function") {
        spline.group.select(false)
        spline.group.select(selectionOptions)
      }
    } catch (err) {
      console.warn("[SplineManager.updateSplineSelectionBox] Error:", err)
    }
  }

  // ========== SELECTION ==========

  /**
   * Select a spline by ID (single selection)
   * @param {string} splineId
   */
  selectSpline(splineId) {
    console.log(
      "[SplineManager.selectSpline] Selecting spline:",
      splineId,
      "current:",
      this.selectedSplineId
    )
    if (this.selectedSplineId === splineId) {
      console.log("[SplineManager.selectSpline] Already selected, returning")
      return
    }

    // Deselect previous
    if (this.selectedSplineId) {
      console.log(
        "[SplineManager.selectSpline] Deselecting previous spline:",
        this.selectedSplineId
      )
      const prev = this.splines.get(this.selectedSplineId)
      prev?.setSelected(false)
    }

    this.selectedSplineId = splineId
    const current = this.splines.get(splineId)
    console.log(
      "[SplineManager.selectSpline] Current spline retrieved:",
      !!current
    )

    if (current) {
      console.log("[SplineManager.selectSpline] Calling setSelected(true)")
      current.setSelected(true)

      // If transformation API exists and we're in select mode, trigger transformation selection
      if (this._transformAPI && this.selectedToolRef?.current === "select") {
        this._transformAPI.selectSpline(current)
      }

      eventBus.emit("spline:selected", { spline: current })
    }

    console.log("[SplineManager.selectSpline] Complete")
  }

  /**
   * Deselect current spline
   */
  clearSelection() {
    if (!this.selectedSplineId) return

    const current = this.splines.get(this.selectedSplineId)
    current?.setSelected(false)

    this.selectedSplineId = null
    eventBus.emit("spline:selected", { spline: null })
  }

  /**
   * Get currently selected spline
   * @returns {Spline|null}
   */
  getSelected() {
    return this.splines.get(this.selectedSplineId) || null
  }

  // ========== Z-ORDER OPERATIONS ==========

  /**
   * Move selected spline forward one step
   */
  bringForward() {
    const spline = this.getSelected()
    if (!spline || !spline.group) return

    // Prevent moving past the end (though forward() handles this)
    spline.group.forward()
  }

  /**
   * Move selected spline to front
   */
  bringToFront() {
    const spline = this.getSelected()
    if (!spline || !spline.group) return

    spline.group.front()
  }

  /**
   * Move selected spline backward one step
   * Prevents moving behind background or grid
   */
  sendBackward() {
    const spline = this.getSelected()
    if (!spline || !spline.group) return

    // Check previous sibling to avoid moving behind grid/bg
    const prev = spline.group.previous()
    if (prev && (prev.id() === "canvas-bg" || prev.id() === "canvas-grid")) {
      return
    }

    spline.group.backward()
  }

  /**
   * Move selected spline to back
   * Keeps it above background and grid
   */
  sendToBack() {
    const spline = this.getSelected()
    if (!spline || !spline.group) return

    // Move to back first (which puts it at index 0)
    spline.group.back()

    // Then move forward past bg and grid
    // Assuming bg is 0 and grid is 1 (or similar)
    // Safer: find bg and grid and move after them
    const bg = this.draw.findOne("#canvas-bg")
    const grid = this.draw.findOne("#canvas-grid")

    if (grid) {
      spline.group.after(grid)
    } else if (bg) {
      spline.group.after(bg)
    }
  }

  // ========== TOOL STATE UPDATES ==========

  /**
   * Called when the active tool changes
   * Handles visual state updates for tool switching
   */
  updateOnToolChange(tool) {
    if (
      tool !== "curve" &&
      tool !== "line" &&
      tool !== "straight" &&
      tool !== "nurbs"
    ) {
      // Leaving point-edit tools: clear any multi-point selection state/colors
      try {
        this.pointSelectionManager?.clearSelection?.()
      } catch {
        // ignore point selection clearing errors
      }
      // Hide points when not in an editing tool
      this.splines.forEach((spline) => {
        if (spline.selected) {
          spline.setSelected(false)
        }
        spline.points.forEach((pt) => pt.bindDragControl?.())
      })

      // Also clear manager selection state when switching away from curve
      if (this.selectedSplineId) {
        this.selectedSplineId = null
        eventBus.emit("spline:selected", { spline: null })
      }
    }

    // Notify transform API if set
    this._transformAPI?.notifyToolChange?.(tool)
  }

  /**
   * Finish drawing the active spline (called on escape or double-click)
   */
  finishActiveSpline() {
    if (this.selectedSplineId) {
      const current = this.splines.get(this.selectedSplineId)
      if (current) {
        current.setSelected(false)
      }
      this.selectedSplineId = null
      eventBus.emit("spline:selected", { spline: null })
    }
  }

  /**
   * Finish drawing and clear all selections (called via hotkey or tool change)
   * Deselects active spline and clears all selection state
   */
  finishDrawing() {
    this.finishActiveSpline()
  }

  // ========== SERIALIZATION ==========

  /**
   * Get all spline data as JSON-serializable objects
   * Returns splines sorted by their DOM order to preserve layering
   * @returns {object[]}
   */
  getState() {
    // Sort splines by DOM position
    const allSplines = this.getAllSplines()
    if (this.draw && this.draw.node) {
      const domNodes = Array.from(this.draw.node.children)
      allSplines.sort((a, b) => {
        const idxA = domNodes.indexOf(a.group.node)
        const idxB = domNodes.indexOf(b.group.node)
        return idxA - idxB
      })
    }
    return allSplines.map((s) => s.toJSON())
  }

  /**
   * Load splines from saved state
   * @param {object[]} splineDataArray
   */
  loadState(splineDataArray) {
    // Clear existing splines
    this.splines.forEach((spline) => spline.remove())
    this.splines.clear()
    this.selectedSplineId = null

    if (!Array.isArray(splineDataArray)) return

    // Reconstruct splines
    splineDataArray.forEach((data) => {
      const spline = new Spline({ draw: this.draw })
      spline.loadFromJSON(data)

      // Re-attach handlers to all loaded points
      spline.points.forEach((point) => {
        if (point.circle) {
          setupPointHandlers(
            point.circle,
            spline,
            this.isDraggingRef,
            this,
            this.selectedToolRef,
            this.pointSelectionManager,
            this.historyManager
          )
        }
      })

      this.splines.set(spline.id, spline)
    })

    // Attach transform handlers to all loaded splines
    this._transformAPI?.attachToAll?.()
  }

  /**
   * Restore splines from state data (used by undo/redo)
   * @param {object[]} splineDataArray - Array of serialized spline data
   * @param {object} context - Context with setupPointHandlers, drawRef, etc.
   */
  restoreFromState(splineDataArray, context = {}) {
    // Clear and restore splines
    this.splines.forEach((spline) => {
      try {
        spline.setSelected?.(false)
        spline.group?.remove?.()
      } catch (err) {
        console.warn(
          "[SplineManager.restoreFromState] Error clearing spline:",
          err
        )
      }
    })
    this.splines.clear()
    this.selectedSplineId = null

    // Restore splines from state, skip splines with <2 points
    if (splineDataArray && Array.isArray(splineDataArray)) {
      splineDataArray.forEach((splineData) => {
        if (!splineData.points || splineData.points.length < 2) return
        try {
          const spline = new Spline({ draw: this.draw, id: splineData.id })
          spline.loadFromJSON(splineData)

          // Re-attach point handlers if context provided
          if (
            context.setupPointHandlers &&
            context.isDraggingRef &&
            context.selectedToolRef
          ) {
            console.log(
              `[SplineManager.restoreFromState] Re-attaching handlers for ${spline.points.length} points in spline ${spline.id}`,
              {
                hasSetupPointHandlers: !!context.setupPointHandlers,
                hasIsDraggingRef: !!context.isDraggingRef,
                hasSelectedToolRef: !!context.selectedToolRef,
                currentTool: context.selectedToolRef?.current,
              }
            )
            spline.points.forEach((point, idx) => {
              if (point.circle) {
                console.log(
                  `[SplineManager.restoreFromState] Attaching handlers to point ${idx}`,
                  {
                    hasCircle: true,
                    cx: point.circle.cx(),
                    cy: point.circle.cy(),
                  }
                )
                context.setupPointHandlers(
                  point.circle,
                  spline,
                  context.isDraggingRef,
                  this,
                  context.selectedToolRef,
                  this.pointSelectionManager,
                  this.historyManager
                )
              } else {
                console.warn(
                  `[SplineManager.restoreFromState] Point ${idx} has no circle!`
                )
              }
            })
          } else {
            console.warn(
              "[SplineManager.restoreFromState] Cannot re-attach point handlers, missing context:",
              {
                hasSetupPointHandlers: !!context?.setupPointHandlers,
                hasIsDraggingRef: !!context?.isDraggingRef,
                hasSelectedToolRef: !!context?.selectedToolRef,
              }
            )
          }

          // Attach hover and click handlers
          spline.path.on("mouseover", () => spline.setHovering(true))
          spline.path.on("mouseout", () => spline.setHovering(false))
          spline.group.on("mouseover", () => spline.setHovering(true))
          spline.group.on("mouseout", () => spline.setHovering(false))

          // Attach click handlers for tool interactions
          const clickHandler = (e) => {
            const tool = this.selectedToolRef?.current

            // Delete tool
            if (tool === "delete_spline") {
              e.stopPropagation()
              this.deleteSpline(spline.id)
              return
            }

            // Select tool - select the spline
            if (tool === "select") {
              e.stopPropagation()
              this.selectSpline(spline.id)
              return
            }

            // Curve/Line/Straight/NURBS tools - select for adding points
            if (
              tool === "curve" ||
              tool === "line" ||
              tool === "straight" ||
              tool === "nurbs"
            ) {
              const selectedSpline = this.getSelected()
              if (selectedSpline && selectedSpline.id === spline.id) {
                // Already selected in curve mode: allow point addition by not stopping propagation
                // The canvas click handler will handle adding the point
                return
              } else {
                // Not selected: select it and stop propagation
                e.stopPropagation()
                this.selectSpline(spline.id)
                return
              }
            }
          }

          spline.path.on("click", clickHandler)
          spline.group.on("click", clickHandler)

          this.splines.set(spline.id, spline)
        } catch (error) {
          console.error(
            "[SplineManager.restoreFromState] Error restoring spline:",
            error
          )
        }
      })
    }

    // Deselect all splines and remove selection boxes
    this.clearSelection()
    this.splines.forEach((spline) => {
      try {
        if (spline.group && typeof spline.group.select === "function") {
          spline.group.select(false)
          const selBox = spline.group.node.querySelector(".svg-select-box")
          if (selBox) selBox.remove()
        }
      } catch (error) {
        console.warn(
          "[SplineManager.restoreFromState] Error clearing selection box:",
          error
        )
      }
    })

    // Re-attach transform handlers
    this._transformAPI?.attachToAll?.()

    // Auto-select the last spline if in curve mode (so user can continue editing)
    if (
      (context.selectedToolRef?.current === "curve" ||
        context.selectedToolRef?.current === "line" ||
        context.selectedToolRef?.current === "straight" ||
        context.selectedToolRef?.current === "nurbs") &&
      this.splines.size > 0
    ) {
      const lastSpline = Array.from(this.splines.values())[
        this.splines.size - 1
      ]
      if (lastSpline) {
        this.selectSpline(lastSpline.id)
        console.log(
          "[SplineManager.restoreFromState] Auto-selected last spline:",
          lastSpline.id
        )
      }
    }
  }

  // ========== TRANSFORMATIONS ==========

  /**
   * Set up drag/resize/rotate handlers for spline groups
   * Called during Canvas initialization
   * @param {Spline} spline
   */
  setupSplineTransformations(selectedToolRef, isDraggingRef) {
    let selectedSpline = null

    const clearSelection = () => {
      if (!selectedSpline) return

      try {
        const el = selectedSpline.group
        selectedSpline.setSelected(false)

        try {
          if (el) {
            // Fully remove selection box and transform handlers
            el.select(false)
            el.resize(false)
            el.draggable(false)
          }
        } catch (e) {
          console.warn("[splineManager] clearSelection toggle error:", e)
        }
      } catch (err) {
        console.warn("[splineManager] clearSelection error:", err)
      } finally {
        selectedSpline = null
      }
    }

    const selectSpline = (spline) => {
      console.log(
        "[transformAPI.selectSpline] Called with:",
        spline?.id,
        "current tool:",
        selectedToolRef?.current
      )
      if (!spline || !spline.group) {
        console.log("[transformAPI.selectSpline] No spline or group, returning")
        return
      }
      // Allow selection in both select and curve modes
      const currentTool = selectedToolRef?.current
      const canSelect =
        currentTool === "select" ||
        currentTool === "curve" ||
        currentTool === "line" ||
        currentTool === "straight" ||
        currentTool === "nurbs"
      if (!canSelect) {
        console.log(
          "[transformAPI.selectSpline] Tool not select or curve:",
          currentTool
        )
        return
      }
      if (selectedSpline === spline) {
        console.log("[transformAPI.selectSpline] Already selected, returning")
        return
      }

      console.log("[transformAPI.selectSpline] Proceeding with selection")
      clearSelection()
      selectedSpline = spline

      try {
        spline.setSelected(true)
      } catch (err) {
        console.warn("[splineManager] update visual on select failed:", err)
      }

      // CRITICAL: Update manager's selection state and emit event for scope activation
      // This ensures hotkey scopes are activated properly
      if (this.selectedSplineId !== spline.id) {
        this.selectedSplineId = spline.id
        eventBus.emit("spline:selected", { spline })
      }

      // Only attach drag/resize/rotate handlers and show selection box in select mode
      // In curve mode, we only select visually but don't enable transforms or show selection box
      if (currentTool !== "select") {
        // In curve mode, just update visual state and return
        console.log(
          "[transformAPI.selectSpline] Curve mode, skipping selection box"
        )
        return
      }

      console.log(
        "[transformAPI.selectSpline] Attaching selection box and handlers"
      )
      const el = spline.group
      // Only show selection box in select mode
      el.select(selectionOptions)
      el.resize({ rotationPoint: true })
      el.draggable()
      console.log("[transformAPI.selectSpline] Selection box attached")
      el.off(".splineTransform")

      // ===== DRAG HANDLERS =====
      el.on("dragstart.splineTransform", (e) => {
        try {
          el.select(false)
          const startBox = e?.detail?.box || el.bbox()
          spline._startBox = {
            x: startBox.x,
            y: startBox.y,
            w: startBox.w || startBox.width,
            h: startBox.h || startBox.height,
          }
          spline._startPoints = spline.points.map((pt) => ({
            x: pt.x,
            y: pt.y,
          }))
        } catch (err) {
          console.error("[splineManager] dragstart error:", err)
        }
      })

      el.on("dragmove.splineTransform", (e) => {
        try {
          e.preventDefault()

          const box = e?.detail?.box
          const startBox = spline._startBox

          if (!box || !spline._startPoints) {
            const dx = e?.detail?.dx || 0
            const dy = e?.detail?.dy || 0

            if (dx === 0 && dy === 0) return

            spline.points.forEach((pt, i) => {
              const sp = spline._startPoints[i] || { x: pt.x, y: pt.y }
              pt.x = sp.x + dx
              pt.y = sp.y + dy
              pt.circle?.center(pt.x, pt.y)
            })

            spline.plot()
            isDraggingRef.current = true
            return
          }

          const dx = box.x - startBox.x
          const dy = box.y - startBox.y

          spline.points.forEach((pt, i) => {
            const sp = spline._startPoints[i] || { x: pt.x, y: pt.y }
            pt.x = sp.x + dx
            pt.y = sp.y + dy
            try {
              pt.circle?.center(pt.x, pt.y)
            } catch (centerError) {
              console.warn(
                "[splineManager] Failed to center circle:",
                centerError
              )
            }
          })

          spline.plot()
          isDraggingRef.current = true
        } catch (err) {
          console.error("[splineManager] dragmove handler error:", err)
        }
      })

      el.on("dragend.splineTransform", () => {
        try {
          delete spline._startBox
          delete spline._startPoints

          // Emit transform event for AutoHistoryPlugin
          eventBus.emit("spline:transformed", {
            splineId: spline.id,
            type: "drag",
          })

          setTimeout(() => {
            try {
              // Force refresh of selection box to match new position
              el.select(false)
              el.select(selectionOptions)
            } catch {
              // ignore
            }
          }, 0)
        } catch (e) {
          console.error("[splineManager] dragend handler error:", e)
        } finally {
          setTimeout(() => (isDraggingRef.current = false), 50)
        }
      })

      // ===== RESIZE HANDLER =====
      el.on("resize.splineTransform", (e) => {
        try {
          const detail = e?.detail || {}
          const rawEventType = (detail.eventType || "").toString()
          const handleName = rawEventType
            .replace(/\.resize$/i, "")
            .split(".")[0]
          const userEventType = detail.event?.type || ""

          const hasSignificantAngle =
            typeof detail.angle === "number" && Math.abs(detail.angle) > 0.1
          const isRotateOp = hasSignificantAngle
          const isDone = /up|end|cancel/i.test(userEventType)

          const box = detail.box || null

          // ----- ROTATE START -----
          if (isRotateOp && !spline._rotateIsActive && !isDone) {
            console.log(
              "[splineManager] Starting rotation for spline:",
              spline.id
            )
            spline._rotateStartPoints = spline.points.map((pt) => ({
              x: pt.x,
              y: pt.y,
            }))
            spline._rotateIsActive = true
            isDraggingRef.current = true
            return
          }

          // ----- RESIZE START -----
          if (!isRotateOp && !spline._resizeIsActive && !isDone) {
            // Always use the current bbox as the start box for a new resize operation
            // This ensures we don't use stale cached boxes from previous operations
            const sb = box || el.bbox()
            spline._resizeStartBox = {
              x: sb.x,
              y: sb.y,
              w: sb.w || sb.width,
              h: sb.h || sb.height,
            }
            // Snapshot points at the start of THIS resize operation
            spline._resizeStartPoints = spline.points.map((pt) => ({
              x: pt.x,
              y: pt.y,
            }))
            spline._resizeIsActive = true
            spline._resizePointsScaled = false

            return
          }

          // ----- MOVE (RESIZE) -----
          if (!isRotateOp && spline._resizeIsActive) {
            e.preventDefault()

            const curBox = detail.box
            const startBox = spline._resizeStartBox

            if (!curBox || !startBox) {
              isDraggingRef.current = true
              return
            }

            const scaleX = curBox.w / startBox.w
            const scaleY = curBox.h / startBox.h

            // Determine anchor point based on which handle is dragged
            let anchorX = startBox.x // default: left
            let anchorY = startBox.y // default: top

            if (handleName.includes("l")) anchorX = startBox.x + startBox.w
            if (handleName.includes("r")) anchorX = startBox.x
            if (handleName.includes("b")) anchorY = startBox.y
            if (handleName.includes("t")) anchorY = startBox.y + startBox.h

            // Scale points relative to anchor
            spline.points.forEach((pt, i) => {
              const startPt = spline._resizeStartPoints[i]
              if (!startPt) return

              const relX = startPt.x - anchorX
              const relY = startPt.y - anchorY
              const scaledX = relX * scaleX
              const scaledY = relY * scaleY

              pt.x = anchorX + scaledX
              pt.y = anchorY + scaledY

              pt.circle?.center(pt.x, pt.y)
            })

            spline.plot()
            isDraggingRef.current = true
            return
          }

          // ----- END -----
          if (isDone) {
            if (spline._resizeIsActive) {
              spline._resizeIsActive = false
              // Emit transform event for AutoHistoryPlugin
              eventBus.emit("spline:transformed", {
                splineId: spline.id,
                type: "resize",
              })
              // Re-show selection box after resize completes
              setTimeout(() => {
                el.select(selectionOptions)
              }, 0)
            }
            if (spline._rotateIsActive) {
              spline._rotateIsActive = false
              // Emit transform event for AutoHistoryPlugin
              eventBus.emit("spline:transformed", {
                splineId: spline.id,
                type: "rotate",
              })
            }
            return
          }
        } catch (error) {
          console.error("[splineManager] resize handler error:", error)
        }
      })

      el.on("dragstart.splineTransform-storeMatrix", () => {
        try {
          spline._startMatrix = el.matrixify?.()
        } catch (startMatrixError) {
          console.warn(
            "[splineManager] Failed to get start matrix:",
            startMatrixError
          )
        }
      })
    }

    const attachToAll = () => {
      this.splines.forEach((spline) => {
        if (!spline || !spline.group) return
        if (spline.__splineAttachBound) return

        spline.__splineAttachBound = true
        spline.group.off("click.selectSpline")
        spline.group.on("click.selectSpline", (e) => {
          const tool = selectedToolRef?.current
          const selectedSpline = this.getSelected()
          if (
            (tool === "curve" ||
              tool === "line" ||
              tool === "straight" ||
              tool === "nurbs") &&
            selectedSpline &&
            selectedSpline.id === spline.id
          ) {
            // Already selected in curve mode: allow point addition by not stopping propagation
            // Still call selectSpline to ensure state is correct
            selectSpline(spline)
            return
          } else {
            e.stopPropagation()
            selectSpline(spline)
          }
        })
      })
    }

    const notifyToolChange = (tool) => {
      if (isDraggingRef?.current) return

      if (tool !== "select") {
        this.splines.forEach((spline) => {
          try {
            spline.group.select(false)
            spline.group.draggable(false)
            spline.group.resize(false)
          } catch (deselectError) {
            console.warn(
              "[splineManager] Failed to deselect group:",
              deselectError
            )
          }

          spline.setSelected(false)

          try {
            spline.clearTransformState()
          } catch (clearError) {
            console.warn(
              "[splineManager] Failed to clear transform state:",
              clearError
            )
          }
        })

        clearSelection()
      }
    }

    attachToAll()

    // Listen for manager-level deselection and clear local selectedSpline
    const handleManagerSelect = (data) => {
      const { spline } = data || {}
      if (!spline && selectedSpline) {
        // Manager deselected - clear our local selectedSpline too
        clearSelection()
      }
    }
    eventBus.on("spline:selected", handleManagerSelect)

    // Return API for Canvas to use
    this._transformAPI = {
      selectSpline,
      clearSelection,
      attachToAll,
      getSelected: () => selectedSpline,
      notifyToolChange,
      destroy: () => {
        // Clean up EventBus listener
        eventBus.off("spline:selected", handleManagerSelect)
        console.log("[SplineManager] Transform API destroyed, listener removed")
      },
    }

    return this._transformAPI
  }

  /**
   * Clear the transform selection (visual box) without deselecting the spline in the manager
   * Used by SelectionManager when switching to multi-selection
   */
  clearTransformSelection() {
    this._transformAPI?.clearSelection?.()
  }

  // ========== CONVENIENCE METHODS FOR CANVAS ==========

  /**
   * Create a new spline at the given coordinates (starting with the first point)
   * This is used by Canvas when curve tool is active and user clicks
   * @param {number} x - X coordinate of first point
   * @param {number} y - Y coordinate of first point
   * @returns {Spline} - The newly created and selected spline
   */
  createSplineAt(x, y, type = "bspline") {
    console.log("[SplineManager.createSplineAt] Creating spline at", { x, y })
    const spline = this.createSpline(true, type) // auto-select with type
    // First point of a spline is always sharp/endpoint effectively, but we can mark it
    this.addPointToSpline(spline.id, x, y, false)
    // Flag to suppress immediate background clearance so next click can add a point
    this._justCreatedSplineId = spline.id
    return spline
  }

  /**
   * Add a point to the currently selected/active spline
   * @param {number} x - X coordinate
   * @param {number} y - Y Coordinate
   * @returns {object} - The point object, or null if no active spline
   */
  addPointToActiveSpline(x, y) {
    const activeSpline = this.getSelected()
    if (!activeSpline) {
      console.log("[SplineManager.addPointToActiveSpline] No active spline")
      return null
    }
    console.log(
      "[SplineManager.addPointToActiveSpline] Adding point to",
      activeSpline.id
    )
    // While actively adding points keep suppression flag
    this._justCreatedSplineId = activeSpline.id
    return this.addPointToSpline(activeSpline.id, x, y)
  }

  /**
   * Find nearest spline to a point by checking all points on all splines
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} maxDistance - Maximum distance to consider (default 20px)
   * @returns {Spline|null} - The nearest spline or null if none within distance
   */
  findNearestSpline(x, y, maxDistance = 20) {
    let nearestSpline = null
    let nearestDistance = maxDistance

    this.getAllSplines().forEach((spline) => {
      spline.points.forEach((point) => {
        const dx = point.x - x
        const dy = point.y - y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < nearestDistance) {
          nearestDistance = dist
          nearestSpline = spline
        }
      })
    })

    return nearestSpline
  }
}
