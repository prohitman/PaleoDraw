// src/input/hotkeys/canvasHotkeys.js
/**
 * Canvas, project, and tool switching hotkey bindings
 * Handles: Project ops (Ctrl+N/S/O/E), Tool switching (T/C/L/N/I/P), Undo/Redo, Escape
 */

export function registerCanvasHotkeys(hotkeysManager, context) {
  const { canvasRef } = context

  // New project (Ctrl+N)
  hotkeysManager.register(
    "ctrl+n",
    "global",
    () => {
      if (confirm("Start a new project? Unsaved changes will be lost.")) {
        canvasRef?.current?.newProject?.()
      }
    },
    "New project"
  )

  // Open project (Ctrl+O)
  hotkeysManager.register(
    "ctrl+o",
    "global",
    () => {
      canvasRef?.current?.loadFromJSON?.()
    },
    "Open project"
  )

  // Open Recent (Ctrl+Shift+O)
  hotkeysManager.register(
    "ctrl+shift+o",
    "global",
    () => {
      context.onShowRecentProjects?.()
    },
    "Open recent project"
  )

  // Save project (Ctrl+S)
  hotkeysManager.register(
    "ctrl+s",
    "global",
    () => {
      canvasRef?.current?.saveProject?.()
    },
    "Save project"
  )

  // Save As (Ctrl+Shift+S)
  hotkeysManager.register(
    "ctrl+shift+s",
    "global",
    () => {
      canvasRef?.current?.saveAsJSON?.()
    },
    "Save project as..."
  )

  // Export as SVG (Ctrl+E)
  hotkeysManager.register(
    "ctrl+e",
    "global",
    () => {
      canvasRef?.current?.exportAsSVG?.()
    },
    "Export as SVG"
  )

  // Undo (Ctrl+Z)
  hotkeysManager.register(
    "ctrl+z",
    "global",
    () => {
      const splineManager = context.splineManager?.current
      const svgObjectManager = context.svgObjectManager?.current
      const selectionManager = context.selectionManager?.current
      const pointSelectionManager = context.pointSelectionManager?.current
      const historyManager = splineManager?.historyManager

      if (!historyManager) {
        console.log("[canvasHotkeys] History manager not available")
        return
      }

      // Clear all selections before undo
      splineManager?.clearSelection?.()
      svgObjectManager?.clearSelection?.()
      selectionManager?.clearSelection?.()
      pointSelectionManager?.clearSelection?.()

      // Use convenience method
      historyManager.undoAndRestore()
    },
    "Undo"
  )

  // Redo (Ctrl+Y)
  hotkeysManager.register(
    "ctrl+y",
    "global",
    () => {
      const splineManager = context.splineManager?.current
      const svgObjectManager = context.svgObjectManager?.current
      const selectionManager = context.selectionManager?.current
      const pointSelectionManager = context.pointSelectionManager?.current
      const historyManager = splineManager?.historyManager

      if (!historyManager) {
        console.log("[canvasHotkeys] History manager not available")
        return
      }

      // Clear all selections before redo
      splineManager?.clearSelection?.()
      svgObjectManager?.clearSelection?.()
      selectionManager?.clearSelection?.()
      pointSelectionManager?.clearSelection?.()

      // Use convenience method
      historyManager.redoAndRestore()
    },
    "Redo"
  )

  // Select all (Ctrl+A) - placeholder for future implementation
  hotkeysManager.register(
    "ctrl+a",
    "global",
    () => {
      console.log("[canvasHotkeys] Select all not yet implemented")
    },
    "Select all (not yet implemented)"
  )

  // Escape - hierarchical deselection
  hotkeysManager.register(
    "escape",
    "global",
    () => {
      const splineManager = context.splineManager?.current
      const svgObjectManager = context.svgObjectManager?.current
      const pointSelectionManager = context.pointSelectionManager?.current
      const groupSelectionManager = context.groupSelectionManager?.current

      // Cancel any active drag selection first
      groupSelectionManager?.cancelDragSelection?.()

      // Hierarchical deselection:
      // 1. If points are selected, clear point selection but keep spline selected
      // 2. If no points selected, finish drawing and clear spline/SVG selection
      const hasPointSelection = pointSelectionManager?.hasSelection?.()

      if (hasPointSelection) {
        // Just clear point selections, don't finish drawing or deselect spline
        pointSelectionManager?.clearSelection?.()
        console.log(
          "[canvasHotkeys] Cleared point selection, spline remains selected"
        )
      } else {
        // No points selected, finish drawing and clear everything
        splineManager?.finishDrawing?.()
        svgObjectManager?.finishDrawing?.()
        splineManager?.clearSelection?.()
        svgObjectManager?.clearSelection?.()
        groupSelectionManager?.clearSelection?.()
        console.log("[canvasHotkeys] Cleared all selections")
      }
    },
    "Deselect points or spline"
  )

  // Reverse point direction (R)
  hotkeysManager.register(
    "r",
    "global",
    () => {
      const splineManager = context.splineManager?.current
      splineManager?.togglePointDirection?.()
    },
    "Reverse point addition direction"
  )

  // Tool switching hotkeys
  const { selectedToolRef, onToolChange } = context

  // Select tool (T)
  hotkeysManager.register(
    "t",
    "global",
    () => {
      if (selectedToolRef?.current !== "select") {
        selectedToolRef.current = "select"
        onToolChange?.("select")
      }
    },
    "Activate Select tool"
  )

  // Curve tool (C)
  hotkeysManager.register(
    "c",
    "global",
    () => {
      if (selectedToolRef?.current !== "curve") {
        selectedToolRef.current = "curve"
        onToolChange?.("curve")
      }
    },
    "Activate Curve tool"
  )

  // Line (polyline) tool (L)
  hotkeysManager.register(
    "l",
    "global",
    () => {
      if (selectedToolRef?.current !== "line") {
        selectedToolRef.current = "line"
        onToolChange?.("line")
      }
    },
    "Activate Line (polyline) tool"
  )

  // NURBS tool (N)
  hotkeysManager.register(
    "n",
    "global",
    () => {
      if (selectedToolRef?.current !== "nurbs") {
        selectedToolRef.current = "nurbs"
        onToolChange?.("nurbs")
      }
    },
    "Activate NURBS tool"
  )

  // Import SVG (I)
  hotkeysManager.register(
    "i",
    "global",
    () => {
      context.onImportSVG?.()
    },
    "Import SVG"
  )

  // Pan tool (P)
  hotkeysManager.register(
    "p",
    "global",
    () => {
      if (selectedToolRef?.current !== "pan") {
        selectedToolRef.current = "pan"
        onToolChange?.("pan")
      }
    },
    "Activate Pan tool"
  )
}
