// src/managers/SVGObjectManager.js
import eventBus from "../core/EventBus"
import { selectionOptions } from "../utils/selectionConfig"

/**
 * SVGObjectManager: Centralized API for managing imported SVG objects
 * Handles CRUD, selection, and transformations for imported SVGs
 * Emits events via EventBus:
 *  - svg:imported
 *  - svg:deleted
 *  - svg:selected
 *  - svg:modified
 */
export default class SVGObjectManager {
  constructor({ selectedToolRef = null, historyManager = null } = {}) {
    this.objects = new Map() // Map<objectId, svgElement>
    this.selectedObjectId = null
    this.selectedToolRef = selectedToolRef
    this.historyManager = historyManager // HistoryManager instance for undo/redo

    this._transformAPI = null
    this.selectedRef = null // Currently selected SVG element (for internal tracking)

    // Listen to tool changes from EventBus
    eventBus.on("tool:changed", (tool) => this.updateOnToolChange(tool))
  }

  // ========== OBJECT CRUD ==========

  /**
   * Initialize interactive behavior for an SVG object
   * Handles drag, resize, and click events
   * @param {object} svgElement - SVG.js element
   */
  initializeInteractive(svgElement) {
    if (!svgElement || svgElement._initializedInteractive) {
      console.log(
        "[SVGObjectManager.initializeInteractive] Skipped - already initialized or null"
      )
      return
    }

    console.log(
      "[SVGObjectManager.initializeInteractive] Initializing:",
      svgElement._objectId
    )

    // Clear any existing selection/resize UI before initializing
    try {
      svgElement.select?.(false)
      svgElement.resize?.(false)
    } catch {
      // Ignore errors when clearing existing UI
    }

    svgElement._initializedInteractive = true

    // Ensure draggable capability
    try {
      const result = svgElement.draggable?.()
      console.log(
        "[SVGObjectManager.initializeInteractive] draggable() called, result:",
        result
      )
      console.log(
        "[SVGObjectManager.initializeInteractive] Element has draggable method:",
        typeof svgElement.draggable
      )
    } catch (err) {
      console.warn("[SVGObjectManager] Failed to enable draggable on SVG", err)
    }

    // Setup keyboard listener for Shift key to toggle aspect ratio
    const updateResizeOptions = (e) => {
      if (this.selectedRef === svgElement) {
        svgElement.resize({
          rotationPoint: true,
          preserveAspectRatio: !e?.shiftKey, // Default true, false when Shift held
        })
      }
    }

    // Store listener reference for cleanup
    svgElement._keyListener = updateResizeOptions

    // Listen for Shift key changes
    document.addEventListener("keydown", updateResizeOptions)
    document.addEventListener("keyup", updateResizeOptions)

    // Drag start - clear selection UI temporarily
    svgElement.on("dragstart", () => {
      svgElement._isDragging = true
      console.log("[SVGObjectManager] SVG drag started")
      if (this.selectedRef === svgElement) {
        svgElement.select(false)
        this.selectedRef = null
      }
    })

    // Drag end - restore selection UI and save to history
    svgElement.on("dragend", () => {
      const now = Date.now()
      console.log("[SVGObjectManager] SVG drag ended")
      if (svgElement._lastDragPush && now - svgElement._lastDragPush < 50) {
        return
      }
      svgElement._lastDragPush = now

      // Restore selection UI
      if (this.selectedRef === svgElement) {
        try {
          svgElement.select(false)
          svgElement.resize(false)
          setTimeout(() => {
            svgElement.select(selectionOptions)
            svgElement.resize({
              rotationPoint: true,
              preserveAspectRatio: true,
            })
            this.selectedRef = svgElement
          }, 0)
        } catch (err) {
          console.warn("[SVGObjectManager] SVG dragend reselection error:", err)
        }
      }

      // Only emit if we were actually dragging
      if (svgElement._isDragging) {
        svgElement._isDragging = false
        // Emit transform event for AutoHistoryPlugin
        eventBus.emit("svg:transformed", {
          objectId: svgElement._objectId,
          type: "drag",
        })
        console.log("[SVGObjectManager] SVG drag end saved to history")
      }
    })

    // Resize - handle resize events and save to history
    svgElement.on("resize", () => {
      if (!svgElement._resizingActive) svgElement._resizingActive = true

      clearTimeout(svgElement._resizeTimeout)
      svgElement._resizeTimeout = setTimeout(() => {
        svgElement._resizingActive = false
        const now = Date.now()
        if (
          svgElement._lastResizePush &&
          now - svgElement._lastResizePush < 50
        ) {
          return
        }
        svgElement._lastResizePush = now

        // Emit transform event for AutoHistoryPlugin
        eventBus.emit("svg:transformed", {
          objectId: svgElement._objectId,
          type: "resize",
        })
        console.log("[SVGObjectManager] SVG resize end saved to history")
      }, 300)

      // Refresh selection UI during resize
      clearTimeout(svgElement._refreshTimeout)
      svgElement._refreshTimeout = setTimeout(() => {
        if (this.selectedRef === svgElement) {
          svgElement.select(false)
          this.selectedRef = null
          svgElement.select(selectionOptions)
          this.selectedRef = svgElement
        }
      }, 1)
    })

    // Click - handle selection (only in select mode)
    svgElement.on("click", (ev) => {
      // Only allow selection when using select tool
      if (this.selectedToolRef && this.selectedToolRef.current !== "select") {
        console.log("[SVGObjectManager] Click ignored - not in select mode")
        return
      }
      ev.stopPropagation()
      this.selectObject(svgElement._objectId)
      this.selectedRef = this.getSelected()
    })
  }

