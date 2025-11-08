// hooks/useKeyboardResizeModifier.js
import { useEffect, useRef } from "react";

/**
 * useKeyboardResizeModifier(selectedRef)
 * - Listens for Shift keydown/keyup and toggles preserveAspectRatio on selected element's resize.
 * - Works with svg.js resize plugin API used earlier.
 */
export default function useKeyboardResizeModifier(selectedRef) {
  const isShiftRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Shift" && selectedRef.current && !isShiftRef.current) {
        isShiftRef.current = true;
        try {
          // svg.resize API supports passing options/preserve argument
          if (typeof selectedRef.current.resize === "function") {
            selectedRef.current.resize({ preserveAspectRatio: true }, true);
          }
        } catch (err) {
          // Some versions use _isResizing flag or different signature; attempt safe ops
          try {
            selectedRef.current._preserveAspect = true;
          } catch {}
        }
      }
    };

    const onKeyUp = (e) => {
      if (e.key === "Shift" && selectedRef.current && isShiftRef.current) {
        isShiftRef.current = false;
        try {
          if (typeof selectedRef.current.resize === "function") {
            selectedRef.current.resize({ preserveAspectRatio: false }, false);
          }
        } catch (err) {
          try {
            selectedRef.current._preserveAspect = false;
          } catch {}
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedRef]);
}
