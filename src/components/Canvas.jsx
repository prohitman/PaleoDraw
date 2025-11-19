// Canvas.jsx
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react"
import { SVG } from "@svgdotjs/svg.js"
import SplineManager from "../managers/SplineManager"
import SVGObjectManager from "../managers/SVGObjectManager"
import SelectionManager from "../managers/SelectionManager"
import { PointSelectionManager } from "../managers/PointSelectionManager"
import HistoryManager from "../managers/HistoryManager"
import { setupHotkeys } from "../input/setupHotkeys"
import { setupPointHandlers } from "../handlers/pointHandlers"
import {
  setupDragSelectionHandlers,
  setupMultiSelectionHotkeys,
} from "../handlers/selectionHandlers"
import { setupPointDragSelectionHandlers } from "../handlers/pointSelectionBoxHandlers"
import {
  setupToolHandlers,
  createCanvasClickHandler,
  activateToolInRegistry,
} from "../handlers/setupToolHandlers"
import {
  setupCanvasInteractions,
  setupPanBehavior,
  setupGlobalPointerUp,
  setupBackgroundClickBehavior,
} from "../handlers/setupCanvasInteractions"
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
  fitToCanvas as fitToCanvasHelper,
} from "../utils/svgHelpers"
import "@svgdotjs/svg.panzoom.js"
import "@svgdotjs/svg.select.js"
import "@svgdotjs/svg.resize.js"
import "@svgdotjs/svg.draggable.js"

