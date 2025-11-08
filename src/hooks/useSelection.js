// hooks/useSelection.js
import { useEffect, useRef } from "react";
import "@svgdotjs/svg.select.js";
import "@svgdotjs/svg.resize.js";
import "@svgdotjs/svg.draggable.js";

/**
 * useSelection(drawRef)
 * - Listens for clicks on the SVG draw area and manages selection.
 * - Returns selectedRef (React ref) so other hooks/components can read/update selection.
 */
export default function useSelection(drawRef) {
  const selectedRef = useRef(null);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;

    let localSelected = null;

    const handleSelect = (e) => {
      // e.target may be a DOM node; svg.js attaches .instance for SVG.js element
      const target = e?.target?.instance || e?.detail?.instance;
      if (!target) return;

      // ignore background rects (if you use a bg rect)
      const nodeName = e?.target?.nodeName?.toLowerCase();
      if (nodeName === "rect" && target === draw.findOne("rect")) return;

      if (localSelected && localSelected !== target) {
        try { localSelected.select(false); localSelected.resize(false); } catch {}
      }

      localSelected = target;
      selectedRef.current = target;

      // apply select/resize/draggable helpers if available
      try {
        if (typeof target.select === "function") target.select(true);
        if (typeof target.resize === "function")
          target.resize({ rotationPoint: true });
        if (typeof target.draggable === "function") target.draggable();
      } catch (err) {
        // defensive: some svg.js instances might not support these
        console.warn("[useSelection] selection helpers failed", err);
      }
    };

    const handleBackgroundClick = (ev) => {
      // if clicked directly on the <svg> element or on the background rect, deselect
      const node = ev.target;
      if (!node) return;
      const isSvgRoot = node.nodeName?.toLowerCase() === "svg";
      if (isSvgRoot) {
        if (localSelected) {
          try { localSelected.select(false); localSelected.resize(false); } catch {}
          localSelected = null;
          selectedRef.current = null;
        }
      }
    };

    // svg.js emits Dom events on draw.node, but also we can listen via draw.on
    try {
      draw.on("click", handleSelect);
      draw.node.addEventListener("click", handleBackgroundClick);
    } catch (err) {
      console.warn("[useSelection] attach failed", err);
    }

    return () => {
      try {
        draw.off("click", handleSelect);
        draw.node.removeEventListener("click", handleBackgroundClick);
      } catch (err) {}
      if (localSelected) {
        try { localSelected.select(false); localSelected.resize(false); } catch {}
      }
      selectedRef.current = null;
    };
  }, [drawRef]);

  return selectedRef;
}
