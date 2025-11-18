import React, { createContext, useContext, useRef, useCallback, useEffect } from "react";
import hotkeys from "hotkeys-js";

/**
 * Hotkeys Provider / registry
 *
 * API (from context):
 *  - register(binding) -> id
 *  - unregister(id)
 *  - activateScope(name)
 *  - deactivateScope(name)
 *  - getRegistrations()
 *
 * binding = {
 *   keys: "esc" | "ctrl+s",        // string accepted by hotkeys-js
 *   handler: (event) => void,      // callback
 *   scope?: "global" | "canvas",   // default "global"
 *   priority?: number,             // default 0 (higher runs first)
 *   targetRef?: ref to HTMLElement,// optional: only fire if element contains activeElement
 *   enableOnInputs?: boolean,      // default false - if false, ignore when input/select/textarea focused
 *   description?: string,          // optional for help overlays
 *   options?: {}                   // passed to hotkeys-js on bind (e.g. { keydown: true })
 * }
 */

const HotkeysContext = createContext(null);

export function useHotkeysRegistry() {
  const ctx = useContext(HotkeysContext);
  if (!ctx) throw new Error("useHotkeysRegistry must be used inside HotkeysProvider");
  return ctx;
}

export function HotkeysProvider({ children }) {
  // registry keyed by unique id -> registration
  const registryRef = useRef(new Map());
  // map of keyCombo -> Set of registration ids (so we can bind/unbind from hotkeys-js)
  const comboMapRef = useRef(new Map());
  // active scopes set
  const activeScopesRef = useRef(new Set(["global"])); // 'global' active by default

  // helper: ensure hotkeys-js has a single delegate for given combo
  const ensureComboBound = useCallback((combo) => {
    if (comboMapRef.current.has(combo)) return;
    comboMapRef.current.set(combo, new Set());
    // bind central delegator
    hotkeys(combo, (event, handler) => {
      // When hotkeys-js triggers, we delegate to the registry in priority order
      const ids = Array.from(comboMapRef.current.get(combo) || []);
      if (!ids.length) return;

      // get registrations objects, filter disabled, sort by priority desc
      const regs = ids
        .map((id) => registryRef.current.get(id))
        .filter(Boolean)
        .filter((r) => r.enabled !== false) // allow enabled flag
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // find first matching reg that satisfies focus & scope rules
      for (const r of regs) {
        const activeEl = document.activeElement;
        // input filtering
        const isInputLike =
          activeEl &&
          /INPUT|TEXTAREA|SELECT/.test((activeEl && activeEl.tagName) || "");
        if (!r.enableOnInputs && isInputLike) {
          continue;
        }
        // scope check
        if (r.scope && r.scope !== "global" && !activeScopesRef.current.has(r.scope)) {
          continue;
        }
        // targetRef check (if specified, only if activeElement within targetRef.current)
        if (r.targetRef && r.targetRef.current) {
          const t = r.targetRef.current;
          if (!t.contains(activeEl) && activeEl !== t) {
            continue;
          }
        }
        try {
          // allow handler to preventDefault / stopPropagation as needed
          r.handler(event, handler);
        } catch (err) {
          console.error("[HotkeysProvider] handler error", err);
        }
        // stop at the first one that matched (priority order above)
        break;
      }
    });
  }, []);

  // remove combo binding when no registrations remain for combo
  const cleanupCombo = useCallback((combo) => {
    const set = comboMapRef.current.get(combo);
    if (!set || set.size === 0) {
      try {
        hotkeys.unbind(combo);
      } catch (err) {
        // ignore
      }
      comboMapRef.current.delete(combo);
    }
  }, []);

  // register returns an id which must be used to unregister
  const register = useCallback((binding) => {
    if (!binding || !binding.keys || !binding.handler) {
      throw new Error("register requires { keys, handler }");
    }
    const id = `hk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const reg = {
      id,
      keys: binding.keys,
      handler: binding.handler,
      scope: binding.scope || "global",
      priority: binding.priority || 0,
      targetRef: binding.targetRef || null,
      enableOnInputs: !!binding.enableOnInputs,
      description: binding.description || "",
      options: binding.options || {},
      enabled: binding.enabled !== false,
    };
    registryRef.current.set(id, reg);
    // update combo map
    const combo = reg.keys;
    ensureComboBound(combo);
    comboMapRef.current.get(combo).add(id);
    return id;
  }, [ensureComboBound]);

  const unregister = useCallback((id) => {
    const r = registryRef.current.get(id);
    if (!r) return;
    const combo = r.keys;
    registryRef.current.delete(id);
    const set = comboMapRef.current.get(combo);
    if (set) {
      set.delete(id);
      cleanupCombo(combo);
    }
  }, [cleanupCombo]);

  const activateScope = useCallback((scopeName) => {
    if (!scopeName) return;
    activeScopesRef.current.add(scopeName);
  }, []);

  const deactivateScope = useCallback((scopeName) => {
    if (!scopeName) return;
    activeScopesRef.current.delete(scopeName);
  }, []);

  const setActiveScopes = useCallback((scopes = []) => {
    activeScopesRef.current = new Set(scopes);
  }, []);

  const getRegistrations = useCallback(() => {
    return Array.from(registryRef.current.values());
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      // unbind all combos
      comboMapRef.current.forEach((_set, combo) => {
        try {
          hotkeys.unbind(combo);
        } catch {}
      });
      comboMapRef.current.clear();
      registryRef.current.clear();
    };
  }, []);

  const api = {
    register,
    unregister,
    activateScope,
    deactivateScope,
    setActiveScopes,
    getRegistrations,
    _internal: {
      registryRef,
      comboMapRef,
      activeScopesRef,
    },
  };

  return <HotkeysContext.Provider value={api}>{children}</HotkeysContext.Provider>;
}
