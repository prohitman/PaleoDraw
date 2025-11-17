// src/utils/transform.js
// helpers to apply affine matrix transforms and rotate points

/**
 * Apply matrixify-like matrix to source points and write into destPoints (in-place)
 * Matrix expected to have { a, b, c, d, e, f } (SVGMatrix-style)
 */
export function applyMatrixToPoints(matrix, srcPoints, destPoints) {
  if (!matrix || !srcPoints || !destPoints) return
  for (let i = 0; i < srcPoints.length; i++) {
    const sp = srcPoints[i]
    // Affine: [a c e; b d f] * [x; y; 1]
    const nx = matrix.a * sp.x + matrix.c * sp.y + (matrix.e ?? 0)
    const ny = matrix.b * sp.x + matrix.d * sp.y + (matrix.f ?? 0)
    const dp = destPoints[i]
    if (dp) {
      dp.x = nx
      dp.y = ny
      if (dp.circle) {
        try {
          dp.circle?.center(dp.x, dp.y)
        } catch {}
      }
    }
  }
}

/** Rotate a list of points around pivot by 'delta' radians (in-place) */
export function rotatePointsAroundPivot(points, delta, pivot) {
  const cos = Math.cos(delta)
  const sin = Math.sin(delta)
  points.forEach((p) => {
    const rx = p.x - pivot.x
    const ry = p.y - pivot.y
    const nx = pivot.x + (rx * cos - ry * sin)
    const ny = pivot.y + (rx * sin + ry * cos)
    p.x = nx
    p.y = ny
  })
}
