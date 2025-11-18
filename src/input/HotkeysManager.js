// src/input/HotkeysManager.js
/**
 * HotkeysManager: Centralized registry and dispatcher for all hotkeys
 * Provides a single source of truth for hotkey definitions and handlers
 */
export default class HotkeysManager {
  constructor() {
    this.hotkeys = new Map() // key -> { scope, handler, description }
    this.scopes = new Set(["global", "canvas", "selection", "tool"])
    this.activeScopes = new Set(["global", "canvas"])
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
    const keyLower = key.toLowerCase()
    this.hotkeys.set(keyLower, { scope, handler, description })
    console.log(
      `[HotkeysManager] Registered: ${keyLower} (${scope}) - ${description}`
    )
  }

  /**
   * Get all hotkeys for a specific scope
   * @param {string} scope
   * @returns {Map}
   */
  getHotkeysForScope(scope) {
    const result = new Map()
    for (const [key, data] of this.hotkeys) {
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
    for (const [key, data] of this.hotkeys) {
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
      console.log(`[HotkeysManager] Activated scope: ${scope}`)
    }
  }

  /**
   * Deactivate a scope
   * @param {string} scope
   */
  deactivateScope(scope) {
    this.activeScopes.delete(scope)
    console.log(`[HotkeysManager] Deactivated scope: ${scope}`)
  }

  /**
   * Execute a hotkey handler if it exists
   * @param {string} key
   * @returns {boolean} - True if hotkey was handled
   */
  execute(key) {
    const keyLower = key.toLowerCase()
    const data = this.hotkeys.get(keyLower)

    console.log("[HotkeysManager.execute] Attempting to execute hotkey:", {
      key: keyLower,
      exists: !!data,
      scope: data?.scope,
      activeScopes: Array.from(this.activeScopes),
      canExecute: data && this.activeScopes.has(data.scope),
    })

    if (data && this.activeScopes.has(data.scope)) {
      try {
        console.log(
          `[HotkeysManager.execute] Executing: ${keyLower} (scope: ${data.scope})`
        )
        data.handler()
        console.log(
          `[HotkeysManager.execute] Successfully executed: ${keyLower}`
        )
        return true
      } catch (e) {
        console.error(
          `[HotkeysManager.execute] Error executing ${keyLower}:`,
          e
        )
      }
    } else if (!data) {
      console.log(`[HotkeysManager.execute] Hotkey not found: ${keyLower}`)
    } else {
      console.log(
        `[HotkeysManager.execute] Hotkey '${keyLower}' scope '${data.scope}' not in active scopes:`,
        Array.from(this.activeScopes)
      )
    }
    return false
  }

  /**
   * Get all registered hotkeys (for help/reference)
   * @returns {Array} - Array of { key, scope, description }
   */
  getAllHotkeys() {
    const result = []
    for (const [key, data] of this.hotkeys) {
      result.push({
        key,
        scope: data.scope,
        description: data.description,
      })
    }
    return result.sort((a, b) => a.key.localeCompare(b.key))
  }
}
