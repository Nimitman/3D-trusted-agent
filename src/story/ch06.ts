/**
 * Chapter 06's beats in chapter-local time (0 → 1 over film 73% → 89%).
 * It plays in the badge's world, picking up at t ≈ 0.19 where Chapter 05 ends.
 * Shared by the 3D, the captions and the 2D film.
 */
export const CH06_BEATS = {
  /** Where Chapter 05 hands over. */
  start: 0.1875,
  /** Everything but the badge falls into darkness; one light from above. */
  quiet: [0.19, 0.32] as [number, number],
  /** The faint field of stories behind the badge. */
  field: [0.3, 0.45, 0.72, 0.8] as [number, number, number, number],
  /**
   * Five stories, one at a time, in one place, never overlapping, so the eye
   * always knows where to look. Review found staggered corners got missed.
   */
  stories: Array.from({ length: 5 }, (_, i) => [0.32 + i * 0.076, 0.32 + (i + 1) * 0.076]) as [number, number][],
  /** "Some agents close deals." */
  close: [0.72, 0.8] as [number, number],
  /** A held beat of nothing, then "Trusted agents build confidence." */
  confidence: 0.83,
}
