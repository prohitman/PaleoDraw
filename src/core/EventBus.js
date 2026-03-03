// src/core/EventBus.js
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
class EventBus {
  constructor() {
    this._events = Object.create(null)
    this.debug = true // TEMPORARY: Enable to debug duplicate listeners
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} fn - Callback function
   * @returns {function} - Unsubscribe function
   */
  on(event, fn) {
    if (this.debug) {
      console.log(`[EventBus] Registered listener for: ${event}`)
    }
    if (!this._events[event]) {
      this._events[event] = []
    }
    this._events[event].push(fn)
    // Return unsubscribe function
    return () => this.off(event, fn)
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} fn - Callback function
   */
  off(event, fn) {
    if (this.debug) {
      console.log(`[EventBus] Removed listener for: ${event}`)
    }
    if (!this._events[event]) return
    this._events[event] = this._events[event].filter((f) => f !== fn)
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name (preferably <entity>:<action>)
   * @param {...any} args - Arguments to pass to callbacks
   */
  emit(event, ...args) {
    if (this.debug) {
      console.log(`[EventBus] ${event}`, ...args)
    }
    if (!this._events[event]) return
    // Create a copy of the listeners array to avoid issues if listeners modify the array
    this._events[event].slice().forEach((fn) => fn(...args))
  }

  /**
   * Remove all listeners for an event (or all events if no event specified)
   */
  clear(event) {
    if (event) {
      delete this._events[event]
    } else {
      this._events = Object.create(null)
    }
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
    for (const [event, listeners] of Object.entries(this._events)) {
      stats[event] = listeners.length
    }
    return stats
  }
}

// Export singleton instance
export default new EventBus()
