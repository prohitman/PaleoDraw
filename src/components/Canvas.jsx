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
    const drawGrid = (gSize = gridSizeRef.current) => {
      grid.clear()
      const { width: w, height: h } = canvasSizeRef.current
      for (let x = 0; x <= w; x += gSize) {
        grid
          .line(x, 0, x, h)
          .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
      }
      for (let y = 0; y <= h; y += gSize) {
        grid
          .line(0, y, w, y)
          .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
      }
    }
    grid._drawGrid = drawGrid
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

            const resetGroupTransform = (el) => {
              try {
                if (typeof el.untransform === "function") el.untransform()
                else if (el.node && el.node.removeAttribute)
                  el.node.removeAttribute("transform")
              } catch (err) {
                console.warn("[spline] resetGroupTransform failed:", err)
              }
            }

            // Now bake the group's transform into the points
            // The group has accumulated the rotation visually, now apply it to coordinates
            const m = el.matrixify?.()
            if (m && spline._rotateStartPoints) {
              console.log("[canvas] baking rotation matrix into points", {
                matrix: m,
                startPointCount: spline._rotateStartPoints.length,
              })
              // Apply the full matrix to the original start points
              spline._rotateStartPoints.forEach((sp, i) => {
                const nx = m.a * sp.x + m.c * sp.y + (m.e ?? 0)
                const ny = m.b * sp.x + m.d * sp.y + (m.f ?? 0)
                const pt = spline.points[i]
                if (pt) {
                  pt.x = nx
                  pt.y = ny
                  if (pt.circle) {
                    try {
                      pt.circle.center(pt.x, pt.y)
                    } catch {}
                  }
                }
              })
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

      const resetGroupTransform = (el) => {
        try {
          if (typeof el.untransform === "function") el.untransform()
          else if (el.node && el.node.removeAttribute)
            el.node.removeAttribute("transform")
        } catch (err) {
          console.warn("[spline] resetGroupTransform failed:", err)
        }
      }

      const m = el.matrixify?.()
      if (!m) {
        // nothing to bake; ensure no transform attribute leftover
        resetGroupTransform(el)
        console.log("[spline] bakeGroupTransform: no matrix to bake")
        isDraggingPoint.current = false
        return
      }

      // small epsilon for coordinate comparisons
      const EPS = 0.0001
      const pointsAreSame = (aPoints, bPoints) => {
        if (!aPoints || !bPoints) return false
        if (aPoints.length !== bPoints.length) return false
        for (let i = 0; i < aPoints.length; i++) {
          const a = aPoints[i]
          const b = bPoints[i]
          if (Math.abs(a.x - b.x) > EPS || Math.abs(a.y - b.y) > EPS)
            return false
        }
        return true
      }

      // Decide the correct source to bake: prefer _resizeStartPoints if available
      let srcPoints = null
      if (
        spline._resizeStartPoints &&
        Array.isArray(spline._resizeStartPoints)
      ) {
        if (pointsAreSame(spline.points, spline._resizeStartPoints)) {
          // points are still the original start points -> we must bake the matrix onto those start points
          srcPoints = spline._resizeStartPoints
          console.log(
            "[spline] baking matrix onto _resizeStartPoints (points unchanged during resize)"
          )
        } else {
          // points were already updated during the resize moves -> don't re-bake (would double-apply)
          console.log(
            "[spline] points already updated during resize; skipping bake to avoid double-apply"
          )
          // still make sure to reset group's transform attribute
          resetGroupTransform(el)
          // cleanup resize state
          delete spline._resizeStartBox
          delete spline._resizeStartPoints
          // ensure UI shows baked coords
          drawOrUpdateSpline(spline)
          isDraggingPoint.current = false
          return
        }
      } else {
        // no resize start snapshot: fall back to baking current points (safe)
        srcPoints = spline.points.map((p) => ({ x: p.x, y: p.y }))
        console.log(
          "[spline] no _resizeStartPoints found - falling back to current points as source"
        )
      }

      // Apply affine matrix to chosen source points: [a c e; b d f] * [x; y; 1]
      try {
        srcPoints.forEach((sp, i) => {
          const nx = m.a * sp.x + m.c * sp.y + (m.e ?? 0)
          const ny = m.b * sp.x + m.d * sp.y + (m.f ?? 0)
          const pt = spline.points[i] || spline.points[i] /* defensive */
          if (pt) {
            pt.x = nx
            pt.y = ny
            try {
              pt.circle?.center(pt.x, pt.y)
            } catch {}
          }
        })
      } catch (err) {
        console.error("[spline] bake apply error:", err)
      } finally {
        // cleanup resize state
        delete spline._resizeStartBox
        delete spline._resizeStartPoints

        // ensure points are centered and path updated
        spline.points.forEach((pt) => pt.circle?.center(pt.x, pt.y))
        drawOrUpdateSpline(spline)

        // finally clear any transform attribute
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
  const updateGridThickness = (zoom) => {
    if (!gridRef.current) return
    const newThickness = GRID_BASE_THICKNESS / zoom
    gridRef.current.each((i, children) =>
      children.stroke({ width: newThickness })
    )
  }

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
    const draw = drawRef.current
    const container = canvasRef.current
    if (!draw || !container) return

    const { width, height } = canvasSizeRef.current
    draw.viewbox(0, 0, width, height)

    const containerRect = container.getBoundingClientRect()
    const scaleX = containerRect.width / width
    const scaleY = containerRect.height / height
    const scale = Math.min(
      scaleX,
      scaleY,
      panZoomOptionsRef.current.zoomMax || 5
    )

    const screenCenterX = containerRect.width / 2
    const screenCenterY = containerRect.height / 2
    const centerPoint = draw.point(screenCenterX, screenCenterY)

    const panZoom = panZoomRef.current
    if (panZoom && typeof panZoom.zoom === "function")
      panZoom.zoom(scale, centerPoint)
    else draw.zoom(scale)

    updateGridThickness(scale)
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
        grid.clear()
        const gridSize = gridSizeRef.current
        for (let x = 0; x <= newWidth; x += gridSize)
          grid
            .line(x, 0, x, newHeight)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
        for (let y = 0; y <= newHeight; y += gridSize)
          grid
            .line(0, y, newWidth, y)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
      }
      fitToCanvas()
    },

    newProject: () => {
      const draw = drawRef.current
      if (!draw) return
      draw.clear()
      const bg = draw
        .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
        .fill("#222")
        .id("canvas-bg")
      bg.node.style.pointerEvents = "none"

      const grid = draw.group().id("canvas-grid")
      gridRef.current = grid
      const drawGrid = (gSize = gridSizeRef.current) => {
        grid.clear()
        const { width: w, height: h } = canvasSizeRef.current
        for (let x = 0; x <= w; x += gSize)
          grid
            .line(x, 0, x, h)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
        for (let y = 0; y <= h; y += gSize)
          grid
            .line(0, y, w, y)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
      }
      grid._drawGrid = drawGrid
      grid._drawGrid(gridSizeRef.current)
      fitToCanvas()

      svgObjects.current = []
      splinesRef.current = []
      activeSplineRef.current = null
      selectedRef.current = null

      // rebind transforms so API remains valid
      splineTransformRef.current = setupSplineTransformations(
        drawRef.current,
        splinesRef,
        selectedTool,
        isDraggingPoint
      )
    },

    getProjectJSON: () => {
      if (!drawRef.current) return null
      const project = {
        metadata: { version: "2.0", savedAt: new Date().toISOString() },
        canvas: canvasSizeRef.current,
        gridSize: gridSizeRef.current,
        splines: splinesRef.current.map((s) => ({
          id: s.id || null,
          color: s.color || "#00ffff",
          points: s.points.map((p) => ({ x: p.x, y: p.y })),
          selected: false,
        })),
        importedSVGs: svgObjects.current.map((obj) => ({
          svg: obj.svg(),
          transform: obj.transform ? obj.transform() : null,
        })),
      }
      return JSON.stringify(project, null, 2)
    },

    saveAsJSON: (filename = "project.json") => {
      const jsonStr = ref.current?.getProjectJSON?.()
      if (!jsonStr) return
      const blob = new Blob([jsonStr], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    },

    loadFromJSON: async () => {
      if (!drawRef.current) return
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".json"
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        const text = await file.text()
        let data
        try {
          data = JSON.parse(text)
        } catch (err) {
          console.error("Invalid JSON project file", err)
          return
        }

        const draw = drawRef.current
        draw.clear()

        // Restore canvas size if present
        if (data.canvas) {
          canvasSizeRef.current = data.canvas
          draw.size(data.canvas.width, data.canvas.height)
          draw.viewbox(0, 0, data.canvas.width, data.canvas.height)
        }

        // Background + grid
        const bg = draw
          .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
          .fill("#222")
          .id("canvas-bg")
        bg.node.style.pointerEvents = "none"
        const grid = draw.group().id("canvas-grid")
        gridRef.current = grid
        const drawGrid = (gSize = data.gridSize || gridSizeRef.current) => {
          grid.clear()
          const { width: w, height: h } = canvasSizeRef.current
          for (let x = 0; x <= w; x += gSize)
            grid
              .line(x, 0, x, h)
              .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
          for (let y = 0; y <= h; y += gSize)
            grid
              .line(0, y, w, y)
              .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
        }
        grid._drawGrid = drawGrid
        grid._drawGrid(data.gridSize || gridSizeRef.current)
        gridSizeRef.current = data.gridSize || gridSizeRef.current
        fitToCanvas()

        // Restore splines
        splinesRef.current = []
        if (data.splines) {
          for (const s of data.splines) {
            // create spline which constructs a group and path
            const spline = createSpline(
              draw,
              selectedTool,
              drawRef,
              isDraggingPoint,
              splinesRef,
              activeSplineRef
            )

            // create points inside spline.group so they transform with group
            spline.points = s.points.map(({ x, y }) => {
              const circle = spline.group
                .circle(6)
                .fill("#ffcc00")
                .center(x, y)
                .show()
              setupPointHandlers(
                circle,
                spline,
                isDraggingPoint,
                splinesRef,
                activeSplineRef
              )
              return { x, y, circle }
            })

            spline.color = s.color
            spline.selected = false
            drawOrUpdateSpline(spline)
            splinesRef.current.push(spline)
            updateSplineVisualState(spline)
          }
        }

        // Restore imported SVGs (these were separate, keep behavior identical)
        svgObjects.current = []
        if (data.importedSVGs) {
          data.importedSVGs.forEach((objData) => {
            const group = draw.group().svg(objData.svg)
            if (objData.transform) group.transform(objData.transform)
            group.draggable()
            svgObjects.current.push(group)
          })
        }

        // Attach transform handlers to the newly restored splines (important)
        splineTransformRef.current = setupSplineTransformations(
          drawRef.current,
          splinesRef,
          selectedTool,
          isDraggingPoint
        )
        splineTransformRef.current?.attachToAll?.()

        activeSplineRef.current = null
        selectedRef.current = null
      }
      input.click()
    },

    exportAsSVG: (filename = "project.svg") => {
      const draw = drawRef.current
      if (!draw) return
      // create offscreen temp document
      const temp = SVG()
        .size(canvasSizeRef.current.width, canvasSizeRef.current.height)
        .viewbox(
          0,
          0,
          canvasSizeRef.current.width,
          canvasSizeRef.current.height
        )

      // clone entire spline groups (so points & path & transforms come through)
      splinesRef.current.forEach((s) => {
        if (s.group) temp.add(s.group.clone())
        else if (s.path) temp.add(s.path.clone())
      })

      // clone imported SVGs
      svgObjects.current.forEach((obj) => temp.add(obj.clone()))

      const svgContent = temp.svg()
      temp.remove()

      const blob = new Blob([svgContent], {
        type: "image/svg+xml;charset=utf-8",
      })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    },
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
