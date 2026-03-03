// src/handlers/selectionHandlers.js
/**
 * Selection handlers for right-click drag and shift-click multi-selection
 */
import logger from "../../utils/logger.js"

/**
 * Setup drag selection handlers on the canvas
 * @param {object} draw - SVG.js draw instance
 * @param {object} selectionManager - SelectionManager instance
 * @param {object} selectedToolRef - Ref to current tool
 * @param {function} getViewportCoords - Function to convert screen to viewport coords
 */
export function setupDragSelectionHandlers(
  draw,
  selectionManager,
  selectedToolRef,
  getViewportCoords,
) {
  let isDraggingSelection = false
  let dragButton = null
  let windowPointerMoveBound = null
  let windowPointerUpBound = null
  // Track both screen and viewport coords for smoother visual box tracking
  // (screen coords retained conceptually; removed vars to satisfy lint)

  // Right-click drag for box selection
  draw.node.addEventListener("pointerdown", (e) => {
    // Only in select tool
    if (selectedToolRef?.current !== "select") return

    // Right mouse button (button 2)
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()

      // Use SVG.js point() for robust coordinate conversion
      const { x, y } = draw.point(e.clientX, e.clientY)
      // screen offsets accessible via event; no persistent vars needed
      isDraggingSelection = true
      dragButton = 2

      // Deselect everything else first (unless shift is held, but drag selection usually starts fresh)
      // If shift is held, we might want additive, but the prompt says "Moment a drag operation... happens... all objects should deselect"
      // Assuming this refers to a standard drag selection without modifiers, or even with modifiers if the user wants a clean slate.
      // Standard behavior: Shift adds, No-Shift clears.
      if (!e.shiftKey) {
        selectionManager.clearSelection()
      }

      selectionManager.startDragSelection(x, y, draw)

      logger.debug("[selectionHandlers] Starting drag selection at", { x, y })
    }
  })

  const handleMove = (e) => {
    if (!isDraggingSelection || dragButton !== 2) return
    // Use SVG.js point() for robust coordinate conversion
    const { x, y } = draw.point(e.clientX, e.clientY)
    selectionManager.updateDragSelection(x, y)
  }
  draw.node.addEventListener("pointermove", (e) => {
    if (!isDraggingSelection) return
    e.preventDefault()
    e.stopPropagation()
    handleMove(e)
  })

  const finalizeDrag = (e, cancelled = false) => {
    if (!isDraggingSelection || dragButton !== 2) return
    const { x, y } = draw.point(e.clientX, e.clientY)
    if (!cancelled) {
      const additive = e.shiftKey
      selectionManager.endDragSelection(x, y, additive)
      logger.debug("[selectionHandlers] Ended drag selection")
    } else {
      selectionManager.cancelDragSelection()
      logger.debug("[selectionHandlers] Cancelled drag selection")
    }
    isDraggingSelection = false
    dragButton = null
    if (windowPointerMoveBound) {
      window.removeEventListener("pointermove", windowPointerMoveBound)
      windowPointerMoveBound = null
    }
    if (windowPointerUpBound) {
      window.removeEventListener("pointerup", windowPointerUpBound)
      windowPointerUpBound = null
    }
  }
  draw.node.addEventListener("pointerup", (e) => {
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()
      finalizeDrag(e, false)
    }
  })

  // Window-level listeners to catch pointer leaving canvas
  windowPointerMoveBound = (e) => {
    if (!isDraggingSelection) return
    handleMove(e)
  }
  windowPointerUpBound = (e) => {
    if (!isDraggingSelection) return
    if (e.button === 2) {
      finalizeDrag(e, false)
    } else if (e.button === 0) {
      // Left button release while right-drag active -> cancel
      finalizeDrag(e, true)
    }
  }
  window.addEventListener("pointermove", windowPointerMoveBound)
  window.addEventListener("pointerup", windowPointerUpBound)

  // Prevent context menu on right-click
  draw.node.addEventListener("contextmenu", (e) => {
    if (selectedToolRef?.current === "select") {
      e.preventDefault()
    }
  })

  // Cancel selection on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isDraggingSelection) {
      finalizeDrag(e, true)
    }
  })
}

/**
 * Handle click on spline with shift modifier for multi-selection
 * @param {string} splineId
 * @param {boolean} shiftKey
 * @param {object} selectionManager
 */
export function handleSplineClick(splineId, shiftKey, selectionManager) {
  selectionManager.selectSpline(splineId, shiftKey)
  logger.debug(
    "[selectionHandlers] Spline clicked:",
    splineId,
    "shift:",
    shiftKey,
  )
}

/**
 * Handle click on SVG object with shift modifier for multi-selection
 * @param {string} svgObjectId
 * @param {boolean} shiftKey
 * @param {object} selectionManager
 */
export function handleSvgObjectClick(svgObjectId, shiftKey, selectionManager) {
  selectionManager.selectSvgObject(svgObjectId, shiftKey)
  logger.debug(
    "[selectionHandlers] SVG object clicked:",
    svgObjectId,
    "shift:",
    shiftKey,
  )
}

/**
 * Setup keyboard shortcuts for multi-selection operations
 * @param {object} selectionManager
 * @param {object} historyManager
 */
export function setupMultiSelectionHotkeys(selectionManager) {
  // Note: Delete/Backspace for multi-selection is handled by splineHotkeys.js
  // which checks if multiple items are selected and calls selectionManager.deleteSelected()

  // Select all (Ctrl+A) - only enabled in select mode
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "a" && !e.shiftKey) {
      e.preventDefault()
      const allSplineIds = selectionManager.splineManager
        .getAllSplines()
        .map((s) => s.id)
      selectionManager.selectSplines(allSplineIds, false)

      logger.debug("[selectionHandlers] Selected all splines")
    }
  })
}
