// src/input/setupHotkeys.js
/**
 * setupHotkeys: Initializes the hotkey system for Canvas
 * Call this once during Canvas initialization to set up all hotkeys
 */
import HotkeysManager from "./HotkeysManager"
import { registerSplineHotkeys } from "./hotkeys/splineHotkeys"
import { registerToolHotkeys } from "./hotkeys/toolHotkeys"
import { registerCanvasHotkeys } from "./hotkeys/canvasHotkeys"

export function setupHotkeys(context) {
  const manager = new HotkeysManager()

  // Register all hotkey modules
  registerSplineHotkeys(manager, context, context.canvasRef)
  registerToolHotkeys(manager, context)
  registerCanvasHotkeys(manager, context)

  console.log("[setupHotkeys] HotkeysManager initialized")
  console.log(
    "[setupHotkeys] Registered hotkeys:",
    manager.getAllHotkeys().length
  )

  // Set up keyboard event listener
  const handleKeyDown = (e) => {
    let key = e.key?.toLowerCase()
    if (!key) return

    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey

    // Filter out modifier keys from the key value (don't use ctrl/shift/alt/meta as the main key)
    const modifierKeys = [
      "control",
      "shift",
      "alt",
      "meta",
      "ctrlkey",
      "shiftkey",
      "altkey",
    ]
    if (modifierKeys.includes(key)) return

    // Build hotkey string from event - modifiers FIRST, then key
    let hotkeyStr = ""
    if (ctrl) hotkeyStr += "ctrl+"
    if (shift) hotkeyStr += "shift+"
    if (alt) hotkeyStr += "alt+"
    hotkeyStr += key

    console.log("[setupHotkeys.handleKeyDown] Key pressed:", {
      key,
      hotkey: hotkeyStr,
      ctrl,
      shift,
      alt,
      activeScopes: Array.from(manager.activeScopes),
    })

    const handled = manager.execute(hotkeyStr)
    console.log("[setupHotkeys.handleKeyDown] Handler execution result:", {
      hotkey: hotkeyStr,
      handled,
    })

    if (handled) {
      e.preventDefault()
    }
  }

  document.addEventListener("keydown", handleKeyDown)

  // Return cleanup function and manager
  return {
    manager,
    cleanup: () => {
      document.removeEventListener("keydown", handleKeyDown)
    },
  }
}

export { HotkeysManager }
