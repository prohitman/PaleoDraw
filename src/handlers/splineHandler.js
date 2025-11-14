import { SVG } from "@svgdotjs/svg.js"

/** --- CONFIG --- **/
const SPLINE_COLORS = {
  SELECTED: "#00ffff",
  UNSELECTED: "#16689fff",
  HOVER: "#e3f6f6ff",
}

const POINT_COLOR = "#ffcc00"

/** --- UTILITY HELPERS --- **/

export function updateSplinesOnToolChange(
  splinesRef,
  activeSplineRef,
  selectedTool
) {
  splinesRef.current.forEach((spline) => {
    if (selectedTool?.current !== "curve" && spline.selected) {
      spline.selected = false
      updateSplineVisualState(spline)
      if (activeSplineRef.current === spline) activeSplineRef.current = null
    }
    console.log("Rebinding drag control for spline points due to tool change")
    spline.points.forEach((pt) => pt.bindDragControl?.())
  })
}

export function generateBSplinePath(points) {
  if (!points || points.length < 2) return ""
  const d = [`M${points[0].x},${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`)
  }
  return d.join(" ")
}

export function updateSplineVisualState(spline) {
  if (!spline || !spline.path) return
  spline.path.stroke({
    color: spline.selected ? SPLINE_COLORS.SELECTED : SPLINE_COLORS.UNSELECTED,
    width: 2,
  })

  spline.points.forEach((p) => {
    // show points only when selected
    if (p.circle) spline.selected ? p.circle.show() : p.circle.hide()
  })
}

/** --- CREATION & HANDLING --- **/
export function createSpline(
  draw,
  selectedTool,
  drawRef,
  isDraggingRef,
  splinesRef,
  activeSplineRef
) {
  // Create a group per spline so we can transform (drag/scale/rotate) easily
  const group = draw.group()
  const path = group
    .path("")
    .stroke({ color: SPLINE_COLORS.SELECTED, width: 2 })
    .fill("none")

  const newSpline = {
    id: `spline_${Date.now()}`,
    points: [],
    group,
    path,
    selected: true,
    color: SPLINE_COLORS.SELECTED,
  }

  // click on the path toggles selection or adds a point when in curve tool
  path.on("click", (ev) => {
    ev.stopPropagation()
    if (selectedTool?.current === "curve" && newSpline.selected && !ev.altKey) {
      const { x, y } = drawRef.current.point(ev.clientX, ev.clientY)
      addPointToSpline(
        draw,
        newSpline,
        x,
        y,
        isDraggingRef,
        splinesRef,
        activeSplineRef,
        selectedTool
      )
    }
    handleSplineClick(
      newSpline,
      ev,
      selectedTool,
      isDraggingRef,
      splinesRef,
      activeSplineRef
    )
  })

  path.on("mouseover", () => {
    if (!newSpline.selected)
      path.stroke({ color: SPLINE_COLORS.HOVER, width: 3 })
  })

  path.on("mouseout", () => {
    if (!newSpline.selected)
      path.stroke({ color: SPLINE_COLORS.UNSELECTED, width: 2 })
  })

  return newSpline
}

export function addPointToSpline(
  draw,
  spline,
  x,
  y,
  isDraggingRef,
  splinesRef,
  activeSplineRef,
  selectedTool
) {
  if (!spline || !spline.group) return
  // create circle inside the spline's group so it gets transformed together
  const circle = spline.group.circle(6).fill(POINT_COLOR).center(x, y).show()
  const newPt = { x, y, circle }
  spline.points.push(newPt)
  setupPointHandlers(
    circle,
    spline,
    isDraggingRef,
    splinesRef,
    activeSplineRef,
    selectedTool
  )
  drawOrUpdateSpline(spline)
  updateSplineVisualState(spline)
}

export function drawOrUpdateSpline(spline) {
  if (!spline || !spline.points) return
  const pts = spline.points
  if (pts.length < 2) {
    // hide path if not enough points
    if (spline.path) spline.path.plot("")
    return
  }
  const pathData = generateBSplinePath(pts)
  spline.path.plot(pathData)
}

