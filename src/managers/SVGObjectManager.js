// src/managers/SVGObjectManager.js
import EventEmitter from "../utils/eventEmitter.js"

/**
 * SVGObjectManager: Centralized API for managing imported SVG objects
 * Handles CRUD, selection, and transformations for imported SVGs
 * Emits events: 'imported', 'deleted', 'select', 'change'
 */
export default class SVGObjectManager extends EventEmitter {
  constructor({ selectedToolRef = null, historyManager = null } = {}) {
    super()

    this.objects = new Map() // Map<objectId, svgElement>
    this.selectedObjectId = null
    this.selectedToolRef = selectedToolRef
    this.historyManager = historyManager // HistoryManager instance for undo/redo

    this._transformAPI = null
  }

  // ========== OBJECT CRUD ==========

  /**
   * Add an imported SVG object to the manager
   * @param {object} svgElement - SVG.js element
   * @param {string} id - Optional custom ID
   * @returns {object} - The SVG element with ID attached
   */
  addObject(svgElement, id = null) {
    if (!svgElement) {
      console.error("[SVGObjectManager] Cannot add null/undefined object")
      return null
    }

    const objectId =
      id || `svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.objects.set(objectId, svgElement)
    svgElement._objectId = objectId

    console.log(
      "[SVGObjectManager] Object added:",
      objectId,
      "total:",
      this.objects.size
    )
    this.emit("imported", svgElement)
    this.emit("change")

    return svgElement
  }

  /**
   * Delete an SVG object by ID
   * @param {string} objectId
   */
  deleteObject(objectId) {
    const obj = this.objects.get(objectId)
    if (!obj) {
      console.warn("[SVGObjectManager] Object not found:", objectId)
      return
    }

    try {
      // Remove lingering selection box if present
      if (obj.node) {
        const selBox = obj.node.querySelector(".svg-select-box")
        if (selBox) selBox.remove()
      }
      obj.select?.(false)
      obj.resize?.(false)
      obj.remove?.()
    } catch (err) {
      console.warn("[SVGObjectManager] Error during delete:", err)
    }

    this.objects.delete(objectId)

    if (this.selectedObjectId === objectId) {
      this.selectedObjectId = null
    }

    console.log("[SVGObjectManager] Object deleted:", objectId)
    this.emit("deleted", objectId)
    this.emit("change")
  }

  /**
   * Get object by ID
   * @param {string} objectId
   * @returns {object|null}
   */
  getObject(objectId) {
    return this.objects.get(objectId) || null
  }

  /**
   * Get all objects as array
   * @returns {object[]}
   */
  getAllObjects() {
    return Array.from(this.objects.values())
  }

  // ========== SELECTION ==========

  /**
   * Select an object by ID (single selection)
   * @param {string} objectId
   */
  selectObject(objectId) {
    console.log(
      "[SVGObjectManager] Selecting object:",
      objectId,
      "current:",
      this.selectedObjectId
    )

    const isAlreadySelected = this.selectedObjectId === objectId

    // Even if already selected, we need to reapply the selection UI
    // in case it was cleared (e.g., after dragging)
    const current = this.objects.get(objectId)
    if (!current) {
      console.warn("[SVGObjectManager] Object not found:", objectId)
      return
    }

    // Deselect previous if different
    if (this.selectedObjectId && this.selectedObjectId !== objectId) {
      const prev = this.objects.get(this.selectedObjectId)
      if (prev) {
        try {
          prev.select?.(false)
          prev.resize?.(false)
        } catch (err) {
          console.warn("[SVGObjectManager] Error deselecting previous:", err)
        }
      }
    }

    this.selectedObjectId = objectId

    if (current) {
      try {
        current.select?.({ rotationPoint: true })
        current.resize?.({ rotationPoint: true })
      } catch (err) {
        console.warn("[SVGObjectManager] Error selecting object:", err)
      }

      this.emit("select", current)
    }

    this.emit("change")
    if (isAlreadySelected) {
      console.log(
        "[SVGObjectManager] Reapplied selection to already-selected object"
      )
    } else {
      console.log("[SVGObjectManager] Selection complete")
    }
  }

  /**
   * Deselect current object
   */
  clearSelection() {
    if (!this.selectedObjectId) return

    const current = this.objects.get(this.selectedObjectId)
    if (current) {
      try {
        current.select?.(false)
        current.resize?.(false)
      } catch (err) {
        console.warn("[SVGObjectManager] Error clearing selection:", err)
      }
    }

    this.selectedObjectId = null
    this.emit("select", null)
    this.emit("change")
  }

  /**
   * Clear all objects and reset selection
   */
  clear() {
    this.objects.clear()
    this.selectedObjectId = null
    this.emit("change")
  }

  /**
   * Get currently selected object
   * @returns {object|null}
   */
  getSelected() {
    return this.selectedObjectId
      ? this.objects.get(this.selectedObjectId)
      : null
  }

  /**
   * Get currently selected object ID
   * @returns {string|null}
   */
  getSelectedId() {
    return this.selectedObjectId || null
  }

  /**
   * Finish drawing or editing (called via hotkey or tool change)
   * Clears all selections
   */
  finishDrawing() {
    this.clearSelection()
  }

  // ========== TOOL STATE UPDATES ==========

  /**
   * Called when the active tool changes
   * Clears selection when switching away from select tool
   */
  updateOnToolChange(tool) {
    console.log("[SVGObjectManager] Tool changed to:", tool)

    if (tool !== "select") {
      this.getAllObjects().forEach((obj) => {
        try {
          obj.select?.(false)
          obj.resize?.(false)
        } catch {
          // ignore
        }
      })

      this.clearSelection()
    }
  }

  // ========== SERIALIZATION ==========

  /**
   * Get all object data as JSON-serializable objects
   * @returns {object[]}
   */
  getState() {
    return this.getAllObjects().map((obj) => ({
      svg: obj.svg?.(),
      transform: obj.transform?.(),
    }))
  }

  /**
   * Load objects from saved state
   * @param {object[]} objectDataArray
   * @param {object} drawRef - SVG.js draw instance
   */
  loadState(objectDataArray, drawRef) {
    if (!drawRef || !objectDataArray || !Array.isArray(objectDataArray)) return

    objectDataArray.forEach((data) => {
      try {
        const imported = drawRef.svg(data.svg)
        if (data.transform) {
          imported.transform(data.transform)
        }
        this.addObject(imported)
      } catch {
        // ignore load errors
      }
    })
  }

  /**
   * Save current SVG object state to history
   * Called whenever SVG objects are modified
   * Also accepts external spline state for unified history
   * @param {object[]} splineData - Optional spline state array
   */
  saveHistorySnapshot(splineData = []) {
    if (this.historyManager) {
      const svgData = this.getState()
      this.historyManager.pushState(splineData, svgData)
    }
  }

  /**
   * Undo to previous state and restore SVG objects
   * @param {object} context - Optional context with drawRef for re-initialization
   * @returns {object|null} - The restored state or null if already at start
   */
  undo(context = {}) {
    if (!this.historyManager) return null

    const state = this.historyManager.undo()
    if (!state) return null

    // Clear current objects
    this.objects.forEach((obj) => {
      try {
        obj.select?.(false)
        obj.resize?.(false)
        obj.remove?.()
      } catch (error) {
        console.warn("[SVGObjectManager.undo] Error clearing object:", error)
      }
    })
    this.objects.clear()
    this.selectedObjectId = null

    // Restore SVG objects from state
    if (state.svgs && Array.isArray(state.svgs) && context.drawRef) {
      state.svgs.forEach((svgData) => {
        try {
          const imported = context.drawRef.svg(svgData.svg)
          if (svgData.transform) {
            imported.transform(svgData.transform)
          }
          this.addObject(imported)
        } catch (error) {
          console.error(
            "[SVGObjectManager.undo] Error restoring SVG object:",
            error
          )
        }
      })
    }

    this.clearSelection()
    this.emit("change")

    return state
  }

  /**
   * Redo to next state and restore SVG objects
   * @param {object} context - Optional context with drawRef for re-initialization
   * @returns {object|null} - The restored state or null if already at end
   */
  redo(context = {}) {
    if (!this.historyManager) return null

    const state = this.historyManager.redo()
    if (!state) return null

    // Clear current objects (same logic as undo)
    this.objects.forEach((obj) => {
      try {
        obj.select?.(false)
        obj.resize?.(false)
        obj.remove?.()
      } catch (error) {
        console.warn("[SVGObjectManager.redo] Error clearing object:", error)
      }
    })
    this.objects.clear()
    this.selectedObjectId = null

    // Restore SVG objects from state
    if (state.svgs && Array.isArray(state.svgs) && context.drawRef) {
      state.svgs.forEach((svgData) => {
        try {
          const imported = context.drawRef.svg(svgData.svg)
          if (svgData.transform) {
            imported.transform(svgData.transform)
          }
          this.addObject(imported)
        } catch (error) {
          console.error(
            "[SVGObjectManager.redo] Error restoring SVG object:",
            error
          )
        }
      })
    }

    this.clearSelection()
    this.emit("change")

    return state
  }

  // ========== CONVENIENCE METHODS FOR CANVAS ==========

  /**
   * Import an SVG element at the given coordinates
   * Convenience method for Canvas event handlers
   * @param {object} svgElement - SVG.js element to import
   * @param {number} x - Optional X coordinate (for positioning)
   * @param {number} y - Optional Y coordinate (for positioning)
   * @returns {object} - The imported SVG object
   */
  importSVGAt(svgElement, x, y) {
    console.log("[SVGObjectManager.importSVGAt] Importing SVG at", { x, y })
    const imported = this.addObject(svgElement)

    // Optionally position the SVG if coordinates provided
    if (typeof x === "number" && typeof y === "number") {
      try {
        imported.center(x, y)
      } catch (err) {
        console.warn(
          "[SVGObjectManager.importSVGAt] Could not position SVG:",
          err
        )
      }
    }

    return imported
  }
}
