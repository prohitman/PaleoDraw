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

const Canvas = forwardRef(({ zoomSignal }, ref) => {
  const canvasRef = useRef(null);
  const drawRef = useRef(null);
  const gridRef = useRef(null);
  const svgObjects = useRef([]);
  const selectedRef = useRef(null);

  const zoomLevel = useRef(1);
  const isPanning = useRef(false);
  const isShiftPressed = useRef(false);
  const isAltPressed = useRef(false);

  // --- panZoom persistent settings ---
  const panZoomOptionsRef = useRef({
    panning: true,
    pinchZoom: true,
    wheelZoom: false, // manual handling
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
    const width = container.clientWidth;
    const height = container.clientHeight;

    const draw = SVG()
      .addTo(container)
      .size(width, height)
      .viewbox(0, 0, width, height);

    drawRef.current = draw;
    draw.rect(width, height).fill("#222");

    // --- Grid ---
    const grid = draw.group();
    const gridSize = 25;
    for (let x = 0; x <= width; x += gridSize)
      grid
        .line(x, 0, x, height)
        .stroke({ color: "#333", width: GRID_BASE_THICKNESS });
    for (let y = 0; y <= height; y += gridSize)
      grid
        .line(0, y, width, y)
        .stroke({ color: "#333", width: GRID_BASE_THICKNESS });
    gridRef.current = grid;

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

    // --- Pan cursor feedback ---
    const handleMouseDown = (e) => {
      isPanning.current = true;
      container.style.cursor = "grabbing";
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

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("click", handleBackgroundClick);
      draw.remove();
    };
  }, []);

  // --- Grid thickness ---
  const updateGridThickness = (zoom) => {
    if (!gridRef.current) return;
    const newThickness = GRID_BASE_THICKNESS / zoom;
    gridRef.current.each((i, children) =>
      children.stroke({ width: newThickness })
    );
  };

  // --- Keyboard handlers ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift" && selectedRef.current) {
        isShiftPressed.current = true;
        selectedRef.current.resize({ preserveAspectRatio: true }, true);
      }
      if (e.key === "Alt" && selectedRef.current) {
        isAltPressed.current = true;
        selectedRef.current.resize({ aroundCenter: true }, true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "Shift" && selectedRef.current) {
        isShiftPressed.current = false;
        selectedRef.current.resize({ preserveAspectRatio: false }, false);
      }
      if (e.key === "Alt" && selectedRef.current) {
        isAltPressed.current = false;
        selectedRef.current.resize({ aroundCenter: false }, false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // --- Toolbar zoom ---
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

  // --- Import SVG ---
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

      // --- Resize logic ---
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
      try {
        target.select(false);
        target.resize(false);
        target.remove();
      } catch {}
      selectedRef.current = null;
      console.log("[Delete]", target.id());
    }
  };

  useImperativeHandle(ref, () => ({
    importSVG: handleImportSVG,
    deleteSelected: handleDeleteSelected,
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
});

export default Canvas;
