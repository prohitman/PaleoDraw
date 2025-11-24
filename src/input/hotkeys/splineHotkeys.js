// src/input/hotkeys/splineHotkeys.js
/**
 * Spline-specific hotkey bindings
 * Handles: Delete spline, Copy, Paste, Duplicate
 * Also supports imported SVG objects
 */

// Clipboard for spline/SVG copy/cut operations
let clipboard = null
let clipboardType = null // 'spline' or 'svg'

export function registerSplineHotkeys(hotkeysManager, context) {
  const {
    splineManager,
    svgObjectManager,
    selectionManager,
    pointSelectionManager,
    selectedToolRef,
    historyManager,
    drawRef,
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
      const splineData =
        splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager.current?.getState?.() || []
      historyManager?.current?.pushState(splineData, svgData)
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
      const splineData =
        splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager.current?.getState?.() || []
      historyManager?.current?.pushState(splineData, svgData)
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

  // Copy selected spline or SVG object (select tool OR an active editing tool with a selected spline)
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

      // Try spline first (priority if selected)
      const selectedSpline = splineManager?.current?.getSelected?.()
      if (selectedSpline) {
        clipboard = selectedSpline.toJSON()
        clipboardType = "spline"
        console.log("[Hotkeys] Copied spline:", selectedSpline.id)
        return
      }

      // Try SVG object
      const selectedSvgId = svgObjectManager?.current?.getSelectedId?.()
      if (selectedSvgId) {
        const selectedSvgObj = svgObjectManager.current.getObject(selectedSvgId)
        if (selectedSvgObj) {
          clipboard = {
            svg: selectedSvgObj.svg?.(),
            transform: selectedSvgObj.transform?.(),
          }
          clipboardType = "svg"
          console.log("[Hotkeys] Copied SVG object:", selectedSvgId)
          return
        }
      }

      console.log("[Hotkeys] Nothing selected to copy")
    },
    "Copy selected spline or SVG"
  )

  // Cut selected spline or SVG object (select tool OR active edit tool with selected spline)
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

      // Try spline first
      const selectedSpline = splineManager?.current?.getSelected?.()
      if (selectedSpline) {
        clipboard = selectedSpline.toJSON()
        clipboardType = "spline"
        splineManager.current.deleteSpline(selectedSpline.id)

        // Save history after cut
        const splineData =
          splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) || []
        const svgData = svgObjectManager.current?.getState?.() || []
        historyManager?.current?.pushState(splineData, svgData)

        console.log("[Hotkeys] Cut spline:", selectedSpline.id)
        return
      }

      // Try SVG object
      const selectedSvgId = svgObjectManager?.current?.getSelectedId?.()
      if (selectedSvgId) {
        const selectedSvgObj = svgObjectManager.current.getObject(selectedSvgId)
        if (selectedSvgObj) {
          clipboard = {
            svg: selectedSvgObj.svg?.(),
            transform: selectedSvgObj.transform?.(),
          }
          clipboardType = "svg"
          svgObjectManager.current.deleteObject(selectedSvgId)

          // Save history after cut
          const splineData =
            splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) ||
            []
          const svgData = svgObjectManager.current?.getState?.() || []
          historyManager?.current?.pushState(splineData, svgData)

          console.log("[Hotkeys] Cut SVG object:", selectedSvgId)
          return
        }
      }

      console.log("[Hotkeys] Nothing selected to cut")
    },
    "Cut selected spline or SVG"
  )

  // Paste spline or SVG from clipboard
  hotkeysManager.register(
    "ctrl+v",
    "global",
    () => {
      if (!clipboard) {
        console.log("[Hotkeys] Nothing to paste")
        return
      }

      if (clipboardType === "spline" && splineManager?.current) {
        const manager = splineManager.current
        // Don't auto-select the new spline, keep original selected
        const newSpline = manager.createSpline(false)

        // Load the clipboard data, but don't overwrite the new spline's ID
        const clipboardData = { ...clipboard, id: newSpline.id }
        newSpline.loadFromJSON(clipboardData)

        // Offset the pasted spline slightly so it's not directly on top
        const offsetX = 20
        const offsetY = 20

        // Update point coordinates to reflect the offset
        // Don't use group.translate() as it creates a visual transform without updating data coordinates
        newSpline.points.forEach((p) => {
          p.x += offsetX
          p.y += offsetY
          if (p.circle) p.circle.center(p.x, p.y)
        })
        newSpline.plot()

        // Ensure pasted spline is NOT selected - set selected field to false
        newSpline.setSelected(false)

        // Save history after paste
        const splineData =
          manager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
        const svgData = svgObjectManager.current?.getState?.() || []
        historyManager?.current?.pushState(splineData, svgData)

        console.log("[Hotkeys] Pasted spline:", newSpline.id)
        manager.emit("change")
      } else if (clipboardType === "svg" && svgObjectManager?.current) {
        try {
          const draw = drawRef?.current
          if (!draw) {
            console.warn("[Hotkeys] Cannot paste SVG: drawRef missing")
            return
          }
          const group = draw.group().svg(clipboard.svg)
          if (clipboard.transform) {
            try {
              group.transform(clipboard.transform)
            } catch {
              // ignore transform errors
            }
          }
          // Offset pasted SVG slightly
          const bbox = group.bbox?.()
          if (bbox) {
            group.move(bbox.x + 20, bbox.y + 20)
          }

          // Attach selection, resize, and click handlers (same as import logic)
          group.draggable()
          group.on("dragstart", () => {
            if (svgObjectManager.current.getSelected() === group) {
              group.select(false)
              group.resize(false)
              svgObjectManager.current.clearSelection()
            }
          })
          group.on("dragend", () => {
            if (svgObjectManager.current.getSelected() === group) {
              try {
                group.select(false)
                group.resize(false)
                setTimeout(() => {
                  group.select(true)
                  group.resize({ rotationPoint: true })
                  svgObjectManager.current.selectObject(group._objectId)
                }, 0)
              } catch (err) {
                console.warn("[Hotkeys] SVG dragend reselection error:", err)
              }
            }
            // Save to history after drag end
            const splineData =
              splineManager.current
                ?.getAllSplines?.()
                ?.map((s) => s.toJSON()) || []
            const svgData = svgObjectManager.current?.getState?.() || []
            historyManager?.current?.pushState(splineData, svgData)
          })
          group.on("resize", () => {
            if (!group._resizingActive) group._resizingActive = true
            clearTimeout(group._resizeTimeout)
            group._resizeTimeout = setTimeout(() => {
              group._resizingActive = false
              // Save to history after resize end
              const splineData =
                splineManager.current
                  ?.getAllSplines?.()
                  ?.map((s) => s.toJSON()) || []
              const svgData = svgObjectManager.current?.getState?.() || []
              historyManager?.current?.pushState(splineData, svgData)
            }, 150)

            clearTimeout(group._refreshTimeout)
            group._refreshTimeout = setTimeout(() => {
              if (svgObjectManager.current.getSelected() === group) {
                group.select(false)
                group.resize(false)
                group.select(true)
                group.resize({ rotationPoint: true })
              }
            }, 1)
          })
          group.on("click", (ev) => {
            ev.stopPropagation()
            svgObjectManager.current.selectObject(group._objectId)
          })

          svgObjectManager.current.addObject(group)

          // Save history after paste
          const splineData =
            splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) ||
            []
          const svgData = svgObjectManager.current?.getState?.() || []
          historyManager?.current?.pushState(splineData, svgData)
          console.log("[Hotkeys] Pasted SVG object with handlers attached")
        } catch (err) {
          console.error("[Hotkeys] Error pasting SVG object", err)
        }
      } else {
        console.log(
          "[Hotkeys] Clipboard type mismatch or manager not available"
        )
      }
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
      const splineData =
        splineManager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager?.getState?.() || []
      historyManager.pushState(splineData, svgData)
    }
    return
  }

  // Check for multi-selection first
  if (selectionManager?.hasSelection?.()) {
    selectionManager.moveSelected(dx, dy)

    // Save to history
    if (historyManager) {
      const splineData =
        splineManager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager?.getState?.() || []
      historyManager.pushState(splineData, svgData)
    }

    console.log(`[nudgeSelected] Moved multi-selection by dx:${dx}, dy:${dy}`)
    return
  }

  // Try single spline
  const selectedSpline = splineManager?.getSelected?.()
  if (selectedSpline?.points) {
    // Directly move all points instead of using group transform
    selectedSpline.points.forEach((point) => {
      point.x += dx
      point.y += dy
      if (point.circle) {
        point.circle.center(point.x, point.y)
      }
    })
    selectedSpline.plot()

    // Update selection box position if visible
    if (
      selectedSpline.group &&
      typeof selectedSpline.group.select === "function"
    ) {
      // Re-apply selection to update the box position
      // We need to briefly deselect and reselect or force update if the library supports it
      // svg.select.js usually updates on resize/drag but not manual point changes
      // A quick toggle forces a redraw of the selection box
      try {
        // Only toggle if currently selected visually
        if (selectedToolRefRef?.current === "select") {
          selectedSpline.group.select(false)
          selectedSpline.group.select(true)
        }
      } catch (e) {
        // ignore
      }
    }

    // Save to history
    if (historyManager) {
      const splineData = splineManager.getAllSplines().map((s) => s.toJSON())
      const svgData = svgObjectManager?.getState?.() || []
      historyManager.pushState(splineData, svgData)
    }

    splineManager.emit("change")
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
          obj.select?.({ rotationPoint: true })
          obj.resize?.({ rotationPoint: true })
        }, 0)
      } catch (moveErr) {
        console.warn("[Hotkeys] Failed to move SVG object", moveErr)
      }

      // Save to history
      if (historyManager) {
        const splineData =
          splineManager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
        const svgData = svgObjectManager.getState()
        historyManager.pushState(splineData, svgData)
      }

      console.log(
        `[nudgeSelected] Moved SVG object ${selectedSvgId} by dx:${dx}, dy:${dy} (local applied: ${tdx}, ${tdy})`
      )
    }
  }
}
