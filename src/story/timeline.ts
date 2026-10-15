import { remap } from '../lib/math'

/**
 * The film's single timeline. Scroll progress p runs 0 → 1 across the whole film;
 * every scene reads p and derives its own local time from its chapter range.
 * Ranges overlap on purpose so scenes hand off instead of replacing each other.
 */
export const CHAPTERS = [
  { id: 'ch01', n: '01', title: 'Everyone is an agent', start: 0, end: 0.14 },
  { id: 'ch02', n: '02', title: 'But trust is different', start: 0.11, end: 0.28 },
  { id: 'ch03', n: '03', title: 'The moments that matter', start: 0.26, end: 0.47 },
  { id: 'ch04', n: '04', title: 'Trust is built in small moments', start: 0.44, end: 0.6 },
  { id: 'ch05', n: '05', title: 'The badge', start: 0.57, end: 0.76 },
  { id: 'ch06', n: '06', title: 'The reveal', start: 0.73, end: 0.89 },
  { id: 'ch07', n: '07', title: 'The final statement', start: 0.87, end: 1 },
] as const

export type ChapterId = (typeof CHAPTERS)[number]['id']

export const chapter = (id: ChapterId) => CHAPTERS.find((c) => c.id === id)!

/** Local 0 → 1 time inside a chapter. */
export const localT = (p: number, id: ChapterId) => {
  const c = chapter(id)
  return remap(p, c.start, c.end)
}

/** Total scroll length of the full film, in viewport heights. Tuned in the spike. */
// Desktop was 2400; review found the Ch01 transition dragged versus mobile, so it sits closer now.
export const FILM_VH = { desktop: 1700, mobile: 1500 }

/**
 * Where one world hands over to the next, always unseen:
 * Ch01 → Ch02 through AGENT into black; Ch02 → Ch03 by rising into fog
 * so thick the frame is a single tone, while the camera keeps moving;
 * Ch03 → Ch04 by pushing into the phone's glow until warm light fills the frame;
 * Ch07 → the 2D lockup once a flat keystone has replaced the 3D one.
 */
export const CUTS = { ch01to02: 0.134, ch02to03: 0.285, ch03to04: 0.469, toLockup: 0.935 } as const

/** The world the camera is in at progress p. */
export const activeWorld = (p: number): ChapterId =>
  p < CUTS.ch01to02
    ? 'ch01'
    : p < CUTS.ch02to03
      ? 'ch02'
      : p < CUTS.ch03to04
        ? 'ch03'
        : p < CUTS.toLockup
          ? 'ch04'
          : // The lockup covers the frame: no 3D world needs to render.
            'ch07'

/**
 * The page's scroll length covers the film up to this point; each phase
 * raises it as chapters land, until it reaches 1.
 */
export const BUILT_UNTIL = 1
