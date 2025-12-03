// src/core/EventBus.js
import EventEmitter from "./EventEmitter"

/**
 * EventBus: Centralized event hub for the entire application
 * Singleton instance shared across all managers and components
 *
 * Benefits:
 * - Single source of truth for all events
 * - Decouples managers from each other
 * - Enables plugins (like AutoHistoryPlugin)
 * - Easier debugging with centralized event logging
 *
 * Event Naming Convention: <entity>:<action>
 * Examples:
 *   - spline:created
 *   - spline:deleted
 *   - spline:modified
 *   - svg:imported
 *   - svg:deleted
 *   - selection:changed
 *   - point:moved
 *   - history:saved
 */
class EventBus extends EventEmitter {
  constructor() {
    super()
    this.debug = false // Set to true for verbose logging
  }

  /**
   * Emit an event with optional debugging
   * @param {string} event - Event name (preferably <entity>:<action>)
   * @param {*} data - Event payload
   */
  emit(event, data) {
    if (this.debug) {
      console.log(`[EventBus] ${event}`, data)
    }
    super.emit(event, data)
  }

  /**
   * Listen to an event
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  on(event, handler) {
    if (this.debug) {
      console.log(`[EventBus] Registered listener for: ${event}`)
    }
    super.on(event, handler)
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  off(event, handler) {
    if (this.debug) {
      console.log(`[EventBus] Removed listener for: ${event}`)
    }
    super.off(event, handler)
  }

  /**
   * Enable debug logging
   */
  enableDebug() {
    this.debug = true
    console.log("[EventBus] Debug mode enabled")
  }

  /**
   * Disable debug logging
   */
  disableDebug() {
    this.debug = false
  }

  /**
   * Get all registered listeners (for debugging)
   * @returns {object} Map of event names to listener counts
   */
  getListenerStats() {
    const stats = {}
    for (const [event, listeners] of Object.entries(this.listeners)) {
      stats[event] = listeners.length
    }
    return stats
  }
}

// Export singleton instance
export default new EventBus()
