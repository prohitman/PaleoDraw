import { useEffect } from "react"

export default function useZoom(drawRef, zoomSignal, zoomSettings = { min: 0.2, max: 5 }) {
  useEffect(() => {
    const draw = drawRef.current
    if (!draw) return
    draw.panZoom({
      zoomMin: zoomSettings.min,
      zoomMax: zoomSettings.max,
      wheelZoom: true,
      zoomFactor: 0.1,
    })
  }, [drawRef])

  useEffect(() => {
    if (!zoomSignal || !drawRef.current) return
    const { type } = zoomSignal
    const draw = drawRef.current
    const zoomStep = type === "in" ? 1.1 : 0.9
    const newZoom = Math.min(Math.max(draw.zoom() * zoomStep, zoomSettings.min), zoomSettings.max)
    draw.zoom(newZoom)
  }, [zoomSignal])
}
