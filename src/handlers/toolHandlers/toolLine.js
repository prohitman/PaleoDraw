// src/handlers/toolHandlers/toolLine.js
/**
 * Line (polyline) tool handlers: creating and extending straight line splines
 * Mirrors curve tool logic but sets spline type to 'polyline' and uses straight segments.
 */

export const lineToolHandlers = {
  click: (e, context) => {
    const {
      manager,
      svgObjectManager,
      historyManager,
      isDraggingPoint,
      drawRef,
    } = context
    if (isDraggingPoint?.current) return
    const draw = drawRef?.current
    if (!draw) return
    const { x, y } = draw.point(e.clientX, e.clientY)

    // If clicking existing spline path/circle: selection behavior identical to curve tool
    if (
      e.target.tagName === "path" ||
      e.target.tagName === "circle" ||
      e.target.classList?.contains("spline-hover")
    ) {
      const splineGroup = e.target.closest("g")
      if (splineGroup && splineGroup.hasAttribute("data-spline-id")) {
        const splineId = splineGroup.getAttribute("data-spline-id")
        const targetSpline = manager.getSpline(splineId)
        const selectedSpline = manager.getSelected()
        if (targetSpline && targetSpline !== selectedSpline) {
          manager.selectSpline(splineId)
          e.stopPropagation()
          return
        }
        if (e.target.tagName === "circle") {
          e.stopPropagation()
          return
        }
      } else {
        e.stopPropagation()
        return
      }
    }

    const selectedSpline = manager.getSelected()

    // Alt+click insertion (polyline) if spline selected & has >=2 points
    if (e.altKey && selectedSpline && selectedSpline.selected) {
      if (selectedSpline.points.length >= 2) {
        manager.finishDrawing()
        if (historyManager?.current) {
          historyManager.current.saveSnapshot(manager, svgObjectManager)
        }
        e.stopPropagation()
        return
      }
    }

    // Start new polyline if none selected
    if (!selectedSpline) {
      if (historyManager?.current) {
        if (
          historyManager.current.currentIndex <
          historyManager.current.history.length - 1
        ) {
          historyManager.current.history = historyManager.current.history.slice(
            0,
            historyManager.current.currentIndex + 1
          )
        }
      }
      manager.createSplineAt(x, y, "polyline")
      e.stopPropagation()
      return
    }

    // Add point to active polyline
    const activeSpline = manager.getSelected()
    if (activeSpline && activeSpline.selected) {
      manager.addPointToSpline(activeSpline.id, x, y)
      if (historyManager?.current) {
        historyManager.current.saveSnapshot(manager, svgObjectManager)
      }
    }

    e.stopPropagation()
  },
}
