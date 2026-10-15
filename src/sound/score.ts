import { chapter, CUTS, type ChapterId } from '../story/timeline'
import { CH03_BEATS, WHITEOUT } from '../story/ch03'
import { landing } from '../story/ch04'
import { CH05_BEATS } from '../story/ch05'
import { CH07_BEATS } from '../story/ch07'
import { clamp, lerp, remap, smoothstep } from '../lib/math'

/**
 * The film's music, as data. One motif on a section of cellos repeats through
 * the whole film while the scroll adds the world around it, a layer per
 * chapter: hand drums for the crowd, plucked strings for the tower's moments,
 * vibraphone and brushes for the glass, then strings and horns as each part of
 * the badge locks. When the keystone seats, the whole ensemble plays the motif
 * in D major. Pure, so it can be read and tuned on its own.
 */

const at = (id: ChapterId, t: number) => lerp(chapter(id).start, chapter(id).end, t)

/** 66 BPM; each chord lasts two bars of 4/4 (16 eighth notes). */
export const TEMPO = 66
export const BEAT = 60 / TEMPO
export const EIGHTHS_PER_CHORD = 16

/** Chord voicings as MIDI notes, low to high: root, fifth, then the upper tones. */
export const PROGRESSIONS = {
  // i – VI – III – VII: D minor, B-flat, F, C. Searching, unresolved.
  minor: [
    [38, 45, 50, 53, 57],
    [34, 41, 46, 50, 53],
    [41, 48, 53, 57, 60],
    [36, 43, 48, 52, 55],
  ],
  // I – V – vi – IV: D major, A, B minor, G. The release.
  major: [
    [38, 45, 50, 54, 57],
    [33, 40, 45, 49, 52],
    [35, 42, 47, 50, 54],
    [31, 38, 43, 47, 50],
  ],
} as const

/**
 * The motif, one phrase per chord: [start eighth, MIDI note, length in eighths].
 * It rises on every chord and falls back at the end of the cycle; in major,
 * the third phrase climbs to the top of the line.
 */
export const MOTIF: Record<'minor' | 'major', [number, number, number][][]> = {
  minor: [
    [[0, 57, 4], [4, 62, 4], [8, 65, 8]],
    [[0, 65, 4], [4, 64, 2], [6, 62, 2], [8, 62, 8]],
    [[0, 60, 4], [4, 57, 4], [8, 60, 8]],
    [[0, 64, 6], [6, 62, 2], [8, 60, 4], [12, 55, 4]],
  ],
  major: [
    [[0, 57, 4], [4, 62, 4], [8, 66, 8]],
    [[0, 64, 4], [4, 66, 2], [6, 64, 2], [8, 61, 8]],
    [[0, 62, 4], [4, 66, 4], [8, 69, 8]],
    [[0, 67, 6], [6, 66, 2], [8, 62, 4], [12, 64, 4]],
  ],
}

/** Film progress where the keystone seats: the music turns to major here. */
export const RELEASE_P = at('ch05', CH05_BEATS.locks[4])
const LOCKS = CH05_BEATS.locks.map((t) => at('ch05', t))

/** A level that ramps between (p, value) points, smoothly. */
function envelope(points: [number, number][], p: number) {
  if (p <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x0, y0] = points[i - 1]
    if (p <= x1) return lerp(y0, y1, smoothstep(remap(p, x0, x1)))
  }
  return points[points.length - 1][1]
}

const SILENCE: [number, number] = [0.89, 0.93]
const earnIt: [number, number] = [at('ch02', 0.8), at('ch02', 0.9)]
const R = RELEASE_P

export const LAYERS = ['drone', 'hero', 'double', 'hands', 'pizz', 'jazz', 'viola', 'violin', 'horn', 'timp', 'big'] as const
export type Layer = (typeof LAYERS)[number]

export type Arrangement = Record<Layer, number> & {
  mode: 'minor' | 'major'
  /** Overall level, including the silence before the final statement. */
  master: number
}

