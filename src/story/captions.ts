import { chapter, CUTS, type ChapterId } from './timeline'
import { COPY } from './copy'
import { CH03_BEATS } from './ch03'
import { landing } from './ch04'
import { CH05_BEATS } from './ch05'
import { CH06_BEATS } from './ch06'
import { CH07_BEATS } from './ch07'
import { lerp } from '../lib/math'

/**
 * Lines spoken over the film rather than placed in it: the beats, and later
 * the moments and stories. Set as HTML so they stay crisp at any size.
 * Times are chapter-local and converted to film progress here.
 */
export type Cue = {
  id: string
  text: string
  /** Film progress where the line starts and finishes appearing. */
  in: [number, number]
  /** Film progress where it starts and finishes leaving. */
  out: [number, number]
  style:
    | 'beat'
    | 'beat-final'
    | 'moment'
    | 'moment-2'
    | 'stamp'
    | 'stack-1'
    | 'stack-2'
    | 'stack-3'
    | 'stack-4'
    | 'lock-now'
    | 'lock-now-final'
    | 'title'
    | 'story'
    | 'statement'
    | 'tag'
    | 'final'
}

const at = (id: ChapterId, t: number) => lerp(chapter(id).start, chapter(id).end, t)

export const CUES: Cue[] = [
  {
    id: 'claim',
    text: COPY.ch02.beats[0],
    in: [at('ch02', 0.6), at('ch02', 0.635)],
    out: [at('ch02', 0.69), at('ch02', 0.71)],
    style: 'beat',
  },
  {
    id: 'buy',
    text: COPY.ch02.beats[1],
    in: [at('ch02', 0.715), at('ch02', 0.75)],
    out: [at('ch02', 0.795), at('ch02', 0.815)],
    style: 'beat',
  },
  {
    // The last line arrives at half speed and is given room to breathe.
    id: 'earn',
    text: COPY.ch02.beats[2],
    in: [at('ch02', 0.82), at('ch02', 0.9)],
    // Leaves as the camera starts to rise, gone before the fog closes.
    out: [CUTS.ch02to03 - 0.01, CUTS.ch02to03 - 0.003],
    style: 'beat-final',
  },
  ...momentCues(),
  ...builtCues(),
  ...lockCues(),
  ...quietCues(),
  ...finalCues(),
]

/** Chapter 07: the final statement, one line at a time, centred. */
function finalCues(): Cue[] {
  const span = (w: [number, number, number, number]) => ({
    in: [at('ch07', w[0]), at('ch07', w[1])] as [number, number],
    out: [at('ch07', w[2]), at('ch07', w[3])] as [number, number],
  })
  return [
    // "is a" kept together, so a narrow screen never leaves "A" alone on a line.
    { id: 'profession', text: COPY.ch07.statement[0].replace(' is a ', ' is\u00a0a '), ...span(CH07_BEATS.profession), style: 'final' },
    { id: 'earned', text: COPY.ch07.statement[1], ...span(CH07_BEATS.earned), style: 'final' },
  ]
}

/**
 * Chapter 06: a few stories surface around the badge and fade, then the two
 * closing lines. The stories are sample copy, and say so on screen, until
 * real, consented customer quotes replace them.
 */
function quietCues(): Cue[] {
  const stories: Cue[] = COPY.ch06.stories.map((text, i) => {
    const [a, b] = CH06_BEATS.stories[i]
    return {
      id: `story${i}`,
      text: `“${text}”`,
      // Arrive, hold, and be gone before the next one starts.
      in: [at('ch06', a), at('ch06', a + 0.016)] as [number, number],
      out: [at('ch06', b - 0.018), at('ch06', b - 0.004)] as [number, number],
      style: 'story',
    }
  })
  const [c0, c1] = CH06_BEATS.close
  const first = CH06_BEATS.stories[0][0]
  const last = CH06_BEATS.stories[CH06_BEATS.stories.length - 1][1]
  return [
    ...stories,
    { id: 'sample', text: 'Sample stories · placeholders', in: [at('ch06', first), at('ch06', first + 0.03)], out: [at('ch06', last - 0.02), at('ch06', last)], style: 'tag' },
    { id: 'close', text: COPY.ch06.lines[0], in: [at('ch06', c0), at('ch06', c0 + 0.03)], out: [at('ch06', c1 - 0.02), at('ch06', c1)], style: 'statement' },
    // Holds into Chapter 07 and leaves as the push towards the keystone begins.
    { id: 'confidence', text: COPY.ch06.lines[1], in: [at('ch06', CH06_BEATS.confidence), at('ch06', CH06_BEATS.confidence + 0.04)], out: [at('ch07', 0.15), at('ch07', 0.19)], style: 'statement' },
  ]
}

