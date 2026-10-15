/**
 * The Keystone badge, in metres, y up, centred on x = 0, plinth top at y = 0.
 * The same outlines drive the 3D arch, the 2D fallback and (later) the lockup mark.
 * Pure math, no three.js, so the 2D film can use it without loading the 3D bundle.
 * Build order: plinth (Verified) → left pier (Responsive) → right pier (Quality)
 * → eight voussoirs (Consistent) → keystone (Trusted).
 */
export const ARCH = { r1: 0.62, r2: 1, h: 1.05, stones: 9, joint: 0.012, keyRise: 0.17 }

export type Outline = [number, number][]

export function keystoneOutlines() {
  const { r1, r2, h, stones, joint, keyRise } = ARCH
  const voussoirs: Outline[] = []
  let key: Outline = []
  for (let i = 0; i < stones; i++) {
    const a0 = Math.PI - (i * Math.PI) / stones - joint
    const a1 = Math.PI - ((i + 1) * Math.PI) / stones + joint
    const ro = i === 4 ? r2 + keyRise : r2
    const pts: Outline = [
      [Math.cos(a0) * r1, h + Math.sin(a0) * r1],
      [Math.cos(a0) * ro, h + Math.sin(a0) * ro],
      [Math.cos(a1) * ro, h + Math.sin(a1) * ro],
      [Math.cos(a1) * r1, h + Math.sin(a1) * r1],
    ]
    if (i === 4) key = pts
    else voussoirs.push(pts)
  }
  return {
    plinth: [[-1.3, -0.24], [1.3, -0.24], [1.3, -0.03], [-1.3, -0.03]] as Outline,
    pierL: [[-r2, 0], [-r1, 0], [-r1, h], [-r2, h]] as Outline,
    pierR: [[r1, 0], [r2, 0], [r2, h], [r1, h]] as Outline,
    voussoirs,
    key,
  }
}

export const OUTLINES = keystoneOutlines()

/** SVG path for an outline, given a mapping from metres to SVG units. */
export function outlineToPath(pts: Outline, map: (x: number, y: number) => [number, number]) {
  return 'M' + pts.map(([x, y]) => map(x, y).map((v) => v.toFixed(1)).join(' ')).join(' L') + ' Z'
}

/**
 * The badge taken apart. Before Chapter 05 every piece floats at an offset from
 * where it belongs: pushed outward from the arch's centre, turned a little, and
 * pulled forward or back, so the structure can be seen without being read.
 * Chapter 05 eases each piece from here back into place.
 */
export type Exploded = { dx: number; dy: number; dz: number; rz: number; ry: number }

export type PieceName = 'plinth' | 'pierL' | 'pierR' | 'key' | `v${number}`

export function outlineOf(name: PieceName): Outline {
  if (name === 'plinth') return OUTLINES.plinth
  if (name === 'pierL') return OUTLINES.pierL
  if (name === 'pierR') return OUTLINES.pierR
  if (name === 'key') return OUTLINES.key
  return OUTLINES.voussoirs[Number(name.slice(1))]
}

export function centroidOf(pts: Outline): [number, number] {
  let x = 0
  let y = 0
  for (const [px, py] of pts) {
    x += px
    y += py
  }
  return [x / pts.length, y / pts.length]
}

export const EXPLODED: Record<string, Exploded> = (() => {
  // Small deterministic generator, so 3D and 2D agree on the layout.
  let seed = 41
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const names: PieceName[] = ['plinth', 'pierL', 'pierR', 'key', ...OUTLINES.voussoirs.map((_, i) => `v${i}` as PieceName)]
  const out: Record<string, Exploded> = {}
  for (const name of names) {
    const [cx, cy] = centroidOf(outlineOf(name))
    const ang = Math.atan2(cy - ARCH.h * 0.6, cx)
    const push = 0.28 + rnd() * 0.45
    out[name] = {
      dx: Math.cos(ang) * push + (rnd() - 0.5) * 0.2,
      dy: Math.sin(ang) * push + (rnd() - 0.5) * 0.2,
      dz: (rnd() - 0.5) * 0.9,
      rz: (rnd() - 0.5) * 0.5,
      ry: (rnd() - 0.5) * 0.7,
    }
  }
  return out
})()
