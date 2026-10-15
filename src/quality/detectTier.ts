import type { Tier } from '../state/store'

/**
 * Picks a starting tier before any 3D loads. The PerformanceMonitor in the
 * stage can still step down at runtime (full → lite → flat), never up.
 *
 *   full  desktop-class GPU: reflections, refraction, full particle counts
 *   lite  phones and modest GPUs: simpler materials, fewer particles, lower DPR
 *   flat  no usable WebGL or reduced motion: the 2D cinematic version
 */
export function detectTier(reducedMotion: boolean): Tier {
  const forced = new URLSearchParams(location.search).get('tier')
  if (forced === 'full' || forced === 'lite' || forced === 'flat') return forced
  if (reducedMotion) return 'flat'

  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2')
  if (!gl) return 'flat'

  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return 'flat'

  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = matchMedia('(pointer: coarse)').matches
  const small = Math.min(innerWidth, innerHeight) < 768
  const lowMemory = (nav.deviceMemory ?? 8) <= 4
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4
  if ((coarse && small) || lowMemory || fewCores) return 'lite'

  return 'full'
}
