// src/input/useHotkeys.js
import React, { useEffect, useRef } from "react"
import { useHotkeys as useHotkeysHook } from "react-hotkeys-hook"
import HotkeysManager from "./HotkeysManager"
import { registerSplineHotkeys } from "./hotkeys/splineHotkeys"
import { registerToolHotkeys } from "./hotkeys/toolHotkeys"
import { registerCanvasHotkeys } from "./hotkeys/canvasHotkeys"

/**
 * useHotkeys: React hook to initialize and manage the centralized hotkey system
 * Should be called once at the app level or canvas level
 *
 * @param {Object} context - Context object containing refs and callbacks
 * @returns {HotkeysManager} - The initialized hotkeys manager instance
 */
export function useHotkeys(context = {}) {
  const managerRef = useRef(null)

  // Initialize the HotkeysManager once
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new HotkeysManager()

      // Register all hotkey modules
      registerSplineHotkeys(managerRef.current, context)
      registerToolHotkeys(managerRef.current, context)
      registerCanvasHotkeys(managerRef.current, context)

      console.log(
        "[useHotkeys] HotkeysManager initialized with all hotkey modules"
      )
    }
  }, [context])

  // Set up react-hotkeys-hook listener for all registered hotkeys
  useEffect(() => {
    if (!managerRef.current) return

    const allHotkeys = managerRef.current.getAllHotkeys()
    const hotkeyString = allHotkeys.map((hk) => hk.key).join(",")

    if (!hotkeyString) {
      console.warn("[useHotkeys] No hotkeys registered")
      return
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkeysHook(
      hotkeyString,
      (e) => {
        const key = e.key?.toLowerCase()
        const ctrl = e.ctrlKey || e.metaKey
        const shift = e.shiftKey
        const alt = e.altKey

        // Build hotkey string from event
        let hotkeyStr = key
        if (ctrl) hotkeyStr = "ctrl+" + hotkeyStr
        if (shift) hotkeyStr = "shift+" + hotkeyStr
        if (alt) hotkeyStr = "alt+" + hotkeyStr

        const handled = managerRef.current.execute(hotkeyStr)
        if (handled) {
          e.preventDefault()
        }
      },
      {
        enableOnFormTags: false,
      }
    )
  }, [])

  return managerRef.current
}

// Named export for context/ref setup
export { HotkeysManager }
