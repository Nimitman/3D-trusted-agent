import * as THREE from 'three'
import { seeded } from '../../lib/math'

/** Soft radial falloff used for glows and light cores. */
export function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.2, 'rgba(255,255,255,.5)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Stone grain for bump and roughness: fine noise plus a few soft blotches,
 * so lit edges read as cut stone rather than plastic.
 */
export function stoneTexture(seed = 3) {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const rnd = seeded(seed)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const rad = 8 + rnd() * 40
    const v = Math.floor(100 + rnd() * 60)
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, `rgba(${v},${v},${v},.35)`)
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`)
    g.fillStyle = grad
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  const img = g.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 46
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1.6, 1.6)
  return t
}
