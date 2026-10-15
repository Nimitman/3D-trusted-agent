import { clamp } from './math'

/**
 * A camera move as keyframes on chapter-local time. Values are interpolated
 * with Catmull-Rom style tangents, so the camera keeps moving smoothly through
 * each key instead of stopping at it. Endpoints ease in and out.
 */
export type Key = { t: number; v: number[] }

export function track(keys: Key[], t: number, out: number[]) {
  const n = keys.length
  if (t <= keys[0].t) return copy(keys[0].v, out)
  if (t >= keys[n - 1].t) return copy(keys[n - 1].v, out)

  let i = 0
  while (i < n - 2 && t > keys[i + 1].t) i++
  const k0 = keys[i]
  const k1 = keys[i + 1]
  const h = k1.t - k0.t
  const s = clamp((t - k0.t) / h)
  const s2 = s * s
  const s3 = s2 * s
  const h00 = 2 * s3 - 3 * s2 + 1
  const h10 = s3 - 2 * s2 + s
  const h01 = -2 * s3 + 3 * s2
  const h11 = s3 - s2

  for (let d = 0; d < k0.v.length; d++) {
    const m0 = tangent(keys, i, d) * h
    const m1 = tangent(keys, i + 1, d) * h
    out[d] = h00 * k0.v[d] + h10 * m0 + h01 * k1.v[d] + h11 * m1
  }
  return out
}

function tangent(keys: Key[], i: number, d: number) {
  if (i === 0 || i === keys.length - 1) return 0
  const a = keys[i - 1]
  const b = keys[i + 1]
  return (b.v[d] - a.v[d]) / (b.t - a.t)
}

function copy(src: number[], out: number[]) {
  for (let d = 0; d < src.length; d++) out[d] = src[d]
  return out
}