/** How much of each layer plays at film progress p (0 → 1). */
export function arrangementAt(p: number): Arrangement {
  p = clamp(p)
  const silence = 1 - Math.min(remap(p, SILENCE[0] - 0.012, SILENCE[0]), 1 - remap(p, SILENCE[1], SILENCE[1] + 0.012))
  return {
    // A low D and A held under everything, like a tanpura's Sa and Pa.
    drone: envelope([[0, 0], [0.015, 0.55], [0.13, 0.55], [0.145, 0.5], [earnIt[0], 0.6], [earnIt[1], 0.4], [0.3, 0.55], [0.6, 0.7], [R, 0.85], [0.8, 0.6], [0.88, 0.5], [0.95, 0.6], [1, 0.6]], p),
    // The cellos' motif: the one voice that runs through the whole film.
    hero: envelope([[0, 0], [0.02, 0.5], [0.12, 0.55], [0.145, 0.55], [earnIt[0], 0.55], [earnIt[1], 0.75], [0.3, 0.65], [0.6, 0.75], [R, 1], [0.8, 0.8], [0.88, 0.65], [0.94, 0.75], [1, 0.7]], p),
    // Violins take the motif an octave up once the keystone seats.
    double: envelope([[R - 0.001, 0], [R + 0.002, 1], [0.8, 0.6], [0.86, 0], [0.935, 0], [0.95, 0.35], [1, 0.35]], p),
    // Ch02: frame drum and darbuka, an uneasy pulse in the crowd. Out for "earn it".
    hands: envelope([[0.13, 0], [0.145, 0.65], [0.24, 0.8], [earnIt[0], 0.8], [earnIt[1], 0], [0.285, 0], [0.3, 0.45], [0.47, 0.45], [0.5, 0.55], [0.62, 0.65], [0.7, 0.85], [R, 0.9], [0.75, 0.6], [0.78, 0]], p),
    // Ch03: plucked cellos like a fingerpicked guitar, and a plucked bass.
    pizz: envelope([[0.285, 0], [0.3, 0.75], [0.46, 0.8], [0.5, 0.6], [0.62, 0.6], [R, 0.8], [0.76, 0.5], [0.82, 0]], p),
    // Ch04: vibraphone chords with jazz colour, hi-hat and shaker.
    jazz: envelope([[0.465, 0], [0.49, 0.8], [0.6, 0.65], [0.68, 0.4], [R, 0.5], [0.77, 0.35], [0.86, 0], [0.935, 0], [0.95, 0.35], [1, 0.35]], p),
    // Ch05: each lock brings in a section. Verified: violas.
    viola: envelope([[LOCKS[0] - 0.006, 0], [LOCKS[0], 0.75], [R, 0.95], [0.8, 0.6], [0.88, 0.4], [0.94, 0.35], [1, 0.35]], p),
    // Responsive: violins.
    violin: envelope([[LOCKS[1] - 0.006, 0], [LOCKS[1], 0.7], [R - 0.002, 0.85], [R + 0.004, 1], [0.8, 0.55], [0.88, 0.3], [0.94, 0.3], [1, 0.3]], p),
    // Quality: horns.
    horn: envelope([[LOCKS[2] - 0.006, 0], [LOCKS[2], 0.7], [R, 1], [0.77, 0.45], [0.83, 0]], p),
    // Consistent: timpani rolls into every chord.
    timp: envelope([[LOCKS[3] - 0.006, 0], [LOCKS[3], 0.8], [R, 0.9], [0.75, 0]], p),
    // Trusted: big drums for the release, settling before the quiet of Ch06.
    big: envelope([[R - 0.001, 0], [R + 0.001, 1], [0.765, 0.8], [0.785, 0]], p),
    mode: p >= R ? 'major' : 'minor',
    master: silence,
  }
}

export type Cue =
  | { kind: 'riser'; p: number }
  | { kind: 'swell'; p: number }
  | { kind: 'shimmer'; p: number }
  | { kind: 'glass'; p: number; index: number }
  | { kind: 'lock'; p: number; final: boolean }
  | { kind: 'phone'; p: number }
  | { kind: 'resolve'; p: number }

/** Musical hits, fired as scroll passes their moment going forward. */
export const CUES: Cue[] = [
  // Into the black after AGENT: a cymbal swell that peaks on the cut.
  { kind: 'riser', p: at('ch01', 0.82) },
  // Rising into the fog towards the tower.
  { kind: 'swell', p: CUTS.ch02to03 - 0.014 },
  { kind: 'phone', p: at('ch03', lerp(CH03_BEATS.moments[3][0], CH03_BEATS.moments[3][1], 0.22)) },
  // Into the phone's glow: a vibraphone ripple as the white-out fills the frame.
  { kind: 'shimmer', p: at('ch03', WHITEOUT[0]) },
  // Each piece of glass lands on a note of the chord.
  ...Array.from({ length: 10 }, (_, i) => ({ kind: 'glass' as const, p: at('ch04', landing(i)), index: i })),
  ...CH05_BEATS.locks.map((t, i) => ({ kind: 'lock' as const, p: at('ch05', t), final: i === CH05_BEATS.locks.length - 1 })),
  { kind: 'resolve', p: at('ch07', CH07_BEATS.earned[0]) },
]