/** --- CLICK HANDLING --- **/
export function handleSplineClick(
  spline,
  e,
  selectedTool,
  isDraggingRef,
  splinesRef,
  activeSplineRef
) {
  e?.stopPropagation()

  if (
    (selectedTool.current === "curve" || selectedTool.current === "select") &&
    !isDraggingRef.current
  ) {
    // Deselect others
    splinesRef.current.forEach((s) => {
      if (s !== spline) {
        s.selected = false
        updateSplineVisualState(s)
      }
    })

    // Toggle this spline
    spline.selected = !spline.selected
    activeSplineRef.current = spline.selected ? spline : null
    updateSplineVisualState(spline)
  }

  if (selectedTool.current === "delete_spline") {
    deleteSpline(spline, splinesRef, activeSplineRef)
  }
}

/** --- POINT MANIPULATION --- **/
export function deletePointFromSpline(
  spline,
  point,
  splinesRef,
  activeSplineRef
) {
  if (!spline || !point) return
  if (point.circle) point.circle.remove()
  spline.points = spline.points.filter((p) => p !== point)
  drawOrUpdateSpline(spline)
  if (spline.points.length < 2) {
    deleteSpline(spline, splinesRef, activeSplineRef)
  }
}

export function setupPointHandlers(
  point,
  spline,
  isDraggingRef,
  splinesRef,
  activeSplineRef,
  selectedTool
) {
  if (!point) return
  point.draggable()

  const bindDragControl = () => {
    point.off("beforedrag.toolcheck")
    point.on("beforedrag.toolcheck", (e) => {
      if (selectedTool?.current != "curve") {
        e.preventDefault()
      }
    })
  }

  bindDragControl()
  point.bindDragControl = bindDragControl

  point.on("dragmove.curveTool", () => {
    if (selectedTool?.current != "curve") return
    const cx = point.cx()
    const cy = point.cy()
    const p = spline.points.find((pt) => pt.circle === point)
    if (p) {
      p.x = cx
      p.y = cy
      drawOrUpdateSpline(spline)
    }
    isDraggingRef.current = true
  })

  point.on("dragend.curveTool", () => {
    setTimeout(() => (isDraggingRef.current = false), 100)
  })

  point.on("contextmenu.curveTool", (e) => {
    if (selectedTool?.current != "curve") return
    console.log("selectedTool:", selectedTool?.current)
    e.preventDefault()
    e.stopPropagation()
    const p = spline.points.find((pt) => pt.circle === point)
    if (p) deletePointFromSpline(spline, p, splinesRef, activeSplineRef)
  })
}

/** --- SPLINE DELETION --- **/
export function deleteSpline(spline, splinesRef, activeSplineRef) {
  if (!spline) return
  // remove group which contains path + point circles
  if (spline.group) spline.group.remove()
  splinesRef.current = splinesRef.current.filter((s) => s !== spline)
  if (activeSplineRef.current === spline) activeSplineRef.current = null
}

/** --- ALT+CLICK INSERT --- **/

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1)

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(px - projX, py - projY)
}

export function insertPointByProximity(
  drawRef,
  spline,
  x,
  y,
  isDraggingRef,
  splinesRef,
  activeSplineRef,
  selectedTool
) {
  if (!spline || spline.points.length < 2) return

  let minDist = Infinity
  let insertIndex = spline.points.length

  for (let i = 0; i < spline.points.length - 1; i++) {
    const p1 = spline.points[i]
    const p2 = spline.points[i + 1]
    const dist = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y)
    if (dist < minDist) {
      minDist = dist
      insertIndex = i + 1
    }
  }

  // create the circle inside the spline's group
  const point = spline.group.circle(6).fill(POINT_COLOR).center(x, y).show()
  const newPt = { x, y, circle: point }
  spline.points.splice(insertIndex, 0, newPt)

  setupPointHandlers(
    point,
    spline,
    isDraggingRef,
    splinesRef,
    activeSplineRef,
    selectedTool
  )
  drawOrUpdateSpline(spline)
  updateSplineVisualState(spline)
}

/** --- FINISHING --- **/
export function finishActiveSpline(activeSplineRef) {
  if (activeSplineRef.current) {
    activeSplineRef.current.selected = false
    updateSplineVisualState(activeSplineRef.current)
    activeSplineRef.current = null
  }
}

