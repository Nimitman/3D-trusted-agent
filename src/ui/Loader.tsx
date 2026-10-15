import { useEffect, useRef, useState } from 'react'
import { useFilm } from '../state/store'
import { remap } from '../lib/math'

const R = 30
const CIRCUMFERENCE = 2 * Math.PI * R
/** How quickly the ring catches up with what has actually loaded (per second). */
const CATCH_UP = 4
/** Between milestones the ring creeps forward, but never past this share of the gap. */
const MAX_CREEP = 0.33

/**
 * The first thing on screen: a thin ring where the light will be, filling as
 * the film really loads. At 100% the light dawns in its centre and the ring
 * stays on as a faint halo until the viewer starts to scroll.
 */
export function Loader() {
  const root = useRef<HTMLDivElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const [done, setDone] = useState(false)
  const tier = useFilm((s) => s.tier)

  useEffect(() => {
    let shown = 0
    let creep = 0
    let milestone = -1
    let last = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const { loaded, ready, introAt } = useFilm.getState()

      // Head for the last real milestone. While waiting for the next one, creep
      // a little into the gap (at most a third of it) so a long wait still moves.
      if (loaded !== milestone) {
        milestone = loaded
        creep = 0
      }
      creep = Math.min(MAX_CREEP, creep + dt * 0.06)
      const target = ready ? 1 : loaded + (1 - loaded) * creep
      shown += Math.max(0, target - shown) * (1 - Math.exp(-CATCH_UP * dt))
      if (ready && shown > 0.995) shown = 1

      const pct = Math.round(shown * 100)
      if (arc.current) arc.current.style.strokeDashoffset = (CIRCUMFERENCE * (1 - shown)).toFixed(2)
      if (label.current) label.current.textContent = `${pct}%`
      root.current?.setAttribute('aria-valuenow', String(pct))

      if (shown === 1 && introAt === null) {
        useFilm.setState({ introAt: performance.now() })
        setDone(true)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Once the viewer scrolls, the halo goes with the scroll hint.
    const unsub = useFilm.subscribe((s) => {
      root.current?.style.setProperty('--loader-out', remap(s.p, 0, 0.006).toFixed(3))
    })
    return () => {
      cancelAnimationFrame(raf)
      unsub()
    }
  }, [])

  return (
    <div
      ref={root}
      className={`loader loader--${tier}${done ? ' loader--done' : ''}`}
      role="progressbar"
      aria-label="Loading the film"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-hidden={done}
    >
      <svg className="loader__ring" viewBox="-40 -40 80 80" aria-hidden="true">
        <circle className="loader__track" r={R} />
        <circle
          ref={arc}
          className="loader__arc"
          r={R}
          strokeDasharray={CIRCUMFERENCE.toFixed(2)}
          strokeDashoffset={CIRCUMFERENCE.toFixed(2)}
          transform="rotate(-90)"
        />
      </svg>
      <span ref={label} className="loader__pct" aria-hidden="true">
        0%
      </span>
    </div>
  )
}
