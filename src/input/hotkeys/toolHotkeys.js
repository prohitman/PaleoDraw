// src/input/hotkeys/toolHotkeys.js
/**
 * Tool selection hotkey bindings
 * Handles: T for Select, C for Curve, I for Import, etc.
 */

export function registerToolHotkeys(hotkeysManager, context) {
  const { selectedToolRef, onToolChange } = context

  // Select tool (T)
  hotkeysManager.register(
    "t",
    "global",
    () => {
      if (selectedToolRef?.current !== "select") {
        selectedToolRef.current = "select"
        onToolChange?.("select")
      }
    },
    "Activate Select tool"
  )

  // Curve tool (C)
  hotkeysManager.register(
    "c",
    "global",
    () => {
      if (selectedToolRef?.current !== "curve") {
        selectedToolRef.current = "curve"
        onToolChange?.("curve")
      }
    },
    "Activate Curve tool"
  )

  // Line (polyline) tool (L)
  hotkeysManager.register(
    "l",
    "global",
    () => {
      if (selectedToolRef?.current !== "line") {
        selectedToolRef.current = "line"
        onToolChange?.("line")
      }
    },
    "Activate Line (polyline) tool"
  )

  // NURBS tool (N)
  hotkeysManager.register(
    "n",
    "global",
    () => {
      if (selectedToolRef?.current !== "nurbs") {
        selectedToolRef.current = "nurbs"
        onToolChange?.("nurbs")
      }
    },
    "Activate NURBS tool"
  )

  // Import SVG (I)
  hotkeysManager.register(
    "i",
    "global",
    () => {
      context.onImportSVG?.()
    },
    "Import SVG"
  )

  // Pan tool (P)
  hotkeysManager.register(
    "p",
    "global",
    () => {
      if (selectedToolRef?.current !== "pan") {
        selectedToolRef.current = "pan"
        onToolChange?.("pan")
      }
    },
    "Activate Pan tool"
  )
}
