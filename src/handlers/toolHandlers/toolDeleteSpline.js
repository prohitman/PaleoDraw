// src/handlers/toolHandlers/toolDeleteSpline.js
/**
 * Delete spline tool handlers: Deleting splines
 * Triggered when user selects the "delete_spline" tool
 */

export const deleteSplineToolHandlers = {
  /**
   * Handle canvas click for delete_spline tool
   * - Delete spline if clicked directly on it
   * - Find and delete nearest spline if clicked on empty area
   */
  click: (e, context) => {
    const { manager, svgObjectManager, historyManager } = context

    console.log("[deleteSplineToolHandlers.click] Delete spline tool click")

    // Check if clicking on a spline path/circle
    if (e.target.tagName === "path" || e.target.tagName === "circle") {
      const splineGroup = e.target.closest("g")
      if (splineGroup) {
        const targetSpline = manager
          .getAllSplines()
          .find((s) => s.group && s.group.node === splineGroup)

        if (targetSpline) {
          console.log(
            "[deleteSplineToolHandlers] Deleting spline by direct click:",
            targetSpline.id
          )
          manager.deleteSpline(targetSpline.id)

          e.stopPropagation()
          return
        }
      }
    } else {
      // Clicking on empty area - find nearest spline by proximity
      const draw = context.drawRef?.current
      if (!draw) return

      const { x, y } = draw.point(e.clientX, e.clientY)
      const clickX = x
      const clickY = y

      console.log(
        "[deleteSplineToolHandlers] Proximity search for nearest spline"
      )

      // Use manager's helper method if available
      const nearestSpline = manager.findNearestSpline(clickX, clickY, 20)

      if (nearestSpline) {
        console.log(
          "[deleteSplineToolHandlers] Deleting nearest spline by proximity:",
          nearestSpline.id
        )
        manager.deleteSpline(nearestSpline.id)
      } else {
        console.log(
          "[deleteSplineToolHandlers] No spline found within proximity threshold"
        )
      }
    }

    e.stopPropagation()
  },
}