/**
 * Chapter 05: as each piece seats, its name appears large, centred just below
 * the badge, and holds until the next one locks: one word at a time, where the
 * eye already is. (A corner list here got missed in review.) The progress row
 * under it is in ui/LockStrip.tsx. Then, once: TRUSTED AGENT.
 */
function lockCues(): Cue[] {
  const [t0, t1] = CH05_BEATS.title
  const locks = CH05_BEATS.locks
  const rows: Cue[] = COPY.ch05.locks.map((text, i) => {
    const last = i === locks.length - 1
    return {
      id: `lock${i}`,
      text,
      in: [at('ch05', locks[i] - 0.006), at('ch05', locks[i] + 0.012)] as [number, number],
      out: last
        ? ([at('ch05', t0 - 0.025), at('ch05', t0 - 0.005)] as [number, number])
        : ([at('ch05', locks[i + 1] - 0.03), at('ch05', locks[i + 1] - 0.012)] as [number, number]),
      style: last ? 'lock-now-final' : 'lock-now',
    }
  })
  return [
    ...rows,
    // Leaves as the quiet begins, before the stories surface.
    { id: 'title', text: COPY.ch05.result, in: [at('ch05', t0), at('ch05', t1)], out: [at('ch06', 0.22), at('ch06', 0.29)], style: 'title' },
  ]
}

/**
 * Chapter 04: TRUST / IS BUILT / IN SMALL / MOMENTS. One line arrives as each
 * moment lands as glass, and the lines stay, stacked, like the pieces.
 */
function builtCues(): Cue[] {
  const lines = ['Trust', 'is built', 'in small', 'moments.']
  return lines.map((text, i) => ({
    id: `built${i}`,
    text,
    in: [at('ch04', landing(i) - 0.012), at('ch04', landing(i) + 0.03)] as [number, number],
    out: [at('ch04', 0.965), at('ch04', 0.99)] as [number, number],
    style: `stack-${i + 1}` as Cue['style'],
  }))
}

/** Chapter 03: one quiet line per moment, set small, like overheard speech. */
function momentCues(): Cue[] {
  const m = CH03_BEATS.moments
  const span = (i: number, a: number, b: number): [number, number] => [
    at('ch03', lerp(m[i][0], m[i][1], a)),
    at('ch03', lerp(m[i][0], m[i][1], b)),
  ]
  const [line1, line2, line3, line4] = COPY.ch03.moments
  const [ask, wait] = line3.line.split('. ')
  return [
    { id: 'm1', text: line1.line, in: span(0, 0.28, 0.45), out: span(0, 0.86, 0.98), style: 'moment' },
    { id: 'm2', text: line2.line, in: span(1, 0.3, 0.47), out: span(1, 0.86, 0.98), style: 'moment' },
    { id: 'm3a', text: `${ask}.`, in: span(2, 0.22, 0.38), out: span(2, 0.86, 0.98), style: 'moment' },
    { id: 'm3b', text: wait, in: span(2, 0.48, 0.64), out: span(2, 0.86, 0.98), style: 'moment-2' },
    { id: 'm4s', text: line4.stamp, in: span(3, 0.05, 0.18), out: span(3, 0.86, 0.95), style: 'stamp' },
    { id: 'm4', text: line4.line, in: span(3, 0.4, 0.58), out: span(3, 0.88, 0.97), style: 'moment' },
  ]
}