  /**
   * Add an imported SVG object to the manager
   * @param {object} svgElement - SVG.js element
   * @param {string} id - Optional custom ID
   * @param {boolean} skipInteractive - Skip interactive initialization (for restoration)
   * @param {boolean} skipEvent - Skip event emission (for restoration)
   * @returns {object} - The SVG element with ID attached
   */
  addObject(svgElement, id = null, skipInteractive = false, skipEvent = false) {
    if (!svgElement) {
      console.error("[SVGObjectManager] Cannot add null/undefined object")
      return null
    }

    const objectId =
      id || `svg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    this.objects.set(objectId, svgElement)
    svgElement._objectId = objectId
    if (svgElement.node) {
      svgElement.node._objectId = objectId
    }

    // Detect if this group actually wraps a root <svg> element (import pattern draw.group().svg(text))
    try {
      if (
        svgElement.node?.tagName?.toLowerCase() === "g" &&
        /<svg[\s>]/i.test(svgElement.svg?.())
      ) {
        svgElement._wrapsRootSvg = true
      }
    } catch {
      // ignore detection errors
    }

    // Initialize interactive behavior (unless restoring from state)
    if (!skipInteractive) {
      this.initializeInteractive(svgElement)
    }

    console.log(
      "[SVGObjectManager] Object added:",
      objectId,
      "total:",
      this.objects.size
    )

    // Only emit event if not restoring from state
    if (!skipEvent) {
      eventBus.emit("svg:imported", { svgElement, id: objectId })
    }

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

    // Cleanup keyboard listeners
    if (obj._keyListener) {
      document.removeEventListener("keydown", obj._keyListener)
      document.removeEventListener("keyup", obj._keyListener)
      delete obj._keyListener
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
    eventBus.emit("svg:deleted", { objectId })
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
        current.select?.(selectionOptions)
        // Preserve aspect ratio by default
        current.resize?.({
          rotationPoint: true,
          preserveAspectRatio: true,
        })
      } catch (err) {
        console.warn("[SVGObjectManager] Error selecting object:", err)
      }

      eventBus.emit("svg:selected", { svg: current, id: objectId })
    }

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
    eventBus.emit("svg:selected", { svg: null, id: null })
  }

  /**
   * Clear all objects and reset selection
   */
  clear() {
    this.objects.clear()
    this.selectedObjectId = null
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

  // ========== Z-ORDER OPERATIONS ==========

  /**
   * Move selected object forward one step
   */
  bringForward() {
    const obj = this.getSelected()
    if (!obj) return

    obj.forward()
  }

  /**
   * Move selected object to front
   */
  bringToFront() {
    const obj = this.getSelected()
    if (!obj) return

    obj.front()
  }

  /**
   * Move selected object backward one step
   */
  sendBackward() {
    const obj = this.getSelected()
    if (!obj) return

    // Check previous sibling to avoid moving behind grid/bg
    const prev = obj.previous()
    if (prev && (prev.id() === "canvas-bg" || prev.id() === "canvas-grid")) {
      return
    }

    obj.backward()
  }

  /**
   * Move selected object to back
   * Keeps it above background and grid
   */
  sendToBack() {
    const obj = this.getSelected()
    if (!obj) return

    // Find bg and grid elements via parent
    const parent = obj.parent()
    if (parent) {
      const bg = parent.findOne("#canvas-bg")
      const grid = parent.findOne("#canvas-grid")

      // Move after grid (or bg if no grid) - do NOT use .back()
      if (grid) {
        obj.after(grid)
      } else if (bg) {
        obj.after(bg)
      } else {
        // Fallback only if no bg/grid found
        obj.back()
      }
    } else {
      obj.back()
    }
  }

  // ========== TOOL STATE UPDATES ==========

  /**
   * Called when the active tool changes (via EventBus)
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

  serializeObject(svgObject) {
    let matrix = null
    try {
      matrix = svgObject.matrixify?.()
    } catch {
      matrix = null
    }

    // Get the SVG markup
    const svgMarkup = svgObject.svg?.()

    // Extract inner content if this is a group wrapper
    let innerContent = svgMarkup
    if (svgObject.node?.tagName?.toLowerCase() === "g") {
      try {
        // Get children markup without the outer <g> tag
        innerContent = svgObject.node.innerHTML
      } catch {
        innerContent = svgMarkup
      }
    }

    return {
      id: svgObject._objectId,
      svg: svgMarkup, // full markup for compatibility
      inner: innerContent, // inner content for paste
      transform: svgObject.transform?.(), // legacy fallback
      matrix, // preferred precise transform representation
      bbox: svgObject.bbox?.(),
    }
  }

  /**
   * Get all object data as JSON-serializable objects
   * Returns objects sorted by DOM order
   * @returns {object[]}
   */
  getState() {
    const allObjects = this.getAllObjects()

    // Sort by DOM order if possible
    if (allObjects.length > 0 && allObjects[0].parent()) {
      const parent = allObjects[0].parent()
      if (parent && parent.node) {
        const domNodes = Array.from(parent.node.children)
        allObjects.sort((a, b) => {
          const idxA = domNodes.indexOf(a.node)
          const idxB = domNodes.indexOf(b.node)
          return idxA - idxB
        })
      }
    }

    return allObjects.map((obj) => {
      return this.serializeObject(obj)
    })
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
        if (!data) return
        let imported = null
        if (data.inner) {
          // Prefer inner content to avoid double-wrapping
          imported = drawRef.group()
          imported.svg(data.inner)
        } else if (data.svg) {
          // Legacy: full SVG markup
          imported = drawRef.group().svg(data.svg)
        }
        if (imported) {
          if (data.matrix && typeof imported.matrix === "function") {
            try {
              imported.matrix(data.matrix)
            } catch {
              if (data.transform) imported.transform(data.transform)
            }
          } else if (data.transform) {
            imported.transform(data.transform)
          }
          this.addObject(imported, data.id, false)
        }
      } catch {
        // ignore load errors
      }
    })
  }

  /**
   * Restore SVG objects from state (used by undo/redo)
   * @param {object[]} svgDataArray - Array of serialized SVG object data
   * @param {object} context - Context with drawRef for re-initialization
   */
  restoreFromState(svgDataArray, context = {}) {
    // Clear current objects and clean up all selection UI
    this.objects.forEach((obj) => {
      try {
        // Remove all event listeners
        obj.off?.(".selection")
        obj.off?.(".resize")
        obj.off?.("dragstart")
        obj.off?.("dragend")
        obj.off?.("resize")
        obj.off?.("click")

        // Remove keyboard listeners
        if (obj._keyListener) {
          document.removeEventListener("keydown", obj._keyListener)
          document.removeEventListener("keyup", obj._keyListener)
          delete obj._keyListener
        }

        // Disable selection/resize UI
        obj.select?.(false)
        obj.resize?.(false)

        // Remove draggable
        obj.draggable?.(false)

        // Remove the element
        obj.remove?.()
      } catch (error) {
        console.warn(
          "[SVGObjectManager.restoreFromState] Error clearing object:",
          error
        )
      }
    })
    this.objects.clear()
    this.selectedObjectId = null
    this.selectedRef = null

    // Restore SVG objects from state
    if (
      svgDataArray &&
      Array.isArray(svgDataArray) &&
      context.drawRef?.current
    ) {
      svgDataArray.forEach((svgData) => {
        try {
          if (!svgData) return
          let imported = null
          if (svgData.inner) {
            // Prefer inner content to avoid double-wrapping
            imported = context.drawRef.current.group()
            imported.svg(svgData.inner)
          } else if (svgData.svg) {
            // Legacy: full SVG markup
            imported = context.drawRef.current.group().svg(svgData.svg)
          }
          if (imported) {
            // Apply transformations before adding to manager
            if (svgData.matrix && typeof imported.matrix === "function") {
              try {
                imported.matrix(svgData.matrix)
              } catch {
                if (svgData.transform) imported.transform(svgData.transform)
              }
            } else if (svgData.transform) {
              imported.transform(svgData.transform)
            }

            // Initialize interactive AFTER transformations (matching importFromFile pattern)
            console.log(
              "[SVGObjectManager.restoreFromState] About to initialize interactive for:",
              svgData.id
            )
            this.initializeInteractive(imported)
            console.log(
              "[SVGObjectManager.restoreFromState] After initializeInteractive, _initializedInteractive:",
              imported._initializedInteractive
            )

            // Add the object to the manager map
            // Skip interactive (already done above) and skip event emission during restoration
            this.addObject(imported, svgData.id, true, true)
          }
        } catch (error) {
          console.error(
            "[SVGObjectManager.restoreFromState] Error restoring SVG object:",
            error
          )
        }
      })
    }

    this.clearSelection()
  }

  // ========== CONVENIENCE METHODS FOR CANVAS ==========

  /**
   * Import SVG from file
   * Opens file picker, loads SVG, and adds to manager
   * @param {object} drawRef - SVG.js draw instance
   * @returns {Promise<object|null>} - The imported SVG element or null
   */
  async importFromFile(drawRef) {
    return new Promise((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".svg"
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) {
          resolve(null)
          return
        }

        try {
          const text = await file.text()
          const imported = drawRef.group().svg(text)

          // Fix for SVGs without explicit width/height (like Tailwind logo)
          // Extract dimensions from viewBox and set explicit size
          const firstChild = imported.first()
          if (firstChild && firstChild.type === "svg") {
            const vb = firstChild.viewbox()
            if (
              vb &&
              (!firstChild.attr("width") || !firstChild.attr("height"))
            ) {
              // Set explicit dimensions based on viewBox to ensure proper scaling
              firstChild.size(vb.width, vb.height)
            }
          }

          // Center in viewport
          imported.center(
            drawRef.viewbox().width / 2,
            drawRef.viewbox().height / 2
          )

          // Initialize interactive behavior
          this.initializeInteractive(imported)

          // Add to manager
          this.addObject(imported)

          console.log("[SVGObjectManager] SVG import saved to history baseline")

          resolve(imported)
        } catch (err) {
          console.error("[SVGObjectManager] Error importing SVG file:", err)
          resolve(null)
        }
      }
      input.click()
    })
  }

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
