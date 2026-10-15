import { lazy, Suspense, useEffect } from 'react'
import { useFilm } from './state/store'
import { useFilmScroll } from './scroll/useFilmScroll'
import { BUILT_UNTIL, FILM_VH } from './story/timeline'
import { FlatStage } from './flat/FlatStage'
import { Chrome, DebugHud } from './ui/Chrome'
import { Captions } from './ui/Captions'
import { Lockup } from './ui/Lockup'
import { StoryText } from './story/StoryText'

// three.js and the scenes load only for viewers who get the 3D film.
const Stage = lazy(() => import('./three/Stage').then((m) => ({ default: m.Stage })))

const isMobile = matchMedia('(max-width: 767px)').matches

/**
 * If the 3D hasn't drawn a frame after 10 seconds of the page being visible,
 * switch to the 2D film rather than leave the viewer on a black screen.
 */
function useStallGuard() {
  useEffect(() => {
    let visibleFor = 0
    const id = setInterval(() => {
      const { ready, tier, setTier } = useFilm.getState()
      if (ready || tier === 'flat') return clearInterval(id)
      if (document.visibilityState === 'visible') visibleFor += 1
      if (visibleFor >= 10) {
        console.warn('3D did not start in time, switching to 2D.')
        setTier('flat')
        clearInterval(id)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])
}

export default function App() {
  const tier = useFilm((s) => s.tier)
  useFilmScroll()
  useStallGuard()

  // Scrolling the built part of the film takes this many screen-heights.
  const filmVh = (isMobile ? FILM_VH.mobile : FILM_VH.desktop) * BUILT_UNTIL

  return (
    <>
      {tier === 'flat' ? (
        <FlatStage />
      ) : (
        <Suspense fallback={null}>
          <Stage tier={tier} />
        </Suspense>
      )}
      <Captions />
      <Lockup />
      <Chrome />
      <StoryText />
      <DebugHud />
      <div className="spacer" style={{ height: `calc(${filmVh}vh + 100vh)` }} aria-hidden="true" />
    </>
  )
}
