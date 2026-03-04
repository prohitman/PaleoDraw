/**
 * Custom Logger Utility
 *
 * Provides environment-aware logging with different levels.
 * In production, only warnings and errors are logged to avoid console spam.
 * In development, all log levels are active for debugging.
 *
 * Usage:
 *   import logger from './utils/logger.js'
 *   logger.debug('Debug message', data)
 *   logger.info('Info message')
 *   logger.warn('Warning message')
 *   logger.error('Error message', error)
 */

const isDevelopment = import.meta.env?.MODE !== "production"

const logger = {
  /**
   * Debug level logging - only visible in development
   * Use for detailed debugging information
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log("[DEBUG]", ...args)
    }
  },

  /**
   * Info level logging - only visible in development
   * Use for general informational messages
   */
  info: (...args) => {
    if (isDevelopment) {
      console.log("[INFO]", ...args)
    }
  },

  /**
   * Warning level logging - always visible
   * Use for potentially problematic situations
   */
  warn: (...args) => {
    console.warn("[WARN]", ...args)
  },

  /**
   * Error level logging - always visible
   * Use for error conditions
   */
  error: (...args) => {
    console.error("[ERROR]", ...args)
  },
}

export default logger
