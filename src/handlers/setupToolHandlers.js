// src/handlers/setupToolHandlers.js
/**
 * setupToolHandlers: Initialize and register all tool handlers with the ToolRegistry
 * Called once during Canvas initialization
 */

import ToolRegistry from "./ToolRegistry"
import {
  curveToolHandlers,
  selectToolHandlers,
  deleteSplineToolHandlers,
} from "./toolHandlers"

/**
 * Set up the tool registry and register all tool handlers
 * @returns {ToolRegistry} - The initialized registry
 */
export function setupToolHandlers() {
  const registry = new ToolRegistry()

  console.log("[setupToolHandlers] Initializing ToolRegistry")

  // Register all tools
  registry.registerTool("curve", curveToolHandlers)
  registry.registerTool("select", selectToolHandlers)
  registry.registerTool("delete_spline", deleteSplineToolHandlers)

  console.log(
    "[setupToolHandlers] All tools registered:",
    registry.getAllTools()
  )

  // Return the registry so Canvas can use it
  return registry
}

/**
 * Create a handler for canvas click that delegates to the active tool
 * @param {ToolRegistry} toolRegistry - The tool registry
 * @param {Object} drawRef - SVG draw ref
 * @param {Object} splineManager - SplineManager instance
 * @param {Object} svgObjectManager - SVGObjectManager instance
 * @param {Object} selectedTool - Selected tool ref
 * @param {Object} isDraggingPoint - Is dragging ref
 * @param {Object} historyManager - HistoryManager instance
 * @param {Object} selectedRef - Selected SVG object ref
 * @returns {Function} - The click handler function
 */
export function createCanvasClickHandler(
  toolRegistry,
  drawRef,
  splineManager,
  svgObjectManager,
  selectionManager,
  selectedTool,
  isDraggingPoint,
  historyManager,
  selectedRef
) {
  return (e) => {
    const activeTool = toolRegistry.getActiveTool()
    console.log(
      "[createCanvasClickHandler] Click event, active tool:",
      activeTool
    )

    if (!activeTool) {
      console.log("[createCanvasClickHandler] No active tool, ignoring click")
      return
    }

    const context = {
      drawRef,
      manager: splineManager, // Alias for handler compatibility
      svgObjectManager,
      selectionManager,
      selectedTool,
      isDraggingPoint,
      historyManager,
      selectedRef,
    }

    const handlers = toolRegistry.getActiveToolHandlers()
    if (handlers && handlers.click) {
      handlers.click(e, context)
    }
  }
}

/**
 * Activate a tool in the registry when the user selects a different tool
 * @param {ToolRegistry} toolRegistry - The tool registry
 * @param {string} toolName - Name of the tool to activate
 */
export function activateToolInRegistry(toolRegistry, toolName) {
  if (toolName === toolRegistry.getActiveTool()) {
    console.log("[activateToolInRegistry] Tool already active:", toolName)
    return
  }
  toolRegistry.activateTool(toolName)
}

export { ToolRegistry }