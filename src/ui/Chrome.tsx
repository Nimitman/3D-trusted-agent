import { useEffect, useRef, useState } from 'react'
import { useFilm } from '../state/store'
import { BUILT_UNTIL, CHAPTERS, CUTS, localT } from '../story/timeline'
import { remap } from '../lib/math'
import { filmScrollLength } from '../scroll/useFilmScroll'
import { SoundToggle } from './SoundToggle'

/** How long after the loader finishes the scroll hint appears: the light has dawned by then. */
const HINT_AFTER_MS = 2100

/** The whole film is built: no end-of-build card, and skipping lands on the lockup. */
const FINISHED = BUILT_UNTIL >= 1

/**
 * Everything drawn over the film: the cover that hides loading, the fade to
 * black after AGENT, the brand mark, a progress rail, the scroll hint, the
 * skip link and the end-of-spike card. Scroll-driven values are written to
 * the DOM directly so React never re-renders per frame.
 */
export function Chrome() {
  const ready = useFilm((s) => s.ready)
  const introAt = useFilm((s) => s.introAt)
  const root = useRef<HTMLDivElement>(null)
  // "Scroll" arrives once the light has dawned inside the finished loader ring.
  const [hintOn, setHintOn] = useState(false)
  useEffect(() => {
    if (introAt === null) return
    const id = setTimeout(() => setHintOn(true), Math.max(0, introAt + HINT_AFTER_MS - performance.now()))
    return () => clearTimeout(id)
  }, [introAt])

  useEffect(() => {
    const apply = (p: number) => {
      const el = root.current
      if (!el) return
      el.style.setProperty('--p', p.toFixed(4))
      // Through AGENT into black, a held beat of darkness, then the crowd.
      const throughAgent = remap(localT(p, 'ch01'), 0.87, 0.95) * (1 - remap(p, CUTS.ch01to02 + 0.003, CUTS.ch01to02 + 0.017))
      // Only while the film is unfinished: fade out before the end-of-build card.
      const builtEnd = FINISHED ? 0 : remap(p, BUILT_UNTIL - 0.016, BUILT_UNTIL - 0.008)
      el.style.setProperty('--black', Math.max(throughAgent, builtEnd).toFixed(3))
      el.style.setProperty('--end', FINISHED ? '0' : remap(p, BUILT_UNTIL - 0.008, BUILT_UNTIL - 0.002).toFixed(3))
      el.style.setProperty('--hint', (1 - remap(p, 0, 0.006)).toFixed(3))
    }
    apply(useFilm.getState().p)
    return useFilm.subscribe((s) => apply(s.p))
  }, [])

  const skip = () => {
    // To the end of the film (the lockup), not the end of the page.
    const lenis = (window as unknown as { lenis?: { scrollTo: (t: number, o?: object) => void } }).lenis
    const end = filmScrollLength()
    if (lenis) lenis.scrollTo(end, { duration: 2.4 })
    else window.scrollTo({ top: end })
    // The film ends on the lockup, which is visual only; focus moves to the next real content.
    document.getElementById(FINISHED ? 'how-trust-is-earned' : 'end')?.focus({ preventScroll: true })
  }

  return (
    <div ref={root} className="chrome">
      <div className={`cover${ready ? ' cover--lifted' : ''}`} aria-hidden="true" />
      <div className="black" aria-hidden="true" />

      <a className="skip" href={FINISHED ? '#how-trust-is-earned' : '#end'} onClick={(e) => (e.preventDefault(), skip())}>
        Skip the film
      </a>

      <SoundToggle />

      <div className="brand" aria-hidden="true">
        <span>Housing.com</span>
      </div>

      <div className="rail" aria-hidden="true">
        <div className="rail__fill" />
        {CHAPTERS.map((c) => (
          <span key={c.id} className="rail__tick" style={{ top: `${c.start * 100}%` }} />
        ))}
      </div>

      <div className={`hint${hintOn ? ' hint--on' : ''}`} aria-hidden="true">
        <span>Scroll</span>
        <i />
      </div>

      {!FINISHED && (
        <section id="end" className="endcard" tabIndex={-1} aria-label="End of the current build">
          <p className="endcard__k">Phase 3 · in progress</p>
          <p className="endcard__t">Chapter 07 begins here.</p>
          <p className="endcard__s">Next, the camera moves into the keystone, and the final statement.</p>
        </section>
      )}
    </div>
  )
}

/** Opt-in readout for reviews: add ?debug to the URL. */
export function DebugHud() {
  const [on] = useState(() => new URLSearchParams(location.search).has('debug'))
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!on) return
    let frames = 0
    let last = performance.now()
    let fps = 0
    let raf = 0
    const tick = (now: number) => {
      frames++
      if (now - last > 500) {
        fps = Math.round((frames * 1000) / (now - last))
        frames = 0
        last = now
      }
      const s = useFilm.getState()
      if (ref.current)
        ref.current.textContent =
          `p ${(s.p * 100).toFixed(2)}%  ch01 ${localT(s.p, 'ch01').toFixed(3)}\n` +
          `v ${s.v.toFixed(2)}  tier ${s.tier}  fps ${fps}  beyond ${s.beyond.toFixed(2)}`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])

  return on ? <pre ref={ref} className="hud" aria-hidden="true" /> : null
}
