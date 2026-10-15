import { useEffect, useRef, useState } from 'react'
import { useFilm } from '../state/store'
import { localT } from '../story/timeline'
import { COPY } from '../story/copy'
import { CH07_BEATS } from '../story/ch07'
import { lerp, remap, smoothstep } from '../lib/math'
import { OUTLINES, outlineToPath } from '../three/geometry/keystone'

const toSvg = (x: number, y: number): [number, number] => [x * 100, -y * 100]
const STONES = [OUTLINES.plinth, OUTLINES.pierL, OUTLINES.pierR, ...OUTLINES.voussoirs].map((o) => outlineToPath(o, toSvg))
const KEY = outlineToPath(OUTLINES.key, toSvg)
/** The keystone's centre within the mark's viewBox, as a transform origin. */
const KEY_ORIGIN = '50% 17.4%'

/**
 * The final screen. The camera has pushed into the keystone; here a flat
 * keystone of the same purple takes over the frame, then draws back to reveal
 * the whole mark, and the lockup arrives line by line. Real HTML: the links
 * are focusable and work the same in every tier.
 */
export function Lockup() {
  const root = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const apply = (p: number) => {
      const el = root.current
      if (!el) return
      const t = localT(p, 'ch07')
      const b = CH07_BEATS
      const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(3))
      set('--lk-ground', smoothstep(remap(t, b.flatten[0], b.flatten[1])))
      // Fills the frame from the keystone, then draws back to its true size.
      set('--lk-scale', lerp(24, 1, smoothstep(remap(t, b.reveal[0], b.reveal[1]))))
      set('--lk-mark', smoothstep(remap(t, b.flatten[0], b.flatten[1])))
      set('--lk-stones', smoothstep(remap(t, b.reveal[0], b.reveal[1])))
      set('--lk-title', smoothstep(remap(t, b.title[0], b.title[1])))
      set('--lk-recognised', smoothstep(remap(t, b.recognised[0], b.recognised[1])))
      set('--lk-sub', smoothstep(remap(t, b.sub[0], b.sub[1])))
      const ctas = smoothstep(remap(t, b.ctas[0], b.ctas[1]))
      set('--lk-ctas', ctas)
      // Only reachable by pointer and keyboard once the buttons are really there.
      const nowLive = ctas > 0.6
      setLive((was) => (was === nowLive ? was : nowLive))
      el.style.visibility = t > b.flatten[0] - 0.01 ? 'visible' : 'hidden'
    }
    apply(useFilm.getState().p)
    return useFilm.subscribe((s) => apply(s.p))
  }, [])

  return (
    <section ref={root} id="lockup" className={`lockup${live ? ' lockup--live' : ''}`} aria-label={COPY.ch07.lockup} tabIndex={-1}>
      <div className="lockup__ground" aria-hidden="true" />
      <div className="lockup__col">
        <svg className="lockup__mark" viewBox="-140 -240 280 270" aria-hidden="true" style={{ transformOrigin: KEY_ORIGIN }}>
          <g className="lockup__stones">
            {STONES.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path d={KEY} className="lockup__key" />
        </svg>
        <h2 className="lockup__title">{COPY.ch07.lockup}</h2>
        <p className="lockup__recognised">{COPY.ch07.recognised}</p>
        <p className="lockup__sub">
          {COPY.ch07.sub[0]}
          <br />
          {COPY.ch07.sub[1]}
        </p>
        <div className="lockup__ctas">
          {/* Destinations are placeholders until the directory and the trust explainer exist. */}
          <a className="cta cta--primary" href="#explore-trusted-agents" tabIndex={live ? 0 : -1}>
            {COPY.ch07.primary}
          </a>
          <a className="cta cta--secondary" href="#how-trust-is-earned" tabIndex={live ? 0 : -1}>
            {COPY.ch07.secondary}
          </a>
        </div>
      </div>
    </section>
  )
}
