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
  pointSelectionManager,
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

    // If multi-point selection active and this point is selected, snapshot all selected points
    if (pointSelectionManager?.hasSelection?.()) {
      const pointIndex = spline.points.findIndex((p) => p.circle === circle)
      const key = `${spline.id}_${pointIndex}`
      if (pointSelectionManager.selectedPoints.has(key)) {
        pointSelectionManager._dragStartPoints = {}
        pointSelectionManager
          .getSelectedPointsData()
          .forEach(({ splineId, pointIndex: idx, point }) => {
            pointSelectionManager._dragStartPoints[`${splineId}_${idx}`] = {
              x: point.x,
              y: point.y,
            }
          })
      }
    }
  })

  circle.on("dragmove.curveTool", () => {
    if (selectedTool?.current !== "curve") return

    const cx = circle.cx()
    const cy = circle.cy()
    const point = spline.points.find((p) => p.circle === circle)

    if (point) {
      point.x = cx
      point.y = cy
      // If multi-selection drag, move all other selected points by same delta
      if (pointSelectionManager?._dragStartPoints) {
        const pointIndex = spline.points.findIndex((p) => p.circle === circle)
        const key = `${spline.id}_${pointIndex}`
        const start = pointSelectionManager._dragStartPoints[key]
        if (start) {
          const dx = point.x - start.x
          const dy = point.y - start.y
          const affectedSplines = new Set()
          Object.entries(pointSelectionManager._dragStartPoints).forEach(
            ([k, pos]) => {
              if (k === key) return // already updated
              const [spId, idx] = k.split("_")
              const sp = splineManager.getSpline(spId)
              const pt = sp?.points?.[parseInt(idx)]
              if (!sp || !pt) return
              pt.x = pos.x + dx
              pt.y = pos.y + dy
              pt.circle?.center(pt.x, pt.y)
              affectedSplines.add(spId)
            }
          )
          // Replot affected splines including current
          affectedSplines.add(spline.id)
          affectedSplines.forEach((sid) => {
            const sp = splineManager.getSpline(sid)
            sp?.plot?.()
          })
          return
        }
      }
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
    delete pointSelectionManager?._dragStartPoints
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

  // Shift-click (or plain click) point selection logic for multi-point selection
  // Use pointerdown to ensure selection occurs even when user drags immediately.
  circle.on("pointerdown.pointSelect", (e) => {
    if (selectedTool?.current !== "curve") return
    const additive = e.shiftKey
    const pointIndex = spline.points.findIndex((p) => p.circle === circle)
    if (pointIndex === -1) return
    if (pointSelectionManager) {
      console.log("[pointHandlers] pointerdown pointSelect", {
        splineId: spline.id,
        pointIndex,
        additive,
      })
      pointSelectionManager.selectPoint(spline.id, pointIndex, additive)
    }
  })

  // Keep click as fallback (no shift) if user just clicks.
  circle.on("click.pointSelect", (e) => {
    if (selectedTool?.current !== "curve") return
    if (e.shiftKey) return // already handled by pointerdown
    const pointIndex = spline.points.findIndex((p) => p.circle === circle)
    if (pointIndex === -1) return
    if (pointSelectionManager) {
      console.log("[pointHandlers] click pointSelect (fallback)", {
        splineId: spline.id,
        pointIndex,
      })
      pointSelectionManager.selectPoint(spline.id, pointIndex, false)
    }
  })
}
