// src/plugins/AutoHistoryPlugin.js
import eventBus from "../core/EventBus"
import logger from "../utils/logger.js"

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

// Store the active instance to prevent duplicate listeners on hot reload
let activePluginInstance = null

export class AutoHistoryPlugin {
  constructor(historyManager, splineManager, svgObjectManager) {
    // Clean up previous instance if it exists (hot reload scenario)
    if (activePluginInstance) {
      logger.debug("[AutoHistoryPlugin] Cleaning up previous instance")
      activePluginInstance.cleanup()
    }

    this.historyManager = historyManager
    this.splineManager = splineManager
    this.svgObjectManager = svgObjectManager
    this.enabled = true
    this.saveTimeout = null
    this.debounceMs = 200 // Debounce to prevent spam during transformations

    this.registerListeners()
    activePluginInstance = this
    logger.info("[AutoHistoryPlugin] Initialized")
  }

  /**
   * Register listeners for all events that should trigger history saves
   * All saves are immediate (no debouncing) to ensure consistent undo/redo
   */
  registerListeners() {
    // Store bound handlers for cleanup
    this._boundSaveHistory = () => this.saveHistory(true)

    // Spline events
    eventBus.on("spline:created", this._boundSaveHistory)
    eventBus.on("spline:deleted", this._boundSaveHistory)
    eventBus.on("spline:modified", this._boundSaveHistory)
    eventBus.on("spline:moved", this._boundSaveHistory)
    eventBus.on("spline:transformed", this._boundSaveHistory)

    // SVG Object events
    eventBus.on("svg:imported", this._boundSaveHistory)
    eventBus.on("svg:deleted", this._boundSaveHistory)
    eventBus.on("svg:modified", this._boundSaveHistory)
    eventBus.on("svg:moved", this._boundSaveHistory)
    eventBus.on("svg:transformed", this._boundSaveHistory)

    // Point events
    eventBus.on("point:added", this._boundSaveHistory)
    eventBus.on("point:removed", this._boundSaveHistory)
    eventBus.on("point:moved", this._boundSaveHistory)
    eventBus.on("point:modified", this._boundSaveHistory)

    // Group operations
    eventBus.on("selection:deleted", this._boundSaveHistory)
    eventBus.on("selection:moved", this._boundSaveHistory)
    eventBus.on("points:deleted", this._boundSaveHistory)
    eventBus.on("points:moved", this._boundSaveHistory)

    logger.debug(
      "[AutoHistoryPlugin] Registered listeners for all modification events (immediate saves)",
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
      logger.warn("[AutoHistoryPlugin] Cannot save: managers not initialized")
      return
    }

    this.historyManager.saveSnapshot(this.splineManager, this.svgObjectManager)
    logger.debug("[AutoHistoryPlugin] History saved automatically")
  }

  /**
   * Enable auto-saving
   */
  enable() {
    this.enabled = true
    logger.debug("[AutoHistoryPlugin] Auto-save enabled")
  }

  /**
   * Disable auto-saving (useful for batch operations)
   */
  disable() {
    this.enabled = false
    logger.debug("[AutoHistoryPlugin] Auto-save disabled")
  }

  /**
   * Set debounce delay
   * @param {number} ms - Milliseconds to debounce
   */
  setDebounce(ms) {
    this.debounceMs = ms
    logger.debug(`[AutoHistoryPlugin] Debounce set to ${ms}ms`)
  }

  /**
   * Clean up all event listeners (call during component unmount)
   */
  cleanup() {
    if (!this._boundSaveHistory) {
      logger.debug("[AutoHistoryPlugin] No bound handler to clean up")
      return
    }

    // Remove all event listeners to prevent duplicate registrations
    eventBus.off("spline:created", this._boundSaveHistory)
    eventBus.off("spline:deleted", this._boundSaveHistory)
    eventBus.off("spline:modified", this._boundSaveHistory)
    eventBus.off("spline:moved", this._boundSaveHistory)
    eventBus.off("spline:transformed", this._boundSaveHistory)
    eventBus.off("svg:imported", this._boundSaveHistory)
    eventBus.off("svg:deleted", this._boundSaveHistory)
    eventBus.off("svg:modified", this._boundSaveHistory)
    eventBus.off("svg:moved", this._boundSaveHistory)
    eventBus.off("svg:transformed", this._boundSaveHistory)
    eventBus.off("point:added", this._boundSaveHistory)
    eventBus.off("point:removed", this._boundSaveHistory)
    eventBus.off("point:moved", this._boundSaveHistory)
    eventBus.off("point:modified", this._boundSaveHistory)
    eventBus.off("selection:deleted", this._boundSaveHistory)
    eventBus.off("selection:moved", this._boundSaveHistory)
    eventBus.off("points:deleted", this._boundSaveHistory)
    eventBus.off("points:moved", this._boundSaveHistory)

    this._boundSaveHistory = null

    // Clear module-level reference if this is the active instance
    if (activePluginInstance === this) {
      activePluginInstance = null
    }

    logger.debug("[AutoHistoryPlugin] Cleaned up all event listeners")
  }
}

export default AutoHistoryPlugin
