/**
 * Chapter 07's beats in chapter-local time (0 → 1 over film 87% → 100%).
 * It picks up at t ≈ 0.154 where Chapter 06 ends. Shared by the 3D, the
 * captions, the lockup and the 2D film.
 */
export const CH07_BEATS = {
  /** Where Chapter 06 hands over. */
  start: 0.154,
  /** The camera pushes into the keystone until it fills the frame. */
  push: [0.16, 0.46] as [number, number],
  /** "An agent is a profession." */
  profession: [0.2, 0.24, 0.33, 0.37] as [number, number, number, number],
  /** The 3D gives way to a flat keystone of the same shape and colour. */
  flatten: [0.42, 0.48] as [number, number],
  /** "Trusted is earned.", over the purple. */
  earned: [0.5, 0.54, 0.6, 0.63] as [number, number, number, number],
  /** The keystone draws back to reveal the whole mark. */
  reveal: [0.6, 0.7] as [number, number],
  /** The lockup's lines arrive in turn, then the buttons. */
  title: [0.68, 0.73] as [number, number],
  recognised: [0.72, 0.77] as [number, number],
  sub: [0.76, 0.81] as [number, number],
  ctas: [0.8, 0.86] as [number, number],
}
