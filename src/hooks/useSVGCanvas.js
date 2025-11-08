import { useRef, useEffect } from "react"
import { SVG } from "@svgdotjs/svg.js"
import "@svgdotjs/svg.panzoom.js"
import "@svgdotjs/svg.select.js"
import "@svgdotjs/svg.resize.js"
import "@svgdotjs/svg.draggable.js"

export default function useSVGCanvas(containerRef, {
  initialWidth,
  initialHeight,
  initialGridSize = 25,
  onReady
}) {
  const drawRef = useRef(null)
  const gridRef = useRef(null)
  const gridSizeRef = useRef(initialGridSize)
  const canvasSizeRef = useRef({ width: initialWidth, height: initialHeight })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = initialWidth || container.clientWidth
    const height = initialHeight || container.clientHeight
    canvasSizeRef.current = { width, height }

    const draw = SVG().addTo(container).size(width, height).viewbox(0, 0, width, height)
    draw.rect(width, height).fill("#222")

    const grid = draw.group()
    gridRef.current = grid

    const drawGrid = (gSize = gridSizeRef.current) => {
      grid.clear()
      for (let x = 0; x <= width; x += gSize)
        grid.line(x, 0, x, height).stroke({ color: "#333", width: 0.5 })
      for (let y = 0; y <= height; y += gSize)
        grid.line(0, y, width, y).stroke({ color: "#333", width: 0.5 })
    }
    drawGrid()
    gridRef.current._drawGrid = drawGrid

    drawRef.current = draw
    onReady?.(draw, grid)

    return () => draw.remove()
  }, [containerRef])

  const setGridSize = (newSize) => {
    if (!gridRef.current) return
    gridSizeRef.current = newSize
    gridRef.current._drawGrid?.(newSize)
  }

  const resizeCanvas = (newWidth, newHeight) => {
    if (!drawRef.current) return
    canvasSizeRef.current = { width: newWidth, height: newHeight }
    drawRef.current.size(newWidth, newHeight).viewbox(0, 0, newWidth, newHeight)
    const bg = drawRef.current.findOne("rect")
    if (bg) bg.size(newWidth, newHeight)
    gridRef.current?._drawGrid(gridSizeRef.current)
  }

  return { drawRef, gridRef, setGridSize, resizeCanvas }
}
