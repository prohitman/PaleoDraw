// src/handlers/pointSelectionBoxHandlers.js
/**
 * Right-click drag box for point multi-selection (curve tool).
 * Independent of spline selection; operates on all points in all splines.
 */
export function setupPointDragSelectionHandlers(
  draw,
  pointSelectionManager,
  selectedToolRef,
  getViewportCoords
) {
  if (!draw || !pointSelectionManager) return

  let isDragging = false
  let dragButton = null
  let startX = 0
  let startY = 0
  let rectEl = null

  const resetRect = () => {
    if (rectEl) {
      try {
        rectEl.remove()
      } catch {
        /* ignore */
      }
      rectEl = null
    }
  }

  const pointerDown = (e) => {
    // Allow in curve, line, straight tools
    if (
      selectedToolRef?.current !== "curve" &&
      selectedToolRef?.current !== "line" &&
      selectedToolRef?.current !== "straight"
    )
      return
    if (e.button !== 2) return // right mouse button

    e.preventDefault()
    e.stopPropagation()

    const coords = getViewportCoords
      ? getViewportCoords(e)
      : { x: e.offsetX, y: e.offsetY }
    startX = coords.x
    startY = coords.y
    isDragging = true
    dragButton = 2

    resetRect()
    rectEl = draw
      .rect(1, 1)
      .move(startX, startY)
      .fill("rgba(255,0,255,0.15)")
      .stroke({ color: "#ff00ff", width: 1, dasharray: "4,3" })
      .id("point-drag-selection-rect")

    // Prevent context menu
    e.preventDefault()
  }

  const pointerMove = (e) => {
    if (!isDragging || dragButton !== 2) return
    const coords = getViewportCoords
      ? getViewportCoords(e)
      : { x: e.offsetX, y: e.offsetY }
    const currentX = coords.x
    const currentY = coords.y
    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)
    const minX = Math.min(startX, currentX)
    const minY = Math.min(startY, currentY)

    if (rectEl) {
      rectEl.size(width, height).move(minX, minY)
    }
  }

  const finalize = (e, cancelled = false) => {
    if (!isDragging || dragButton !== 2) return
    const coords = getViewportCoords
      ? getViewportCoords(e)
      : { x: e.offsetX, y: e.offsetY }
    const endX = coords.x
    const endY = coords.y
    const additive = e.shiftKey

    if (!cancelled) {
      pointSelectionManager.selectPointsInRect(
        startX,
        startY,
        endX,
        endY,
        additive
      )
    }

    resetRect()
    isDragging = false
    dragButton = null
  }

  draw.node.addEventListener("pointerdown", pointerDown)
  draw.node.addEventListener("pointermove", (e) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()
    pointerMove(e)
  })
  draw.node.addEventListener("pointerup", (e) => {
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()
      finalize(e, false)
    }
  })

  // Window listeners to catch pointer leaving canvas
  const winMove = (e) => {
    if (!isDragging) return
    pointerMove(e)
  }
  const winUp = (e) => {
    if (!isDragging) return
    if (e.button === 2) {
      finalize(e, false)
    } else if (e.button === 0) {
      finalize(e, true)
    }
  }
  window.addEventListener("pointermove", winMove)
  window.addEventListener("pointerup", winUp)

  // Cancel on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isDragging) {
      finalize(e, true)
    }
  })

  // Suppress context menu in curve tool when starting a drag
  draw.node.addEventListener("contextmenu", (e) => {
    if (
      selectedToolRef?.current === "curve" ||
      selectedToolRef?.current === "line" ||
      selectedToolRef?.current === "straight"
    ) {
      e.preventDefault()
    }
  })

  return {
    cleanup: () => {
      draw.node.removeEventListener("pointerdown", pointerDown)
      // other listeners were anonymous; rely on page unload
      window.removeEventListener("pointermove", winMove)
      window.removeEventListener("pointerup", winUp)
      resetRect()
    },
  }
}
