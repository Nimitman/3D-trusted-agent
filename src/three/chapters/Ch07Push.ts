import * as THREE from 'three'
import { CH07_BEATS } from '../../story/ch07'
import { clamp, lerp, remap, smoothstep } from '../../lib/math'
import { track, type Key } from '../../lib/track'
import { centroidOf, outlineOf } from '../geometry/keystone'

/**
 * Chapter 07 · The final statement, in 3D.
 * One straight push into the keystone until it fills the frame. From there the
 * lockup takes over in 2D (see ui/Lockup.tsx).
 */

/** Where the badge floats in Chapter 06: its lift plus the quiet's extra rise. */
const BADGE_Y = 0.6 + 0.35
const KEY_Y = BADGE_Y + centroidOf(outlineOf('key'))[1]

/** Distance, eye height, look height. Starts where Chapter 06 ends. */
const PUSH: Key[] = [
  { t: CH07_BEATS.start, v: [9.6, 1.9, 1.65] },
  { t: 0.3, v: [4.6, 2.45, KEY_Y - 0.25] },
  { t: 0.42, v: [1.3, KEY_Y - 0.03, KEY_Y] },
  { t: CH07_BEATS.push[1], v: [0.55, KEY_Y, KEY_Y] },
  { t: 1, v: [0.5, KEY_Y, KEY_Y] },
]
const o: number[] = []
const portraitness = (aspect: number) => clamp((1 - aspect) / 0.45)

export function ch07Camera(t: number, pos: THREE.Vector3, look: THREE.Vector3, aspect = 1.6) {
  track(PUSH, t, o)
  // Chapter 06 stands further back on narrow screens; that eases away as we close in.
  const far = lerp(1, 1.6, portraitness(aspect) * (1 - smoothstep(remap(t, CH07_BEATS.start, 0.42))))
  pos.set(0, o[1], o[0] * far)
  look.set(0, o[2], 0)
}
