// src/plugins/AutoHistoryPlugin.js
import eventBus from "../utils/EventBus"

/**
 * AutoHistoryPlugin: Automatically saves history when changes occur
 *
 * This plugin eliminates the need for manual saveSnapshot() calls throughout
 * the codebase. It listens to all modification events and automatically
 * triggers history saves.
 *
 * Benefits:
 * - Eliminates 20+ manual saveSnapshot() calls
 * - Single source of truth for history logic
 * - Easy to add debouncing/throttling
 * - Managers don't need historyManager references
 */
export class AutoHistoryPlugin {
  constructor(historyManager, splineManager, svgObjectManager) {
    this.historyManager = historyManager
    this.splineManager = splineManager
    this.svgObjectManager = svgObjectManager
    this.enabled = true
    this.saveTimeout = null
    this.debounceMs = 200 // Debounce to prevent spam during transformations

    this.registerListeners()
    console.log("[AutoHistoryPlugin] Initialized")
  }

  /**
   * Register listeners for all events that should trigger history saves
   * All saves are immediate (no debouncing) to ensure consistent undo/redo
   */
  registerListeners() {
    // Spline events
    eventBus.on("spline:created", () => this.saveHistory(true))
    eventBus.on("spline:deleted", () => this.saveHistory(true))
    eventBus.on("spline:modified", () => this.saveHistory(true))
    eventBus.on("spline:moved", () => this.saveHistory(true))
    eventBus.on("spline:transformed", () => this.saveHistory(true))

    // SVG Object events
    eventBus.on("svg:imported", () => this.saveHistory(true))
    eventBus.on("svg:deleted", () => this.saveHistory(true))
    eventBus.on("svg:modified", () => this.saveHistory(true))
    eventBus.on("svg:moved", () => this.saveHistory(true))
    eventBus.on("svg:transformed", () => this.saveHistory(true))

    // Point events
    eventBus.on("point:added", () => this.saveHistory(true))
    eventBus.on("point:removed", () => this.saveHistory(true))
    eventBus.on("point:moved", () => this.saveHistory(true))
    eventBus.on("point:modified", () => this.saveHistory(true))

    // Group operations
    eventBus.on("selection:deleted", () => this.saveHistory(true))
    eventBus.on("selection:moved", () => this.saveHistory(true))
    eventBus.on("points:deleted", () => this.saveHistory(true))
    eventBus.on("points:moved", () => this.saveHistory(true))

    console.log(
      "[AutoHistoryPlugin] Registered listeners for all modification events (immediate saves)"
    )
  }

  /**
   * Save history snapshot (with optional debouncing)
   * @param {boolean} immediate - If true, skip debounce and save immediately
   */
  saveHistory(immediate = false) {
    if (!this.enabled) return

    // Clear any pending debounced save when immediate save is requested
    if (immediate && this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    if (immediate || this.debounceMs <= 0) {
      // Immediate save
      this.performSave()
    } else {
      // Debounced save
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
      }
      this.saveTimeout = setTimeout(() => {
        this.performSave()
      }, this.debounceMs)
    }
  }

  /**
   * Actually perform the history save
   */
  performSave() {
    if (!this.historyManager || !this.splineManager || !this.svgObjectManager) {
      console.warn("[AutoHistoryPlugin] Cannot save: managers not initialized")
      return
    }

    this.historyManager.saveSnapshot(this.splineManager, this.svgObjectManager)
    console.log("[AutoHistoryPlugin] History saved automatically")
  }

  /**
   * Enable auto-saving
   */
  enable() {
    this.enabled = true
    console.log("[AutoHistoryPlugin] Auto-save enabled")
  }

  /**
   * Disable auto-saving (useful for batch operations)
   */
  disable() {
    this.enabled = false
    console.log("[AutoHistoryPlugin] Auto-save disabled")
  }

  /**
   * Set debounce delay
   * @param {number} ms - Milliseconds to debounce
   */
  setDebounce(ms) {
    this.debounceMs = ms
    console.log(`[AutoHistoryPlugin] Debounce set to ${ms}ms`)
  }
}

export default AutoHistoryPlugin
