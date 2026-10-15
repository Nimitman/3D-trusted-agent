import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * One abstract human figure, about 1.8 m tall, feet at y = 0. A turned profile
 * (feet, legs, hips, waist, chest, shoulders) flattened front to back so it
 * reads as a person from any angle, with no face and no detail.
 */
export function figureGeometry(detail: 'full' | 'lite' = 'full') {
  const segments = detail === 'full' ? 16 : 10
  const profile = [
    [0.0, 0.0],
    [0.085, 0.015],
    [0.1, 0.12],
    [0.115, 0.45],
    [0.135, 0.82],
    [0.17, 0.95],
    [0.155, 1.1],
    [0.185, 1.3],
    [0.215, 1.42],
    [0.2, 1.47],
    [0.075, 1.52],
    [0.06, 1.56],
    [0.0, 1.565],
  ].map(([r, y]) => new THREE.Vector2(r, y))

  const body = new THREE.LatheGeometry(profile, segments)
  const head = new THREE.SphereGeometry(0.105, segments, Math.round(segments * 0.75))
  head.scale(1, 1.12, 1)
  head.translate(0, 1.69, 0)

  const merged = mergeGeometries([body.toNonIndexed(), head.toNonIndexed()])!
  // Keep the lathe's smooth normals; recomputing on non-indexed geometry would facet it.
  merged.scale(1, 1, 0.72)
  body.dispose()
  head.dispose()
  return merged
}
