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
  } = context

  // Delete selected spline(s) - supports both single and multi-selection
  hotkeysManager.register(
    "delete",
    "selection",
    () => {
      // Point multi-selection (curve tool) takes priority
      if (
        selectedToolRef?.current === "curve" &&
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

      // Otherwise, delete single selected spline
      const selected = splineManager?.current?.getSelected?.()
      if (selected) {
        splineManager.current.deleteSpline(selected.id)
      }
    },
    "Delete selected spline"
  )

  // Backspace as alternative to Delete
  hotkeysManager.register(
    "backspace",
    "selection",
    () => {
      if (
        selectedToolRef?.current === "curve" &&
        pointSelectionManager?.current?.hasSelection?.()
      ) {
        pointSelectionManager.current.deleteSelectedPoints()
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

      // Otherwise, delete single selected spline
      const selected = splineManager?.current?.getSelected?.()
      if (selected) {
        splineManager.current.deleteSpline(selected.id)
      }
    },
    "Delete selected spline (alternate)"
  )

  // Copy selected spline or SVG object (only in select tool)
  hotkeysManager.register(
    "ctrl+c",
    "selection",
    () => {
      // Only allow copy in select tool
      if (selectedToolRef?.current !== "select") {
        console.log("[Hotkeys] Copy only available in select tool")
        return
      }

      // Try spline first
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

  // Cut selected spline or SVG object (only in select tool)
  hotkeysManager.register(
    "ctrl+x",
    "selection",
    () => {
      // Only allow cut in select tool
      if (selectedToolRef?.current !== "select") {
        console.log("[Hotkeys] Cut only available in select tool")
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
        // SVG paste - the Canvas component should handle this with drawRef
        // For now, log that we have SVG data and need Canvas integration
        console.log("[Hotkeys] SVG paste copied, ready to paste")
        console.log("[Hotkeys] SVG clipboard data available:", !!clipboard?.svg)
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

  // Point multi-selection first (curve tool)
  if (
    selectedToolRefRef?.current === "curve" &&
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
    const obj = svgObjectManager.getObjectById(selectedSvgId)
    if (obj?.element) {
      const currentX = obj.element.x() || 0
      const currentY = obj.element.y() || 0
      obj.element.move(currentX + dx, currentY + dy)

      // Save to history
      if (historyManager) {
        const splineData =
          splineManager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
        const svgData = svgObjectManager.getState()
        historyManager.pushState(splineData, svgData)
      }

      console.log(
        `[nudgeSelected] Moved SVG object ${selectedSvgId} by dx:${dx}, dy:${dy}`
      )
    }
  }
}
