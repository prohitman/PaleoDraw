// HOTKEYS REFERENCE
// ==================
// This document lists all available hotkeys in PaleoDraw
// The hotkey system is centralized in src/input/ and managed by HotkeysManager

## TOOL SELECTION (Global)

- T: Activate Select tool
- C: Activate Curve tool
- P: Activate Pan tool
- I: Import SVG file

## CANVAS & PROJECT (Global)

- Ctrl+N: New project
- Ctrl+O: Open project
- Ctrl+S: Save project
- Ctrl+E: Export as SVG
- Ctrl+Z: Undo (not yet implemented)
- Ctrl+Y: Redo (not yet implemented)
- Ctrl+A: Select all (not yet implemented)
- Escape: Finish drawing spline

## SPLINE OPERATIONS (Selection scope - active when a spline is selected)

- Delete or Backspace: Delete selected spline
- Arrow Up/Down/Left/Right: Nudge selected spline by 10px
- Ctrl+Arrow Up/Down/Left/Right: Fine nudge selected spline by 1px

## ARCHITECTURE

The hotkey system is organized as:

- HotkeysManager: Central registry for all hotkeys
- splineHotkeys.js: Spline-specific hotkeys (delete, nudge, copy, etc.)
- toolHotkeys.js: Tool selection hotkeys (T, C, P, I)
- canvasHotkeys.js: Canvas and project hotkeys (Ctrl+N, Ctrl+S, etc.)
- setupHotkeys.js: Initialization function called from Canvas.jsx
- useHotkeys.js: Alternative React hook approach (legacy, not currently used)

## SCOPES

The hotkey system uses scope-based activation to prevent conflicts:

- global: Always active (tool selection, project operations)
- canvas: Active when canvas has focus
- selection: Active when a spline is selected
- tool: Tool-specific hotkeys (not currently in use)

## ADDING NEW HOTKEYS

1. Identify which scope the hotkey belongs to (global, canvas, selection, etc.)
2. Add a `hotkeysManager.register()` call in the appropriate hotkeys/\*.js file
3. The hotkey will automatically be active based on its scope

Example:

```javascript
hotkeysManager.register(
  "ctrl+d",
  "selection",
  () => {
    // Your handler code
    console.log("Ctrl+D pressed with selection active")
  },
  "Duplicate selected spline"
)
```
