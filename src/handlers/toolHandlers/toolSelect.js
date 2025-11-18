// src/handlers/toolHandlers/toolSelect.js
/**
 * Select tool handlers: Selection and transformation of splines
 * Triggered when user selects the "select" tool
 */

export const selectToolHandlers = {
  /**
   * Handle canvas click for select tool
   * - Select spline or SVG object if clicked on
   * - Deselect all if clicked on empty area
   * - Shift+click to add/remove from multi-selection
   */
  click: (e, context) => {
    const { manager, svgObjectManager, selectionManager, selectedRef } = context

    console.log("[selectToolHandlers.click] Click detected:", {
      tagName: e.target.tagName,
      targetId: e.target.id,
      classList: Array.from(e.target.classList || []),
      hasSplineHover: e.target.classList?.contains("spline-hover"),
      targetElement: e.target,
      shiftKey: e.shiftKey,
    })

    // Use delete tool's robust event logic for path/circle clicks
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
        if (targetSpline) {
          console.log(
            "[selectToolHandlers] Selecting spline by data-spline-id:",
            splineId,
            "shift:",
            e.shiftKey
          )

          // Use SelectionManager for multi-selection if shift is held
          if (e.shiftKey && selectionManager) {
            selectionManager.selectSpline(splineId, true) // additive=true
          } else if (selectionManager && selectionManager.hasSelection()) {
            // If SelectionManager has items selected, use it for consistency
            selectionManager.selectSpline(splineId, false) // replace selection
          } else {
            // Single selection via SplineManager
            manager.selectSpline(splineId)
          }

          selectedRef.current = targetSpline.group
          e.stopPropagation()
          return
        }
      }
    } else if (e.target.tagName === "g") {
      // Direct group click
      const splineGroup = e.target
      if (splineGroup.hasAttribute("data-spline-id")) {
        const splineId = splineGroup.getAttribute("data-spline-id")
        const targetSpline = manager.getSpline(splineId)
        if (targetSpline) {
          console.log(
            "[selectToolHandlers] Selecting spline by group data-spline-id:",
            splineId,
            "shift:",
            e.shiftKey
          )

          // Use SelectionManager for multi-selection if shift is held
          if (e.shiftKey && selectionManager) {
            selectionManager.selectSpline(splineId, true) // additive=true
          } else if (selectionManager && selectionManager.hasSelection()) {
            // If SelectionManager has items selected, use it for consistency
            selectionManager.selectSpline(splineId, false) // replace selection
          } else {
            // Single selection via SplineManager
            manager.selectSpline(splineId)
          }

          selectedRef.current = targetSpline.group
          e.stopPropagation()
          return
        }
      }
    }
    // Check for imported SVG object
    if (svgObjectManager && e.target.tagName === "g" && e.target._objectId) {
      const objectId = e.target._objectId
      console.log("[selectToolHandlers] Found SVG object to select:", objectId)
      svgObjectManager.selectObject(objectId)
      selectedRef.current = svgObjectManager.getSelected()
      e.stopPropagation()
      return
    }
    // Click on empty area: clear selection
    console.log(
      "[selectToolHandlers] No spline or object found, clearing selection"
    )
    selectedRef.current = null
    e.stopPropagation()
  },
}
