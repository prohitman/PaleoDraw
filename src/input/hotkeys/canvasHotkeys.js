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

      // Perform undo on spline manager (primary manager)
      if (splineManager && typeof splineManager.undo === "function") {
        // Pass context for point handler re-initialization
        const state = splineManager.undo({
          setupPointHandlers,
          drawRef: context.drawRef,
          selectedToolRef: context.selectedToolRef,
          isDraggingRef: context.isDraggingRef,
        })

        if (state) {
          console.log("[canvasHotkeys] Undo executed (splines)")
        } else {
          console.log("[canvasHotkeys] Nothing to undo")
        }
      } else {
        console.log("[canvasHotkeys] Spline manager not available")
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

      // Perform redo on spline manager
      if (splineManager && typeof splineManager.redo === "function") {
        // Pass context for point handler re-initialization
        const drawRef = context.drawRef
        const selectedToolRef = context.selectedToolRef
        const isDraggingRef = context.isDraggingRef

        const state = splineManager.redo({
          setupPointHandlers,
          drawRef,
          selectedToolRef,
          isDraggingRef,
        })

        if (state) {
          console.log("[canvasHotkeys] Redo executed (splines)")
        } else {
          console.log("[canvasHotkeys] Nothing to redo")
        }
      } else {
        console.log("[canvasHotkeys] Spline manager not available")
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

      splineManager?.finishDrawing?.()
      svgObjectManager?.finishDrawing?.()

      console.log("[canvasHotkeys] Finish drawing executed")
    },
    "Finish drawing spline"
  )
}