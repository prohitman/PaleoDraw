// src/input/hotkeys/objectHotkeys.js
/**
 * Object (spline and SVG) hotkey bindings
 * Handles: Delete, Copy/Cut/Paste, Nudge, and Layering for both splines and SVG objects
 * Copy/Cut/Paste delegated to Canvas API for centralized clipboard management
 */

import { selectionOptions } from "../../utils/selectionConfig"

export function registerObjectHotkeys(hotkeysManager, context) {
  const {
    splineManager,
    svgObjectManager,
    selectionManager,
    pointSelectionManager,
    selectedToolRef,
    historyManager,
    canvasRef, // Added to access Canvas API
  } = context

  // Delete selected spline(s) or SVG object(s)
  function deleteSelectedHandler() {
    // Point multi-selection (curve tool) takes priority
    if (
      (selectedToolRef?.current === "curve" ||
        selectedToolRef?.current === "line" ||
        selectedToolRef?.current === "straight" ||
        selectedToolRef?.current === "nurbs") &&
      pointSelectionManager?.current?.hasSelection?.()
    ) {
      pointSelectionManager.current.deleteSelectedPoints()
      // Save history
      if (historyManager?.current) {
        historyManager.current.saveSnapshot(
          splineManager.current,
          svgObjectManager.current
        )
      }
      return
    }
    // Check if SelectionManager has multiple items selected
    if (selectionManager?.current?.hasSelection?.()) {
      selectionManager.current.deleteSelected()
      return
    }

    // Delete selected SVG object if present
    const selectedSvgId = svgObjectManager?.current?.getSelectedId?.()
    if (selectedSvgId) {
      svgObjectManager.current.deleteObject(selectedSvgId)
      // Save history
      if (historyManager?.current) {
        historyManager.current.saveSnapshot(
          splineManager.current,
          svgObjectManager.current
        )
      }
      return
    }

    // Otherwise, delete single selected spline
    const selected = splineManager?.current?.getSelected?.()
    if (selected) {
      splineManager.current.deleteSpline(selected.id)
    }
  }

  hotkeysManager.register(
    "delete",
    "selection",
    deleteSelectedHandler,
    "Delete selected spline or SVG object"
  )

  hotkeysManager.register(
    "backspace",
    "selection",
    deleteSelectedHandler,
    "Delete selected spline or SVG object (alternate)"
  )

  // Copy selected spline or SVG object - delegate to Canvas API
  hotkeysManager.register(
    "ctrl+c",
    "selection",
    () => {
      const tool = selectedToolRef?.current
      const splineSelected = splineManager?.current?.getSelected?.()
      // Allow copy if in select tool OR (tool is curve/line/straight/nurbs and a spline is selected)
      const canCopySpline =
        tool === "select" ||
        ((tool === "curve" ||
          tool === "line" ||
          tool === "straight" ||
          tool === "nurbs") &&
          !!splineSelected)
      if (!canCopySpline) {
        console.log(
          "[Hotkeys] Copy requires selection (select or edit tool with active spline)"
        )
        return
      }

      // Delegate to Canvas copy API
      canvasRef?.current?.copy?.()
    },
    "Copy selected spline or SVG"
  )

  // Cut selected spline or SVG object - delegate to Canvas API
  hotkeysManager.register(
    "ctrl+x",
    "selection",
    () => {
      const tool = selectedToolRef?.current
      const splineSelected = splineManager?.current?.getSelected?.()
      const canCutSpline =
        tool === "select" ||
        ((tool === "curve" ||
          tool === "line" ||
          tool === "straight" ||
          tool === "nurbs") &&
          !!splineSelected)
      if (!canCutSpline) {
        console.log(
          "[Hotkeys] Cut requires selection (select or edit tool with active spline)"
        )
        return
      }

      // Delegate to Canvas cut API
      canvasRef?.current?.cut?.()
    },
    "Cut selected spline or SVG"
  )

  // Paste spline or SVG from clipboard - delegate to Canvas API
  hotkeysManager.register(
    "ctrl+v",
    "global",
    () => {
      // Delegate to Canvas paste API
      canvasRef?.current?.paste?.()
    },
    "Paste spline or SVG from clipboard"
  )

  // Nudge with arrow keys (10px increments)
  hotkeysManager.register(
    "arrowup",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        0,
        -10
      )
    },
    "Nudge selected spline up 10px"
  )

  hotkeysManager.register(
    "arrowdown",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        0,
        10
      )
    },
    "Nudge selected spline down 10px"
  )

  hotkeysManager.register(
    "arrowleft",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        -10,
        0
      )
    },
    "Nudge selected spline left 10px"
  )

  hotkeysManager.register(
    "arrowright",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        10,
        0
      )
    },
    "Nudge selected spline right 10px"
  )

  // Fine nudge with Ctrl+Arrow (1px increments)
  hotkeysManager.register(
    "ctrl+arrowup",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        0,
        -1
      )
    },
    "Fine nudge selected spline up 1px"
  )

  hotkeysManager.register(
    "ctrl+arrowdown",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        0,
        1
      )
    },
    "Fine nudge selected spline down 1px"
  )

  hotkeysManager.register(
    "ctrl+arrowleft",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        -1,
        0
      )
    },
    "Fine nudge selected spline left 1px"
  )

  hotkeysManager.register(
    "ctrl+arrowright",
    "selection",
    () => {
      nudgeSelected(
        splineManager,
        svgObjectManager,
        selectionManager,
        selectedToolRef,
        pointSelectionManager,
        historyManager,
        1,
        0
      )
    },
    "Fine nudge selected spline right 1px"
  )

  // Layering operations
  const handleLayering = (action) => {
    // Try Spline
    const selectedSpline = splineManager?.current?.getSelected?.()
    if (selectedSpline) {
      splineManager.current[action]?.()
      return
    }
    // Try SVG
    const selectedSvgId = svgObjectManager?.current?.getSelectedId?.()
    if (selectedSvgId) {
      svgObjectManager.current[action]?.()
      return
    }
  }

  hotkeysManager.register(
    "ctrl+f",
    "selection",
    () => handleLayering("bringForward"),
    "Bring forward"
  )
  hotkeysManager.register(
    "ctrl+shift+f",
    "selection",
    () => handleLayering("bringToFront"),
    "Bring to front"
  )
  hotkeysManager.register(
    "ctrl+b",
    "selection",
    () => handleLayering("sendBackward"),
    "Send backward"
  )
  hotkeysManager.register(
    "ctrl+shift+b",
    "selection",
    () => handleLayering("sendToBack"),
    "Send to back"
  )
}

