// src/utils/transform.js
/**
 * Affine transformation utilities for applying matrix transformations to points
 * @module utils/transform
 */

/**
 * Apply affine matrix transformation to points (in-place modification)
 * Uses SVGMatrix-style matrix with properties { a, b, c, d, e, f }
 * Transformation: [a c e; b d f] * [x; y; 1] = [x'; y'; 1]
 * @param {object} matrix - Affine transformation matrix { a, b, c, d, e, f }
 * @param {Array<{x: number, y: number}>} srcPoints - Source points to transform
 * @param {Array<{x: number, y: number, circle?: object}>} destPoints - Destination points (modified in-place)
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
