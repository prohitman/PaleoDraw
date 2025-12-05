// src/handlers/pointHandlers.js
/**
 * Point event handlers for spline vertices
 * Handles dragging, deletion (right-click), and visual feedback
 */

import { findNearestSnapPoint } from "../../utils/snapping"
import eventBus from "../../core/EventBus"

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
      if (
        selectedTool?.current !== "curve" &&
        selectedTool?.current !== "line" &&
        selectedTool?.current !== "straight" &&
        selectedTool?.current !== "nurbs"
      ) {
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
    if (
      selectedTool?.current !== "curve" &&
      selectedTool?.current !== "line" &&
      selectedTool?.current !== "straight" &&
      selectedTool?.current !== "nurbs"
    )
      return
    isDraggingRef.current = true

    // Initialize snap visual feedback and snap target
    circle._snapIndicator = null
    circle._snapTarget = null

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

  circle.on("dragmove.curveTool", (e) => {
    if (
      selectedTool?.current !== "curve" &&
      selectedTool?.current !== "line" &&
      selectedTool?.current !== "straight" &&
      selectedTool?.current !== "nurbs"
    )
      return

    let cx = circle.cx()
    let cy = circle.cy()
    const point = spline.points.find((p) => p.circle === circle)

    if (point) {
      // Check for Ctrl key to enable snapping
      if (e?.detail?.event?.ctrlKey) {
        const snapTarget = findNearestSnapPoint(cx, cy, splineManager, point)

        if (snapTarget) {
          // Store snap target for dragend
          circle._snapTarget = snapTarget

          // Update visual position for preview
          cx = snapTarget.x
          cy = snapTarget.y

          // Show visual feedback
          if (!circle._snapIndicator) {
            // Create snap indicator (glow circle on target)
            const draw = splineManager.draw
            circle._snapIndicator = draw
              .circle(12)
              .center(snapTarget.x, snapTarget.y)
              .fill("none")
              .stroke({ color: "#00ff00", width: 2, opacity: 0.8 })
              .addClass("snap-indicator")
          } else {
            // Update existing indicator position
            circle._snapIndicator.center(snapTarget.x, snapTarget.y)
          }

          // CRITICAL: Force the circle to the snap position immediately
          // This must happen during dragmove to override SVG.js positioning
          circle.move(cx - 3, cy - 3) // circle radius is 3, so move accounts for that
        } else {
          // No snap target
          circle._snapTarget = null
          // Remove indicator
          if (circle._snapIndicator) {
            circle._snapIndicator.remove()
            circle._snapIndicator = null
          }
        }
      } else {
        // Ctrl not pressed, remove snap indicator
        if (circle._snapIndicator) {
          circle._snapIndicator.remove()
          circle._snapIndicator = null
        }
      }

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

    // Apply snap target if it exists
    if (circle._snapTarget) {
      const point = spline.points.find((p) => p.circle === circle)
      if (point) {
        point.x = circle._snapTarget.x
        point.y = circle._snapTarget.y
        circle.center(circle._snapTarget.x, circle._snapTarget.y)
        spline.plot()
      }
      circle._snapTarget = null
    }

    // Remove snap indicator if it exists
    if (circle._snapIndicator) {
      circle._snapIndicator.remove()
      circle._snapIndicator = null
    }

    // Batch: Save history only at drag end
    if (
      selectedTool?.current === "curve" ||
      selectedTool?.current === "line" ||
      selectedTool?.current === "straight" ||
      selectedTool?.current === "nurbs"
    ) {
      console.log("[pointHandlers] Dragged point saved to history")
      // Emit event so AutoHistoryPlugin saves to history
      eventBus.emit("point:moved")
    }
    delete pointSelectionManager?._dragStartPoints
  })

  // Handle point deletion via right-click
  circle.on("contextmenu.curveTool", (e) => {
    if (
      selectedTool?.current !== "curve" &&
      selectedTool?.current !== "line" &&
      selectedTool?.current !== "straight" &&
      selectedTool?.current !== "nurbs"
    )
      return

    e.preventDefault()
    e.stopPropagation()

    const point = spline.points.find((p) => p.circle === circle)
    if (point) {
      splineManager.deletePointFromSpline(spline.id, point)
      // History is saved by deletePointFromSpline
    }
  })

  // Add hover effects for visual feedback - handled by CSS .spline-point:hover
  // No manual event listeners needed for color change

  // Shift-click (or plain click) point selection logic for multi-point selection
  // Use pointerdown to ensure selection occurs even when user drags immediately.
  circle.on("pointerdown.pointSelect", (e) => {
    if (
      selectedTool?.current !== "curve" &&
      selectedTool?.current !== "line" &&
      selectedTool?.current !== "straight" &&
      selectedTool?.current !== "nurbs"
    )
      return
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
    if (
      selectedTool?.current !== "curve" &&
      selectedTool?.current !== "line" &&
      selectedTool?.current !== "straight" &&
      selectedTool?.current !== "nurbs"
    )
      return
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

  // Double-click to toggle sharpness (only for NURBS tool)
  circle.on("dblclick.toggleSharpness", (e) => {
    if (selectedTool?.current !== "nurbs") return
    e.preventDefault()
    e.stopPropagation()

    const point = spline.points.find((p) => p.circle === circle)
    if (point) {
      point.isSharp = !point.isSharp
      console.log("[pointHandlers] Toggled sharpness:", point.isSharp)
      spline.plot()
    }
  })
}
