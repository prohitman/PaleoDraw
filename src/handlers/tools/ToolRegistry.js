// src/handlers/ToolRegistry.js
/**
 * ToolRegistry: Central registry for tool-specific event handlers
 * Allows tools to register and unregister their handlers dynamically
 * Only the active tool's handlers are called for events
 */
import logger from "../../utils/logger.js"

export default class ToolRegistry {
  constructor() {
    // Map of tool name -> { mousedown, mousemove, mouseup, click, doubleclick, etc. }
    this.toolHandlers = new Map()
    // Currently active tool
    this.activeTool = null
  }

  /**
   * Register handlers for a tool
   * @param {string} toolName - Name of the tool (e.g., "curve", "select", "delete_spline")
   * @param {object} handlers - Object with handler methods { click, mousedown, mousemove, mouseup, etc. }
   */
  registerTool(toolName, handlers) {
    if (!toolName || !handlers) {
      logger.error("[ToolRegistry] Invalid tool registration:", {
        toolName,
        handlers,
      })
      return
    }
    this.toolHandlers.set(toolName, handlers)
    logger.debug(
      `[ToolRegistry] Registered tool: ${toolName}`,
      Object.keys(handlers),
    )
  }

  /**
   * Activate a tool (its handlers will be called)
   * @param {string} toolName - Name of the tool to activate
   */
  activateTool(toolName) {
    if (!this.toolHandlers.has(toolName)) {
      logger.warn(
        `[ToolRegistry] Cannot activate unregistered tool: ${toolName}`,
      )
      return
    }
    const oldTool = this.activeTool
    this.activeTool = toolName
    logger.debug(`[ToolRegistry] Activated tool: ${toolName} (was: ${oldTool})`)
  }

  /**
   * Get the currently active tool's handlers
   * @returns {object|null} - The handlers object or null if no tool active
   */
  getActiveToolHandlers() {
    if (!this.activeTool) return null
    return this.toolHandlers.get(this.activeTool) || null
  }

  /**
   * Get all registered tools tool name
   * @returns {string|null}
   */
  getActiveTool() {
    return this.activeTool
  }
}
