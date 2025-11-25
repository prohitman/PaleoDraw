// src/models/Spline.js
import {
  generateBSplinePath,
  generatePolylinePath,
  generateNurbsPath,
} from "../utils/geometry"

const SPLINE_COLORS = {
  SELECTED: "#00ffff",
  UNSELECTED: "#16689fff",
  HOVER: "#e3f6f6ff",
}

/**
 * Spline model: encapsulates a single B-spline with its points and visual state
 * Manages the SVG group, path, and points that make up the spline
 */
export default class Spline {
  constructor({ id, draw, color, type = "bspline" } = {}) {
    this.id = id ?? `spline_${Date.now()}`
    console.log("[Spline.constructor] Creating new Spline:", {
      id: this.id,
      hasDraw: !!draw,
    })
    this.points = []
    this.selected = false
    this.color = color || SPLINE_COLORS.SELECTED
    // Spline type: 'bspline' (default) or 'polyline'
    this.type = type

    this._draw = draw
    console.log("[Spline.constructor] Creating SVG group")
    this.group = draw.group()
    // Add data attribute for identification during selection
    this.group.attr("data-spline-id", this.id)
    // Ensure group is always interactive
    // if (this.group.node) {
    //   this.group.node.setAttribute("pointer-events", "all")
    // }
    this.path = this.group
      .path("")
      .stroke({ color: this.color, width: 2 })
      .fill("none")
    this.path.node.setAttribute("pointer-events", "stroke")
    // Add mouseover/mouseout for hover class
    this.path.node.addEventListener("mouseover", () => {
      this.path.node.classList.add("spline-hover")
    })
    this.path.node.addEventListener("mouseout", () => {
      this.path.node.classList.remove("spline-hover")
    })
    console.log("[Spline.constructor] Group and path created")

    // Flag to avoid duplicate event binding
    this.__splineAttachBound = false

    // Transient transform state (used during drag/resize/rotate operations)
    this._startBox = null
    this._startPoints = null
    this._startMatrix = null

    this._resizeStartBox = null
    this._resizeStartPoints = null
    this._resizeIsActive = false
    this._resizePointsScaled = false

    this._rotatePivot = null
    this._rotateStartPoints = null
    this._rotateStartAngle = null
    this._rotateLastAngle = null
    this._rotateIsActive = false
    console.log("[Spline.constructor] Complete")
  }

  /**
   * Add a point to the end of the spline
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} withCircle - Whether to create a visual circle for the point
   * @param {boolean} isSharp - Whether the point is a sharp corner (C0 continuity)
   * @returns {object} - The point object
   */
  addPoint(x, y, withCircle = true, isSharp = false) {
    console.log("[Spline.addPoint]", {
      splineId: this.id,
      x,
      y,
      withCircle,
      isSharp,
      groupExists: !!this.group,
    })
    let circle = null
    if (withCircle) {
      console.log("[Spline.addPoint] Creating circle element")
      try {
        circle = this.group
          .circle(6)
          .addClass("spline-point")
          .center(x, y)
          .show()
        if (circle && circle.node) {
          circle.node.setAttribute("pointer-events", "all")
          // Add mouseover/mouseout for hover class
          circle.node.addEventListener("mouseover", () => {
            circle.node.classList.add("spline-hover")
          })
          circle.node.addEventListener("mouseout", () => {
            circle.node.classList.remove("spline-hover")
          })
        }
        console.log("[Spline.addPoint] Circle created successfully")
      } catch (err) {
        console.error("[Spline.addPoint] Error creating circle:", err)
      }
    }
    const point = { x, y, circle, isSharp }
    this.points.push(point)
    console.log(
      "[Spline.addPoint] Point added, total points:",
      this.points.length
    )
    return point
  }

  /**
   * Insert a point at a specific index
   * @param {number} index - Index to insert at
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} isSharp - Whether the point is a sharp corner
   * @returns {object} - The point object
   */
  insertPointAt(index, x, y, isSharp = false) {
    const circle = this.group
      .circle(6)
      .addClass("spline-point")
      .center(x, y)
      .show()
    const point = { x, y, circle, isSharp }
    this.points.splice(index, 0, point)
    return point
  }

  /**
   * Remove a point by reference
   * @param {object} pointRef - The point object to remove
   * @returns {object} - The removed point, or null if not found
   */
  removePointByRef(pointRef) {
    const idx = this.points.indexOf(pointRef)
    if (idx === -1) return null
    const [removed] = this.points.splice(idx, 1)
    try {
      removed.circle?.remove()
    } catch (err) {
      console.warn("[Spline.removePointByRef] circle remove error", err)
    }
    return removed
  }

  /**
   * Update a point's coordinates by its circle element
   * @param {object} circle - The SVG circle element
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   * @returns {object} - The updated point, or null if circle not found
   */
  updatePointByCircle(circle, x, y) {
    const point = this.points.find((p) => p.circle === circle)
    if (!point) return null
    point.x = x
    point.y = y
    try {
      point.circle?.center(x, y)
    } catch (err) {
      console.warn("[Spline.updatePointByCircle] center error", err)
    }
    return point
  }

