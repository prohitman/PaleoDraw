// src/handlers/toolHandlers/toolSelect.js
/**
 * Select tool handlers: Selection and transformation of splines
 * Triggered when user selects the "select" tool
 */
import logger from "../../utils/logger.js"

export const selectToolHandlers = {
  /**
   * Handle canvas click for select tool
   * - Select spline or SVG object if clicked on
   * - Deselect all if clicked on empty area
   * - Shift+click to add/remove from multi-selection
   */
  click: (e, context) => {
    const { manager, svgObjectManager, selectionManager, selectedRef } = context

    logger.debug("[selectToolHandlers.click] Click detected:", {
      tagName: e.target.tagName,
      targetId: e.target.id,
      classList: Array.from(e.target.classList || []),
      hasSplineHover: e.target.classList?.contains("spline-hover"),
      targetElement: e.target,
      shiftKey: e.shiftKey,
    })

    // First attempt: detect SVG object by ancestor traversal (handles clicks on child nodes inside imported SVGs)
    if (svgObjectManager) {
      let el = e.target
      while (el && el !== e.currentTarget) {
        if (el._objectId) {
          const objectId = el._objectId
          logger.debug(
            "[selectToolHandlers] Selecting SVG object via ancestor traversal:",
            objectId,
          )
          // Shift for future multi-select support (placeholder)
          svgObjectManager.selectObject(objectId)
          selectedRef.current = svgObjectManager.getSelected()
          e.stopPropagation()
          return
        }
        el = el.parentElement
      }
    }

    // Spline detection: path/circle or .spline-hover class
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
          logger.debug(
            "[selectToolHandlers] Selecting spline by data-spline-id:",
            splineId,
            "shift:",
            e.shiftKey,
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
          logger.debug(
            "[selectToolHandlers] Selecting spline by group data-spline-id:",
            splineId,
            "shift:",
            e.shiftKey,
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
    // Click on empty area: clear selection
    logger.debug(
      "[selectToolHandlers] No spline or object found, clearing selection",
    )
    selectedRef.current = null
    e.stopPropagation()
  },
}
