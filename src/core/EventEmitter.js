// src/core/EventEmitter.js
/**
 * Simple EventEmitter for decoupled event publishing/subscription
 * Used by managers to notify Canvas and other components of state changes
 */
export default class EventEmitter {
  constructor() {
    this._events = Object.create(null)
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} fn - Callback function
   * @returns {function} - Unsubscribe function
   */
  on(event, fn) {
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
    if (!this._events[event]) return
    this._events[event] = this._events[event].filter((f) => f !== fn)
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to callbacks
   */
  emit(event, ...args) {
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
}
