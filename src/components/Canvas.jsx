// Canvas.jsx
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { SVG } from "@svgdotjs/svg.js"
import SplineManager from "../managers/SplineManager"
import SVGObjectManager from "../managers/SVGObjectManager"
import SelectionManager from "../managers/GroupSelectionManager"
import { PointSelectionManager } from "../managers/GroupPointSelectionManager"
import HistoryManager from "../managers/HistoryManager"
import ProjectManager from "../managers/ProjectManager"
import eventBus from "../core/EventBus"
import { AutoHistoryPlugin } from "../plugins/AutoHistoryPlugin"
import { setupHotkeys } from "../input/setupHotkeys"
import { setupPointHandlers } from "../handlers/points/pointHandlers"
import {
  setupDragSelectionHandlers,
  setupMultiSelectionHotkeys,
} from "../handlers/selection/selectionHandlers"
import { setupPointDragSelectionHandlers } from "../handlers/points/pointSelectionBoxHandlers"
import {
  setupToolHandlers,
  createCanvasClickHandler,
  activateToolInRegistry,
} from "../handlers/interactions/setupToolHandlers"
import {
  setupCanvasInteractions,
  setupPanBehavior,
  setupGlobalPointerUp,
  setupBackgroundClickBehavior,
} from "../handlers/interactions/setupCanvasInteractions"
import {
  drawGrid,
  updateGridLineThickness,
  fitToCanvas as fitToCanvasHelper,
} from "../utils/svgHelpers"
import "@svgdotjs/svg.panzoom.js"
import "@svgdotjs/svg.select.js"
import "@svgdotjs/svg.resize.js"
import "@svgdotjs/svg.draggable.js"