/** --- TRANSFORMATIONS: attach selection/drag/resize/rotate to spline groups --- **/
export function setupSplineTransformations(
  draw,
  splinesRef,
  selectedTool,
  isDraggingRef
) {
  let selectedSpline = null
  let lastTool = selectedTool?.current ?? null

  const clearSelection = () => {
    if (!selectedSpline) return
    try {
      const el = selectedSpline.group
      console.log(
        "[spline] clearSelection() -> clearing selection for:",
        selectedSpline?.id
      )
      // unset visual selection state
      selectedSpline.selected = false
      try {
        updateSplineVisualState(selectedSpline)
      } catch {}
      // try to disable group transform UI
      try {
        if (el) {
          el.select(false)
          el.draggable(false)
          el.resize(false)
        }
      } catch (err) {
        console.warn("[spline] clearSelection error while toggling group:", err)
      }
    } catch (err) {
      console.warn("[spline] clearSelection error:", err)
    } finally {
      selectedSpline = null
    }
  }

  const selectSpline = (spline) => {
    console.log("[spline] selectSpline called for:", spline?.id)
    // if the same spline is already selected, leave it (idempotent)
    if (selectedSpline === spline) {
      console.log("[spline] selectSpline noop (already selected):", spline?.id)
      return
    }

    clearSelection()
    if (!spline || !spline.group) return
    if (selectedTool?.current !== "select") {
      console.log(
        "[spline] abort selectSpline - wrong tool:",
        selectedTool?.current
      )
      return
    }

    selectedSpline = spline
    try {
      spline.selected = true
      updateSplineVisualState(spline)
    } catch (err) {
      console.warn("[spline] update visual on select failed:", err)
    }

    const el = spline.group
    el.select({ rotationPoint: true })
    el.resize({ rotationPoint: true })
    el.draggable()
    // remove any previous transform handlers, rebind fresh handlers below
    el.off(".splineTransform")

    // small helpers
    const resetGroupTransform = () => {
      try {
        // remove any transform attribute so the group remains identity
        if (typeof el.untransform === "function") el.untransform()
        else if (el.node && el.node.removeAttribute)
          el.node.removeAttribute("transform")
      } catch (err) {
        console.warn("[spline] resetGroupTransform failed:", err)
      }
    }

    /**
     * Bake the group's current transform into the spline's points.
     * We attempt to use the _rotateStartPoints (or _resizeStartPoints) as the
     * original source of truth so baking is deterministic. If those are missing
     * fall back to the current spline.points values.
     *
     * This applies the full affine matrix (a,b,c,d,e,f) so it handles rotation,
     * translation and scaling consistently.
     */
    const bakeGroupTransform = () => {
      try {
        const m = el.matrixify?.()
        console.log("[spline] bakeGroupTransform matrix")
        if (!m) {
          // nothing to bake
          resetGroupTransform()
          console.log("[spline] bakeGroupTransform: no matrix to bake")
          return
        }

        // choose a stable source for original coords:
        const srcPoints =
          spline._rotateStartPoints ||
          spline._resizeStartPoints ||
          spline.points.map((p) => ({ x: p.x, y: p.y }))

        // apply affine matrix to each source point: [a c e; b d f] * [x; y; 1]
        srcPoints.forEach((sp, i) => {
          const nx = m.a * sp.x + m.c * sp.y + (m.e ?? 0)
          const ny = m.b * sp.x + m.d * sp.y + (m.f ?? 0)
          const pt = spline.points[i] || spline.points[i] /* defensive */
          if (pt) {
            pt.x = nx
            pt.y = ny
            try {
              pt.circle?.center(pt.x, pt.y)
            } catch {}
          }
        })

        // ensure path reflects baked coords
        drawOrUpdateSpline(spline)
      } catch (err) {
        console.warn("[spline] bakeGroupTransform failed:", err)
      } finally {
        // always remove the group's transform so visual = baked coords
        resetGroupTransform()
      }
    }

    // DRAG handlers
    el.on("dragstart.splineTransform", (e) => {
      try {
        console.log("[spline] dragstart", {
          splineId: spline.id,
          detail: e?.detail,
        })
        el.select(false)
        const startBox = e?.detail?.box || el.bbox()
        spline._startBox = {
          x: startBox.x,
          y: startBox.y,
          w: startBox.w,
          h: startBox.h,
        }
        spline._startPoints = spline.points.map((pt) => ({ x: pt.x, y: pt.y }))
        console.log("[spline] dragstart snapshot", {
          splineId: spline.id,
          _startBox: spline._startBox,
          _startPoints: spline._startPoints,
        })
      } catch (err) {
        console.error("[spline] dragstart error:", err)
      }
    })

    el.on("dragmove.splineTransform", (e) => {
      try {
        e.preventDefault()
        console.log("[spline] dragmove", {
          splineId: spline.id,
          detail: e?.detail,
        })
        const box = e?.detail?.box
        const startBox = spline._startBox
        if (!box || !spline._startPoints) {
          const dx = e?.detail?.dx || 0
          const dy = e?.detail?.dy || 0
          if (dx === 0 && dy === 0) return
          spline.points.forEach((pt, i) => {
            const sp = (spline._startPoints && spline._startPoints[i]) || {
              x: pt.x,
              y: pt.y,
            }
            pt.x = sp.x + dx
            pt.y = sp.y + dy
            pt.circle?.center(pt.x, pt.y)
          })
          drawOrUpdateSpline(spline)
          isDraggingRef.current = true
          return
        }
        const dx = box.x - startBox.x
        const dy = box.y - startBox.y
        spline.points.forEach((pt, i) => {
          const sp = (spline._startPoints && spline._startPoints[i]) || {
            x: pt.x,
            y: pt.y,
          }
          pt.x = sp.x + dx
          pt.y = sp.y + dy
          try {
            pt.circle?.center(pt.x, pt.y)
          } catch {}
        })
        drawOrUpdateSpline(spline)
        isDraggingRef.current = true
      } catch (err) {
        console.error("[spline] dragmove handler error:", err)
      }
    })

    el.on("dragend.splineTransform", (e) => {
      try {
        console.log("[spline] dragend", {
          splineId: spline.id,
          detail: e?.detail,
        })
        delete spline._startBox
        delete spline._startPoints
        setTimeout(() => {
          try {
            el.select(true)
          } catch {}
        }, 0)
      } catch (err) {
        console.error("[spline] dragend handler error:", err)
      } finally {
        setTimeout(() => (isDraggingRef.current = false), 50)
      }
    })

    // Unified handler for "resize" events coming from the resize plugin
    // Here we implement continuous baking for rotations: on every rotate-move we apply the delta
    // rotation directly to point coordinates and immediately clear the group's transform so the
    // group's transform never accumulates and points remain the single source of truth.
    el.on("resize.splineTransform", (e) => {
      try {
        const detail = e?.detail || {}
        console.log("[spline] raw resize event:", {
          splineId: spline.id,
          eType: e?.type,
          detail,
        })

        console.log("spline angle")

        // Normalize/parse handle name (e.g. 'lt.resize' -> 'lt', 'rot.resize' -> 'rot', 'point' -> 'point')
        const rawEventType = (detail.eventType || "").toString()
        const handleName = rawEventType.replace(/\.resize$/i, "").split(".")[0]
        const userEventType = detail.event?.type || ""

        // lifecycle detection
        // rotation-specific bookkeeping
        const isRotateOp =
          handleName === "rot" ||
          handleName === "rotate" ||
          typeof detail.angle === "number"

        const isDone = /up|end|cancel/i.test(userEventType)
        const isMove = isRotateOp && spline._rotateIsActive

        const isStart = isRotateOp && !spline._rotateIsActive

        console.log("[spline] resize classification:", {
          handleName,
          userEventType,
          isStart,
          isMove,
          isDone,
        })

        const box = detail.box || null

        // ----- START -----
        if (isStart) {
          console.log("[spline] resize start detected", {
            splineId: spline.id,
            handleName,
            box,
          })

          const sb = box || el.bbox()
          spline._resizeStartBox = {
            x: sb.x,
            y: sb.y,
            w: sb.w || sb.width,
            h: sb.h || sb.height,
            cx: (sb.x ?? sb.x) + (sb.w ?? sb.width) / 2,
            cy: (sb.y ?? sb.y) + (sb.h ?? sb.height) / 2,
          }
          spline._resizeStartPoints = spline.points.map((pt) => ({
            x: pt.x,
            y: pt.y,
          }))

          if (isRotateOp) {
            const cx = (sb.x ?? sb.x) + (sb.w ?? sb.width) / 2
            const cy = (sb.y ?? sb.y) + (sb.h ?? sb.height) / 2
            spline._rotatePivot = { x: cx, y: cy }
            spline._rotateStartPoints = spline.points.map((pt) => ({
              x: pt.x,
              y: pt.y,
            }))

            // Use detail.angle if available (most reliable source), otherwise derive from matrix
            let startAngle = 0
            if (typeof detail.angle === "number") {
              startAngle = detail.angle
            } else {
              try {
                const m = el.matrixify?.()
                startAngle = m ? Math.atan2(m.b, m.a) : 0
              } catch (err) {
                console.warn(
                  "[spline] could not matrixify on rotate start",
                  err
                )
              }
            }

            spline._rotateStartAngle = startAngle
            spline._rotateLastAngle = startAngle
            spline._rotateIsActive = true
            console.log("[spline] rotate start snapshot", {
              splineId: spline.id,
              _rotatePivot: spline._rotatePivot,
              _rotateStartAngle: startAngle,
              _rotateLastAngle: startAngle,
            })
          }

          // hide selection UI while operation in progress
          try {
            //el.select(false)
          } catch {}

          return
        }

        // ----- MOVE -----
        if (isMove) {
          const isRotateOp =
            handleName === "rot" ||
            handleName === "rotate" ||
            typeof detail.angle === "number" ||
            spline._rotateIsActive

          if (isRotateOp) {
            try {
              // During rotation, just let the group's transform handle the visual rotation.
              // Don't bake to points during the move - that causes flickering.
              // We'll bake everything at the end when the user releases.

              // Just update the isDraggingRef and return
              isDraggingRef.current = true
              return
            } catch (err) {
              console.error("[spline] rotate move error:", err)
            }
          }

          // Not a rotation -> handle scaling deformation
          try {
            console.log("[spline] resize move", {
              splineId: spline.id,
              box,
              resizeStartBox: spline._resizeStartBox,
            })

            const sbox = spline._resizeStartBox
            if (!box || !sbox || !spline._resizeStartPoints) {
              console.warn("[spline] resize move missing state; ignoring", {
                splineId: spline.id,
              })
              return
            }

            const startW = sbox.w || sbox.width || 1
            const startH = sbox.h || sbox.height || 1
            const scaleX = (box.width || box.w) / startW
            const scaleY = (box.height || box.h) / startH
            const pivotX = sbox.cx
            const pivotY = sbox.cy

            spline._resizeStartPoints.forEach((sp, i) => {
              const nx = pivotX + (sp.x - pivotX) * scaleX
              const ny = pivotY + (sp.y - pivotY) * scaleY
              const pt = spline.points[i]
              pt.x = nx
              pt.y = ny
              try {
                pt.circle?.center(pt.x, pt.y)
              } catch {}
            })

            // also reset any group transform so visual = data
            resetGroupTransform()

            drawOrUpdateSpline(spline)
            isDraggingRef.current = true
            return
          } catch (err) {
            console.error("[spline] resize move error:", err)
          }
        }

        bakeGroupTransform()
      } catch (err) {
        console.error("[spline] resize handler error:", err)
      }
    })

    el.on("dragstart.splineTransform-storeMatrix", () => {
      try {
        spline._startMatrix = el.matrixify?.()
      } catch {}
    })
  }

  const attachToAll = () => {
    const list = splinesRef.current || []
    console.log(
      "[spline] attachToAll - attaching to groups (count):",
      list.length
    )
    list.forEach((spline) => {
      if (!spline || !spline.group) return
      // avoid reattaching clicks if already attached
      if (spline.__splineAttachBound) return
      spline.__splineAttachBound = true
      spline.group.off("click.selectSpline")
      spline.group.on("click.selectSpline", (e) => {
        e.stopPropagation()
        selectSpline(spline)
      })
    })
  }

  // immediate notify function so React can call it instead of relying on poll
  const notifyToolChange = (tool) => {
    lastTool = tool
    // behave the same as updateTransformStateByTool but immediate
    if (isDraggingRef?.current) {
      console.log(
        "[spline] notifyToolChange skipped while dragging (tool:",
        tool,
        ")"
      )
      return
    }
    if (tool !== "select") {
      ;(splinesRef.current || []).forEach((s) => {
        try {
          s.group.select(false)
          s.group.draggable(false)
          s.group.resize(false)
        } catch {}
        s.selected = false
        try {
          updateSplineVisualState(s)
        } catch {}
        try {
          delete s._resizeStartBox
          delete s._resizeStartPoints
          delete s._rotatePivot
          delete s._rotateStartPoints
          delete s._rotateStartAngle
          delete s._startBox
          delete s._startPoints
          delete s._startMatrix
        } catch {}
      })
      clearSelection()
    }
  }

  /*   draw.off("click.deselect")
  draw.on("click.deselect", (e) => {
    if (e.target === draw.node && isDraggingRef?.current === false) {
      console.log("[spline] background click -> clearSelection()")
      clearSelection()
    }
  }) */

  attachToAll()

  return {
    selectSpline,
    clearSelection,
    attachToAll,
    getSelected: () => selectedSpline,
    notifyToolChange,
  }
}
