// src/input/setupHotkeys.js
/**
 * setupHotkeys: Initializes the hotkey system for Canvas
 * Call this once during Canvas initialization to set up all hotkeys
 * Uses hotkeys-js library for robust keyboard event handling
 */
import HotkeysManager from "./HotkeysManager"
import { registerObjectHotkeys } from "./hotkeys/objectHotkeys"
import { registerCanvasHotkeys } from "./hotkeys/canvasHotkeys"

export function setupHotkeys(context) {
  const manager = new HotkeysManager()

  // Register all hotkey modules
  registerObjectHotkeys(manager, context, context.canvasRef)
  registerCanvasHotkeys(manager, context)

  console.log("[setupHotkeys] HotkeysManager initialized with hotkeys-js")
  console.log(
    "[setupHotkeys] Registered hotkeys:",
    manager.getAllHotkeys().length
  )

  // Return cleanup function and manager
  // Note: hotkeys-js handles all keyboard events internally
  return {
    manager,
    cleanup: () => {
      manager.destroy()
    },
  }
}

export { HotkeysManager }
