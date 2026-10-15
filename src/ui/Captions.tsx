import { useEffect, useRef } from 'react'
import { useFilm } from '../state/store'
import { CUES } from '../story/captions'
import { remap } from '../lib/math'

/**
 * How long a line takes to follow the scroll, in seconds. Scroll sets where a
 * line should be; this sets how fast it may get there, so a single mouse-wheel
 * notch (which can cover a whole fade) still reads as a fade on desktop.
 */
const FOLLOW = 0.45

/**
 * Spoken lines over the film. Each line settles into place as it arrives,
 * by scale only, so its line breaks never change mid-transition.
 * Shared by every tier.
 */
export function Captions() {
  const refs = useRef<(HTMLParagraphElement | null)[]>([])
  const reduced = useFilm((s) => s.reducedMotion)

  useEffect(() => {
    const shown = CUES.map(() => 0)
    const arrived = CUES.map(() => 0)
    let last = performance.now()
    let raf = 0
    let settleNow = false

    const tick = (now: number) => {
      // Generous cap: after a stall (busy tab, slow device) lines catch up in a frame or two.
      const dt = Math.min((now - last) / 1000, 0.6)
      last = now
      const k = settleNow ? 1 : 1 - Math.exp(-dt / FOLLOW)
      settleNow = false
      const p = useFilm.getState().p

      CUES.forEach((cue, i) => {
        const el = refs.current[i]
        if (!el) return
        const arrive = remap(p, cue.in[0], cue.in[1])
        const target = Math.min(arrive, 1 - remap(p, cue.out[0], cue.out[1]))
        shown[i] += (target - shown[i]) * k
        arrived[i] += (arrive - arrived[i]) * k
        if (Math.abs(target - shown[i]) < 0.001) shown[i] = target

        el.style.opacity = shown[i].toFixed(3)
        el.style.visibility = shown[i] > 0.001 ? 'visible' : 'hidden'
        el.style.setProperty('--settle', reduced ? '0' : (1 - arrived[i]).toFixed(3))
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Review tool (?debug): jump every line straight to where it should be now.
    const w = window as unknown as { __captionsSettle?: () => void }
    if (new URLSearchParams(location.search).has('debug')) {
      w.__captionsSettle = () => {
        settleNow = true
        tick(performance.now())
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(tick)
      }
    }
    return () => {
      cancelAnimationFrame(raf)
      delete w.__captionsSettle
    }
  }, [reduced])

  return (
    <div className="captions" aria-hidden="true">
      {CUES.map((cue, i) => (
        <p
          key={cue.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          className={`cue cue--${cue.style}`}
        >
          {cue.text}
        </p>
      ))}
    </div>
  )
}
