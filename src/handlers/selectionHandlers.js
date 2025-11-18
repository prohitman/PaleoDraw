// src/handlers/selectionHandlers.js
/**
 * Selection handlers for right-click drag and shift-click multi-selection
 */

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
  getViewportCoords
) {
  let isDraggingSelection = false
  let dragButton = null

  // Right-click drag for box selection
  draw.node.addEventListener("pointerdown", (e) => {
    // Only in select tool
    if (selectedToolRef?.current !== "select") return

    // Right mouse button (button 2)
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()

      const coords = getViewportCoords
        ? getViewportCoords(e)
        : { x: e.offsetX, y: e.offsetY }

      isDraggingSelection = true
      dragButton = 2
      selectionManager.startDragSelection(coords.x, coords.y, draw)

      console.log("[selectionHandlers] Starting drag selection at", coords)
    }
  })

  draw.node.addEventListener("pointermove", (e) => {
    if (!isDraggingSelection || dragButton !== 2) return

    e.preventDefault()
    e.stopPropagation()

    const coords = getViewportCoords
      ? getViewportCoords(e)
      : { x: e.offsetX, y: e.offsetY }

    selectionManager.updateDragSelection(coords.x, coords.y)
  })

  draw.node.addEventListener("pointerup", (e) => {
    if (!isDraggingSelection || dragButton !== 2) return
    if (e.button !== 2) return

    e.preventDefault()
    e.stopPropagation()

    const coords = getViewportCoords
      ? getViewportCoords(e)
      : { x: e.offsetX, y: e.offsetY }

    // Check if shift is held for additive selection
    const additive = e.shiftKey

    selectionManager.endDragSelection(coords.x, coords.y, additive)

    isDraggingSelection = false
    dragButton = null

    console.log("[selectionHandlers] Ended drag selection")
  })

  // Prevent context menu on right-click
  draw.node.addEventListener("contextmenu", (e) => {
    if (selectedToolRef?.current === "select") {
      e.preventDefault()
    }
  })

  // Cancel selection on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isDraggingSelection) {
      selectionManager.cancelDragSelection()
      isDraggingSelection = false
      dragButton = null
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
  console.log(
    "[selectionHandlers] Spline clicked:",
    splineId,
    "shift:",
    shiftKey
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
  console.log(
    "[selectionHandlers] SVG object clicked:",
    svgObjectId,
    "shift:",
    shiftKey
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

      console.log("[selectionHandlers] Selected all splines")
    }
  })
}
