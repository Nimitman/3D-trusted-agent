import { create } from 'zustand'

export type Tier = 'full' | 'lite' | 'flat'

type FilmState = {
  /** Film progress, 0 → 1 across the whole film. */
  p: number
  /** Scroll velocity, normalised to roughly -1 → 1. */
  v: number
  /** Screens scrolled past the end of the film, into the page that follows. */
  beyond: number
  /** Pointer in normalised device coordinates, -1 → 1. */
  pointer: { x: number; y: number }
  tier: Tier
  reducedMotion: boolean
  /** True once the first 3D frame has rendered, so the cover can lift. */
  ready: boolean
  /**
   * How much has genuinely loaded, 0 → 1, set at real milestones (page start,
   * 3D code, canvas, first frame). The loader ring eases towards it, never past.
   */
  loaded: number
  /** performance.now() when the loader finished: the light dawns from here. */
  introAt: number | null
  setTier: (t: Tier) => void
}

/**
 * p, v and pointer change every frame. 3D code reads them with getState()
 * inside useFrame so nothing re-renders; only tier and ready are subscribed to.
 */
export const useFilm = create<FilmState>((set) => ({
  p: 0,
  v: 0,
  beyond: 0,
  pointer: { x: 0, y: 0 },
  tier: 'full',
  reducedMotion: false,
  ready: false,
  loaded: 0,
  introAt: null,
  // The 2D film needs no warm-up, so switching to it lifts the cover at once.
  setTier: (tier) => set(tier === 'flat' ? { tier, ready: true, loaded: 1 } : { tier }),
}))

export const film = () => useFilm.getState()
