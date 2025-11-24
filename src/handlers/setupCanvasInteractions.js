import { applyMatrixToPoints } from "../utils/transform"
import { resetGroupTransform } from "../utils/svgHelpers"

/**
 * Sets up global canvas interactions (zoom, pan, cursor behavior)
 * Returns cleanup function
 */
export function setupCanvasInteractions(
  container,
  drawRef,
  panZoomRef,
  updateGridThickness
) {
  const ZOOM_SMOOTHNESS = 0.1

  // ===== WHEEL ZOOM =====
  const handleWheel = (e) => {
    e.preventDefault()
    const direction = e.deltaY < 0 ? "in" : "out"
    const zoomStep =
      direction === "in" ? 1 + ZOOM_SMOOTHNESS : 1 - ZOOM_SMOOTHNESS
    const newZoom = Math.min(
      Math.max(drawRef.current.zoom() * zoomStep, 0.2),
      5
    )
    const point = drawRef.current.point(e.offsetX, e.offsetY)
    const panZoom = panZoomRef.current
    if (panZoom && typeof panZoom.zoom === "function") {
      panZoom.zoom(newZoom, point)
    } else {
      drawRef.current.zoom(newZoom)
    }
    updateGridThickness(newZoom)
  }

  container.addEventListener("wheel", handleWheel)

  return {
    handleWheel,
  }
}

/**
 * Sets up pan and cursor behavior for select tool
 * Returns cleanup function
 */
export function setupPanBehavior(
  container,
  selectedTool,
  selectedRef,
  isPanning
) {
  const handleMouseDown = (e) => {
    if (selectedRef.current?._isResizing) return
    if (
      e.target &&
      e.target.classList &&
      (e.target.classList.contains("svg_select_handle") ||
        e.target.classList.contains("svg_select_shape"))
    ) {
      return
    }
    if (
      e.target &&
      e.target.closest &&
      e.target.closest(".svg_select_boundingRect")
    ) {
      return
    }
    if (selectedTool && selectedTool.current !== "select") {
      return
    }

    isPanning.current = true
    container.style.cursor = "grabbing"
  }

  const handleMouseMove = (e) => {
    if (selectedRef.current?._isResizing) return
    if (
      e.target &&
      e.target.classList &&
      (e.target.classList.contains("svg_select_handle") ||
        e.target.classList.contains("svg_select_shape"))
    )
      return
    if (!isPanning.current && selectedTool.current === "select")
      container.style.cursor = "grab"
    if (selectedTool && selectedTool.current !== "select")
      container.style.cursor = "crosshair"
  }

  const handleMouseUp = () => {
    isPanning.current = false
    if (selectedTool && selectedTool.current === "select")
      container.style.cursor = "grab"
    else if (selectedTool && selectedTool.current !== "select")
      container.style.cursor = "crosshair"
  }

  const handleMouseLeave = () => {
    if (isPanning.current) {
      isPanning.current = false
      container.style.cursor = "grab"
    }
  }

  container.addEventListener("mousedown", handleMouseDown)
  container.addEventListener("mouseup", handleMouseUp)
  container.addEventListener("mouseleave", handleMouseLeave)
  container.addEventListener("mousemove", handleMouseMove)

  return {
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleMouseMove,
  }
}

/**
 * Sets up global pointer up handler for transform finalization
 */