  /**
   * Update a point's coordinates by index
   * @param {number} index - Point index
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   * @returns {object} - The updated point, or null if index out of bounds
   */
  updatePointByIndex(index, x, y) {
    const point = this.points[index]
    if (!point) return null
    point.x = x
    point.y = y
    try {
      point.circle?.center(x, y)
    } catch (err) {
      console.warn("[Spline.updatePointByIndex] center error", err)
    }
    return point
  }

  /**
   * Recalculate and redraw the B-spline path
   */
  plot() {
    console.log(
      "[Spline.plot] Called with",
      this.points.length,
      "points",
      "type:",
      this.type
    )
    if (this.type === "polyline") {
      const pathData = generatePolylinePath(this.points)
      this.path.plot(pathData)
      return
    }
    if (this.type === "nurbs") {
      const pathData = generateNurbsPath(this.points)
      this.path.plot(pathData)
      return
    }
    // Default bspline behavior
    if (this.points.length < 2) {
      console.log("[Spline.plot] Less than 2 points, clearing path for now")
      this.path.plot("")
      if (this.points.length === 1) {
        try {
          this.path.plot(
            `M${this.points[0].x},${this.points[0].y} L${
              this.points[0].x + 0.1
            },${this.points[0].y + 0.1}`
          )
        } catch (err) {
          console.warn("[Spline.plot] Single point indicator error", err)
        }
      }
      return
    }
    const pathData = generateBSplinePath(this.points)
    this.path.plot(pathData)
  }

  /**
   * Set the selection state and update visual appearance
   * @param {boolean} selected - Whether the spline is selected
   */
  setSelected(selected) {
    console.log("[Spline.setSelected]", {
      splineId: this.id,
      selected,
      previousSelected: this.selected,
    })
    this.selected = !!selected
    const color = this.selected
      ? SPLINE_COLORS.SELECTED
      : SPLINE_COLORS.UNSELECTED
    console.log("[Spline.setSelected] Setting path color:", color)
    this.path.stroke({ color, width: 2 })
    // Always ensure pointer-events: stroke for path and all for circles
    if (this.path?.node) {
      this.path.node.setAttribute("pointer-events", "stroke")
      this.path.node.style.display = ""
    }
    this.points.forEach((p) => {
      if (p.circle?.node) {
        p.circle.node.setAttribute("pointer-events", "all")
        // Show only if selected, hide otherwise
        if (this.selected) {
          p.circle.node.style.display = ""
        } else {
          p.circle.node.style.display = "none"
        }
      }
    })
    console.log("[Spline.setSelected] Complete")
  }

  /**
   * Set hover visual state (for unselected splines)
   * @param {boolean} hovering - Whether spline is being hovered
   */
  setHovering(hovering) {
    if (this.selected) return
    const color = hovering ? SPLINE_COLORS.HOVER : SPLINE_COLORS.UNSELECTED
    const width = hovering ? 3 : 2
    this.path.stroke({ color, width })
  }

  /**
   * Remove the spline from the canvas entirely
   */
  remove() {
    try {
      this.group.remove()
    } catch (err) {
      console.warn("[Spline.remove] group remove error", err)
    }
  }

  /**
   * Serialize spline to JSON (for saving)
   * @returns {object} - Serialized spline data
   */
  toJSON() {
    return {
      id: this.id,
      color: this.color,
      type: this.type,
      points: this.points.map((p) => ({
        x: p.x,
        y: p.y,
        isSharp: !!p.isSharp,
      })),
    }
  }

  /**
   * Load spline data from JSON (for loading)
   * @param {object} obj - Serialized spline data
   */
  loadFromJSON(obj) {
    this.id = obj.id ?? this.id
    this.color = obj.color ?? this.color
    this.type = obj.type || this.type || "bspline"
    this.points = []
    if (Array.isArray(obj.points)) {
      obj.points.forEach((p) => {
        // Handle both old format {x,y} and new format {x,y,isSharp}
        const x = typeof p.x === "number" ? p.x : p[0]
        const y = typeof p.y === "number" ? p.y : p[1]
        const isSharp = !!p.isSharp
        this.addPoint(x, y, true, isSharp)
      })
    }
    this.plot()
  }

  /**
   * Clear transform state (called after transform finalization)
   */
  clearTransformState() {
    this._startBox = null
    this._startPoints = null
    this._startMatrix = null
    this._resizeStartBox = null
    this._resizeStartPoints = null
    this._resizeIsActive = false
    this._resizePointsScaled = false
    this._rotatePivot = null
    this._rotateStartPoints = null
    this._rotateStartAngle = null
    this._rotateLastAngle = null
    this._rotateIsActive = false
  }
}
