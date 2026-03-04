// src/handlers/dragDropHandlers.js
/**
 * Drag-and-Drop handlers for SVG file import
 *
 * This module handles both web-based and Electron-based file drops:
 *
 * 1. **Web Drag-and-Drop**: Standard HTML5 drag-and-drop API
 *    - Works in browser and Electron
 *    - Limited to File objects (no direct file paths)
 *    - Provides mouse coordinates for drop positioning
 *
 * 2. **Electron IPC**: Native OS file drop events
 *    - Provides full file paths (useful for recent files, relative paths)
 *    - No mouse coordinates (files dropped on window, not specific location)
 *    - Requires Electron main process to read file contents
 *
 * Both methods ultimately call the same import logic for consistency.
 */
import logger from "../../utils/logger.js"

/**
 * Setup drag-and-drop handlers for SVG import
 * @param {HTMLElement} container - Canvas container element
 * @param {object} draw - SVG.js draw instance
 * @param {object} svgObjectManager - SVGObjectManager instance
 * @returns {object} - Cleanup function
 */
export function setupDragDropHandlers(container, draw, svgObjectManager) {
  if (!container || !draw || !svgObjectManager) {
    logger.warn("[DragDropHandlers] Missing required parameters")
    return { cleanup: () => {} }
  }

  /**
   * Import SVG from file content
   * @param {string} svgContent - SVG file content
   * @param {string} fileName - File name for logging
   * @param {number} x - X coordinate for positioning
   * @param {number} y - Y coordinate for positioning
   * @param {number} offset - Offset for multiple files
   */
  const importSVGContent = async (svgContent, fileName, x, y, offset = 0) => {
    try {
      const imported = draw.group().svg(svgContent)

      // Fix for SVGs without explicit width/height
      const firstChild = imported.first()
      if (firstChild && firstChild.type === "svg") {
        const vb = firstChild.viewbox()
        if (vb && (!firstChild.attr("width") || !firstChild.attr("height"))) {
          firstChild.size(vb.width, vb.height)
        }
      }

      // Position at drop location with offset for multiple files
      imported.center(x + offset, y + offset)

      // Initialize interactive behavior
      svgObjectManager.initializeInteractive(imported)

      // Add to manager
      svgObjectManager.addObject(imported)

      logger.debug(`[DragDropHandlers] Imported: ${fileName}`)
      return imported
    } catch (err) {
      logger.error(`[DragDropHandlers] Error importing ${fileName}:`, err)
      return null
    }
  }

  // ========== Web Drag-and-Drop Handlers ==========

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    container.classList.add("drag-over")
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only remove class if leaving container itself (not child elements)
    if (e.target === container) {
      container.classList.remove("drag-over")
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    container.classList.remove("drag-over")

    const files = Array.from(e.dataTransfer.files)
    const svgFiles = files.filter(
      (file) => file.type === "image/svg+xml" || file.name.endsWith(".svg"),
    )

    if (svgFiles.length === 0) {
      logger.debug("[DragDropHandlers] No SVG files dropped")
      return
    }

    logger.debug(`[DragDropHandlers] Dropped ${svgFiles.length} SVG file(s)`)

    // Get drop position in canvas coordinates
    const { x, y } = draw.point(e.clientX, e.clientY)

    // Import each SVG file
    for (let i = 0; i < svgFiles.length; i++) {
      const file = svgFiles[i]
      const content = await file.text()
      const offset = i * 20 // Stagger multiple files
      await importSVGContent(content, file.name, x, y, offset)
    }
  }

  // ========== Electron IPC Handlers ==========

  let electronFileDropHandler = null

  // Check if running in Electron environment
  if (window.electron?.onFileDrop) {
    electronFileDropHandler = async (filePaths) => {
      logger.debug(
        `[DragDropHandlers] Electron file drop: ${filePaths.length} file(s)`,
      )

      const svgFiles = filePaths.filter((path) => path.endsWith(".svg"))

      if (svgFiles.length === 0) {
        logger.debug("[DragDropHandlers] No SVG files in Electron drop")
        return
      }

      // Center position for Electron drops (no mouse coords available)
      const viewBox = draw.viewbox()
      const centerX = viewBox.x + viewBox.width / 2
      const centerY = viewBox.y + viewBox.height / 2

      // Import each file
      for (let i = 0; i < svgFiles.length; i++) {
        const filePath = svgFiles[i]
        try {
          // Use Electron IPC to read file content
          const content = await window.electron.readFile(filePath)
          const fileName = filePath.split(/[\\/]/).pop() // Get filename from path
          const offset = i * 20
          await importSVGContent(content, fileName, centerX, centerY, offset)
        } catch (err) {
          logger.error(
            `[DragDropHandlers] Error reading file ${filePath}:`,
            err,
          )
        }
      }
    }

    // Register Electron IPC listener
    window.electron.onFileDrop(electronFileDropHandler)
    logger.debug("[DragDropHandlers] Electron file drop handler registered")
  }

  // ========== Attach Event Listeners ==========

  container.addEventListener("dragover", handleDragOver)
  container.addEventListener("dragenter", handleDragEnter)
  container.addEventListener("dragleave", handleDragLeave)
  container.addEventListener("drop", handleDrop)

  // ========== Cleanup Function ==========

  return {
    cleanup: () => {
      container.removeEventListener("dragover", handleDragOver)
      container.removeEventListener("dragenter", handleDragEnter)
      container.removeEventListener("dragleave", handleDragLeave)
      container.removeEventListener("drop", handleDrop)

      // Clean up Electron listener if it exists
      if (electronFileDropHandler && window.electron?.removeFileDropListener) {
        window.electron.removeFileDropListener(electronFileDropHandler)
      }

      logger.debug("[DragDropHandlers] Cleanup complete")
    },
  }
}
