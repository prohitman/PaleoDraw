// src/handlers/pointHandlers.js
/**
 * Point event handlers for spline vertices
 * Handles dragging, deletion (right-click), and visual feedback
 */

export function setupPointHandlers(
  circle,
  spline,
  isDraggingRef,
  splineManager,
  selectedTool,
  historyManager
) {
  if (!circle) return

  circle.draggable()

  // Prevent dragging in non-curve mode
  const bindDragControl = () => {
    circle.off("beforedrag.toolcheck")
    circle.on("beforedrag.toolcheck", (e) => {
      if (selectedTool?.current !== "curve") {
        e.preventDefault()
      }
    })
  }

  bindDragControl()
  circle.bindDragControl = bindDragControl

  // Handle point dragging
  circle.on("dragstart.curveTool", () => {
    console.log("[pointHandlers] dragstart fired", {
      selectedTool: selectedTool?.current,
    })
    if (selectedTool?.current !== "curve") return
    isDraggingRef.current = true
  })

  circle.on("dragmove.curveTool", () => {
    if (selectedTool?.current !== "curve") return

    const cx = circle.cx()
    const cy = circle.cy()
    const point = spline.points.find((p) => p.circle === circle)

    if (point) {
      point.x = cx
      point.y = cy
      spline.plot()
    }
  })

  circle.on("dragend.curveTool", () => {
    console.log("[pointHandlers] dragend fired", {
      selectedTool: selectedTool?.current,
      hasHistoryManager: !!historyManager,
      isCurveTool: selectedTool?.current === "curve",
    })
    isDraggingRef.current = false
    // Batch: Save history only at drag end
    if (selectedTool?.current === "curve" && historyManager) {
      const splineData = splineManager.getAllSplines().map((s) => s.toJSON())
      historyManager.pushState(splineData, [])
      console.log("[pointHandlers] Dragged point saved to history")
    }
  })

  // Handle point deletion via right-click
  circle.on("contextmenu.curveTool", (e) => {
    if (selectedTool?.current !== "curve") return

    e.preventDefault()
    e.stopPropagation()

    const point = spline.points.find((p) => p.circle === circle)
    if (point) {
      splineManager.deletePointFromSpline(spline.id, point)
      // History is saved by deletePointFromSpline
    }
  })

  // Add hover effects for visual feedback - inner white circle on hover (same size)
  const originalFill = circle.fill()
  const hoverFill = "#ffffff" // white for hover

  circle.on("mouseover.pointHover", () => {
    circle.fill(hoverFill)
    // Keep same radius as original, just change color to white
  })

  circle.on("mouseout.pointHover", () => {
    circle.fill(originalFill)
  })
}
