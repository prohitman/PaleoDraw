// src/input/HotkeysManager.js
import hotkeys from "hotkeys-js"

/**
 * HotkeysManager: Centralized registry and dispatcher for all hotkeys
 * Leverages hotkeys-js library for robust key handling and scope management
 */
export default class HotkeysManager {
  constructor() {
    this.registry = new Map() // key -> { scope, handler, description }
    this.scopes = new Set(["global", "canvas", "selection"])

    // Configure hotkeys-js to use "all" scope so we can do our own filtering
    hotkeys.filter = () => true // Allow hotkeys even when inputs are focused (we'll filter manually)
    hotkeys.setScope("all") // Use "all" scope for hotkeys-js, we manage scopes ourselves

    // Set initial scopes (global and canvas active by default)
    this.activeScopes = new Set(["global", "canvas"])

    console.log("[HotkeysManager] Initialized with hotkeys-js")
  }

  /**
   * Register a hotkey with its handler
   * @param {string} key - Hotkey string (e.g., 'ctrl+s', 'delete', 't')
   * @param {string} scope - Scope name (e.g., 'global', 'canvas', 'selection')
   * @param {function} handler - Callback function
   * @param {string} description - Human-readable description
   */
  register(key, scope, handler, description) {
    if (!this.scopes.has(scope)) {
      console.warn(`[HotkeysManager] Unknown scope: ${scope}`)
    }

    const registryKey = `${key}@${scope}`
    this.registry.set(registryKey, { key, scope, handler, description })

    hotkeys(key, "all", (event, hotkeyHandler) => {
      if (!this.activeScopes.has(scope)) {
        console.log(
          `[HotkeysManager] Hotkey ${key} ignored - scope ${scope} not active. Active scopes:`,
          Array.from(this.activeScopes)
        )
        return
      }

      const target = event.target || event.srcElement
      const tagName = target.tagName
      const isInput =
        tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"

      // Allow Escape and navigation keys in inputs
      const allowedInInputs = ["esc", "escape", "tab", "enter"]
      const keyName = hotkeyHandler.key.toLowerCase()

      if (isInput && !allowedInInputs.includes(keyName)) {
        return
      }

      event.preventDefault()

      try {
        handler(event)
        console.log(`[HotkeysManager] Executed: ${key} (${scope})`)
      } catch (e) {
        console.error(`[HotkeysManager] Error executing ${key}:`, e)
      }
    })

    console.log(
      `[HotkeysManager] Registered: ${key} (${scope}) - ${description}`
    )
  }

  /**
   * Get all hotkeys for a specific scope
   * @param {string} scope
   * @returns {Map}
   */
  getHotkeysForScope(scope) {
    const result = new Map()
    for (const [key, data] of this.registry) {
      if (data.scope === scope) {
        result.set(key, data)
      }
    }
    return result
  }

  /**
   * Get all active hotkeys (from currently active scopes)
   * @returns {Map}
   */
  getActiveHotkeys() {
    const result = new Map()
    for (const [key, data] of this.registry) {
      if (this.activeScopes.has(data.scope)) {
        result.set(key, data)
      }
    }
    return result
  }

  /**
   * Activate a scope
   * @param {string} scope
   */
  activateScope(scope) {
    if (this.scopes.has(scope)) {
      this.activeScopes.add(scope)
      console.log(`[HotkeysManager] Activated scope: ${scope}`, {
        activeScopes: Array.from(this.activeScopes),
      })
    }
  }

  /**
   * Deactivate a scope
   * @param {string} scope
   */
  deactivateScope(scope) {
    this.activeScopes.delete(scope)
    console.log(`[HotkeysManager] Deactivated scope: ${scope}`, {
      activeScopes: Array.from(this.activeScopes),
    })
  }

  /**
   * Get all registered hotkeys (for help/reference)
   * @returns {Array} - Array of { key, scope, description }
   */
  getAllHotkeys() {
    const result = []
    for (const [, data] of this.registry) {
      result.push({
        key: data.key,
        scope: data.scope,
        description: data.description,
      })
    }
    return result.sort((a, b) => a.key.localeCompare(b.key))
  }

  /**
   * Unbind all hotkeys and cleanup
   */
  destroy() {
    hotkeys.unbind()
    this.registry.clear()
    console.log("[HotkeysManager] Destroyed and cleaned up")
  }
}