export function setupGlobalPointerUp(splineManager, isDraggingPoint) {
  const handleGlobalPointerUp = () => {
    const manager = splineManager.current
    if (!manager) return

    let transformOccurred = false

    // Process all splines, not just selected one, to handle rotation cleanup
    manager.getAllSplines().forEach((spline) => {
      if (spline._rotateIsActive) {
        try {
          console.log(
            "[canvas] global pointerup -> finalizing rotation for",
            spline.id
          )
          const el = spline.group
          if (!el) return

          // Now bake the group's transform into the points
          // The group has accumulated the rotation visually, now apply it to coordinates
          const m = el.matrixify?.()
          if (m && spline._rotateStartPoints) {
            console.log("[canvas] baking rotation matrix into points", {
              matrix: m,
              startPointCount: spline._rotateStartPoints.length,
            })
            // Apply the full matrix to the original start points
            applyMatrixToPoints(m, spline._rotateStartPoints, spline.points)
            spline.plot()
            transformOccurred = true
          } else {
            console.warn("[canvas] missing matrix or _rotateStartPoints", {
              hasMatrix: !!m,
              hasStartPoints: !!spline._rotateStartPoints,
            })
          }

          // Reset the group transform so visual matches baked coords
          resetGroupTransform(el)

          // Clear rotate state
          delete spline._rotateIsActive
          delete spline._rotateStartPoints
          delete spline._rotatePivot
          delete spline._rotateStartAngle
          delete spline._rotateLastAngle
          console.log("[canvas] rotation finalized for", spline.id)
        } catch (err) {
          console.error("[canvas] rotation cleanup error:", err)
        }
      }

      // NOTE: We DO NOT clean up resize state here!
      // The resize finalization happens below in the main pointerup handler,
      // after the splineHandler resize END event has finished.
    })

    if (!isDraggingPoint.current) return

    console.log("[canvas] global pointerup -> clearing isDraggingPoint")
    const spline = manager.getSelected()
    if (!spline) {
      isDraggingPoint.current = false
      return
    }
    const el = spline.group
    if (!el) {
      isDraggingPoint.current = false
      return
    }

    // Debug: Log the resize/rotate state flags
    console.log("[canvas] pointerup - spline transform state:", {
      splineId: spline.id,
      hasResizeStartBox: !!spline._resizeStartBox,
      hasResizeStartPoints: !!spline._resizeStartPoints,
      resizeIsActive: spline._resizeIsActive,
      hasRotateStartPoints: !!spline._rotateStartPoints,
      rotateIsActive: spline._rotateIsActive,
    })

    const m = el.matrixify?.()
    if (!m) {
      // nothing to bake; ensure no transform attribute leftover
      resetGroupTransform(el)
      console.log("[spline] bakeGroupTransform: no matrix to bake")
    } else if (
      m.a !== 1 ||
      m.b !== 0 ||
      m.c !== 0 ||
      m.d !== 1 ||
      m.e !== 0 ||
      m.f !== 0
    ) {
      // Matrix has transform - bake it into points
      console.log("[canvas] baking transform into points - matrix:", m)

      // Snapshot the current points before applying transform
      spline._resizeStartPoints = spline.points.map((p) => ({
        x: p.x,
        y: p.y,
      }))

      applyMatrixToPoints(m, spline._resizeStartPoints, spline.points)
      spline.plot()
      transformOccurred = true

      // Reset the group transform so visual matches baked coords
      resetGroupTransform(el)
      console.log("[canvas] transform finalized for spline", spline.id)

      // Ensure resize plugin knows about the reset
      // If we don't do this, the next resize might start from the old transformed box state
      try {
        if (spline.selected) {
          el.resize(false)
          // We don't immediately re-enable resize here because the resize END event
          // in SplineManager will handle re-enabling it.
          // If we enable it here, it might conflict or be redundant.
          // However, we MUST clear the internal state of the resize plugin if possible.
        }
      } catch (e) {
        console.warn("[canvas] error resetting resize plugin", e)
      }
    }

    if (transformOccurred) {
      // Only clear isDraggingPoint AFTER transform is finalized, so events can complete
      isDraggingPoint.current = false
      console.log("[canvas] isDraggingPoint cleared after transform")
    }
  }

  window.addEventListener("pointerup", handleGlobalPointerUp)

  return { handleGlobalPointerUp }
}

/**
 * Sets up background click behavior (clears selection on empty area click)
 */
export function setupBackgroundClickBehavior(
  container,
  splineManager,
  selectionManager,
  selectedRef,
  selectedTool,
  svgObjectManager
) {
  const handleBackgroundClick = (e) => {
    console.log("[Canvas.handleBackgroundClick] Click on container", {
      targetTag: e.target?.tagName,
      tool: selectedTool?.current,
    })
    // CRITICAL: Don't clear selection if in curve mode - let unifiedCanvasClickHandler manage it
    // Also skip clearing if user just created a spline in line/straight mode so next click adds a point
    const manager = splineManager.current
    const justCreatedId = manager?._justCreatedSplineId
    const inEditLineMode =
      selectedTool?.current === "line" || selectedTool?.current === "straight"
    if (
      selectedTool?.current === "curve" ||
      selectedTool?.current === "nurbs" ||
      (inEditLineMode &&
        justCreatedId &&
        manager?.getSelected?.()?.id === justCreatedId)
    ) {
      console.log(
        "[Canvas.handleBackgroundClick] Skipping clear (active edit mode or just created spline)"
      )
      // Clear the suppression after allowing one additive click
      if (inEditLineMode && justCreatedId) {
        // Keep selection; allow next click to add a point
        // Remove flag only AFTER next successful additive click handled elsewhere
        // If user clicks truly empty again (no additive point) we clear below on next event
      }
      return
    }
    const rootSvg = container.querySelector("svg")
    const clickedCanvasBg = e.target?.id === "canvas-bg"
    const isRootSvg = e.target === rootSvg
    if ((isRootSvg || clickedCanvasBg) && e.target != selectedRef.current) {
      console.log("[Canvas.handleBackgroundClick] Clearing selections")
      if (manager) manager._justCreatedSplineId = null
      if (selectedRef.current) {
        selectedRef.current.select(false)
        selectedRef.current.resize(false)
        selectedRef.current = null
      }
      // Clear SplineManager selection
      splineManager.current?.clearSelection?.()
      // Clear SelectionManager multi-selection
      selectionManager.current?.clearSelection?.()
      // Clear imported SVG selection via manager API
      svgObjectManager?.current?.clearSelection?.()
    }
  }

  container.addEventListener("click", handleBackgroundClick)

  return { handleBackgroundClick }
}
