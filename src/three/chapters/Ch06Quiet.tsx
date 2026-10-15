import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { film } from '../../state/store'
import { localT } from '../../story/timeline'
import { COPY } from '../../story/copy'
import { CH06_BEATS } from '../../story/ch06'
import { clamp, lerp, remap, seeded, smoothstep, window4 } from '../../lib/math'
import { track, type Key } from '../../lib/track'

/**
 * Chapter 06 · The reveal.
 * Everything but the badge falls into darkness and the camera drifts back,
 * square on, until the badge floats alone under one light. Behind it, a faint
 * field of stories, too many and too far to read one by one; in front, a few
 * surface briefly and fade (set as captions).
 */
const ORBIT: Key[] = [
  { t: CH06_BEATS.start, v: [0.32, 6.8, 1.75, 1.25] },
  { t: 0.32, v: [0.08, 8, 1.85, 1.5] },
  { t: 0.7, v: [0, 9, 1.9, 1.6] },
  { t: 1, v: [0, 9.6, 1.9, 1.65] },
]
const o: number[] = []
const portraitness = (aspect: number) => clamp((1 - aspect) / 0.45)

export function ch06Camera(t: number, pos: THREE.Vector3, look: THREE.Vector3, aspect = 1.6) {
  track(ORBIT, t, o)
  // Matches the narrow-screen distance Chapter 05 ends on, then keeps it.
  const r = o[1] * lerp(1, 1.6, portraitness(aspect))
  pos.set(Math.sin(o[0]) * r, o[2], Math.cos(o[0]) * r)
  look.set(0, o[3], 0)
}

/** How far into the quiet we are, 0 → 1. */
export const quietAt = (p: number) => smoothstep(remap(localT(p, 'ch06'), CH06_BEATS.quiet[0], CH06_BEATS.quiet[1]))

/**
 * Draws a sheet of faint lines in the body face. These are the same sample
 * stories as the captions, repeated: placeholders until real, consented ones exist.
 */
function storySheet(seed: number) {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const g = c.getContext('2d')!
  const rnd = seeded(seed)
  const lines = COPY.ch06.stories
  let placed = 0
  while (placed < 24) {
    const x = rnd() * 1700
    const y = 40 + rnd() * 960
    // Keep the middle and the lower centre clear: the badge stands there, and
    // the stories surface just below it.
    if (x > 450 && x < 1600 && y > 200) continue
    const size = 18 + rnd() * 20
    g.font = `italic 300 ${size}px "Hanken Grotesk", system-ui, sans-serif`
    g.fillStyle = `rgba(236, 231, 222, ${0.3 + rnd() * 0.5})`
    g.fillText(`“${lines[Math.floor(rnd() * lines.length)]}”`, x, y)
    placed++
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const LAYERS = [
  // Faint, and fainter with distance: a sense of many voices, not lines to read.
  { z: -4, w: 14, y: 2.2, seed: 3, opacity: 0.13, drift: 0.05 },
  { z: -8, w: 20, y: 2.6, seed: 8, opacity: 0.08, drift: 0.03 },
  { z: -13, w: 28, y: 3.2, seed: 13, opacity: 0.05, drift: 0.02 },
]

export function StoryField() {
  // Draw only once the body face has loaded, so the sheet isn't set in a fallback font.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts
      .load('italic 300 32px "Hanken Grotesk"')
      .catch(() => undefined)
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  const textures = useMemo(() => (ready ? LAYERS.map((l) => storySheet(l.seed)) : []), [ready])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  // Upright phones see the busiest middle of the field, so it's quieter there.
  const aspect = useThree((s) => s.size.width / s.size.height)
  const strength = lerp(1, 0.45, portraitness(aspect))

  useFrame((state) => {
    const t = localT(film().p, 'ch06')
    const [a, b, c, d] = CH06_BEATS.field
    const shown = window4(t, a, b, c, d)
    meshes.current.forEach((m, i) => {
      if (!m) return
      const l = LAYERS[i]
      ;(m.material as THREE.MeshBasicMaterial).opacity = shown * l.opacity * strength
      m.visible = shown > 0.001
      // Each layer drifts slowly sideways, at its own pace, for depth.
      m.position.x = Math.sin(state.clock.elapsedTime * l.drift) * 0.6 + (t - 0.5) * l.drift * 20
    })
  })

  if (!ready) return null
  return (
    <group>
      {LAYERS.map((l, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} position={[0, l.y, l.z]}>
          <planeGeometry args={[l.w, l.w / 2]} />
          <meshBasicMaterial map={textures[i]} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
