/**
 * Chapter 04's beats in chapter-local time (0 → 1 over film 44% → 60%).
 * The chapter is entered at about t = 0.18, out of Chapter 03's warm white-out.
 * Shared by the 3D, the captions and the 2D film.
 */
export const CH04_BEATS = {
  /** The white-out shrinks back to a single orb of light. */
  recede: [0.18, 0.26] as [number, number],
  /** Each moment travels in as a light and lands as a piece of glass. */
  moments: [
    [0.24, 0.33],
    [0.36, 0.45],
    [0.49, 0.58],
    [0.62, 0.71],
  ] as [number, number][],
  /** Then the rest arrive, quicker: another, another, another. */
  rest: [0.75, 0.93] as [number, number],
}

/**
 * Which badge pieces form here, in the order they arrive. The plinth and the
 * keystone are held back for Chapter 05. The first four are the four moments.
 */
export const CH04_PIECES = ['v1', 'v6', 'v3', 'pierL', 'v4', 'v0', 'pierR', 'v7', 'v2', 'v5'] as const
export type PieceId = (typeof CH04_PIECES)[number]

/** When a piece lands, in chapter-local time. */
export function landing(index: number) {
  if (index < 4) return CH04_BEATS.moments[index][1]
  const [a, b] = CH04_BEATS.rest
  const n = CH04_PIECES.length - 4
  return a + ((index - 4 + 1) / n) * (b - a)
}

/** When a piece's light sets off towards it. */
export function departure(index: number) {
  if (index < 4) return CH04_BEATS.moments[index][0]
  return landing(index) - 0.05
}