const Canvas = forwardRef(
  ({ zoomSignal, selectedTool, onShowRecentProjects }, ref) => {
    // ========== Core Refs ==========
    const canvasRef = useRef(null) // Container DOM element
    const drawRef = useRef(null) // SVG.js draw instance
    const gridRef = useRef(null) // SVG.js grid group
    const selectedToolRef = useRef(selectedTool || "select") // Current active tool
    const selectedRef = useRef(null) // Currently selected imported SVG object

    // ========== Manager Refs ==========
    const splineManager = useRef(null) // Manages all spline operations (CRUD, transformations)
    const svgObjectManager = useRef(null) // Manages imported SVG objects
    const selectionManager = useRef(null) // Manages multi-selection of splines/SVGs
    const pointSelectionManager = useRef(null) // Manages multi-point selection within splines
    const historyManager = useRef(null) // Manages undo/redo stack (persistent across renders)
    const autoHistoryPlugin = useRef(null) // Automatic history capture on modifications
    const projectManager = useRef(null) // Manages project lifecycle and state

    // ========== Utility Refs ==========
    const clipboard = useRef(null) // Internal clipboard for copy/paste operations
    const hotkeysManagerRef = useRef(null) // Manages hotkey scopes (e.g., selection)
    const toolRegistryRef = useRef(null) // Registry for tool-specific event handlers
    const isDraggingPoint = useRef(false) // Tracks point drag state
    const panZoomRef = useRef(null) // SVG.js pan/zoom plugin instance

    // ========== Canvas Configuration ==========
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
      wheelZoom: false, // Disabled (handled by custom wheel handler)
      panButton: 0, // Left mouse button for panning
      oneFingerPan: false,
      zoomFactor: 0.1,
      zoomMin: 0.2,
      zoomMax: 5,
    })

    const ZOOM_SMOOTHNESS = 0.05
    const GRID_BASE_THICKNESS = 0.5

    // ========== Main Initialization (Runs Once on Mount) ==========
    // Sets up: SVG canvas, grid, managers, event handlers, hotkeys, and cleanup
    useEffect(() => {
      const container = canvasRef.current
      if (!container) return

      const width = canvasSizeRef.current.width || container.clientWidth
      const height = canvasSizeRef.current.height || container.clientHeight
      canvasSizeRef.current = { width, height }

      const draw = SVG()
        .addTo(container)
        // Use percentage sizing so SVG always matches container pixel size; logical space defined by viewBox below.
        .size("100%", "100%")
        .viewbox(0, 0, width, height)
      drawRef.current = draw

      const bg = draw
        .rect(width, height)
        .addClass("canvas-bg-rect")
        .id("canvas-bg")
      bg.node.style.pointerEvents = "none"

      // Initialize grid layer (protected from z-ordering operations)
      const grid = draw.group().id("canvas-grid")
      grid.attr("data-protected-layer", "true") // Protect from z-ordering operations
      gridRef.current = grid

      grid._drawGrid = (gSize = gridSizeRef.current) =>
        drawGrid(grid, canvasSizeRef.current, gSize)
      grid._drawGrid(gridSizeRef.current)

      // Initialize pan/zoom (disabled when not in select tool)
      panZoomRef.current = draw.panZoom(panZoomOptionsRef.current)
      draw.on("panning", (e) => {
        if (selectedToolRef.current !== "select") {
          e.preventDefault()
        }
      })

      // ========== Manager Initialization ==========
      // IMPORTANT: HistoryManager must be initialized before managers that depend on it
      if (!historyManager.current) {
        historyManager.current = new HistoryManager()
      }

      // Initialize core managers
      splineManager.current = new SplineManager({
        draw,
        selectedToolRef: selectedToolRef,
        isDraggingRef: isDraggingPoint,
        historyManager: historyManager.current,
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
      pointSelectionManager.current.initializeOverlay(draw, selectedToolRef)
      splineManager.current.pointSelectionManager =
        pointSelectionManager.current

      // Initialize overlay systems for visual feedback
      selectionManager.current.initializeOverlay(draw, selectedToolRef)

      // Set HistoryManager for SVGObjectManager
      svgObjectManager.current.historyManager = historyManager.current

      // Initialize HistoryManager with manager references for restoration
      historyManager.current.initializeManagers({
        splineManager: splineManager.current,
        svgObjectManager: svgObjectManager.current,
        pointSelectionManager: pointSelectionManager.current,
        autoHistoryPlugin: autoHistoryPlugin.current,
        restorationContext: {
          setupPointHandlers,
          drawRef,
          selectedToolRef,
          isDraggingRef: isDraggingPoint,
        },
      })

      // Do NOT capture initial empty state - it prevents undo from working
      // Users expect undo to work AFTER the first change, not before
      // historyManager will have currentIndex at -1 initially, and first pushState() sets it to 0

      // Set up spline transformations (drag/resize/rotate) and get transform API
      const transformAPI = splineManager.current.setupSplineTransformations(
        selectedToolRef,
        isDraggingPoint,
        historyManager.current
      )

      // ========== Tool System Setup ==========
      // Initialize tool registry and register all tool handlers
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

      // ========== Canvas Interactions Setup ==========
      // Setup zoom, pan, cursor behavior, and selection
      const { handleWheel } = setupCanvasInteractions(
        container,
        drawRef,
        panZoomRef,
        updateGridThickness,
        selectedToolRef
      )

      const {
        handleMouseDown,
        handleMouseUp,
        handleMouseLeave,
        handleMouseMove,
      } = setupPanBehavior(container, selectedToolRef, selectedRef)

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
        selectedToolRef,
        svgObjectManager
      )

      // Viewport coordinate conversion helper (screen pixels → SVG viewport coordinates)
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

      // ========== Hotkey System Setup ==========
      const hotkeySetup = setupHotkeys({
        canvasRef: ref,
        splineManager,
        svgObjectManager,
        selectionManager,
        historyManager,
        pointSelectionManager,
        selectedToolRef: selectedToolRef,
        isDraggingRef: isDraggingPoint,
        drawRef,
        onToolChange: (tool) => {
          selectedToolRef.current = tool
        },
        onImportSVG: () => {
          ref.current?.importSVG?.()
        },
        onShowRecentProjects,
      })

      // Store hotkeys manager for dynamic scope activation
      hotkeysManagerRef.current = hotkeySetup.manager

      activateToolInRegistry(
        toolRegistryRef.current,
        selectedToolRef.current || "select"
      )

      // ========== EventBus Listeners Setup ==========
      // Scope activation/deactivation based on selection state
      const handleSplineSelect = (spline) => {
        if (spline) {
          hotkeysManagerRef.current?.activateScope("selection")
        } else {
          hotkeysManagerRef.current?.deactivateScope("selection")
        }
      }

      const handleSVGSelect = (objectOrId) => {
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
        selectionManager.current?.updateOverlay()
      }

      const handleSelectionMoved = () => {
        selectionManager.current?.updateOverlay()
      }

      // Overlay updates for point selection changes
      const handlePointSelectionChanged = () => {
        pointSelectionManager.current?.updateOverlay()
      }
      const handlePointsMoved = () => {
        pointSelectionManager.current?.updateOverlay()
      }
      const handlePointsDeleted = () => {
        pointSelectionManager.current?.updateOverlay()
      }

      const handleSplineCreated = () => {
        transformAPI?.attachToAll?.()
      }

      // Register all EventBus listeners
      eventBus.on("spline:selected", handleSplineSelect)
      eventBus.on("spline:created", handleSplineCreated)
      eventBus.on("svg:selected", handleSVGSelect)
      eventBus.on("selection:changed", handleSelectionChanged)
      eventBus.on("selection:moved", handleSelectionMoved)
      eventBus.on("point-selection:changed", handlePointSelectionChanged)
      eventBus.on("points:moved", handlePointsMoved)
      eventBus.on("points:deleted", handlePointsDeleted)

      // ========== Plugin Initialization ==========
      // AutoHistoryPlugin automatically captures history on all modification events
      autoHistoryPlugin.current = new AutoHistoryPlugin(
        historyManager.current,
        splineManager.current,
        svgObjectManager.current
      )
      autoHistoryPlugin.current.enable()

      // Initialize ProjectManager for project lifecycle (save/load/export)
      projectManager.current = new ProjectManager({
        drawRef,
        canvasSizeRef,
        gridSizeRef,
        gridRef,
        fitToCanvas,
        splineManager: splineManager.current,
        svgObjectManager: svgObjectManager.current,
        selectedRef,
      })

      // ========== Emit Initial States ==========
      // Emit initial state for toolbar to reflect starting conditions
      eventBus.emit("app:historyChanged", {
        canUndo: false,
        canRedo: false,
      })
      eventBus.emit("app:selectionChanged", {
        hasSelection: false,
        hasSplineSelection: false,
      })
      eventBus.emit("app:clipboardChanged", { hasClipboard: false })

      // ========== Cleanup Function ==========
      return () => {
        container.removeEventListener("wheel", handleWheel)
        container.removeEventListener("mousedown", handleMouseDown)
        container.removeEventListener("mouseup", handleMouseUp)
        container.removeEventListener("mouseleave", handleMouseLeave)
        container.removeEventListener("mousemove", handleMouseMove)
        container.removeEventListener("click", handleBackgroundClick)
        container.removeEventListener("click", unifiedCanvasClickHandler)
        window.removeEventListener("pointerup", handleGlobalPointerUp)

        // Clean up EventBus listeners
        eventBus.off("spline:selected", handleSplineSelect)
        eventBus.off("spline:created", handleSplineCreated)
        eventBus.off("svg:selected", handleSVGSelect)
        eventBus.off("selection:changed", handleSelectionChanged)
        eventBus.off("selection:moved", handleSelectionMoved)
        eventBus.off("point-selection:changed", handlePointSelectionChanged)
        eventBus.off("points:moved", handlePointsMoved)
        eventBus.off("points:deleted", handlePointsDeleted)

        // Clean up AutoHistoryPlugin listeners
        if (autoHistoryPlugin.current) {
          autoHistoryPlugin.current.cleanup()
        }

        // Clean up project manager
        if (projectManager.current) {
          projectManager.current.destroy()
        }

        // Destroy transform API and clean up its listeners
        if (transformAPI?.destroy) {
          transformAPI.destroy()
        }

        hotkeySetup.cleanup()
        draw.remove()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run once on mount only

    // ========== Window Resize/Fullscreen Handler ==========
    // Preserves logical canvas size while updating viewport and grid
    useEffect(() => {
      const handleResizeOrFullscreen = () => {
        const container = canvasRef.current
        const draw = drawRef.current
        if (!container || !draw) return

        // Preserve logical canvas size (don't modify canvasSizeRef)
        const { width: logicalW, height: logicalH } = canvasSizeRef.current
        draw.viewbox(0, 0, logicalW, logicalH)

        // Match SVG element pixel size to container to avoid letterboxing slabs
        const rect = container.getBoundingClientRect()
        draw.size(rect.width, rect.height)

        // Redraw grid with logical dimensions
        if (gridRef.current) {
          drawGrid(gridRef.current, canvasSizeRef.current, gridSizeRef.current)
        }

        // Refit zoom to new container dimensions
        if (typeof fitToCanvas === "function") {
          fitToCanvas()
        } else if (typeof fitToCanvasHelper === "function") {
          fitToCanvasHelper(
            drawRef,
            canvasSizeRef,
            container,
            panZoomRef,
            panZoomOptionsRef,
            updateGridLineThickness
          )
        }

        // Update selection overlays to match new viewport
        selectionManager.current?.updateOverlay()
        pointSelectionManager.current?.updateOverlay()
      }
      window.addEventListener("resize", handleResizeOrFullscreen)
      window.addEventListener("fullscreenchange", handleResizeOrFullscreen)
      return () => {
        window.removeEventListener("resize", handleResizeOrFullscreen)
        window.removeEventListener("fullscreenchange", handleResizeOrFullscreen)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ========== Tool Change Effects ==========
    // Hide spline points when leaving point-editing tools
    useEffect(() => {
      const manager = splineManager.current
      if (!manager) return

      const allSplines = manager.getAllSplines()
      if (allSplines.length === 0) return

      // Hide points when not in point-editing tools
      if (
        selectedToolRef.current !== "curve" &&
        selectedToolRef.current !== "line" &&
        selectedToolRef.current !== "straight"
      ) {
        allSplines.forEach((spline) => {
          spline.setSelected(false)
        })
      }
    }, [selectedTool])

    // Update tool registry and activate correct tool
    useEffect(() => {
      if (!toolRegistryRef.current) return
      selectedToolRef.current = selectedTool
      activateToolInRegistry(toolRegistryRef.current, selectedTool || "select")

      // Cancel any active drag selection if leaving select tool
      if (selectedToolRef.current !== "select") {
        selectionManager.current?.cancelDragSelection?.()
      }

      // Emit tool change event for managers to react
      eventBus.emit("tool:changed", selectedTool || "select")
    }, [selectedTool])

    // ========== Helper Functions ==========
    const updateGridThickness = (zoom) =>
      updateGridLineThickness(gridRef.current, zoom)

    // ========== Toolbar Zoom Handler ==========
    useEffect(() => {
      if (!zoomSignal || !drawRef.current) return
      const { type } = zoomSignal
      const zoomStep = type === "in" ? 1.1 : 0.9
      const draw = drawRef.current
      const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5)
      draw.zoom(newZoom)
      updateGridThickness(newZoom)
    }, [zoomSignal])

    // ========== Import/Delete Handlers ==========
    const handleImportSVG = async () => {
      await svgObjectManager.current?.importFromFile(drawRef.current)
    }

    const handleDeleteSelected = () => {
      // Try deleting selected SVG object first
      const svgMgr = svgObjectManager.current
      const selectedSvgId = svgMgr?.getSelectedId?.()

      if (selectedSvgId) {
        svgMgr.deleteObject(selectedSvgId)
        selectedRef.current = null
        return
      }

      // Try deleting selected spline
      const selectedSpline = splineManager.current?.getSelected()
      if (selectedSpline) {
        splineManager.current?.deleteSpline(selectedSpline.id)
        selectedRef.current = null
        return
      }

      // Legacy fallback for direct selectedRef
      if (selectedRef.current) {
        const target = selectedRef.current
        target.select(false)
        target.resize(false)
        target.remove()
        selectedRef.current = null
      }
    }

    // Fit canvas viewport to container dimensions
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

    // ========== Imperative Handle (Exposed Methods) ==========
    useImperativeHandle(ref, () => ({
      importSVG: handleImportSVG,
      deleteSelected: handleDeleteSelected,

      // Tool state updates (deprecated - now handled by EventBus via selectedTool prop)
      updateCanvasOnToolChange: () => {
        // No-op: tool changes are now handled by the selectedTool prop change
        // which triggers the useEffect that emits tool:changed event
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

      // --- Project operations delegated to ProjectManager ---
      newProject: () => {
        if (!projectManager.current) return
        projectManager.current.newProject(
          drawRef,
          canvasSizeRef,
          gridSizeRef,
          gridRef,
          fitToCanvas,
          splineManager.current,
          svgObjectManager.current,
          selectedRef
        )
      },

      getProjectJSON: () => {
        if (!projectManager.current) return null
        return projectManager.current.getProjectJSON(
          drawRef,
          canvasSizeRef,
          gridSizeRef,
          splineManager.current,
          svgObjectManager.current
        )
      },

      saveProject: async () => {
        if (!projectManager.current) return null
        return await projectManager.current.save(ref)
      },

      saveAsJSON: async (filename = "project.json") => {
        if (!projectManager.current) return null
        return await projectManager.current.saveAs(filename, ref)
      },

      loadFromJSON: async () => {
        if (!projectManager.current) return
        await projectManager.current.load(
          drawRef,
          canvasSizeRef,
          gridSizeRef,
          gridRef,
          fitToCanvas,
          splineManager.current,
          svgObjectManager.current,
          selectedRef
        )
      },

      loadProjectFromPath: async (path) => {
        if (!projectManager.current) return
        await projectManager.current.loadFromPath(
          path,
          drawRef,
          canvasSizeRef,
          gridSizeRef,
          gridRef,
          fitToCanvas,
          splineManager.current,
          svgObjectManager.current,
          selectedRef
        )
      },

      loadTemplateData: (templateData) => {
        if (!projectManager.current) return
        // Load template data but don't set project path (treat as new project)
        projectManager.current.loadTemplate(
          templateData,
          drawRef,
          canvasSizeRef,
          gridSizeRef,
          gridRef,
          fitToCanvas,
          splineManager.current,
          svgObjectManager.current,
          selectedRef
        )
      },

      exportAsSVG: async (filename = "project.svg") => {
        if (!projectManager.current) return null
        return await projectManager.current.exportSVG(
          filename,
          drawRef,
          canvasSizeRef,
          splineManager.current,
          svgObjectManager.current
        )
      },

      // Project state queries
      getProjectInfo: () => {
        if (!projectManager.current) {
          return { path: null, name: null, isDirty: false }
        }
        return projectManager.current.getState()
      },

      // Edit Menu Operations
      undo: () => {
        if (!historyManager.current) return
        historyManager.current.undoAndRestore()
      },

      redo: () => {
        if (!historyManager.current) return
        historyManager.current.redoAndRestore()
      },

      copy: () => {
        const selectedSpline = splineManager.current?.getSelected()
        const selectedSvg = svgObjectManager.current?.getSelected()

        if (selectedSpline) {
          clipboard.current = {
            type: "spline",
            data: selectedSpline.toJSON(),
          }
          console.log("[Canvas] Copied spline to clipboard")
          eventBus.emit("app:clipboardChanged", { hasClipboard: true })
        } else if (selectedSvg) {
          // Serialize the SVG object with all its transformation data
          clipboard.current = {
            type: "svg",
            data: svgObjectManager.current?.serializeObject(selectedSvg),
          }
          console.log("[Canvas] Copied SVG to clipboard")
          eventBus.emit("app:clipboardChanged", { hasClipboard: true })
        }
      },

      paste: () => {
        if (!clipboard.current) return

        const { type, data } = clipboard.current
        if (type === "spline") {
          // Create new spline from data
          const newSpline = splineManager.current?.createSpline(
            false,
            data.type || "bspline"
          )
          if (newSpline) {
            newSpline.loadFromJSON(data)
            splineManager.current.offsetSplinePoints(newSpline.id, 20, 20)
            // Generate unique ID to avoid conflicts
            newSpline.id = `spline_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 11)}`

            // Re-attach handlers
            if (
              setupPointHandlers &&
              isDraggingPoint &&
              splineManager.current
            ) {
              newSpline.points.forEach((point) => {
                if (point.circle) {
                  setupPointHandlers(
                    point.circle,
                    newSpline,
                    isDraggingPoint,
                    splineManager.current,
                    selectedToolRef,
                    pointSelectionManager.current,
                    historyManager.current
                  )
                }
              })
            }

            splineManager.current?._transformAPI?.attachToAll?.()
          }
        } else if (type === "svg") {
          if (!drawRef.current || !data) return

          let imported = null
          if (data.inner) {
            // Use inner content to avoid double-wrapping
            imported = drawRef.current.group()
            imported.svg(data.inner)
          } else if (data.svg) {
            // Legacy: full SVG markup
            imported = drawRef.current.group().svg(data.svg)
          }

          if (imported) {
            // Restore transformation matrix if it exists (preserves rotation, scale, skew)
            if (data.matrix && typeof imported.matrix === "function") {
              try {
                // Apply the matrix transformation
                imported.matrix(data.matrix)
                // Get current position and offset it
                const bbox = imported.bbox()
                imported.move(bbox.x + 20, bbox.y + 20)
              } catch (err) {
                console.warn("[Canvas] Failed to restore matrix on paste:", err)
                // Fallback: just offset without matrix
                imported.dmove(20, 20)
              }
            } else if (data.transform) {
              // Legacy fallback: apply transform if matrix not available
              try {
                imported.transform(data.transform)
                imported.dmove(20, 20)
              } catch (err) {
                console.warn(
                  "[Canvas] Failed to restore transform on paste:",
                  err
                )
                imported.dmove(20, 20)
              }
            } else {
              // No transformation data, just offset
              imported.dmove(20, 20)
            }

            svgObjectManager.current?.addObject(imported)
          }
        }
      },
      cut: () => {
        ref.current.copy()
        ref.current.deleteSelected()
      },

      // Z-Order Operations
      bringToFront: () => {
        splineManager.current?.bringToFront()
        svgObjectManager.current?.bringToFront()
      },
      bringForward: () => {
        splineManager.current?.bringForward()
        svgObjectManager.current?.bringForward()
      },
      sendToBack: () => {
        splineManager.loadcurrent?.sendToBack()
        svgObjectManager.current?.sendToBack()
      },
      sendBackward: () => {
        splineManager.current?.sendBackward()
        svgObjectManager.current?.sendBackward()
      },
      togglePointDirection: () => {
        splineManager.current?.togglePointDirection()
      },

      // History manager reference (private API for hotkeys)
      _historyManager: historyManager.current,
    }))

    // Attach history manager to ref for external access
    if (ref?.current) {
      ref.current._historyManager = historyManager.current
    }

    return (
      <div
        ref={canvasRef}
        className="canvas-container"
        style={{ cursor: "grab" }}
      />
    )
  }
)

export default Canvas
