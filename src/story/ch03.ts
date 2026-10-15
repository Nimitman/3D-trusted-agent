/**
 * Chapter 03's beats in chapter-local time (0 → 1 over film 26% → 47%).
 * Shared by the 3D sets, the captions and the 2D film so they stay in step.
 */
export const CH03_BEATS = {
  /** Fog from the crowd clears and the tower appears. */
  emerge: [0.12, 0.26] as [number, number],
  /** The camera passes through the glass of the lit floor. */
  enter: 0.37,
  /** Each moment's window: the camera arrives, it plays, the camera moves on. */
  moments: [
    [0.38, 0.5],
    [0.51, 0.63],
    [0.64, 0.77],
    [0.78, 0.97],
  ] as [number, number][],
}

/** The phone's glow swells to fill the frame: the cut into Chapter 04. */
export const WHITEOUT: [number, number] = [0.955, 0.995]

/** Where the four sets stand along the lit floor, in metres. */
export const SET_X = [-7, 0, 7, 14]
