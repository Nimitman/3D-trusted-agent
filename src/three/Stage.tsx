import { Component, Suspense, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useFilm, type Tier } from '../state/store'
import { CameraRig } from './CameraRig'
import { Ch01Portal } from './chapters/Ch01Portal'
import { Ch02Crowd } from './chapters/Ch02Crowd'
import { Ch03Tower } from './chapters/Ch03Tower'
import { Ch04Glass } from './chapters/Ch04Glass'
import { World } from './World'
import { Atmosphere } from './Atmosphere'

/** Lifts the cover once real frames are on screen, so nobody sees a half-built scene. */
function ReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 3) useFilm.setState({ ready: true })
  })
  return null
}

/**
 * Review tool, only with ?debug: window.__shoot(p) renders one exact frame at
 * film progress p, with the camera already settled, and shows it as a still.
 * Works even when the browser has paused animation frames.
 */
function DebugShoot() {
  const advance = useThree((s) => s.advance)
  const gl = useThree((s) => s.gl)
  useLayoutEffect(() => {
    if (!new URLSearchParams(location.search).has('debug')) return
    const w = window as unknown as Record<string, unknown>
    w.__shoot = (p: number) => {
      useFilm.setState({ p, v: 0 })
      w.__filmSnap = true
      for (let i = 0; i < 4; i++) advance(performance.now() + i * 16, true)
      w.__filmSnap = false
      ;(w.__captionsSettle as (() => void) | undefined)?.()
      let img = document.getElementById('debug-still') as HTMLImageElement | null
      if (!img) {
        img = document.createElement('img')
        img.id = 'debug-still'
        img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:7;pointer-events:none'
        document.body.appendChild(img)
      }
      img.src = gl.domElement.toDataURL('image/jpeg', 0.85)
      return p
    }
    return () => {
      delete w.__shoot
    }
  }, [advance, gl])
  return null
}

function Effects({ tier }: { tier: Tier }) {
  const full = tier === 'full'
  return (
    <EffectComposer multisampling={full ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={full ? 1.25 : 0.9} luminanceThreshold={1} luminanceSmoothing={0.35} radius={0.78} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise premultiply opacity={0.5} />
      <Vignette offset={0.22} darkness={0.85} />
    </EffectComposer>
  )
}

/** Any render error drops the viewer to the 2D film instead of a broken canvas. */
class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('3D stage failed, switching to 2D.', error)
    useFilm.getState().setTier('flat')
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Frame-rate dips are only evidence of a slow GPU once the scene has warmed up
 * (shaders compiled, fonts laid out) and while the page is actually visible.
 * Throttled or background tabs must never downgrade the film.
 */
const WARMUP_MS = 4000
let readyAt = 0
useFilm.subscribe((s) => {
  if (s.ready && !readyAt) readyAt = performance.now()
})
const measurable = () =>
  readyAt > 0 && performance.now() - readyAt > WARMUP_MS && document.visibilityState === 'visible' && document.hasFocus()

export function Stage({ tier }: { tier: Exclude<Tier, 'flat'> }) {
  const [dpr, setDpr] = useState(tier === 'full' ? 1.75 : 1.25)
  const setTier = useFilm((s) => s.setTier)
  const declines = useRef(0)

  return (
    <GLBoundary>
      <Canvas
        className="stage"
        aria-hidden="true"
        dpr={dpr}
        shadows="soft"
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 35, near: 0.1, far: 120, position: [0, 1.45, 14] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => setTier('flat'), { once: true })
        }}
      >
        <PerformanceMonitor
          bounds={() => [42, 58]}
          ms={500}
          iterations={8}
          onDecline={() => {
            if (!measurable()) return
            // Step down gently: resolution first, then the lite tier, and only
            // fall back to 2D after repeated sustained declines at the lowest setting.
            if (dpr > 1) return setDpr((d) => Math.max(1, d - 0.25))
            if (tier === 'full') return setTier('lite')
            if (++declines.current >= 3) setTier('flat')
          }}
          onIncline={() => {
            declines.current = 0
          }}
        >
          <Suspense fallback={null}>
            <World id="ch01">
              <Ch01Portal tier={tier} />
            </World>
            <World id="ch02">
              <Ch02Crowd tier={tier} />
            </World>
            <World id="ch03">
              <Ch03Tower tier={tier} />
            </World>
            <World id="ch04">
              <Ch04Glass tier={tier} />
            </World>
            <CameraRig />
            <Atmosphere />
            <Effects tier={tier} />
            <ReadySignal />
            <DebugShoot />
            <Preload all />
          </Suspense>
        </PerformanceMonitor>
      </Canvas>
    </GLBoundary>
  )
}