/**
 * Helper function to nudge selected items by offset
 * Supports single splines, multi-selection, and SVG objects
 * @param {Object} splineManagerRef - Reference to SplineManager
 * @param {Object} svgObjectManagerRef - Reference to SVGObjectManager
 * @param {Object} selectionManagerRef - Reference to SelectionManager
 * @param {Object} historyManagerRef - Reference to HistoryManager
 * @param {number} dx - X offset
 * @param {number} dy - Y offset
 */
function nudgeSelected(
  splineManagerRef,
  svgObjectManagerRef,
  selectionManagerRef,
  selectedToolRefRef,
  pointSelectionManagerRef,
  historyManagerRef,
  dx,
  dy
) {
  const splineManager = splineManagerRef?.current
  const svgObjectManager = svgObjectManagerRef?.current
  const selectionManager = selectionManagerRef?.current
  const pointSelectionManager = pointSelectionManagerRef?.current
  const historyManager = historyManagerRef?.current

  // Point multi-selection first (curve or line tool)
  if (
    (selectedToolRefRef?.current === "curve" ||
      selectedToolRefRef?.current === "line" ||
      selectedToolRefRef?.current === "straight" ||
      selectedToolRefRef?.current === "nurbs") &&
    pointSelectionManager?.hasSelection?.()
  ) {
    pointSelectionManager.moveSelectedPoints(dx, dy)
    if (historyManager) {
      historyManager.saveSnapshot(splineManager, svgObjectManager)
    }
    return
  }

  // Check for multi-selection first
  if (selectionManager?.hasSelection?.()) {
    selectionManager.moveSelected(dx, dy)

    // Save to history
    if (historyManager) {
      historyManager.saveSnapshot(splineManager, svgObjectManager)
    }

    console.log(`[nudgeSelected] Moved multi-selection by dx:${dx}, dy:${dy}`)
    return
  }

  // Try single spline
  const selectedSpline = splineManager?.getSelected?.()
  if (selectedSpline?.points) {
    // Use SplineManager method instead of direct point manipulation
    splineManager.moveSplinePoints(selectedSpline.id, dx, dy)

    // Update selection box position if visible
    if (selectedToolRefRef?.current === "select") {
      splineManager.updateSplineSelectionBox(
        selectedSpline.id,
        selectionOptions
      )
    }

    // Save to history
    if (historyManager) {
      historyManager.saveSnapshot(splineManager, svgObjectManager)
    }

    console.log(
      `[nudgeSelected] Moved spline ${selectedSpline.id} by dx:${dx}, dy:${dy}`
    )
    return
  }

  // Try SVG object
  const selectedSvgId = svgObjectManager?.getSelectedId?.()
  if (selectedSvgId) {
    const obj = svgObjectManager.getObject(selectedSvgId)
    if (obj) {
      // Prepare local deltas (will adjust if transform present)
      let tdx = dx
      let tdy = dy
      try {
        // Convert global delta (dx,dy) into the object's local coordinate space
        if (typeof obj.ctm === "function") {
          try {
            const ctm = obj.ctm()
            if (ctm && typeof ctm.inverse === "function") {
              const inv = ctm.inverse()
              if (inv && typeof inv.transformPoint === "function") {
                const local = inv.transformPoint({ x: dx, y: dy })
                tdx = local.x
                tdy = local.y
              } else {
                // Fallback manual inverse application if transformPoint not available
                // Using matrix components (a,b,c,d,e,f) of inverse as linear part
                if (inv && typeof inv.a === "number") {
                  const lx = inv.a * dx + inv.c * dy
                  const ly = inv.b * dx + inv.d * dy
                  tdx = lx
                  tdy = ly
                }
              }
            }
          } catch {
            // Ignore CTM conversion errors; keep raw dx/dy
          }
        }
        if (typeof obj.dmove === "function") {
          obj.dmove(tdx, tdy)
        } else {
          const currentX = obj.x?.() || obj.bbox?.().x || 0
          const currentY = obj.y?.() || obj.bbox?.().y || 0
          obj.move(currentX + tdx, currentY + tdy)
        }
        // Remove lingering selection box after nudge
        if (obj.node) {
          const selBox = obj.node.querySelector(".svg-select-box")
          if (selBox) selBox.remove()
        }
        obj.select?.(false)
        obj.resize?.(false)
        setTimeout(() => {
          obj.select?.(selectionOptions)
          obj.resize?.({ rotationPoint: true })
        }, 0)
      } catch (moveErr) {
        console.warn("[Hotkeys] Failed to move SVG object", moveErr)
      }

      // Save to history
      if (historyManager) {
        historyManager.saveSnapshot(splineManager, svgObjectManager)
      }

      console.log(
        `[nudgeSelected] Moved SVG object ${selectedSvgId} by dx:${dx}, dy:${dy} (local applied: ${tdx}, ${tdy})`
      )
    }
  }
}
