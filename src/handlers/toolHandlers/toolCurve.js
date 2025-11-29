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

    // Selection vs addition logic on path/circle clicks.
    // Previous behavior: always stop adding when clicking any part of an existing spline.
    // Fix: If clicking the path of the CURRENT selected spline while in curve mode, treat it as an add-point click.
    // Still: clicking a different spline's path selects it; clicking a circle does NOT add a new point.
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
        // Clicking a different spline's path: select it and exit
        if (targetSpline && targetSpline !== selectedSpline) {
          manager.selectSpline(splineId)
          e.stopPropagation()
          return
        }
        // Clicking a circle of the current spline: do not add a point (likely drag/select intent)
        if (e.target.tagName === "circle") {
          e.stopPropagation()
          return
        }
        // Clicking the path of the currently selected spline: allow point addition (do NOT return here)
      } else {
        // Path/circle without spline id – ignore adding
        e.stopPropagation()
        return
      }
    }

    const selectedSpline = manager.getSelected()
    console.log("[curveToolHandlers.click] Selected spline:", selectedSpline)

    // Alt+click: Insert point by proximity into existing spline
    if (e.altKey && selectedSpline && selectedSpline.selected) {
      console.log("[curveToolHandlers] Alt+click: inserting point by proximity")
      // Clear any existing multi-point selection before modifying spline
      if (manager.pointSelectionManager) {
        manager.pointSelectionManager.clearSelection()
      }
      manager.insertPointByProximity(selectedSpline.id, x, y)
      manager.finishDrawing()
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
      // Starting a new spline should clear any prior multi-point selection
      if (manager.pointSelectionManager) {
        manager.pointSelectionManager.clearSelection()
      }
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
      // Deselect multi-selected points when appending a new point
      // Access pointSelectionManager via the manager instance since it's not in context
      if (manager.pointSelectionManager) {
        manager.pointSelectionManager.clearSelection()
      }

      const point = manager.addPointToSpline(activeSpline.id, x, y)
      console.log("[curveToolHandlers] addPointToSpline returned:", point)
    }

    e.stopPropagation()
  },

  // Additional handlers can be added here (mousedown, mousemove, etc.)
  // For now, click is the primary interaction point
}
