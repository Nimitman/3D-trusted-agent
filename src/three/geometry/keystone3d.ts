import * as THREE from 'three'
import { ARCH, type Outline } from './keystone'

export function extrudeOutline(pts: Outline, depth = 0.34) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 1,
  })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  return geo
}

/** The opening of the arch: the shape light fills in Chapter 01. */
export function openingShape() {
  const { r1, h } = ARCH
  const s = new THREE.Shape()
  s.moveTo(-r1, 0)
  s.lineTo(-r1, h)
  s.absarc(0, h, r1, Math.PI, 0, true)
  s.lineTo(r1, 0)
  s.closePath()
  return s
}
