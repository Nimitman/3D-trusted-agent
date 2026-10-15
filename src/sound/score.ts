import { chapter, CUTS, type ChapterId } from '../story/timeline'
import { CH03_BEATS, WHITEOUT } from '../story/ch03'
import { landing } from '../story/ch04'
import { CH05_BEATS } from '../story/ch05'
import { CH07_BEATS } from '../story/ch07'
import { clamp, lerp, remap, smoothstep } from '../lib/math'

/**
 * The film's music, as data. Background music that runs in real time, whose
 * arrangement follows the scroll: a cinematic build in D minor that releases
 * into D major when the keystone seats. Plus musical hits timed to the key
 * transitions. Pure, so it can be read and tuned without touching the engine.
 */

const at = (id: ChapterId, t: number) => lerp(chapter(id).start, chapter(id).end, t)

/** 72 BPM; each chord lasts two bars of 4/4. */
export const TEMPO = 72
export const BEAT = 60 / TEMPO
export const CHORD_BEATS = 8

/** Chord voicings as MIDI notes, low to high. The top two carry the high strings. */
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

/** Film progress where the keystone seats: the music turns to major here. */
export const RELEASE_P = at('ch05', CH05_BEATS.locks[4])

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

export type Arrangement = {
  /** Low string pad: the bed under everything. */
  pad: number
  /** A low pulsing ostinato: urgency. */
  pulse: number
  /** Felt piano, sparse: the human, intimate voice. */
  piano: number
  /** High strings: tension gathering, then warmth. */
  high: number
  mode: 'minor' | 'major'
  /** Overall level, including the silence before the final statement. */
  master: number
}

export function arrangementAt(p: number): Arrangement {
  p = clamp(p)
  const silence = 1 - Math.min(remap(p, SILENCE[0] - 0.012, SILENCE[0]), 1 - remap(p, SILENCE[1], SILENCE[1] + 0.012))
  return {
    pad: envelope(
      [[0.0, 0.0], [0.03, 0.35], [0.12, 0.55], [0.2, 0.65], [earnIt[0], 0.55], [earnIt[1], 0.3], [0.3, 0.5], [0.47, 0.55], [0.6, 0.7], [0.72, 0.85], [0.75, 1], [0.8, 0.7], [0.87, 0.45], [0.94, 0.6], [1, 0.7]],
      p,
    ),
    pulse: envelope(
      [[0.13, 0], [0.15, 0.55], [0.21, 0.7], [earnIt[0], 0.5], [earnIt[1], 0], [0.47, 0], [0.52, 0.35], [0.63, 0.6], [0.72, 0.85], [RELEASE_P, 0.9], [RELEASE_P + 0.006, 0]],
      p,
    ),
    piano: envelope(
      [[0.0, 0], [0.04, 0.35], [0.13, 0.25], [0.29, 0.3], [0.33, 0.75], [0.46, 0.75], [0.5, 0.5], [0.7, 0.4], [0.76, 0.7], [0.86, 0.75], [0.94, 0.6], [1, 0.6]],
      p,
    ),
    high: envelope(
      [[0.46, 0], [0.55, 0.35], [0.68, 0.7], [RELEASE_P, 0.85], [RELEASE_P + 0.01, 1], [0.8, 0.55], [0.87, 0.2], [0.94, 0.45], [1, 0.5]],
      p,
    ),
    mode: p >= RELEASE_P ? 'major' : 'minor',
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
  // Into the black after AGENT: a rise that lands on the cut.
  { kind: 'riser', p: at('ch01', 0.82) },
  // Rising into the fog towards the tower.
  { kind: 'swell', p: CUTS.ch02to03 - 0.014 },
  { kind: 'phone', p: at('ch03', lerp(CH03_BEATS.moments[3][0], CH03_BEATS.moments[3][1], 0.22)) },
  // Into the phone's glow: a piano ripple as the white-out fills the frame.
  { kind: 'shimmer', p: at('ch03', WHITEOUT[0]) },
  ...Array.from({ length: 10 }, (_, i) => ({ kind: 'glass' as const, p: at('ch04', landing(i)), index: i })),
  ...CH05_BEATS.locks.map((t, i) => ({ kind: 'lock' as const, p: at('ch05', t), final: i === CH05_BEATS.locks.length - 1 })),
  { kind: 'resolve', p: at('ch07', CH07_BEATS.earned[0]) },
]
