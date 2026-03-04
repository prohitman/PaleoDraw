/**
 * Electron Preload Script
 *
 * Security Bridge between Main and Renderer Processes
 *
 * Purpose:
 * - Expose safe, controlled APIs to renderer process via contextBridge
 * - Prevent direct Node.js/Electron API access from renderer
 * - Validate and sanitize IPC communication
 *
 * APIs Exposed:
 * - window.api: File operations (read, save, export)
 * - window.electron: Electron-specific features (file drops, etc.)
 *
 * Security Model:
 * - contextIsolation ensures renderer cannot access Node.js
 * - Only whitelisted methods are exposed
 * - All file operations require explicit user interaction (dialogs)
 */

const { contextBridge, ipcRenderer } = require("electron")
const logger = require("./logger")

/**
 * Main API namespace: File operations and core functionality
 * Available in renderer as window.api
 */
contextBridge.exposeInMainWorld("api", {
  /** Test function to verify bridge is working */
  ping: () => logger.debug("Electron bridge working!"),

  /**
   * Read a project file from disk
   * @param {string} path - Absolute path to file
   * @returns {Promise<string>} File content as UTF-8 string
   */
  readProjectFile: (path) => ipcRenderer.invoke("read-project-file", path),

  /**
   * Save project file to disk
   * @param {string} filePath - Target file path
   * @param {string} content - JSON content to save
   * @param {boolean} isDirect - Whether to skip save dialog
   * @returns {Promise<{success: boolean, filePath: string|null, canceled: boolean}>}
   */
  saveProjectFile: (filePath, content, isDirect = false) =>
    ipcRenderer.invoke("save-project-file", { filePath, content, isDirect }),

  /**
   * Export drawing as SVG file
   * @param {string} defaultPath - Default filename
   * @param {string} content - SVG XML content
   * @returns {Promise<{success: boolean, filePath: string|null, canceled: boolean}>}
   */
  exportSVGFile: (defaultPath, content) =>
    ipcRenderer.invoke("export-svg-file", { defaultPath, content }),

  /**
   * Show file in OS file explorer
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<{success: boolean}>}
   */
  showFileInExplorer: (filePath) =>
    ipcRenderer.invoke("show-file-in-explorer", filePath),

  /**
   * Update title bar overlay styling
   * @param {Object} config - Overlay configuration (color, symbolColor, height)
   */
  updateTitleBarOverlay: (config) =>
    ipcRenderer.send("update-title-bar-overlay", config),
})

/**
 * Electron-specific API namespace
 * Available in renderer as window.electron
 */
contextBridge.exposeInMainWorld("electron", {
  /**
   * Register callback for file drop events
   * @param {Function} callback - Callback(filePaths: string[])
   */
  onFileDrop: (callback) => {
    ipcRenderer.on("file-drop", (event, filePaths) => callback(filePaths))
  },

  /**
   * Unregister file drop listener
   * @param {Function} callback - Previously registered callback
   */
  removeFileDropListener: (callback) => {
    ipcRenderer.removeListener("file-drop", callback)
  },

  /**
   * Read file content (for drag-dropped files)
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<string>} File content as UTF-8 string
   */
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
})
