import type { PieceName } from '../three/geometry/keystone'

/**
 * Chapter 05's beats in chapter-local time (0 → 1 over film 57% → 76%).
 * It plays in Chapter 04's world with the same pieces, picking up at t ≈ 0.16
 * where Chapter 04 ends. Shared by the 3D, the captions and the 2D film.
 */
export const CH05_BEATS = {
  /** Where Chapter 04 hands over: the same camera, the same glass. */
  start: 0.158,
  /** The camera pulls back and the glass turns to stone. */
  stone: [0.17, 0.28] as [number, number],
  /** Each group seats here, with a flash of purple: film ≈ 63, 65, 68, 71, 73%. */
  locks: [0.3, 0.44, 0.58, 0.72, 0.86],
  /** How long a group takes to ease from where it floats into place. */
  travel: 0.08,
  /** The keystone appears above the arch, waiting, before it descends. */
  keyAppears: 0.75,
  /** "TRUSTED AGENT". */
  title: [0.9, 0.96] as [number, number],
}

/** What locks at each beat, in the badge's build order. */
export const LOCK_GROUPS: PieceName[][] = [
  ['plinth'],
  ['pierL'],
  ['pierR'],
  ['v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'],
  ['key'],
]

/** When a piece is fully seated. The stones of the ring land one after another. */
export function seatTime(name: PieceName) {
  const g = LOCK_GROUPS.findIndex((group) => group.includes(name))
  const lock = CH05_BEATS.locks[g]
  if (g !== 3) return lock
  const k = Number(name.slice(1))
  return lock - (7 - k) * 0.006
}
