// managers/ProjectManager.js
import eventBus from "../core/EventBus"
import {
  createNewProject,
  getProjectJSON,
  saveProject as saveProjectFile,
  saveAsJSON as saveAsJSONFile,
  loadFromJSON as loadFromJSONFile,
  loadProjectFromPath as loadProjectFromPathFile,
  exportAsSVG as exportAsSVGFile,
} from "../services/ProjectService"

/**
 * ProjectManager: Manages project lifecycle, state, and file operations
 *
 * Responsibilities:
 * - Track current project path and name
 * - Manage dirty state (unsaved changes)
 * - Coordinate save/load operations
 * - Emit project state change events
 *
 * Benefits:
 * - Single source of truth for project state
 * - Consistent with other manager patterns (SplineManager, HistoryManager, etc.)
 * - Centralized event emission logic
 * - Auto-listens to modification events for dirty tracking
 */
export default class ProjectManager {
  constructor({
    drawRef,
    canvasSizeRef,
    gridSizeRef,
    gridRef,
    fitToCanvas,
    splineManager,
    svgObjectManager,
    selectedRef,
  }) {
    // Project state
    this.currentPath = null
    this.projectName = null
    this.isDirty = false

    // References for project operations
    this.drawRef = drawRef
    this.canvasSizeRef = canvasSizeRef
    this.gridSizeRef = gridSizeRef
    this.gridRef = gridRef
    this.fitToCanvas = fitToCanvas
    this.splineManager = splineManager
    this.svgObjectManager = svgObjectManager
    this.selectedRef = selectedRef

    // Auto-register dirty state listeners
    this.setupDirtyTracking()

    console.log("[ProjectManager] Initialized")
  }

  /**
   * Setup automatic dirty tracking by listening to modification events
   */
  setupDirtyTracking() {
    const dirtyEvents = [
      "spline:created",
      "spline:deleted",
      "spline:modified",
      "spline:moved",
      "spline:transformed",
      "svg:imported",
      "svg:deleted",
      "svg:modified",
      "svg:moved",
      "svg:transformed",
      "point:added",
      "point:removed",
      "point:moved",
      "point:modified",
      "selection:deleted",
      "selection:moved",
      "points:deleted",
      "points:moved",
    ]

    this.markDirtyHandler = () => this.markDirty()

    dirtyEvents.forEach((event) => {
      eventBus.on(event, this.markDirtyHandler)
    })

    this.dirtyEvents = dirtyEvents // Store for cleanup
  }

  /**
   * Cleanup event listeners (call when unmounting)
   */
  destroy() {
    if (this.dirtyEvents && this.markDirtyHandler) {
      this.dirtyEvents.forEach((event) => {
        eventBus.off(event, this.markDirtyHandler)
      })
    }
    console.log("[ProjectManager] Destroyed")
  }

  /**
   * Mark project as having unsaved changes
   */
  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true
      eventBus.emit("project:dirty-changed", { isDirty: true })
      console.log("[ProjectManager] Marked as dirty")
    }
  }

  /**
   * Mark project as clean (no unsaved changes)
   */
  markClean() {
    if (this.isDirty) {
      this.isDirty = false
      eventBus.emit("project:dirty-changed", { isDirty: false })
      console.log("[ProjectManager] Marked as clean")
    }
  }

  /**
   * Set current project path and name, emit change event
   * @param {string|null} path - Full file path or null
   */
  setProjectPath(path) {
    this.currentPath = path
    this.projectName = path
      ? path.split(/[/\\]/).pop().replace(".json", "")
      : null
    eventBus.emit("project:path-changed", { path, name: this.projectName })
    console.log("[ProjectManager] Project path set to:", path)
  }

  /**
   * Clear project state (new project or close)
   */
  clearProject() {
    this.currentPath = null
    this.projectName = null
    this.isDirty = false
    eventBus.emit("project:path-changed", { path: null, name: null })
    eventBus.emit("project:dirty-changed", { isDirty: false })
    console.log("[ProjectManager] Project cleared")
  }

  /**
   * Get current project state
   * @returns {Object} - { path, name, isDirty }
   */
  getState() {
    return {
      path: this.currentPath,
      name: this.projectName,
      isDirty: this.isDirty,
    }
  }

  /**
   * Create a new blank project
   */
  newProject() {
    createNewProject(
      this.drawRef,
      this.canvasSizeRef,
      this.gridSizeRef,
      this.gridRef,
      this.fitToCanvas,
      this.splineManager,
      this.svgObjectManager,
      this.selectedRef
    )
    this.clearProject()
  }

  /**
   * Get project JSON for serialization
   * @returns {string|null} - JSON string or null
   */
  getProjectJSON() {
    return getProjectJSON(
      this.drawRef,
      this.canvasSizeRef,
      this.gridSizeRef,
      this.splineManager,
      this.svgObjectManager
    )
  }

  /**
   * Save project to current path, or prompt for location if new project
   * @returns {Promise<string|null>} - Saved file path or null if cancelled
   */
  async save() {
    const canvasRef = {
      current: { getProjectJSON: () => this.getProjectJSON() },
    }
    console.log(
      "[ProjectManager] Saving project, current path:",
      this.currentPath
    )

    const savedPath = await saveProjectFile(this.currentPath, canvasRef)

    if (savedPath) {
      this.setProjectPath(savedPath)
      this.markClean()
    }

    return savedPath
  }

  /**
   * Save project as (always prompts for location)
   * Does NOT update current project path - creates a copy
   * @param {string} filename - Default filename
   * @returns {Promise<string|null>} - Saved file path or null if cancelled
   */
  async saveAs(filename = "project.json") {
    const canvasRef = {
      current: { getProjectJSON: () => this.getProjectJSON() },
    }

    const savedPath = await saveAsJSONFile(filename, canvasRef)

    // Save As creates a copy without changing the current project
    // Don't update path or clear dirty flag

    return savedPath
  }

  /**
   * Load project from file picker dialog
   * @returns {Promise<void>}
   */
  async load() {
    const loadedPath = await loadFromJSONFile(
      this.drawRef,
      this.canvasSizeRef,
      this.gridSizeRef,
      this.gridRef,
      this.fitToCanvas,
      this.splineManager,
      this.svgObjectManager,
      this.selectedRef
    )

    if (loadedPath) {
      this.setProjectPath(loadedPath)
    } else {
      // If no path (browser mode), clear project tracking
      this.clearProject()
    }

    this.markClean()
  }

  /**
   * Load project from specific file path (Electron only)
   * @param {string} path - Full file path
   * @returns {Promise<void>}
   */
  async loadFromPath(path) {
    console.log("[ProjectManager] Loading from path:", path)

    await loadProjectFromPathFile(
      path,
      this.drawRef,
      this.canvasSizeRef,
      this.gridSizeRef,
      this.gridRef,
      this.fitToCanvas,
      this.splineManager,
      this.svgObjectManager,
      this.selectedRef
    )

    this.setProjectPath(path)
    this.markClean()
  }

  /**
   * Export project as SVG
   * @param {string} filename - Default filename
   * @returns {Promise<boolean>} - True if export succeeded
   */
  async exportSVG(filename = "drawing.svg") {
    return await exportAsSVGFile(
      filename,
      this.drawRef,
      this.canvasSizeRef,
      this.splineManager,
      this.svgObjectManager
    )
  }
}
