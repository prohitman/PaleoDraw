import EventEmitter from "../utils/eventEmitter"

/**
 * HistoryManager: Manages undo/redo history for the application
 * Emits events: 'stateChange', 'undo', 'redo'
 */
export default class HistoryManager extends EventEmitter {
  constructor() {
    super()

    this.history = []
    this.currentIndex = -1
    this.maxHistorySize = 50 // Maximum number of states to keep
  }

  /**
   * Create a snapshot of the current state
   * This should be called whenever the user makes a change
   * @param {object} splineData - Array of serialized splines
   * @param {object} svgData - Array of serialized SVG objects
   */
  pushState(splineData, svgData) {
    console.log("[HistoryManager] pushState BEFORE", {
      currentIndex: this.currentIndex,
      historySize: this.history.length,
    })
    const state = {
      timestamp: Date.now(),
      splines: JSON.parse(JSON.stringify(splineData)),
      svgs: JSON.parse(JSON.stringify(svgData)),
    }
    if (this.currentIndex >= 0) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }
    this.history.push(state)
    this.currentIndex = this.history.length - 1
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
      this.currentIndex--
    }
    console.log("[HistoryManager] pushState AFTER", {
      currentIndex: this.currentIndex,
      historySize: this.history.length,
    })
    this.emit("stateChange", state)
  }

  /**
   * Undo to previous state
   * Returns null if already at start (before first change)
   * Special behavior: When at index 0, undo goes to -1 (empty canvas state)
   * @returns {object|null} - The previous state or null if already at start
   */
  undo() {
    console.log("[HistoryManager] undo BEFORE", {
      currentIndex: this.currentIndex,
      historySize: this.history.length,
    })
    if (this.currentIndex < 0) {
      console.log("[HistoryManager] Cannot undo, already at start of history")
      return null
    }
    if (this.currentIndex === 0) {
      this.currentIndex = -1
      console.log(
        "[HistoryManager] Undo executed to empty state (before first change), index: -1"
      )
      this.emit("undo", null)
      return { splines: [], svgs: [], isEmpty: true }
    }
    this.currentIndex--
    const state = this.history[this.currentIndex]
    console.log("[HistoryManager] undo AFTER", {
      currentIndex: this.currentIndex,
      historySize: this.history.length,
      stateTimestamp: state?.timestamp,
    })
    this.emit("undo", state)
    return state
  }

  /**
   * Redo to next state
   * @returns {object|null} - The next state or null if at end of history
   */
  redo() {
    console.log("[HistoryManager] redo BEFORE", {
      currentIndex: this.currentIndex,
      historySize: this.history.length,
    })
    if (this.currentIndex >= this.history.length - 1) {
      console.log("[HistoryManager] Cannot redo, at end of history")
      return null
    }
    this.currentIndex++
    const state = this.history[this.currentIndex]
    console.log("[HistoryManager] redo AFTER", {
      currentIndex: this.currentIndex,
      historySize: this.history.length,
      stateTimestamp: state?.timestamp,
    })
    this.emit("redo", state)
    return state
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex > 0
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = []
    this.currentIndex = -1
    console.log("[HistoryManager] History cleared")
  }

  /**
   * Get history info for debugging
   * @returns {object}
   */
  getInfo() {
    return {
      historySize: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    }
  }
}
