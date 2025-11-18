// src/handlers/ToolRegistry.js
/**
 * ToolRegistry: Central registry for tool-specific event handlers
 * Allows tools to register and unregister their handlers dynamically
 * Only the active tool's handlers are called for events
 */
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
      console.error("[ToolRegistry] Invalid tool registration:", {
        toolName,
        handlers,
      })
      return
    }
    this.toolHandlers.set(toolName, handlers)
    console.log(
      `[ToolRegistry] Registered tool: ${toolName}`,
      Object.keys(handlers)
    )
  }

  /**
   * Unregister a tool's handlers
   * @param {string} toolName - Name of the tool
   */
  unregisterTool(toolName) {
    if (!this.toolHandlers.has(toolName)) {
      console.warn(`[ToolRegistry] Tool not registered: ${toolName}`)
      return
    }
    this.toolHandlers.delete(toolName)
    console.log(`[ToolRegistry] Unregistered tool: ${toolName}`)
    if (this.activeTool === toolName) {
      this.activeTool = null
    }
  }

  /**
   * Activate a tool (its handlers will be called)
   * @param {string} toolName - Name of the tool to activate
   */
  activateTool(toolName) {
    if (!this.toolHandlers.has(toolName)) {
      console.warn(
        `[ToolRegistry] Cannot activate unregistered tool: ${toolName}`
      )
      return
    }
    const oldTool = this.activeTool
    this.activeTool = toolName
    console.log(`[ToolRegistry] Activated tool: ${toolName} (was: ${oldTool})`)
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
   * Get handlers for a specific tool
   * @param {string} toolName - Name of the tool
   * @returns {object|null}
   */
  getToolHandlers(toolName) {
    return this.toolHandlers.get(toolName) || null
  }

  /**
   * Call a handler method on the active tool if it exists
   * @param {string} eventName - Name of the handler method (e.g., "click", "mousedown")
   * @param {any} args - Arguments to pass to the handler
   * @returns {boolean} - True if handler was called, false otherwise
   */
  callActiveHandler(eventName, ...args) {
    const handlers = this.getActiveToolHandlers()
    if (!handlers || !handlers[eventName]) {
      return false
    }
    try {
      handlers[eventName](...args)
      return true
    } catch (error) {
      console.error(
        `[ToolRegistry] Error calling ${this.activeTool}.${eventName}:`,
        error
      )
      return false
    }
  }

  /**
   * Get all registered tools
   * @returns {string[]}
   */
  getAllTools() {
    return Array.from(this.toolHandlers.keys())
  }

  /**
   * Get the currently active tool name
   * @returns {string|null}
   */
  getActiveTool() {
    return this.activeTool
  }
}
