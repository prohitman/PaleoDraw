// src/handlers/toolHandlers/toolCurve.js
/**
 * Curve tool handlers: Creating and editing splines
 * Triggered when user selects the "curve" tool
 */

export const curveToolHandlers = {
  /**
   * Handle canvas click for curve tool
   * - Create new spline if none active
   * - Add point to active spline if one exists
   * - Select deselected spline if clicked on one
   * - Support Alt+click for proximity insertion
   */
  click: (e, context) => {
    const {
      manager,
      svgObjectManager,
      historyManager,
      isDraggingPoint,
      drawRef,
    } = context
    console.log("[curveToolHandlers.click] Handling curve tool click", {
      managerType: typeof manager,
      managerInstance: manager,
      svgObjectManagerType: typeof svgObjectManager,
      svgObjectManagerInstance: svgObjectManager,
      historyManagerType: typeof historyManager,
      historyManagerInstance: historyManager,
      isDraggingPointType: typeof isDraggingPoint,
      isDraggingPointInstance: isDraggingPoint,
      event: e,
    })

    if (isDraggingPoint?.current) {
      console.log("[curveToolHandlers] Currently dragging, ignoring click")
      return
    }

    const draw = drawRef?.current
    if (!draw) {
      console.log("[curveToolHandlers.click] No draw ref")
      return
    }
    const { x, y } = draw.point(e.clientX, e.clientY)
    console.log("[curveToolHandlers.click] Click detected:", {
      x,
      y,
      tagName: e.target.tagName,
      classList: Array.from(e.target.classList || []),
      hasSplineHover: e.target.classList?.contains("spline-hover"),
    })

    // Only respond to path/circle clicks, use closest('g'), select by data-spline-id
    // Accept path/circle or .spline-hover class
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
      }
    }

    const selectedSpline = manager.getSelected()
    console.log("[curveToolHandlers.click] Selected spline:", selectedSpline)

    // Alt+click: Insert point by proximity into existing spline
    if (e.altKey && selectedSpline && selectedSpline.selected) {
      console.log("[curveToolHandlers] Alt+click: inserting point by proximity")
      manager.insertPointByProximity(selectedSpline.id, x, y)
      // Save to history
      const splineData =
        manager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager?.getState?.() || []
      if (historyManager?.current) {
        // Truncate history if not at end
        if (
          historyManager.current.currentIndex <
          historyManager.current.history.length - 1
        ) {
          historyManager.current.history = historyManager.current.history.slice(
            0,
            historyManager.current.currentIndex + 1
          )
        }
        historyManager.current.pushState(splineData, svgData)
      }
      e.stopPropagation()
      return
    }

    // Start new spline if none active
    if (!selectedSpline) {
      console.log("[curveToolHandlers] Creating new spline at", { x, y })
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
      const spline = manager.createSplineAt(x, y)
      console.log("[curveToolHandlers] createSplineAt returned:", spline)
      // Only create the first point, do NOT add a second point immediately
      e.stopPropagation()
      return
    }

    // Add point to the active spline
    const activeSpline = manager.getSelected()
    console.log(
      "[curveToolHandlers] Active spline after create/getSelected:",
      activeSpline
    )
    if (activeSpline && activeSpline.selected) {
      console.log("[curveToolHandlers] Adding point to spline", activeSpline.id)
      const point = manager.addPointToSpline(activeSpline.id, x, y)
      console.log("[curveToolHandlers] addPointToSpline returned:", point)
      // Save to history
      const splineData =
        manager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager?.getState?.() || []
      if (historyManager?.current) {
        historyManager.current.pushState(splineData, svgData)
      }
    }

    e.stopPropagation()
  },

  // Additional handlers can be added here (mousedown, mousemove, etc.)
  // For now, click is the primary interaction point
}
