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
    // Prepare deep copies
    const splinesCopy = JSON.parse(JSON.stringify(splineData))
    const svgsCopy = JSON.parse(JSON.stringify(svgData))
    const snapshotString = `${JSON.stringify(splinesCopy)}|${JSON.stringify(
      svgsCopy
    )}`

    // Skip push if identical to last snapshot
    const last = this.history[this.history.length - 1]
    if (last && last._snapshotString === snapshotString) {
      console.log("[HistoryManager] Skipping pushState (duplicate state)")
      return
    }

    const state = {
      timestamp: Date.now(),
      splines: splinesCopy,
      svgs: svgsCopy,
      _snapshotString: snapshotString,
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

  /**
   * Helper method to capture a unified snapshot from managers
   * Reduces code duplication across the codebase
   * @param {object} splineManager - SplineManager instance
   * @param {object} svgObjectManager - SVGObjectManager instance
   */
  saveSnapshot(splineManager, svgObjectManager) {
    const splineData =
      splineManager?.getAllSplines?.()?.map((s) => s.toJSON()) || []
    const svgData = svgObjectManager?.getState?.() || []
    this.pushState(splineData, svgData)
  }

  /**
   * Initialize manager references for restoration
   * @param {object} managers - Object containing all manager references
   */
  initializeManagers(managers) {
    this.splineManager = managers.splineManager
    this.svgObjectManager = managers.svgObjectManager
    this.pointSelectionManager = managers.pointSelectionManager
    this.restorationContext = managers.restorationContext
  }

  /**
   * Restore state by delegating to managers
   * This centralizes restoration logic that was previously in Canvas.jsx
   * @param {object} state - The state to restore
   * @returns {boolean} - True if restoration succeeded
   */
  restoreState(state) {
    if (!state) {
      console.warn("[HistoryManager] Cannot restore: no state provided")
      return false
    }

    if (!this.splineManager || !this.svgObjectManager) {
      console.warn("[HistoryManager] Cannot restore: managers not initialized")
      return false
    }

    // Clear point selection to remove lingering selection boxes
    if (this.pointSelectionManager) {
      this.pointSelectionManager.clearSelection()
    }

    // Delegate to managers' restoreFromState methods
    this.splineManager.restoreFromState(
      state.splines || [],
      this.restorationContext
    )
    this.svgObjectManager.restoreFromState(
      state.svgs || [],
      this.restorationContext
    )

    console.log("[HistoryManager] State restored successfully")
    this.emit("restored", state)
    return true
  }

  /**
   * Undo and restore previous state automatically
   * @returns {boolean} - True if undo succeeded
   */
  undoAndRestore() {
    const state = this.undo()
    if (!state) return false

    // Handle empty state (index -1)
    if (state.isEmpty) {
      return this.restoreState({ splines: [], svgs: [] })
    }

    return this.restoreState(state)
  }

  /**
   * Redo and restore next state automatically
   * @returns {boolean} - True if redo succeeded
   */
  redoAndRestore() {
    const state = this.redo()
    if (!state) return false
    return this.restoreState(state)
  }
}
