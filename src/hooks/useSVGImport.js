import { SVG } from "@svgdotjs/svg.js"

export function importSVGFile(drawRef, file) {
  if (!drawRef.current || !file) return
  const reader = new FileReader()
  reader.onload = () => {
    const draw = drawRef.current
    const group = draw.group().svg(reader.result)
    const { width, height } = draw.viewbox()
    group.center(width / 2, height / 2)
    group.draggable()
  }
  reader.readAsText(file)
}
