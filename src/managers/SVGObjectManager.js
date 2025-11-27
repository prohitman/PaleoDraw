// src/managers/SVGObjectManager.js
import EventEmitter from "../utils/eventEmitter.js"
import { selectionOptions } from "../utils/selectionConfig"

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
    this.linkedSplineManager = null // Reference to SplineManager for unified history

    this._transformAPI = null
    this.selectedRef = null // Currently selected SVG element (for internal tracking)
  }

  // ========== OBJECT CRUD ==========

  /**
   * Initialize interactive behavior for an SVG object
   * Handles drag, resize, and click events
   * @param {object} svgElement - SVG.js element
   */
  initializeInteractive(svgElement) {
    if (!svgElement || svgElement._initializedInteractive) return
    svgElement._initializedInteractive = true

    // Ensure draggable capability
    try {
      svgElement.draggable?.()
    } catch (err) {
      console.warn("[SVGObjectManager] Failed to enable draggable on SVG", err)
    }

    // Drag start - clear selection UI temporarily
    svgElement.on("dragstart", () => {
      if (this.selectedRef === svgElement) {
        svgElement.select(false)
        this.selectedRef = null
      }
    })

    // Drag end - restore selection UI and save to history
    svgElement.on("dragend", () => {
      const now = Date.now()
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
            svgElement.resize({ rotationPoint: true })
            this.selectedRef = svgElement
          }, 0)
        } catch (err) {
          console.warn("[SVGObjectManager] SVG dragend reselection error:", err)
        }
      }

      // Save to history
      this.saveHistorySnapshot()
      console.log("[SVGObjectManager] SVG drag end saved to history")
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

        // Save to history
        this.saveHistorySnapshot()
        console.log("[SVGObjectManager] SVG resize end saved to history")
      }, 150)

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

    // Click - handle selection
    svgElement.on("click", (ev) => {
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
   * @returns {object} - The SVG element with ID attached
   */
  addObject(svgElement, id = null, skipInteractive = false) {
    if (!svgElement) {
      console.error("[SVGObjectManager] Cannot add null/undefined object")
      return null
    }

    const objectId =
      id || `svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
        current.select?.(selectionOptions)
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

  // ========== Z-ORDER OPERATIONS ==========

  /**
   * Move selected object forward one step
   */
  bringForward() {
    const obj = this.getSelected()
    if (!obj) return

    obj.forward()
    this.saveHistorySnapshot()
  }

  /**
   * Move selected object to front
   */
  bringToFront() {
    const obj = this.getSelected()
    if (!obj) return

    obj.front()
    this.saveHistorySnapshot()
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
    this.saveHistorySnapshot()
  }

  /**
   * Move selected object to back
   */
  sendToBack() {
    const obj = this.getSelected()
    if (!obj) return

    obj.back()

    // Ensure it stays above bg/grid
    // We need access to draw instance to find bg/grid, or just look at siblings
    // Since we don't have direct ref to draw here easily (except via obj.parent()),
    // we can use obj.parent().findOne(...)
    const parent = obj.parent()
    if (parent) {
      const bg = parent.findOne("#canvas-bg")
      const grid = parent.findOne("#canvas-grid")
      if (grid) {
        obj.after(grid)
      } else if (bg) {
        obj.after(bg)
      }
    }

    this.saveHistorySnapshot()
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
      let matrix = null
      try {
        matrix = obj.matrixify?.()
      } catch {
        matrix = null
      }
      return {
        id: obj._objectId,
        svg: obj.svg?.(), // full markup for uniform restoration
        transform: obj.transform?.(), // legacy fallback
        matrix, // preferred precise transform representation
        bbox: obj.bbox?.(),
      }
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
        if (data.svg) {
          imported = drawRef.group().svg(data.svg)
        } else if (data.inner) {
          // legacy schema support
          imported = drawRef.group().svg(`<svg>${data.inner}</svg>`)
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
          // Add without initializing interactive (will be done after all objects loaded)
          this.addObject(imported, data.id, true)
          // Now initialize interactive behavior
          this.initializeInteractive(imported)
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
    // Clear current objects
    this.objects.forEach((obj) => {
      try {
        obj.select?.(false)
        obj.resize?.(false)
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
          if (svgData.svg) {
            imported = context.drawRef.current.group().svg(svgData.svg)
          } else if (svgData.inner) {
            imported = context.drawRef.current
              .group()
              .svg(`<svg>${svgData.inner}</svg>`)
          }
          if (imported) {
            if (svgData.matrix && typeof imported.matrix === "function") {
              try {
                imported.matrix(svgData.matrix)
              } catch {
                if (svgData.transform) imported.transform(svgData.transform)
              }
            } else if (svgData.transform) {
              imported.transform(svgData.transform)
            }
            // Add without initializing interactive (will be done after all objects loaded)
            this.addObject(imported, svgData.id, true)
            // Now initialize interactive behavior
            this.initializeInteractive(imported)
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
    this.emit("change")
  }

  /**
   * Save current SVG object state to history
   * Called whenever SVG objects are modified
   */
  saveHistorySnapshot() {
    if (this.historyManager) {
      this.historyManager.saveSnapshot(this.linkedSplineManager, this)
    }
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

          // Center in viewport
          imported.center(
            drawRef.viewbox().width / 2,
            drawRef.viewbox().height / 2
          )

          // Initialize interactive behavior
          this.initializeInteractive(imported)

          // Add to manager
          this.addObject(imported)

          // Save to history
          this.saveHistorySnapshot()
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
