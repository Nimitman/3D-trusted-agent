import { useEffect, useRef, useState } from 'react'
import { useFilm } from '../state/store'
import type { SoundEngine } from '../sound/engine'

/**
 * Create and unlock audio synchronously inside the click. Safari (iOS above
 * all) only lets audio start within the gesture itself; awaiting anything
 * first, even loading the engine's code, can lose that permission.
 */
function unlockAudio() {
  const ctx = new AudioContext()
  const src = ctx.createBufferSource()
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  src.connect(ctx.destination)
  src.start()
  void ctx.resume()
  return ctx
}

/**
 * Sound is off until the viewer asks for it. The first press creates the
 * audio (browsers only allow that from a gesture); after that it fades in and
 * out. It also pauses whenever the tab is hidden.
 */
export function SoundToggle() {
  const [on, setOn] = useState(false)
  const engine = useRef<SoundEngine | null>(null)

  // Drive the score from the film while sound is on.
  useEffect(() => {
    if (!on) return
    let raf = 0
    const tick = () => {
      const { p, v, beyond } = useFilm.getState()
      engine.current?.update(p, v, beyond)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])

  // Never play to a hidden tab.
  useEffect(() => {
    const onVisibility = () => {
      const e = engine.current
      if (!e || !on) return
      if (document.visibilityState === 'hidden') e.suspend()
      else e.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [on])

  const toggle = async () => {
    if (!engine.current) {
      // Unlock audio now, inside the click; then load the engine (only on first use).
      const ctx = unlockAudio()
      const { SoundEngine } = await import('../sound/engine')
      engine.current = new SoundEngine(ctx)
      // Review hook (?debug): inspect levels and cues without listening.
      if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __sound?: SoundEngine }).__sound = engine.current
    }
    const next = !on
    if (next) await engine.current.resume()
    engine.current.setOn(next)
    if (!next) setTimeout(() => engine.current?.suspend(), 900)
    setOn(next)
  }

  return (
    <button
      type="button"
      className={`sound${on ? ' sound--on' : ''}`}
      aria-pressed={on}
      aria-label={on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'}
      onClick={toggle}
    >
      <span className="sound__bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="sound__label" aria-hidden="true">
        {on ? 'Sound on' : 'Sound off'}
      </span>
    </button>
  )
}
