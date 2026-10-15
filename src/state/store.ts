import { create } from 'zustand'

export type Tier = 'full' | 'lite' | 'flat'

type FilmState = {
  /** Film progress, 0 → 1 across the whole film. */
  p: number
  /** Scroll velocity, normalised to roughly -1 → 1. */
  v: number
  /** Pointer in normalised device coordinates, -1 → 1. */
  pointer: { x: number; y: number }
  tier: Tier
  reducedMotion: boolean
  /** True once the first 3D frame has rendered, so the cover can lift. */
  ready: boolean
  setTier: (t: Tier) => void
}

/**
 * p, v and pointer change every frame. 3D code reads them with getState()
 * inside useFrame so nothing re-renders; only tier and ready are subscribed to.
 */
export const useFilm = create<FilmState>((set) => ({
  p: 0,
  v: 0,
  pointer: { x: 0, y: 0 },
  tier: 'full',
  reducedMotion: false,
  ready: false,
  // The 2D film needs no warm-up, so switching to it lifts the cover at once.
  setTier: (tier) => set(tier === 'flat' ? { tier, ready: true } : { tier }),
}))

export const film = () => useFilm.getState()