const Canvas = forwardRef(({ zoomSignal, selectedTool }, ref) => {
  const canvasRef = useRef(null)
  const drawRef = useRef(null)
  const gridRef = useRef(null)
  const selectedToolRef = useRef(selectedTool || "select")
  const svgObjects = useRef([]) // imported arbitrary SVG groups - DEPRECATED, use svgObjectManager instead
  const svgObjectManager = useRef(null) // SVGObjectManager instance for imported SVG operations
  const selectedRef = useRef(null) // currently selected imported SVG (not splines)
  const splineManager = useRef(null) // SplineManager instance for all spline operations
  const selectionManager = useRef(null) // SelectionManager for multi-selection
  const pointSelectionManager = useRef(null) // PointSelectionManager for multi-point selection
  // HistoryManager instance for undo/redo (persistent)
  const historyManager = useRef(null)
  const hotkeysManagerRef = useRef(null) // HotkeysManager instance for scope activation
  const toolRegistryRef = useRef(null) // ToolRegistry instance for tool handler delegation
  const isDraggingPoint = useRef(false)
  const panZoomRef = useRef(null)
  const groupOverlayRef = useRef(null) // Overlay rect for multi-selection
  const overlayDragStateRef = useRef({ dragging: false, lastX: 0, lastY: 0 })
  const pointGroupOverlayRef = useRef(null) // Overlay for multi-point selection (curve tool)
  const pointOverlayDragStateRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
  })

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

  // Convert screen event to viewport coords using current viewBox
  const getViewportCoordsFromEvent = (e) => {
    const container = canvasRef.current
    const draw = drawRef.current
    if (!container || !draw) return { x: e.clientX, y: e.clientY }
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    try {
      const viewBox = draw.viewbox()
      const scaleX = viewBox.width / rect.width
      const scaleY = viewBox.height / rect.height
      return { x: viewBox.x + x * scaleX, y: viewBox.y + y * scaleY }
    } catch {
      return { x, y }
    }
  }

  // Handle overlay drag movement
  const handleOverlayDragMove = (e) => {
    const state = overlayDragStateRef.current
    if (!state.dragging) return
    const selMgr = selectionManager.current
    const draw = drawRef.current
    if (!selMgr || !draw) return
    const { x, y } = getViewportCoordsFromEvent(e)

    const dx = x - state.lastX
    const dy = y - state.lastY
    if (dx === 0 && dy === 0) return

    state.lastX = x
    state.lastY = y

    selMgr.moveSelected(dx, dy)
    // Recompute overlay from fresh bounds for accurate tracking
    updateGroupOverlay()
  }

  // Finalize overlay drag, push history, and cleanup listeners
  const handleOverlayDragUp = () => {
    overlayDragStateRef.current.dragging = false
    window.removeEventListener("pointermove", handleOverlayDragMove)

    const manager = splineManager.current
    const svgMgr = svgObjectManager.current
    const hist = historyManager.current
    if (manager && hist) {
      const splineData = manager.getAllSplines().map((s) => s.toJSON())
      const svgData = svgMgr?.getState?.() || []
      hist.pushState(splineData, svgData)
    }
  }

  // ----- Point selection overlay drag handlers -----
  const handlePointOverlayDragMove = (e) => {
    const state = pointOverlayDragStateRef.current
    if (!state.dragging) return
    const mgr = pointSelectionManager.current
    if (!mgr) return
    const { x, y } = getViewportCoordsFromEvent(e)
    const dx = x - state.lastX
    const dy = y - state.lastY
    if (dx === 0 && dy === 0) return
    state.lastX = x
    state.lastY = y
    mgr.moveSelectedPoints(dx, dy)
    updatePointGroupOverlay()
  }

  const handlePointOverlayDragUp = () => {
    pointOverlayDragStateRef.current.dragging = false
    window.removeEventListener("pointermove", handlePointOverlayDragMove)
    const manager = splineManager.current
    const svgMgr = svgObjectManager.current
    const hist = historyManager.current
    if (manager && hist) {
      const splineData = manager.getAllSplines().map((s) => s.toJSON())
      const svgData = svgMgr?.getState?.() || []
      hist.pushState(splineData, svgData)
    }
  }

  // Create or update the multi-selection overlay rectangle
  const updateGroupOverlay = () => {
    const draw = drawRef.current
    const selMgr = selectionManager.current
    if (!draw || !selMgr) return

    const count = selMgr.getSelectionCount?.() || 0
    const inSelectTool = selectedToolRef.current === "select"
    const bounds = selMgr.getSelectionBounds?.()

    const shouldShow = inSelectTool && bounds && count >= 2

    if (!shouldShow) {
      if (groupOverlayRef.current) {
        try {
          groupOverlayRef.current.remove()
        } catch {
          // ignore front errors
        }
        groupOverlayRef.current = null
      }
      return
    }

    const { x, y, width, height } = bounds

    if (!groupOverlayRef.current) {
      const overlay = draw
        .rect(width, height)
        .move(x, y)
        .fill("rgba(0,0,0,0)") // transparent but clickable
        .stroke({ color: "#00bfff", width: 1.5, dasharray: "6,4" })
        .id("group-selection-overlay")

      overlay.on("pointerdown", (e) => {
        if (selectedToolRef.current !== "select" || e.button !== 0) return
        e.stopPropagation()
        e.preventDefault()
        const coords = getViewportCoordsFromEvent(e)
        overlayDragStateRef.current = {
          dragging: true,
          lastX: coords.x,
          lastY: coords.y,
        }
        window.addEventListener("pointermove", handleOverlayDragMove)
        window.addEventListener("pointerup", handleOverlayDragUp, {
          once: true,
        })
      })

      groupOverlayRef.current = overlay
    } else {
      groupOverlayRef.current.size(width, height).move(x, y)
    }

    try {
      groupOverlayRef.current.front()
    } catch {
      // ignore front errors
    }
  }

  // Create or update multi-point selection overlay (curve tool)
  const updatePointGroupOverlay = () => {
    const draw = drawRef.current
    const ptMgr = pointSelectionManager.current
    if (!draw || !ptMgr) return

    const count = ptMgr.getSelectionCount?.() || 0
    const inCurveTool = selectedToolRef.current === "curve"
    const bounds = ptMgr.getSelectionBounds?.()
    const shouldShow = inCurveTool && bounds && count >= 2

    console.log("[Canvas.updatePointGroupOverlay]", {
      count,
      inCurveTool,
      hasBounds: !!bounds,
      shouldShow,
      bounds,
    })

    if (!shouldShow) {
      if (pointGroupOverlayRef.current) {
        try {
          pointGroupOverlayRef.current.remove()
        } catch {
          /* ignore removal errors */
        }
        pointGroupOverlayRef.current = null
        console.log("[Canvas.updatePointGroupOverlay] removed overlay")
      }
      return
    }

    const { x, y, width, height } = bounds

    if (!pointGroupOverlayRef.current) {
      const overlay = draw
        .rect(width, height)
        .move(x, y)
        .fill("rgba(0,0,0,0)")
        .stroke({ color: "#ff00ff", width: 1.5, dasharray: "5,3" })
        .id("point-group-selection-overlay")
      console.log("[Canvas.updatePointGroupOverlay] created overlay", {
        width,
        height,
        x,
        y,
      })

      overlay.on("pointerdown", (e) => {
        if (selectedToolRef.current !== "curve" || e.button !== 0) return
        e.stopPropagation()
        e.preventDefault()
        const coords = getViewportCoordsFromEvent(e)
        pointOverlayDragStateRef.current = {
          dragging: true,
          lastX: coords.x,
          lastY: coords.y,
        }
        window.addEventListener("pointermove", handlePointOverlayDragMove)
        window.addEventListener("pointerup", handlePointOverlayDragUp, {
          once: true,
        })
      })

      pointGroupOverlayRef.current = overlay
    } else {
      pointGroupOverlayRef.current.size(width, height).move(x, y)
      console.log("[Canvas.updatePointGroupOverlay] updated overlay", {
        width,
        height,
        x,
        y,
      })
    }

    try {
      pointGroupOverlayRef.current.front()
    } catch {
      /* ignore front errors */
    }
  }

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
      if (selectedToolRef.current !== "select") {
        e.preventDefault()
      }
    })

    // Initialize HistoryManager for undo/redo (only once) - MUST be before SplineManager
    if (!historyManager.current) {
      historyManager.current = new HistoryManager()
    }

    // Initialize SplineManager for all spline operations
    splineManager.current = new SplineManager({
      draw,
      selectedToolRef: selectedToolRef,
      isDraggingRef: isDraggingPoint,
      historyManager: historyManager.current, // Pass the instance, not the ref
    })

    // Initialize SVGObjectManager for imported SVG objects
    svgObjectManager.current = new SVGObjectManager({
      selectedToolRef: selectedToolRef,
    })

    // Initialize SelectionManager for multi-selection
    selectionManager.current = new SelectionManager({
      splineManager: splineManager.current,
      svgObjectManager: svgObjectManager.current,
    })

    // Initialize PointSelectionManager for multi-point selection
    pointSelectionManager.current = new PointSelectionManager()
    pointSelectionManager.current.initialize(splineManager.current)
    console.log("[Canvas] PointSelectionManager initialized")
    // Attach to spline manager for handler access
    splineManager.current.pointSelectionManager = pointSelectionManager.current

    // Set HistoryManager for SVGObjectManager
    svgObjectManager.current.historyManager = historyManager.current

    // Do NOT capture initial empty state - it prevents undo from working
    // Users expect undo to work AFTER the first change, not before
    // historyManager will have currentIndex at -1 initially, and first pushState() sets it to 0

    // Set up spline transformations (drag/resize/rotate) and get transform API
    const transformAPI = splineManager.current.setupSplineTransformations(
      selectedToolRef,
      isDraggingPoint,
      historyManager.current
    )

    // --- Initialize tool registry and handlers BEFORE click handler ---
    toolRegistryRef.current = setupToolHandlers({
      manager: splineManager.current,
      svgObjectManager: svgObjectManager.current,
      drawRef,
      selectedToolRef: selectedToolRef,
      isDraggingPoint,
      historyManager,
      selectedRef,
    })

    // Activate initial tool
    activateToolInRegistry(toolRegistryRef.current, selectedTool || "select")

    // Now create and attach the click handler
    const unifiedCanvasClickHandler = createCanvasClickHandler(
      toolRegistryRef.current,
      drawRef,
      splineManager.current,
      svgObjectManager.current,
      selectionManager.current,
      selectedToolRef,
      isDraggingPoint,
      historyManager.current,
      selectedRef
    )

    container.addEventListener("click", unifiedCanvasClickHandler)
    container.addEventListener("contextmenu", (e) => e.preventDefault())

    // Setup canvas interactions (zoom, pan)
    const { handleWheel } = setupCanvasInteractions(
      container,
      drawRef,
      panZoomRef,
      updateGridThickness,
      selectedToolRef
    )

    // pan cursor behavior
    const {
      handleMouseDown,
      handleMouseUp,
      handleMouseLeave,
      handleMouseMove,
    } = setupPanBehavior(container, selectedToolRef, selectedRef, isPanning)

    // Setup global pointer up (transform finalization)
    const { handleGlobalPointerUp } = setupGlobalPointerUp(
      splineManager,
      isDraggingPoint
    )
    window.addEventListener("pointerup", handleGlobalPointerUp)

    container.addEventListener("mousedown", handleMouseDown)
    container.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("mouseleave", handleMouseLeave)
    container.addEventListener("mousemove", handleMouseMove)

    // Setup background click behavior (deselect on empty click)
    const { handleBackgroundClick } = setupBackgroundClickBehavior(
      container,
      splineManager,
      selectionManager,
      selectedRef,
      selectedToolRef
    )

    // Helper function to convert screen coordinates to viewport coordinates
    const getViewportCoords = (e) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Get the current viewbox for pan/zoom transformation
      try {
        const viewBox = draw.viewbox()
        // viewBox contains x, y, width, height
        // Calculate the scale from container size to viewbox size
        const scaleX = viewBox.width / rect.width
        const scaleY = viewBox.height / rect.height

        return {
          x: viewBox.x + x * scaleX,
          y: viewBox.y + y * scaleY,
        }
      } catch (err) {
        console.warn("[Canvas] Error getting viewport coords:", err)
        return { x, y }
      }
    }

    // Setup drag selection handlers (right-click drag box selection)
    setupDragSelectionHandlers(
      draw,
      selectionManager.current,
      selectedToolRef,
      getViewportCoords
    )

    // Point drag-box selection (curve tool)
    setupPointDragSelectionHandlers(
      draw,
      pointSelectionManager.current,
      selectedToolRef,
      getViewportCoords
    )

    // Setup multi-selection keyboard shortcuts
    setupMultiSelectionHotkeys(selectionManager.current)

    fitToCanvas()

    // Initialize hotkey system
    const hotkeySetup = setupHotkeys({
      canvasRef: ref,
      splineManager,
      svgObjectManager,
      selectionManager,
      historyManager,
      pointSelectionManager,
      selectedToolRef: selectedToolRef,
      isDraggingRef: isDraggingPoint,
      onToolChange: (tool) => {
        selectedToolRef.current = tool
      },
      onImportSVG: () => {
        ref.current?.importSVG?.()
      },
    })

    // Store hotkeys manager for scope activation
    hotkeysManagerRef.current = hotkeySetup.manager

    // ...existing code...

    // Activate initial tool
    activateToolInRegistry(
      toolRegistryRef.current,
      selectedToolRef.current || "select"
    )

    // Set up listeners for selection scope activation/deactivation
    const handleSplineSelect = (spline) => {
      if (spline) {
        hotkeysManagerRef.current?.activateScope("selection")
      } else {
        hotkeysManagerRef.current?.deactivateScope("selection")
      }
    }

    const handleSVGSelect = (objectOrId) => {
      // objectOrId could be SVG element or null
      if (objectOrId) {
        hotkeysManagerRef.current?.activateScope("selection")
      } else {
        hotkeysManagerRef.current?.deactivateScope("selection")
      }
    }

    // Handle multi-selection scope activation
    const handleSelectionChanged = (event) => {
      if (event.hasSelection) {
        hotkeysManagerRef.current?.activateScope("selection")
      } else {
        hotkeysManagerRef.current?.deactivateScope("selection")
      }
      // Update overlay visibility/position when selection changes
      updateGroupOverlay()
    }

    const handleSelectionMoved = () => {
      // Always recompute overlay bounds; spline path changes can shift bbox
      updateGroupOverlay()
    }

    // Point selection events
    const handlePointSelectionChanged = () => {
      updatePointGroupOverlay()
    }
    const handlePointsMoved = () => {
      updatePointGroupOverlay()
    }
    const handlePointsDeleted = () => {
      updatePointGroupOverlay()
    }

    // When a new spline is created (including during paste), attach transformation handlers
    const handleSplineCreated = () => {
      transformAPI?.attachToAll?.()
    }

    splineManager.current?.on("select", handleSplineSelect)
    splineManager.current?.on("created", handleSplineCreated)
    svgObjectManager.current?.on("select", handleSVGSelect)
    selectionManager.current?.on("selectionChanged", handleSelectionChanged)
    selectionManager.current?.on("selectionMoved", handleSelectionMoved)
    pointSelectionManager.current?.on(
      "selectionChanged",
      handlePointSelectionChanged
    )
    pointSelectionManager.current?.on("pointsMoved", handlePointsMoved)
    pointSelectionManager.current?.on("pointsDeleted", handlePointsDeleted)

    // cleanup
    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("mousedown", handleMouseDown)
      container.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("mouseleave", handleMouseLeave)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("click", handleBackgroundClick)
      container.removeEventListener("click", unifiedCanvasClickHandler)
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      splineManager.current?.off("select", handleSplineSelect)
      splineManager.current?.off("created", handleSplineCreated)
      svgObjectManager.current?.off("select", handleSVGSelect)
      selectionManager.current?.off("selectionChanged", handleSelectionChanged)
      selectionManager.current?.off("selectionMoved", handleSelectionMoved)
      pointSelectionManager.current?.off(
        "selectionChanged",
        handlePointSelectionChanged
      )
      pointSelectionManager.current?.off("pointsMoved", handlePointsMoved)
      pointSelectionManager.current?.off("pointsDeleted", handlePointsDeleted)
      hotkeySetup.cleanup()
      draw.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  // Remove the separate effect that tried to re-run setupSplineTransformations based on ref length.
  // Instead we'll call splineTransformRef.current.attachToAll() explicitly when splines are created / loaded.

  // When tool switches away from curve, hide all spline points
  useEffect(() => {
    const manager = splineManager.current
    if (!manager) return

    const allSplines = manager.getAllSplines()
    if (allSplines.length === 0) return

    if (selectedToolRef.current !== "curve") {
      allSplines.forEach((spline) => {
        spline.setSelected(false)
      })
    }
  }, [selectedTool])

  // Update tool registry when tool changes (fix: always activate correct tool)
  useEffect(() => {
    if (!toolRegistryRef.current) return
    selectedToolRef.current = selectedTool
    console.log("[Canvas] useEffect tool change, activating:", selectedTool)
    activateToolInRegistry(toolRegistryRef.current, selectedTool || "select")
    console.log("[Canvas] Tool changed to:", selectedTool)

    // Cancel any active drag selection if leaving select tool
    if (selectedToolRef.current !== "select") {
      selectionManager.current?.cancelDragSelection?.()
    }

    // Also remove any lingering drag selection rectangle if tool switched
    selectionManager.current?.clearSelection?.()
    updateGroupOverlay()
    updatePointGroupOverlay()
    // Intentionally exclude updateGroupOverlay from deps to avoid recreating on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTool])

  // dblclick: finish current spline (escape is handled by hotkeys)
  useEffect(() => {
    const handleDblClick = () => {
      if (selectedToolRef.current === "curve") {
        splineManager.current?.finishActiveSpline()
        // ensure transform selection cleared too
        splineManager.current?.clearSelection?.()
      }
    }

    window.addEventListener("dblclick", handleDblClick)
    return () => {
      window.removeEventListener("dblclick", handleDblClick)
    }
  }, [selectedTool])

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
          } catch {
            // ignore resize errors
          }
        }
        // spline selection
        const s = splineManager.current?.getSelected()
        if (s && s.group) {
          try {
            s.group.resize({ preserveAspectRatio: true })
          } catch {
            // ignore resize errors
          }
        }
      }
    }
    const handleKeyUp = (e) => {
      if (e.key === "Shift") {
        isShiftPressed.current = false
        if (selectedRef.current) {
          try {
            selectedRef.current.resize({ preserveAspectRatio: false }, false)
          } catch {
            // ignore resize errors
          }
        }
        const s = splineManager.current?.getSelected()
        if (s && s.group) {
          try {
            s.group.resize({ preserveAspectRatio: false })
          } catch {
            // ignore resize errors
          }
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
          try {
            imported.select(false)
            imported.resize(false)
            setTimeout(() => {
              imported.select(true)
              imported.resize({ rotationPoint: true })
              selectedRef.current = imported
            }, 0)
          } catch (err) {
            console.warn("[Canvas] SVG dragend reselection error:", err)
          }
        }
        // Save to history after drag end
        const splineData =
          splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) || []
        const svgData = svgObjectManager.current?.getState?.() || []
        if (historyManager?.current) {
          if (
            historyManager.current.currentIndex <
            historyManager.current.history.length - 1
          ) {
            historyManager.current.history =
              historyManager.current.history.slice(
                0,
                historyManager.current.currentIndex + 1
              )
            console.log(
              "[Canvas] History truncated at currentIndex (SVG drag)",
              {
                currentIndex: historyManager.current.currentIndex,
                newHistoryLength: historyManager.current.history.length,
              }
            )
          }
          historyManager.current.pushState(splineData, svgData)
          console.log("[Canvas] SVG drag end saved to history")
        }
      })

      // resize refresh logic
      imported.on("resize", () => {
        if (!imported._resizingActive) imported._resizingActive = true
        clearTimeout(imported._resizeTimeout)
        imported._resizeTimeout = setTimeout(() => {
          imported._resizingActive = false
          // Save to history after resize end
          const splineData =
            splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) ||
            []
          const svgData = svgObjectManager.current?.getState?.() || []
          if (historyManager?.current) {
            if (
              historyManager.current.currentIndex <
              historyManager.current.history.length - 1
            ) {
              historyManager.current.history =
                historyManager.current.history.slice(
                  0,
                  historyManager.current.currentIndex + 1
                )
              console.log(
                "[Canvas] History truncated at currentIndex (SVG resize)",
                {
                  currentIndex: historyManager.current.currentIndex,
                  newHistoryLength: historyManager.current.history.length,
                }
              )
            }
            historyManager.current.pushState(splineData, svgData)
            console.log("[Canvas] SVG resize end saved to history")
          }
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
        // Use SVGObjectManager to select
        const svgMgr = svgObjectManager.current
        if (svgMgr) {
          svgMgr.selectObject(imported._objectId)
          selectedRef.current = svgMgr.getSelected()
        } else {
          // Fallback if manager not available
          if (selectedRef.current && selectedRef.current !== imported) {
            selectedRef.current.select(false)
          }
          imported.select(true)
          imported.resize({ rotationPoint: true })
          selectedRef.current = imported
        }
      })

      // Add to SVGObjectManager
      svgObjectManager.current?.addObject(imported)
      svgObjects.current.push(imported)
    }
    input.click()
  }

  const handleDeleteSelected = () => {
    // Try to delete selected SVG object first
    const svgMgr = svgObjectManager.current
    const selectedSvgId = svgMgr?.getSelectedId?.()

    if (selectedSvgId) {
      svgMgr.deleteObject(selectedSvgId)
      selectedRef.current = null
      // Save to history after SVG delete
      const splineData =
        splineManager.current?.getAllSplines?.()?.map((s) => s.toJSON()) || []
      const svgData = svgObjectManager.current?.getState?.() || []
      if (historyManager?.current) {
        if (
          historyManager.current.currentIndex <
          historyManager.current.history.length - 1
        ) {
          historyManager.current.history = historyManager.current.history.slice(
            0,
            historyManager.current.currentIndex + 1
          )
          console.log(
            "[Canvas] History truncated at currentIndex (SVG delete)",
            {
              currentIndex: historyManager.current.currentIndex,
              newHistoryLength: historyManager.current.history.length,
            }
          )
        }
        historyManager.current.pushState(splineData, svgData)
        console.log("[Canvas] SVG delete saved to history")
      }
      return
    }

    // Otherwise try deleting selected spline
    const selectedSpline = splineManager.current?.getSelected()
    if (selectedSpline) {
      splineManager.current?.deleteSpline(selectedSpline.id)
      selectedRef.current = null
      return
    }

    // Fallback: delete by selectedRef (legacy)
    if (selectedRef.current) {
      const target = selectedRef.current
      target.select(false)
      target.resize(false)
      target.remove()
      selectedRef.current = null
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

    updateCanvasOnToolChange: (tool) => {
      splineManager.current?.updateOnToolChange(tool)
      svgObjectManager.current?.updateOnToolChange(tool)
      splineManager.current?.clearSelection()
      svgObjectManager.current?.clearSelection()
      selectedRef.current = null
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
        splineManager.current,
        svgObjectManager.current,
        selectedRef
      ),

    getProjectJSON: () =>
      getProjectJSON(
        drawRef,
        canvasSizeRef,
        gridSizeRef,
        svgObjects,
        splineManager.current,
        svgObjectManager.current
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
        splineManager.current,
        svgObjectManager.current,
        selectedRef
      ),

    exportAsSVG: (filename = "project.svg") =>
      exportAsSVG(
        filename,
        drawRef,
        canvasSizeRef,
        svgObjects,
        splineManager.current,
        svgObjectManager.current
      ),

    // Expose history manager for hotkeys (private API)
    _historyManager: historyManager.current,
    _restoreState: (state) => {
      if (
        !state ||
        !drawRef.current ||
        !splineManager.current ||
        !svgObjectManager.current
      ) {
        console.warn("[Canvas] Cannot restore state, missing dependencies")
        return
      }

      // FULLY DELETE all current splines (remove SVG group and clear from collection)
      splineManager.current.getAllSplines().forEach((spline) => {
        try {
          // Deselect before removing to clear selection box and highlights
          if (spline.setSelected) spline.setSelected(false)
          if (spline.group) spline.group.remove()
        } catch (err) {
          console.warn("[Canvas] Error removing spline group:", err)
        }
      })
      // Clear SplineManager's internal collection
      splineManager.current.splines.clear()
      svgObjectManager.current.clear()

      // Restore splines with original IDs, skip splines with <2 points
      if (state.splines && Array.isArray(state.splines)) {
        const restoredSplines = []
        state.splines.forEach((splineData) => {
          if (!splineData.points || splineData.points.length < 2) return
          try {
            // Remove any existing spline with same ID to prevent duplicates
            if (splineManager.current.splines.has(splineData.id)) {
              const existing = splineManager.current.splines.get(splineData.id)
              if (existing && existing.setSelected) existing.setSelected(false)
              if (existing && existing.group) existing.group.remove()
              splineManager.current.splines.delete(splineData.id)
            }
            // Use silent mode to avoid duplicate events/collection
            const spline = splineManager.current.createSpline(false)
            spline.id = splineData.id // Set original ID
            spline.loadFromJSON(splineData)

            // Re-setup point handlers after loading from JSON
            if (spline.points && spline.points.length > 0) {
              spline.points.forEach((point) => {
                if (point.circle) {
                  setupPointHandlers(
                    point.circle,
                    spline,
                    isDraggingPoint,
                    splineManager.current,
                    selectedTool,
                    historyManager // Pass historyManager for drag/delete batching
                  )
                }
              })
            }
            splineManager.current.splines.set(spline.id, spline)
            restoredSplines.push(spline)
          } catch (err) {
            console.error("[Canvas] Error restoring spline:", err)
          }
        })
        // Always deselect all splines and remove selection boxes after restore
        restoredSplines.forEach((spline) => {
          if (spline.setSelected) spline.setSelected(false)
          if (spline.group && typeof spline.group.select === "function") {
            spline.group.select(false)
            // Also remove any lingering selection box elements if present
            const selBox = spline.group.node.querySelector(".svg-select-box")
            if (selBox) selBox.remove()
          }
        })
      }

      // Restore SVG objects
      const drawRef_current = drawRef.current
      if (state.svgs && Array.isArray(state.svgs)) {
        state.svgs.forEach((svgData) => {
          try {
            const imported = drawRef_current.group().svg(svgData.svg)
            if (svgData.transform) {
              imported.transform(svgData.transform)
            }
            svgObjectManager.current.addObject(imported)
          } catch (err) {
            console.error("[Canvas] Error restoring SVG object:", err)
          }
        })
      }

      console.log("[Canvas] State restored")
    },
  }))

  // Attach history manager to ref for hotkeys access (temporary - will be replaced with proper API)
  if (ref?.current) {
    ref.current._historyManager = historyManager.current
    ref.current._restoreState = (state) => {
      // This will be called by hotkeys
      if (!state) return

      // FULLY DELETE all current splines (remove SVG group and clear from collection)
      splineManager.current.getAllSplines().forEach((spline) => {
        try {
          if (spline.group) spline.group.remove()
        } catch (err) {
          console.warn("[Canvas] Error removing spline group:", err)
        }
        splineManager.current.splines.delete(spline.id)
      })

      // Restore splines
      if (state.splines && Array.isArray(state.splines)) {
        const restoredSplines = []
        state.splines.forEach((splineData) => {
          try {
            const spline = splineManager.current.createSpline()
            spline.loadFromJSON(splineData)

            // Re-setup point handlers after loading from JSON
            if (spline.points && spline.points.length > 0) {
              spline.points.forEach((point) => {
                if (point.circle) {
                  setupPointHandlers(
                    point.circle,
                    spline,
                    isDraggingPoint,
                    splineManager.current,
                    selectedTool
                  )
                }
              })
            }
            restoredSplines.push(spline)
          } catch (err) {
            console.error("[Canvas] Error restoring spline:", err)
          }
        })
        // If curve tool is active and there are splines, select the last one
        if (selectedTool?.current === "curve" && restoredSplines.length > 0) {
          const lastSpline = restoredSplines[restoredSplines.length - 1]
          splineManager.current.selectSpline(lastSpline.id)
        }
      }

      // Restore SVG objects
      svgObjectManager.current.clear()
      if (state.svgs && Array.isArray(state.svgs)) {
        state.svgs.forEach((svgData) => {
          try {
            const imported = drawRef.current.group().svg(svgData.svg)
            if (svgData.transform) {
              imported.transform(svgData.transform)
            }
            svgObjectManager.current.addObject(imported)
          } catch (err) {
            console.error("[Canvas] Error restoring SVG object:", err)
          }
        })
      }

      console.log("[Canvas] State restored from history")
    }
  }

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
