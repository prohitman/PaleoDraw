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
   */
  registerListeners() {
    // Spline events
    eventBus.on("spline:created", () => this.saveHistory())
    eventBus.on("spline:deleted", () => this.saveHistory())
    eventBus.on("spline:modified", () => this.saveHistory())
    eventBus.on("spline:moved", () => this.saveHistory())
    eventBus.on("spline:transformed", () => this.saveHistory())

    // SVG events
    eventBus.on("svg:imported", () => this.saveHistory())
    eventBus.on("svg:deleted", () => this.saveHistory())
    eventBus.on("svg:modified", () => this.saveHistory())
    eventBus.on("svg:moved", () => this.saveHistory())
    eventBus.on("svg:transformed", () => this.saveHistory())

    // Point events
    eventBus.on("point:added", () => this.saveHistory())
    eventBus.on("point:removed", () => this.saveHistory())
    eventBus.on("point:moved", () => this.saveHistory())
    eventBus.on("point:modified", () => this.saveHistory())

    // Group operations
    eventBus.on("selection:deleted", () => this.saveHistory())
    eventBus.on("selection:moved", () => this.saveHistory())
    eventBus.on("points:deleted", () => this.saveHistory())
    eventBus.on("points:moved", () => this.saveHistory())

    console.log(
      "[AutoHistoryPlugin] Registered listeners for all modification events"
    )
  }

  /**
   * Save history snapshot (with optional debouncing)
   */
  saveHistory() {
    if (!this.enabled) return

    if (this.debounceMs > 0) {
      // Debounced save
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
      }
      this.saveTimeout = setTimeout(() => {
        this.performSave()
      }, this.debounceMs)
    } else {
      // Immediate save
      this.performSave()
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
