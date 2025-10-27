import React from "react"

export default function GridOverlay() {
  const size = 25
  const lines = []

  for (let i = 0; i <= 800; i += size) {
    lines.push(<line key={`v${i}`} x1={i} y1="0" x2={i} y2="600" stroke="#333" strokeWidth="0.5" />)
    lines.push(<line key={`h${i}`} x1="0" y1={i} x2="800" y2={i} stroke="#333" strokeWidth="0.5" />)
  }

  return (
    <svg
      className="grid-overlay"
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      {lines}
    </svg>
  )
}
