import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react"
import { SVG } from "@svgdotjs/svg.js"
import {
  createSpline,
  drawOrUpdateSpline,
  setupPointHandlers,
  deleteSpline,
  insertPointByProximity,
  updateSplineVisualState,
  finishActiveSpline,
} from "../handlers/splineHandler"
import "@svgdotjs/svg.panzoom.js"
import "@svgdotjs/svg.select.js"
import "@svgdotjs/svg.resize.js"
import "@svgdotjs/svg.draggable.js"

const Canvas = forwardRef(({ zoomSignal, selectedTool }, ref) => {
  const canvasRef = useRef(null)
  const drawRef = useRef(null)
  const gridRef = useRef(null)
  const svgObjects = useRef([])
  const selectedRef = useRef(null)
  const splinesRef = useRef([])
  const activeSplineRef = useRef(null)
  const isDraggingPoint = useRef(false)

  //const zoomLevel = useRef(1)
  const isPanning = useRef(false)
  const isShiftPressed = useRef(false)

  const initialGridSize = 25
  const initialCanvasWidth = 0
  const initialCanvasHeight = 0

  // store current grid/canvas sizes
  const gridSizeRef = useRef(initialGridSize)
  const canvasSizeRef = useRef({
    width: initialCanvasWidth,
    height: initialCanvasHeight,
  })

  // --- panZoom persistent settings ---
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

  // --- Define your style constants once ---
  const SPLINE_COLOR_SELECTED = "#00ffff" // bright cyan
  const SPLINE_COLOR_UNSELECTED = "#16689fff" // darker tone
  const SPLINE_COLOR_HOVER = "#e3f6f6ff" // highlight on hover

  // --- Utility: apply visual style to a spline ---

  useEffect(() => {
    const container = canvasRef.current
    // fallback to container size if no initial explicit canvas size provided
    const width = canvasSizeRef.current.width || container.clientWidth
    const height = canvasSizeRef.current.height || container.clientHeight

    // persist current canvas size
    canvasSizeRef.current = { width, height }

    const draw = SVG()
      .addTo(container)
      .size(width, height)
      .viewbox(0, 0, width, height)

    drawRef.current = draw
    const bg = draw.rect(width, height).fill("#222")
    bg.node.style.pointerEvents = "none"

    // --- Grid (draw once, stored in gridRef) ---
    const grid = draw.group()
    gridRef.current = grid
    // draw grid using helper (centralized so we can redraw later)
    const drawGrid = (gSize = gridSizeRef.current) => {
      grid.clear() // important — erase previous lines only (no double-draw)
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

    // initial draw
    drawGrid(gridSizeRef.current)

    // store helper on ref so other functions can reuse (not exposed externally)
    gridRef.current._drawGrid = drawGrid

    // --- panZoom setup ---
    const panZoom = draw.panZoom(panZoomOptionsRef.current)
    //zoomLevel.current = 1
    draw.on("panning", (e) => {
      if (selectedTool && selectedTool.current !== "select") {
        e.preventDefault()
        return
      }
    })

    const handleSplineClick = (spline, e) => {
      e?.stopPropagation()

      if (selectedTool.current === "curve" && !isDraggingPoint.current) {
        // Deselect others
        splinesRef.current.forEach((s) => {
          if (s !== spline) {
            s.selected = false
            updateSplineVisualState(s)
          }
        })

        // Toggle this spline
        spline.selected = !spline.selected
        activeSplineRef.current = spline.selected ? spline : null
        updateSplineVisualState(spline)
      }

      if (selectedTool.current === "delete_spline") {
        deleteSpline(spline, splinesRef, activeSplineRef)
      }
    }

    const handleBSplineClick = (e) => {
      if (selectedTool.current !== "curve" || isDraggingPoint.current) return

      const draw = drawRef.current
      const { x, y } = drawRef.current.point(e.clientX, e.clientY)

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
          activeSplineRef
        )
        return
      }

      if (e.target.tagName === "path" || e.target.tagName === "circle") return

      const point = draw.circle(6).fill("#ffcc00").center(x, y)

      // Start new spline if none active
      if (!activeSplineRef.current) {
        const newSpline = createSpline(
          draw,
          handleSplineClick,
          selectedTool,
          drawRef,
          isDraggingPoint,
          splinesRef,
          activeSplineRef
        )

        splinesRef.current.push(newSpline)
        activeSplineRef.current = newSpline
      }

      const spline = activeSplineRef.current
      if (spline.selected === false) return // prevent adding points to inactive splines
      spline.points.push({ x, y, circle: point })

      // Allow dragging datapoints to reshape
      setupPointHandlers(
        point,
        spline,
        isDraggingPoint,
        splinesRef,
        activeSplineRef
      )
      drawOrUpdateSpline(spline)
      updateSplineVisualState(spline)
    }
    container.addEventListener("click", handleBSplineClick)
    container.addEventListener("contextmenu", (e) => e.preventDefault())

    // ---- Point setup (drag + right-click delete) ----

    // --- Wheel Zoom (calls toolbar logic style) ---
    const handleWheel = (e) => {
      e.preventDefault()
      const direction = e.deltaY < 0 ? "in" : "out"
      const zoomStep =
        direction === "in" ? 1 + ZOOM_SMOOTHNESS : 1 - ZOOM_SMOOTHNESS
      const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5)
      //zoomLevel.current = newZoom
      const point = draw.point(e.offsetX, e.offsetY)
      panZoom.zoom(newZoom, point)
      updateGridThickness(newZoom)
    }
    container.addEventListener("wheel", handleWheel)

    // --- Pan cursor feedback (block when over handles) ---
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
      if (selectedTool && selectedTool.current !== "select") {
        container.style.cursor = "crosshair"
      }
    }

    const handleMouseUp = () => {
      isPanning.current = false
      if (selectedTool && selectedTool.current === "select") {
        container.style.cursor = "grab"
      } else if (selectedTool && selectedTool.current !== "select") {
        container.style.cursor = "crosshair"
      }
    }
    const handleMouseLeave = () => {
      if (isPanning.current) {
        isPanning.current = false
        container.style.cursor = "grab"
      }
    }
    container.addEventListener("mousedown", handleMouseDown)
    container.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("mouseleave", handleMouseLeave)
    container.addEventListener("mousemove", handleMouseMove)

    // --- Deselect on empty click ---
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
      }
    }
    container.addEventListener("click", handleBackgroundClick)

    // cleanup
    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("mousedown", handleMouseDown)
      container.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("mouseleave", handleMouseLeave)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("click", handleBackgroundClick)
      container.removeEventListener("click", handleBSplineClick)
      draw.remove()
    }
  }, []) // end main effect (runs once)

  useEffect(() => {
    if (!splinesRef.current?.length) return
    if (selectedTool.current !== "curve") {
      splinesRef.current.forEach((spline) => {
        spline.selected = false
        updateSplineVisualState(spline)
      })
    }
  }, [selectedTool])

  useEffect(() => {
    const handleDblClick = () => {
      if (selectedTool.current === "curve") {
        finishActiveSpline(activeSplineRef)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") finishActiveSpline(activeSplineRef)
    }

    window.addEventListener("dblclick", handleDblClick)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("dblclick", handleDblClick)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // --- Grid thickness ---
  const updateGridThickness = (zoom) => {
    if (!gridRef.current) return
    const newThickness = GRID_BASE_THICKNESS / zoom
    gridRef.current.each((i, children) =>
      children.stroke({ width: newThickness })
    )
  }

  // --- Keyboard handlers (unchanged) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift" && selectedRef.current) {
        isShiftPressed.current = true
        selectedRef.current.resize({ preserveAspectRatio: true }, true)
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === "Shift" && selectedRef.current) {
        isShiftPressed.current = false
        selectedRef.current.resize({ preserveAspectRatio: false }, false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // --- Toolbar zoom (unchanged except updateGridThickness call) ---
  useEffect(() => {
    if (!zoomSignal || !drawRef.current) return
    const { type } = zoomSignal
    const zoomStep = type === "in" ? 1.1 : 0.9
    const draw = drawRef.current
    const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5)
    draw.zoom(newZoom)
    //zoomLevel.current = newZoom
    updateGridThickness(newZoom)
  }, [zoomSignal])

  // --- Import SVG (kept intact) ---
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

      // --- Drag logic (hides selection box) ---
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

      // --- Resize logic (keeps your resize refresh) ---
      imported.on("resize", () => {
        if (!imported._resizingActive) {
          imported._resizingActive = true
        }
        clearTimeout(imported._resizeTimeout)
        imported._resizeTimeout = setTimeout(() => {
          imported._resizingActive = false
        }, 150)

        // Refresh selection box dynamically
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

      // --- Click selection ---
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
    if (selectedRef.current) {
      const target = selectedRef.current
      target.select(false)
      target.resize(false)
      target.remove()
      selectedRef.current = null
    }
  }

  // --- Expose methods to parent: setGridSize and resizeCanvas (non-invasive) ---
  useImperativeHandle(ref, () => ({
    importSVG: handleImportSVG,
    deleteSelected: handleDeleteSelected,

    // setGridSize: redraws the single, existing grid group (avoids double-draw)
    setGridSize: (newSize) => {
      if (!gridRef.current || !drawRef.current) return
      gridSizeRef.current = newSize
      // call the helper stored on gridRef
      if (gridRef.current._drawGrid) gridRef.current._drawGrid(newSize)
    },

    // resizeCanvas: adjusts svg numeric size + viewbox, redraws grid to new bounds
    resizeCanvas: (newWidth, newHeight) => {
      if (!drawRef.current) return
      const draw = drawRef.current
      // update stored canvas size
      canvasSizeRef.current = { width: newWidth, height: newHeight }
      // update SVG size and viewbox
      draw.size(newWidth, newHeight)
      draw.viewbox(0, 0, newWidth, newHeight)

      const bg = draw.findOne("rect")
      if (bg) bg.size(newWidth, newHeight)
      // redraw grid to new extents with current grid size
      if (gridRef.current && gridRef.current._drawGrid)
        gridRef.current._drawGrid(gridSizeRef.current)
    },

    // === NEW METHODS: JSON-based save/load & export SVG/PNG ===

    // Reset canvas (keeps rest of behavior unchanged)
    newProject: () => {
      if (!drawRef.current) return
      const draw = drawRef.current
      draw.clear()

      // Recreate background
      const bg = draw
        .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
        .fill("#222")
      bg.node.style.pointerEvents = "none"

      // Recreate and re-store the grid group
      const newGrid = draw.group()
      gridRef.current = newGrid
      const drawGrid = (gSize = gridSizeRef.current) => {
        newGrid.clear()
        const { width: w, height: h } = canvasSizeRef.current
        for (let x = 0; x <= w; x += gSize)
          newGrid
            .line(x, 0, x, h)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
        for (let y = 0; y <= h; y += gSize)
          newGrid
            .line(0, y, w, y)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
      }
      gridRef.current._drawGrid = drawGrid
      gridRef.current._drawGrid(gridSizeRef.current)

      svgObjects.current = []
      selectedRef.current = null
    },

    // Return project as JSON string (content holds SVG markup)
    getProjectJSON: () => {
      if (!drawRef.current) return null
      const draw = drawRef.current
      const svgMarkup = draw.svg()
      const project = {
        metadata: { version: "1.0", savedAt: new Date().toISOString() },
        canvas: { ...canvasSizeRef.current },
        gridSize: gridSizeRef.current,
        content: svgMarkup,
      }
      return JSON.stringify(project, null, 2)
    },

    // Save project to a .json file (downloads)
    saveAsJSON: (filename = "project.json") => {
      const json = this?.getProjectJSON ? this.getProjectJSON() : null
      // `this` won't be bound here; call through ref in App instead.
      // We'll fallback to directly calling drawRef here for safety:
      let jsonStr = null
      if (drawRef.current) {
        const svgMarkup = drawRef.current.svg()
        const project = {
          metadata: { version: "1.0", savedAt: new Date().toISOString() },
          canvas: { ...canvasSizeRef.current },
          gridSize: gridSizeRef.current,
          content: svgMarkup,
        }
        jsonStr = JSON.stringify(project, null, 2)
      }
      if (!jsonStr) return
      const blob = new Blob([jsonStr], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    },

    // Load project from JSON file (file picker)
    loadFromJSON: async () => {
      if (!drawRef.current) return
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".json,application/json"
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

        // Restore canvas size
        if (data.canvas && data.canvas.width && data.canvas.height) {
          canvasSizeRef.current = {
            width: data.canvas.width,
            height: data.canvas.height,
          }
          draw.size(canvasSizeRef.current.width, canvasSizeRef.current.height)
          draw.viewbox(
            0,
            0,
            canvasSizeRef.current.width,
            canvasSizeRef.current.height
          )
        }

        const bg = draw
          .rect(canvasSizeRef.current.width, canvasSizeRef.current.height)
          .fill("#222")
        bg.node.style.pointerEvents = "none"

        // Restore grid
        gridRef.current = draw.group()
        const drawGrid = (gSize = data.gridSize || gridSizeRef.current) => {
          gridRef.current.clear()
          const { width: w, height: h } = canvasSizeRef.current
          for (let x = 0; x <= w; x += gSize)
            gridRef.current
              .line(x, 0, x, h)
              .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
          for (let y = 0; y <= h; y += gSize)
            gridRef.current
              .line(0, y, w, y)
              .stroke({ color: "#333", width: GRID_BASE_THICKNESS })
        }
        gridRef.current._drawGrid = drawGrid
        gridRef.current._drawGrid(data.gridSize || gridSizeRef.current)
        gridSizeRef.current = data.gridSize || gridSizeRef.current

        svgObjects.current = []
        selectedRef.current = null

        // Load SVG content (content is the svg markup)
        if (data.content) {
          // Insert SVG markup into a group so we can reattach events
          const imported = draw.group().svg(data.content)
          // Reattach behavior to all elements (simple heuristic)
          draw
            .find("path, rect, circle, polygon, line, ellipse, g")
            .forEach((el) => {
              // skip background rect we created
              if (el.type === "rect" && el.fill && el.fill() === "#222") return
              el.draggable && el.draggable()
              el.on &&
                el.on("click", (ev) => {
                  ev.stopPropagation()
                  if (selectedRef.current && selectedRef.current !== el)
                    selectedRef.current.select(false)
                  el.select && el.select(true)
                  el.resize && el.resize({ rotationPoint: true })
                  selectedRef.current = el
                })
              svgObjects.current.push(el)
            })
        }
      }
      input.click()
    },

    // Export as PNG (downloads). filename should end with .png
    exportAsPNG: (filename = "project.png") => {
      if (!drawRef.current) return
      const draw = drawRef.current

      // temporarily hide selection visuals
      const sel = selectedRef.current
      if (sel) {
        sel.select(false)
        sel.resize(false)
      }

      const svgData = draw.svg()
      const blob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        // enforce canvas size for consistent export
        canvas.width = canvasSizeRef.current.width || img.width
        canvas.height = canvasSizeRef.current.height || img.height
        const ctx = canvas.getContext("2d")
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blobPng) => {
          const pngUrl = URL.createObjectURL(blobPng)
          const a = document.createElement("a")
          a.href = pngUrl
          a.download = filename
          a.click()
          URL.revokeObjectURL(pngUrl)
        })

        // restore selection visuals if necessary
        if (sel) {
          sel.select(true)
          sel.resize && sel.resize({ rotationPoint: true })
        }
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        console.error("Failed to convert SVG to PNG")
        URL.revokeObjectURL(url)
      }
      img.src = url
    },

    // Export as SVG (downloads). filename should end with .svg
    exportAsSVG: (filename = "project.svg") => {
      if (!drawRef.current) return
      const svgData = drawRef.current.svg()
      const blob = new Blob([svgData], {
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
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#111",
        overflow: "hidden",
        cursor: "grab",
      }}
    />
  )
})

export default Canvas
