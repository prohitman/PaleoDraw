// src/input/hotkeys/canvasHotkeys.js
/**
 * Canvas and project hotkey bindings
 * Handles: Ctrl+N (New), Ctrl+S (Save), Ctrl+O (Open), Ctrl+E (Export), etc.
 */

import { setupPointHandlers } from "../../handlers/pointHandlers"

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

  // Save project (Ctrl+S)
  hotkeysManager.register(
    "ctrl+s",
    "global",
    () => {
      canvasRef?.current?.saveAsJSON?.()
    },
    "Save project"
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
      console.log("[canvasHotkeys] Undo triggered, context:", {
        hasSplineManager: !!context.splineManager?.current,
        hasSvgObjectManager: !!context.svgObjectManager?.current,
        hasIsDraggingRef: !!context.isDraggingRef,
        isDraggingRefValue: context.isDraggingRef?.current,
        hasSelectedToolRef: !!context.selectedToolRef,
        selectedToolRefValue: context.selectedToolRef?.current,
      })

      const splineManager = context.splineManager?.current
      const svgObjectManager = context.svgObjectManager?.current
      const selectionManager = context.selectionManager?.current
      const historyManager = splineManager?.historyManager

      // Deselect all splines and SVG objects before undo
      if (splineManager && typeof splineManager.clearSelection === "function") {
        splineManager.clearSelection()
      }
      if (
        svgObjectManager &&
        typeof svgObjectManager.clearSelection === "function"
      ) {
        svgObjectManager.clearSelection()
      }
      // Clear multi-selection manager (removes group overlay box)
      if (
        selectionManager &&
        typeof selectionManager.clearSelection === "function"
      ) {
        selectionManager.clearSelection()
      }

      // Get previous state from history manager (single step)
      if (!historyManager) {
        console.log("[canvasHotkeys] History manager not available")
        return
      }

      const state = historyManager.undo()
      if (!state) {
        console.log("[canvasHotkeys] Nothing to undo")
        return
      }

      // Restore splines from state
      if (splineManager && state.splines) {
        splineManager.restoreFromState(state.splines, {
          setupPointHandlers,
          drawRef: context.drawRef,
          selectedToolRef: context.selectedToolRef,
          isDraggingRef: context.isDraggingRef,
        })
        console.log("[canvasHotkeys] Restored splines from state")
      }

      // Restore SVG objects from state
      if (svgObjectManager && state.svgs) {
        svgObjectManager.restoreFromState(state.svgs, {
          drawRef: context.drawRef,
        })
        console.log("[canvasHotkeys] Restored SVG objects from state")
      }
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
      const historyManager = splineManager?.historyManager

      // Deselect all splines and SVG objects before redo
      if (splineManager && typeof splineManager.clearSelection === "function") {
        splineManager.clearSelection()
      }
      if (
        svgObjectManager &&
        typeof svgObjectManager.clearSelection === "function"
      ) {
        svgObjectManager.clearSelection()
      }
      if (
        selectionManager &&
        typeof selectionManager.clearSelection === "function"
      ) {
        selectionManager.clearSelection()
      }

      // Get next state from history manager (single step)
      if (!historyManager) {
        console.log("[canvasHotkeys] History manager not available")
        return
      }

      const state = historyManager.redo()
      if (!state) {
        console.log("[canvasHotkeys] Nothing to redo")
        return
      }

      // Restore splines from state
      if (splineManager && state.splines) {
        splineManager.restoreFromState(state.splines, {
          setupPointHandlers,
          drawRef: context.drawRef,
          selectedToolRef: context.selectedToolRef,
          isDraggingRef: context.isDraggingRef,
        })
        console.log("[canvasHotkeys] Restored splines from state")
      }

      // Restore SVG objects from state
      if (svgObjectManager && state.svgs) {
        svgObjectManager.restoreFromState(state.svgs, {
          drawRef: context.drawRef,
        })
        console.log("[canvasHotkeys] Restored SVG objects from state")
      }
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

  // Escape - finish drawing spline
  hotkeysManager.register(
    "escape",
    "global",
    () => {
      const splineManager = context.splineManager?.current
      const svgObjectManager = context.svgObjectManager?.current
      const pointSelectionManager = context.pointSelectionManager?.current

      splineManager?.finishDrawing?.()
      svgObjectManager?.finishDrawing?.()
      // Clear all selections: splines, SVG objects, and points
      splineManager?.clearSelection?.()
      svgObjectManager?.clearSelection?.()
      pointSelectionManager?.clearSelection?.()

      console.log("[canvasHotkeys] Finish drawing and cleared all selections")
    },
    "Finish drawing spline"
  )
}
