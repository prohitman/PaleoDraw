// hooks/usePanFeedback.js
import { useEffect, useRef } from "react";

/**
 * usePanFeedback(containerRef, drawRef)
 * - Makes cursor show 'grab'/'grabbing' while panning.
 * - Prevents panning when interacting with selection handles, shapes, etc.
 * - Exposes isPanningRef if you need programmatic access.
 */
export default function usePanFeedback(containerRef, drawRef) {
  const isPanningRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !drawRef.current) return;

    const isHandle = (target) => {
      if (!target) return false;
      // class checks used by svg.select/resize plugins
      const cls = target.classList || [];
      if (cls && (cls.contains("svg_select_handle") || cls.contains("svg_select_shape")))
        return true;
      // bounding rect wrapper check
      if (target.closest && target.closest(".svg_select_boundingRect")) return true;
      return false;
    };

    const handleMouseDown = (e) => {
      if (isHandle(e.target)) return;
      isPanningRef.current = true;
      container.style.cursor = "grabbing";
    };

    const handleMouseMove = (e) => {
      if (isHandle(e.target)) return;
      if (!isPanningRef.current) {
        container.style.cursor = "grab";
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
      }
      container.style.cursor = "grab";
    };

    const handleMouseLeave = () => {
      if (isPanningRef.current) isPanningRef.current = false;
      container.style.cursor = "grab";
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("mouseleave", handleMouseLeave);

    // initialize cursor
    container.style.cursor = "grab";

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.style.cursor = "";
    };
  }, [containerRef, drawRef]);

  return { isPanningRef };
}
