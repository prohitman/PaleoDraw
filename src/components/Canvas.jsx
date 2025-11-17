// Canvas.jsx
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react"
import { SVG } from "@svgdotjs/svg.js"
import {
  createSpline,
  addPointToSpline,
  drawOrUpdateSpline,
  setupPointHandlers,
  insertPointByProximity,
  updateSplineVisualState,
  finishActiveSpline,
  setupSplineTransformations,
  updateSplinesOnToolChange,
} from "../handlers/splineHandler"
import {
  createNewProject,
  getProjectJSON,
  saveAsJSON,
  loadFromJSON,
  exportAsSVG,
} from "../handlers/projectHandler"
import {
  drawGrid,
  updateGridLineThickness,
  resetGroupTransform,
  fitToCanvas as fitToCanvasHelper,
} from "../utils/svgHelpers"
import { applyMatrixToPoints } from "../utils/transform"
import "@svgdotjs/svg.panzoom.js"
import "@svgdotjs/svg.select.js"
import "@svgdotjs/svg.resize.js"
import "@svgdotjs/svg.draggable.js"

const Canvas = forwardRef(({ zoomSignal, selectedTool }, ref) => {
  const canvasRef = useRef(null)
  const drawRef = useRef(null)
  const gridRef = useRef(null)
  const svgObjects = useRef([]) // imported arbitrary SVG groups
  const selectedRef = useRef(null) // currently selected imported SVG (not splines)
  const splinesRef = useRef([]) // array of spline objects (with group, path, points)
  const activeSplineRef = useRef(null)
  const isDraggingPoint = useRef(false)
  const panZoomRef = useRef(null)
  const splineTransformRef = useRef(null) // store api returned by setupSplineTransformations

  const isPanning = useRef(false)
  const isShiftPressed = useRef(false)

  const initialGridSize = 25
  const initialCanvasWidth = 1200
  const initialCanvasHeight = 800

  const gridSizeRef = useRef(initialGridSize)
  const canvasSizeRef = useRef({
    width: initialCanvasWidth,
    height: initialCanvasHeight,
  })

  const panZoomOptionsRef = useRef({
    panning: true,
    pinchZoom: true,
    wheelZoom: false,
    panButton: 0,
    oneFingerPan: false,
    zoomFactor: 0.1,
    zoomMin: 0.2,
    zoomMax: 5,
  })

  const ZOOM_SMOOTHNESS = 0.05
  const GRID_BASE_THICKNESS = 0.5

  // ---------- Initialize SVG draw, grid, pan/zoom, and main handlers ----------
  useEffect(() => {
    const container = canvasRef.current
    if (!container) return

    const width = canvasSizeRef.current.width || container.clientWidth
    const height = canvasSizeRef.current.height || container.clientHeight
    canvasSizeRef.current = { width, height }

    const draw = SVG()
      .addTo(container)
      .size(width, height)
      .viewbox(0, 0, width, height)
    drawRef.current = draw

    const bg = draw.rect(width, height).fill("#222").id("canvas-bg")
    bg.node.style.pointerEvents = "none"

    // grid
    const grid = draw.group().id("canvas-grid")
    gridRef.current = grid

    grid._drawGrid = (gSize = gridSizeRef.current) =>
      drawGrid(grid, canvasSizeRef.current, gSize)
    grid._drawGrid(gridSizeRef.current)

    // pan/zoom
    panZoomRef.current = draw.panZoom(panZoomOptionsRef.current)
    draw.on("panning", (e) => {
      if (selectedTool && selectedTool.current !== "select") {
        e.preventDefault()
      }
    })

    // initialize spline transformation API (it attaches background deselect, and attachToAll will be called when splines exist)
    splineTransformRef.current = setupSplineTransformations(
      draw,
      splinesRef,
      selectedTool,
      isDraggingPoint
    )

    // --- handle adding spline points by clicking the canvas ---
    const handleBSplineClick = (e) => {
      if (!selectedTool?.current) return
      if (selectedTool.current !== "curve" || isDraggingPoint.current) return

      const draw = drawRef.current
      const { x, y } = draw.point(e.clientX, e.clientY)

      if (
        e.altKey &&
        activeSplineRef.current &&
        activeSplineRef.current.selected
      ) {
        insertPointByProximity(
          drawRef,
          activeSplineRef.current,
          x,
          y,
          isDraggingPoint,
          splinesRef,
          activeSplineRef,
          selectedTool
        )
        // ensure newly inserted spline point has handlers, and transform bindings exist
        splineTransformRef.current?.attachToAll?.()
        return
      }

      if (e.target.tagName === "path" || e.target.tagName === "circle") return

      // Start new spline if none active
      if (!activeSplineRef.current) {
        const newSpline = createSpline(
          draw,
          selectedTool,
          drawRef,
          isDraggingPoint,
          splinesRef,
          activeSplineRef
        )

        splinesRef.current.push(newSpline)
        activeSplineRef.current = newSpline

        // Attach transform handlers to the new spline group
        // setupSplineTransformations attaches click/select handlers via attachToAll
        splineTransformRef.current?.attachToAll?.()
      }

      const spline = activeSplineRef.current
      if (!spline || spline.selected === false) return

      // Use addPointToSpline so circle created inside the spline.group
      try {
        // addPointToSpline is imported from handler and sets up handlers/updates path
        addPointToSpline(
          drawRef.current,
          spline,
          x,
          y,
          isDraggingPoint,
          splinesRef,
          activeSplineRef,
          selectedTool
        )
      } catch (err) {
        // fallback: create circle inside group and set handlers
        const circle = spline.group.circle(6).fill("#ffcc00").center(x, y)
        spline.points.push({ x, y, circle })
        setupPointHandlers(
          circle,
          spline,
          isDraggingPoint,
          splinesRef,
          activeSplineRef,
          selectedTool
        )
        drawOrUpdateSpline(spline)
        updateSplineVisualState(spline)
      }

      // ensure transforms attached
      splineTransformRef.current?.attachToAll?.()
    }

    container.addEventListener("click", handleBSplineClick)
    container.addEventListener("contextmenu", (e) => e.preventDefault())

    // wheel zoom
    const handleWheel = (e) => {
      e.preventDefault()
      const direction = e.deltaY < 0 ? "in" : "out"
      const zoomStep =
        direction === "in" ? 1 + ZOOM_SMOOTHNESS : 1 - ZOOM_SMOOTHNESS
      const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5)
      const point = draw.point(e.offsetX, e.offsetY)
      const panZoom = panZoomRef.current
      if (panZoom && typeof panZoom.zoom === "function") {
        panZoom.zoom(newZoom, point)
      } else {
        draw.zoom(newZoom)
      }
      updateGridThickness(newZoom)
    }
    container.addEventListener("wheel", handleWheel)

    // pan cursor behavior
    const handleMouseDown = (e) => {
      if (
        selectedRef.current?._isResizing ||
        (e.target &&
          e.target.classList &&
          (e.target.classList.contains("svg_select_handle") ||
            e.target.classList.contains("svg_select_shape"))) ||
        (e.target &&
          e.target.closest &&
          e.target.closest(".svg_select_boundingRect"))
      )
        return
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

    // Clear dragging flag if pointer is released anywhere
    const handleGlobalPointerUp = () => {
      // Process all splines, not just selected one, to handle rotation cleanup
      ;(splinesRef.current || []).forEach((spline) => {
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
              drawOrUpdateSpline(spline)
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
      const spline = splineTransformRef.current?.getSelected?.()
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
        isDraggingPoint.current = false
        return
      }

      // CRITICAL: Check if this is a rotation or a resize
      // Rotations have _rotateStartPoints, resizes don't
      const wasRotation = !!spline._rotateStartPoints

      if (wasRotation) {
        // Rotation: apply full affine matrix to points
        try {
          console.log("[canvas] applying rotation matrix to points", {
            splineId: spline.id,
            matrix: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f },
            srcPointCount: spline._rotateStartPoints.length,
          })

          applyMatrixToPoints(m, spline._rotateStartPoints, spline.points)
        } catch (err) {
          console.error("[canvas] rotation bake error:", err)
        } finally {
          drawOrUpdateSpline(spline)
          resetGroupTransform(el)
          delete spline._rotateStartPoints
          delete spline._rotateIsActive
          isDraggingPoint.current = false
        }
        return
      }

      // Non-rotation resize: Points have been scaled during MOVE phase via e.preventDefault()
      // We just need to clean up the state and redraw the final path
      try {
        console.log(
          "[canvas] non-rotation resize finalization - cleaning up after manual scaling",
          {
            splineId: spline.id,
          }
        )

        // Points are already scaled and positioned correctly from MOVE phase
        // Just ensure path reflects final point positions
        drawOrUpdateSpline(spline)

        // Refresh the selection UI by re-selecting the spline
        // This updates the selection box to reflect the new bounding box after scaling
        try {
          el.select(false)
          setTimeout(() => {
            el.select(true)
            el.resize({ rotationPoint: true })
          }, 0)
        } catch (err) {
          console.warn("[canvas] failed to refresh selection UI:", err)
        }
      } catch (err) {
        console.error("[canvas] resize finalization error:", err)
      } finally {
        // cleanup all resize/rotate state
        delete spline._resizeStartBox
        delete spline._resizeStartPoints
        delete spline._resizePointsAlreadyUpdated
        delete spline._resizePointsScaled

        // Clear the group transform (should be identity since we used preventDefault)
        resetGroupTransform(el)
        isDraggingPoint.current = false
      }
    }
    window.addEventListener("pointerup", handleGlobalPointerUp)

    container.addEventListener("mousedown", handleMouseDown)
    container.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("mouseleave", handleMouseLeave)
    container.addEventListener("mousemove", handleMouseMove)

    // Deselect on empty click -> also ensure splineTransform API clears selection
    const handleBackgroundClick = (e) => {
      if (
        e.target === container.querySelector("svg") &&
        e.target != selectedRef.current
      ) {
        if (selectedRef.current) {
          selectedRef.current.select(false)
          selectedRef.current.resize(false)
          selectedRef.current = null
        }
        // also clear selected spline if any (API from setupSplineTransformations)
        splineTransformRef.current?.clearSelection?.()
      }
    }
    container.addEventListener("click", handleBackgroundClick)

    fitToCanvas()

    // cleanup
    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("mousedown", handleMouseDown)
      container.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("mouseleave", handleMouseLeave)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("click", handleBackgroundClick)
      container.removeEventListener("click", handleBSplineClick)
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      draw.remove()
    }
  }, []) // run once

  // Remove the separate effect that tried to re-run setupSplineTransformations based on ref length.
  // Instead we'll call splineTransformRef.current.attachToAll() explicitly when splines are created / loaded.

  // When tool switches away from curve, hide all spline points
  useEffect(() => {
    if (!splinesRef.current?.length) return
    if (selectedTool.current !== "curve") {
      splinesRef.current.forEach((spline) => {
        spline.selected = false
        updateSplineVisualState(spline)
      })
    }
  }, [selectedTool])

  // dblclick / escape: finish current spline
  useEffect(() => {
    const handleDblClick = () => {
      if (selectedTool.current === "curve") {
        finishActiveSpline(activeSplineRef)
        // ensure transform selection cleared too
        splineTransformRef.current?.clearSelection?.()
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        finishActiveSpline(activeSplineRef)
        // ensure transform selection cleared too
        splineTransformRef.current?.clearSelection?.()
      }
    }

    window.addEventListener("dblclick", handleDblClick)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("dblclick", handleDblClick)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // grid thickness helper
  const updateGridThickness = (zoom) =>
    updateGridLineThickness(gridRef.current, zoom)

  // Shift key behavior: freeform unless Shift is held -> lock preserveAspectRatio when Shift
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") {
        isShiftPressed.current = true
        // imported SVG selection
        if (selectedRef.current) {
          try {
            selectedRef.current.resize({ preserveAspectRatio: true }, true)
          } catch {}
        }
        // spline selection
        const s = splineTransformRef.current?.getSelected?.()
        if (s && s.group) {
          try {
            s.group.resize({ preserveAspectRatio: true })
          } catch {}
        }
      }
    }
    const handleKeyUp = (e) => {
      if (e.key === "Shift") {
        isShiftPressed.current = false
        if (selectedRef.current) {
          try {
            selectedRef.current.resize({ preserveAspectRatio: false }, false)
          } catch {}
        }
        const s = splineTransformRef.current?.getSelected?.()
        if (s && s.group) {
          try {
            s.group.resize({ preserveAspectRatio: false })
          } catch {}
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // toolbar zoom
  useEffect(() => {
    if (!zoomSignal || !drawRef.current) return
    const { type } = zoomSignal
    const zoomStep = type === "in" ? 1.1 : 0.9
    const draw = drawRef.current
    const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5)
    draw.zoom(newZoom)
    updateGridThickness(newZoom)
  }, [zoomSignal])

  // --- Import arbitrary SVG (unchanged behavioral expectations) ---
  const handleImportSVG = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".svg"
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      const draw = drawRef.current
      const imported = draw.group().svg(text)

      imported.center(draw.viewbox().width / 2, draw.viewbox().height / 2)
      imported.draggable()

      // drag logic
      imported.on("dragstart", () => {
        if (selectedRef.current === imported) {
          imported.select(false)
          selectedRef.current = null
        }
      })
      imported.on("dragend", () => {
        if (selectedRef.current === imported) {
          imported.select(true)
          selectedRef.current = imported
        }
      })

      // resize refresh logic
      imported.on("resize", () => {
        if (!imported._resizingActive) imported._resizingActive = true
        clearTimeout(imported._resizeTimeout)
        imported._resizeTimeout = setTimeout(() => {
          imported._resizingActive = false
        }, 150)

        clearTimeout(imported._refreshTimeout)
        imported._refreshTimeout = setTimeout(() => {
          if (selectedRef.current === imported) {
            imported.select(false)
            selectedRef.current = null
            imported.select(true)
            selectedRef.current = imported
          }
        }, 1)
      })

      // click selection for imported SVG
      imported.on("click", (ev) => {
        ev.stopPropagation()
        if (selectedRef.current && selectedRef.current !== imported) {
          selectedRef.current.select(false)
        }
        imported.select(true)
        imported.resize({ rotationPoint: true })
        selectedRef.current = imported
      })

      svgObjects.current.push(imported)
    }
    input.click()
  }

  const handleDeleteSelected = () => {
    // This deletes imported SVG selection only.
    if (selectedRef.current) {
      const target = selectedRef.current
      target.select(false)
      target.resize(false)
      target.remove()
      selectedRef.current = null
    } else {
      // also try deleting selected spline if any
      const selectedSpline = splineTransformRef.current?.getSelected?.()
      if (selectedSpline) {
        // use handler deleteSpline indirectly: remove group and array entry
        if (selectedSpline.group) selectedSpline.group.remove()
        splinesRef.current = splinesRef.current.filter(
          (s) => s !== selectedSpline
        )
        splineTransformRef.current?.clearSelection?.()
      }
    }
  }

  // fit-to-canvas helper
  const fitToCanvas = () => {
    fitToCanvasHelper(
      drawRef,
      canvasSizeRef,
      canvasRef.current,
      panZoomRef,
      panZoomOptionsRef,
      updateGridThickness
    )
  }

  // -- Expose methods via ref --
  useImperativeHandle(ref, () => ({
    importSVG: handleImportSVG,
    deleteSelected: handleDeleteSelected,

    updateCanvasOnToolChange: () => {
      updateSplinesOnToolChange(splinesRef, activeSplineRef, selectedTool)
      splineTransformRef.current?.notifyToolChange?.()
    },

    setGridSize: (newSize) => {
      if (!gridRef.current || !drawRef.current) return
      gridSizeRef.current = newSize
      if (gridRef.current._drawGrid) gridRef.current._drawGrid(newSize)
    },

    resizeCanvas: (newWidth, newHeight) => {
      if (!drawRef.current) return
      const draw = drawRef.current
      canvasSizeRef.current = { width: newWidth, height: newHeight }
      draw.size(newWidth, newHeight)
      draw.viewbox(0, 0, newWidth, newHeight)
      const bg = draw.findOne("#canvas-bg")
      if (bg) bg.size(newWidth, newHeight)

      if (gridRef.current) {
        const grid = gridRef.current
        drawGrid(grid, canvasSizeRef.current, gridSizeRef.current)
      }
      fitToCanvas()
    },

    // --- Project operations delegated to projecthandler ---
    newProject: () =>
      createNewProject(
        drawRef,
        canvasSizeRef,
        gridSizeRef,
        gridRef,
        fitToCanvas,
        svgObjects,
        splinesRef,
        activeSplineRef,
        selectedRef,
        splineTransformRef,
        selectedTool,
        isDraggingPoint,
        setupSplineTransformations
      ),

    getProjectJSON: () =>
      getProjectJSON(
        drawRef,
        canvasSizeRef,
        gridSizeRef,
        svgObjects,
        splinesRef
      ),

    saveAsJSON: (filename = "project.json") => saveAsJSON(filename, ref),

    loadFromJSON: () =>
      loadFromJSON(
        drawRef,
        canvasSizeRef,
        gridSizeRef,
        gridRef,
        fitToCanvas,
        svgObjects,
        splinesRef,
        activeSplineRef,
        splineTransformRef,
        selectedRef,
        selectedTool,
        isDraggingPoint,
        createSpline,
        setupPointHandlers,
        drawOrUpdateSpline,
        updateSplineVisualState,
        setupSplineTransformations
      ),

    exportAsSVG: (filename = "project.svg") =>
      exportAsSVG(filename, drawRef, canvasSizeRef, svgObjects, splinesRef),
  }))

  return (
    <div
      ref={canvasRef}
      className="canvas-container"
      style={{
        cursor: "grab",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    />
  )
})

export default Canvas
