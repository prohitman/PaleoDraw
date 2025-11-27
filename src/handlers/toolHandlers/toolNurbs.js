/**
 * NURBS tool handlers: creating and extending NURBS splines
 * Currently configured to create sharp edges (polylines) as requested
 */

export const nurbsToolHandlers = {
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

    // Alt+click insertion (nurbs) if spline selected & has >=2 points
    if (e.altKey && selectedSpline && selectedSpline.selected) {
      if (selectedSpline.points.length >= 2) {
        manager.insertPointByProximity(selectedSpline.id, x, y)
        if (historyManager?.current) {
          historyManager.current.saveSnapshot(manager, svgObjectManager)
        }
        e.stopPropagation()
        return
      }
    }

    // Start new nurbs spline if none selected
    if (!selectedSpline) {
      // Create spline with type 'nurbs'
      // Use Shift+Click to start with a sharp point, otherwise smooth
      const isSharp = e.shiftKey
      const spline = manager.createSpline(true, "nurbs")
      manager.addPointToSpline(spline.id, x, y, isSharp)
      manager._justCreatedSplineId = spline.id
      e.stopPropagation()
      return
    }

    // Add point to active nurbs spline
    const activeSpline = manager.getSelected()
    if (activeSpline && activeSpline.selected) {
      // Use Shift+Click to add a sharp point
      const isSharp = e.shiftKey
      manager.addPointToSpline(activeSpline.id, x, y, isSharp)
      if (historyManager?.current) {
        historyManager.current.saveSnapshot(manager, svgObjectManager)
      }
    }

    e.stopPropagation()
  },
}
