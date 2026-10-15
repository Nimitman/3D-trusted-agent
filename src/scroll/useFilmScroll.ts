import { useEffect } from 'react'
import Lenis from 'lenis'
import { BUILT_UNTIL } from '../story/timeline'
import { useFilm } from '../state/store'
import { clamp } from '../lib/math'

/**
 * Turns page scroll into film progress. Lenis gives the scroll its weight;
 * with reduced motion we fall back to native scrolling and no smoothing.
 */
export function useFilmScroll() {
  const reducedMotion = useFilm((s) => s.reducedMotion)

  useEffect(() => {
    const write = (scroll: number, limit: number, velocity: number) => {
      const p = limit > 0 ? (scroll / limit) * BUILT_UNTIL : 0
      useFilm.setState({ p, v: clamp(velocity / 60, -1, 1) })
    }

    const onPointer = (e: PointerEvent) => {
      useFilm.setState({
        pointer: { x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 },
      })
    }
    addEventListener('pointermove', onPointer, { passive: true })

    if (reducedMotion) {
      const onScroll = () => {
        const limit = document.documentElement.scrollHeight - innerHeight
        write(scrollY, limit, 0)
      }
      onScroll()
      addEventListener('scroll', onScroll, { passive: true })
      return () => {
        removeEventListener('scroll', onScroll)
        removeEventListener('pointermove', onPointer)
      }
    }

    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1.2 })
    lenis.on('scroll', (l: Lenis) => write(l.scroll, l.limit, l.velocity))
    write(lenis.scroll, lenis.limit, 0)

    // Velocity decays to zero when scrolling stops; Lenis stops emitting, so do it here.
    let raf = 0
    const settle = () => {
      if (!lenis.isScrolling) useFilm.setState((s) => ({ v: s.v * 0.9 }))
      raf = requestAnimationFrame(settle)
    }
    raf = requestAnimationFrame(settle)

    ;(window as unknown as { lenis?: Lenis }).lenis = lenis
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      removeEventListener('pointermove', onPointer)
    }
  }, [reducedMotion])
}
