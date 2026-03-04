/**
 * Logger for Electron Main Process
 *
 * Simple environment-aware logging for the main Electron process.
 * Uses CommonJS (require/module.exports) since Electron main runs in Node.js.
 *
 * In production, only warnings and errors are logged.
 * In development, all log levels are active.
 */

const isDevelopment = process.env.NODE_ENV !== "production"

const logger = {
  /**
   * Debug level logging - only visible in development
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log("[DEBUG]", ...args)
    }
  },

  /**
   * Info level logging - only visible in development
   */
  info: (...args) => {
    if (isDevelopment) {
      console.log("[INFO]", ...args)
    }
  },

  /**
   * Warning level logging - always visible
   */
  warn: (...args) => {
    console.warn("[WARN]", ...args)
  },

  /**
   * Error level logging - always visible
   */
  error: (...args) => {
    console.error("[ERROR]", ...args)
  },
}

module.exports = logger
