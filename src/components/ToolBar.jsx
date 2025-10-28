import React, { useState } from "react";
import "./../styles/toolbar.css";

export default function Toolbar({
  onZoom,
  onImportSVG,
  onDelete,
  onApplyGridSize,
  onApplyCanvasSize
}) {
  const [gridSize, setGridSize] = useState(25);
  const [canvasW, setCanvasW] = useState(1200);
  const [canvasH, setCanvasH] = useState(800);

  return (
    <div className="toolbar">
      <button>New</button>
      <button>Open</button>
      <button onClick={onImportSVG}>Import SVG</button>
      <button onClick={() => onZoom("in")}>＋</button>
      <button onClick={() => onZoom("out")}>−</button>
      <button onClick={onDelete}>Delete</button>

      <label style={{ marginLeft: 12 }}>
        Grid:
        <input
          type="number"
          min="5"
          step="1"
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          style={{ width: 60, marginLeft: 6 }}
        />
        <button
          onClick={() => {
            onApplyGridSize && onApplyGridSize(gridSize);
          }}
          style={{ marginLeft: 6 }}
        >
          Apply
        </button>
      </label>

      <label style={{ marginLeft: 12 }}>
        Canvas:
        <input
          type="number"
          value={canvasW}
          onChange={(e) => setCanvasW(Number(e.target.value))}
          style={{ width: 80, marginLeft: 6 }}
        />
        ×
        <input
          type="number"
          value={canvasH}
          onChange={(e) => setCanvasH(Number(e.target.value))}
          style={{ width: 80, marginLeft: 6 }}
        />
        <button
          onClick={() => {
            onApplyCanvasSize && onApplyCanvasSize(canvasW, canvasH);
          }}
          style={{ marginLeft: 6 }}
        >
          Apply
        </button>
      </label>
    </div>
  );
}
