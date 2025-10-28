import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { SVG } from "@svgdotjs/svg.js";
import "@svgdotjs/svg.panzoom.js";
import "@svgdotjs/svg.select.js";
import "@svgdotjs/svg.resize.js";
import "@svgdotjs/svg.draggable.js";

const Canvas = forwardRef(
  ({ zoomSignal, initialGridSize = 25, initialWidth, initialHeight }, ref) => {
    const canvasRef = useRef(null);
    const drawRef = useRef(null);
    const gridRef = useRef(null);
    const svgObjects = useRef([]);
    const selectedRef = useRef(null);

    const zoomLevel = useRef(1);
    const isPanning = useRef(false);
    const isShiftPressed = useRef(false);

    // store current grid/canvas sizes
    const gridSizeRef = useRef(initialGridSize);
    const canvasSizeRef = useRef({
      width: initialWidth ?? 0,
      height: initialHeight ?? 0,
    });

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
    });

    const ZOOM_SMOOTHNESS = 0.05;
    const GRID_BASE_THICKNESS = 0.5;

    useEffect(() => {
      const container = canvasRef.current;
      // fallback to container size if no initial explicit canvas size provided
      const width = canvasSizeRef.current.width || container.clientWidth;
      const height = canvasSizeRef.current.height || container.clientHeight;

      // persist current canvas size
      canvasSizeRef.current = { width, height };

      const draw = SVG()
        .addTo(container)
        .size(width, height)
        .viewbox(0, 0, width, height);

      drawRef.current = draw;
      draw.rect(width, height).fill("#222");

      // --- Grid (draw once, stored in gridRef) ---
      const grid = draw.group();
      gridRef.current = grid;
      // draw grid using helper (centralized so we can redraw later)
      const drawGrid = (gSize = gridSizeRef.current) => {
        grid.clear(); // important — erase previous lines only (no double-draw)
        const { width: w, height: h } = canvasSizeRef.current;
        for (let x = 0; x <= w; x += gSize) {
          grid
            .line(x, 0, x, h)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS });
        }
        for (let y = 0; y <= h; y += gSize) {
          grid
            .line(0, y, w, y)
            .stroke({ color: "#333", width: GRID_BASE_THICKNESS });
        }
      };

      // initial draw
      drawGrid(gridSizeRef.current);

      // store helper on ref so other functions can reuse (not exposed externally)
      gridRef.current._drawGrid = drawGrid;

      // --- panZoom setup ---
      const panZoom = draw.panZoom(panZoomOptionsRef.current);
      zoomLevel.current = 1;

      // --- Wheel Zoom (calls toolbar logic style) ---
      const handleWheel = (e) => {
        e.preventDefault();
        const direction = e.deltaY < 0 ? "in" : "out";
        const zoomStep =
          direction === "in" ? 1 + ZOOM_SMOOTHNESS : 1 - ZOOM_SMOOTHNESS;
        const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5);
        zoomLevel.current = newZoom;
        const point = draw.point(e.offsetX, e.offsetY);
        panZoom.zoom(newZoom, point);
        updateGridThickness(newZoom);
        console.log("[WheelZoom]", direction, newZoom.toFixed(2));
      };
      container.addEventListener("wheel", handleWheel);

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
          return;

        isPanning.current = true;
        container.style.cursor = "grabbing";
      };

      const handleMouseMove = (e) => {
        if (selectedRef.current?._isResizing) return;
        if (
          e.target &&
          e.target.classList &&
          (e.target.classList.contains("svg_select_handle") ||
            e.target.classList.contains("svg_select_shape"))
        )
          return;
        if (!isPanning.current) container.style.cursor = "grab";
      };

      const handleMouseUp = () => {
        isPanning.current = false;
        container.style.cursor = "grab";
      };
      const handleMouseLeave = () => {
        if (isPanning.current) {
          isPanning.current = false;
          container.style.cursor = "grab";
        }
      };
      container.addEventListener("mousedown", handleMouseDown);
      container.addEventListener("mouseup", handleMouseUp);
      container.addEventListener("mouseleave", handleMouseLeave);
      container.addEventListener("mousemove", handleMouseMove);

      // --- Deselect on empty click ---
      const handleBackgroundClick = (e) => {
        if (e.target === container.querySelector("svg")) {
          if (selectedRef.current) {
            selectedRef.current.select(false);
            selectedRef.current.resize(false);
            selectedRef.current = null;
            console.log("[Deselect] Background click");
          }
        }
      };
      container.addEventListener("click", handleBackgroundClick);

      // cleanup
      return () => {
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("mousedown", handleMouseDown);
        container.removeEventListener("mouseup", handleMouseUp);
        container.removeEventListener("mouseleave", handleMouseLeave);
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("click", handleBackgroundClick);
        draw.remove();
      };
    }, []); // end main effect (runs once)

    // --- Grid thickness ---
    const updateGridThickness = (zoom) => {
      if (!gridRef.current) return;
      const newThickness = GRID_BASE_THICKNESS / zoom;
      gridRef.current.each((i, children) =>
        children.stroke({ width: newThickness })
      );
    };

    // --- Keyboard handlers (unchanged) ---
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === "Shift" && selectedRef.current) {
          isShiftPressed.current = true;
          selectedRef.current.resize({ preserveAspectRatio: true }, true);
        }
      };

      const handleKeyUp = (e) => {
        if (e.key === "Shift" && selectedRef.current) {
          isShiftPressed.current = false;
          selectedRef.current.resize({ preserveAspectRatio: false }, false);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, []);

    // --- Toolbar zoom (unchanged except updateGridThickness call) ---
    useEffect(() => {
      if (!zoomSignal || !drawRef.current) return;
      const { type } = zoomSignal;
      const zoomStep = type === "in" ? 1.1 : 0.9;
      const draw = drawRef.current;
      const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, 0.2), 5);
      draw.zoom(newZoom);
      zoomLevel.current = newZoom;
      updateGridThickness(newZoom);
      console.log("[ToolbarZoom]", type, newZoom.toFixed(2));
    }, [zoomSignal]);

    // --- Import SVG (kept intact) ---
    const handleImportSVG = async () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".svg";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const draw = drawRef.current;
        const imported = draw.group().svg(text);

        imported.center(draw.viewbox().width / 2, draw.viewbox().height / 2);
        imported.draggable();

        // --- Drag logic (hides selection box) ---
        imported.on("dragstart", () => {
          console.log("[DragStart]", imported.id());
          if (selectedRef.current === imported) {
            imported.select(false);
            selectedRef.current = null;
            console.log("selection cancelled due to drag start");
          }
        });

        imported.on("dragend", () => {
          console.log("[DragEnd]", imported.id());
          if (selectedRef.current === imported) {
            imported.select(true);
            selectedRef.current = imported;
            console.log("selection restored after drag end");
          }
        });

        // --- Resize logic (keeps your resize refresh) ---
        imported.on("resize", () => {
          if (!imported._resizingActive) {
            imported._resizingActive = true;
          }
          clearTimeout(imported._resizeTimeout);
          imported._resizeTimeout = setTimeout(() => {
            imported._resizingActive = false;
          }, 150);

          // Refresh selection box dynamically
          clearTimeout(imported._refreshTimeout);
          imported._refreshTimeout = setTimeout(() => {
            if (selectedRef.current === imported) {
              imported.select(false);
              selectedRef.current = null;
              imported.select(true);
              selectedRef.current = imported;
              console.log("[Resize] Selection box refreshed");
            }
          }, 1);
        });

        // --- Click selection ---
        imported.on("click", (ev) => {
          ev.stopPropagation();
          console.log("[Select]", imported.id());

          if (selectedRef.current && selectedRef.current !== imported) {
            selectedRef.current.select(false);
          }

          imported.select(true);
          imported.resize({ rotationPoint: true });
          selectedRef.current = imported;
        });

        svgObjects.current.push(imported);
        console.log("[Import]", imported.id());
      };
      input.click();
    };

    const handleDeleteSelected = () => {
      if (selectedRef.current) {
        const target = selectedRef.current;
        target.select(false);
        target.resize(false);
        target.remove();
        selectedRef.current = null;
        console.log("[Delete]", target.id());
      }
    };

    // --- Expose methods to parent: setGridSize and resizeCanvas (non-invasive) ---
    useImperativeHandle(ref, () => ({
      importSVG: handleImportSVG,
      deleteSelected: handleDeleteSelected,

      // setGridSize: redraws the single, existing grid group (avoids double-draw)
      setGridSize: (newSize) => {
        if (!gridRef.current || !drawRef.current) return;
        gridSizeRef.current = newSize;
        // call the helper stored on gridRef
        if (gridRef.current._drawGrid) gridRef.current._drawGrid(newSize);
        console.log("[Grid] setGridSize ->", newSize);
      },

      // resizeCanvas: adjusts svg numeric size + viewbox, redraws grid to new bounds
      resizeCanvas: (newWidth, newHeight) => {
        if (!drawRef.current) return;
        const draw = drawRef.current;
        // update stored canvas size
        canvasSizeRef.current = { width: newWidth, height: newHeight };
        // update SVG size and viewbox
        draw.size(newWidth, newHeight);
        draw.viewbox(0, 0, newWidth, newHeight);

        const bg = draw.findOne("rect");
        if (bg) bg.size(newWidth, newHeight);
        // redraw grid to new extents with current grid size
        if (gridRef.current && gridRef.current._drawGrid)
          gridRef.current._drawGrid(gridSizeRef.current);
        console.log("[Canvas] resizeCanvas ->", newWidth, "x", newHeight);
      },
    }));

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
    );
  }
);

export default Canvas;
