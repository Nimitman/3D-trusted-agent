import { useEffect, useRef } from 'react'
import { useFilm } from '../state/store'
import { chapter } from '../story/timeline'
import { COPY } from '../story/copy'
import { CH05_BEATS } from '../story/ch05'
import { lerp, remap } from '../lib/math'

const at = (t: number) => lerp(chapter('ch05').start, chapter('ch05').end, t)

/**
 * Chapter 05's progress: all five qualities in one quiet row under the big
 * word, each lighting up as its piece seats. Same spot as the word above it,
 * so the eye never has to leave the badge to see how far it has come.
 */
export function LockStrip() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const locks = CH05_BEATS.locks
    const [t0] = CH05_BEATS.title
    const apply = (p: number) => {
      const el = root.current
      if (!el) return
      const shown = Math.min(remap(p, at(locks[0] - 0.02), at(locks[0])), 1 - remap(p, at(t0 - 0.025), at(t0 - 0.005)))
      el.style.opacity = shown.toFixed(3)
      el.style.visibility = shown > 0.001 ? 'visible' : 'hidden'
      el.querySelectorAll('span').forEach((s, i) => {
        s.classList.toggle('is-locked', p >= at(locks[i]))
      })
    }
    apply(useFilm.getState().p)
    return useFilm.subscribe((s) => apply(s.p))
  }, [])

  return (
    <div ref={root} className="lockstrip" aria-hidden="true">
      {COPY.ch05.locks.map((l, i) => (
        <span key={l} className={i === COPY.ch05.locks.length - 1 ? 'is-trust' : undefined}>
          {l}
        </span>
      ))}
    </div>
  )
}
