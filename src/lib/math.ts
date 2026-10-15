export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

/** Maps v from [a, b] to [0, 1], clamped. */
export const remap = (v: number, a: number, b: number) => clamp((v - a) / (b - a))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const smoothstep = (t: number) => t * t * (3 - 2 * t)

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Frame-rate independent exponential smoothing. lambda ≈ 1 / settle-time. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Fade in over [a, b], hold, fade out over [c, d]. */
export const window4 = (t: number, a: number, b: number, c: number, d: number) =>
  Math.min(remap(t, a, b), 1 - remap(t, c, d))

export function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
