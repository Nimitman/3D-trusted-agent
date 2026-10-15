import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { damp } from '../lib/math'
import { useFilm } from '../state/store'
import { LOCK_GROUPS } from '../story/ch05'
import { centroidOf, outlineOf } from '../three/geometry/keystone'
import { extrudeOutline } from '../three/geometry/keystone3d'

const PURPLE = new THREE.Color('#7a45ff')
const COLORS = ['#57534d', '#c4bdb1', '#c4bdb1', '#d8d2c6', '#e9e4da']

type Piece = { mesh: THREE.Mesh; base: THREE.Color; group: number; home: THREE.Vector3 }

/**
 * The finished badge, small and close, for "What makes an agent trusted?".
 * The selected quality's part lifts towards you with a purple underglow; the
 * rest step back. The whole badge leans a little towards the pointer.
 */
function Badge({ active }: { active: number }) {
  const reduced = useFilm((s) => s.reducedMotion)
  const root = useRef<THREE.Group>(null)
  const glow = useRef<THREE.PointLight>(null)

  const pieces = useMemo<Piece[]>(
    () =>
      LOCK_GROUPS.flatMap((names, group) =>
        names.map((name) => {
          const outline = outlineOf(name)
          const [cx, cy] = centroidOf(outline)
          const geo = extrudeOutline(outline)
          geo.translate(-cx, -cy, 0)
          const base = new THREE.Color(COLORS[group])
          const mat = new THREE.MeshStandardMaterial({
            color: base.clone(),
            roughness: group === 4 ? 0.35 : 0.8,
            metalness: group === 4 ? 0.3 : 0,
          })
          const mesh = new THREE.Mesh(geo, mat)
          const home = new THREE.Vector3(cx, cy, 0)
          mesh.position.copy(home)
          return { mesh, base, group, home }
        }),
      ),
    [],
  )

  const centres = useMemo(
    () =>
      LOCK_GROUPS.map((_, g) => {
        const own = pieces.filter((p) => p.group === g)
        return own.reduce((c, p) => c.add(p.home), new THREE.Vector3()).divideScalar(own.length)
      }),
    [pieces],
  )
  const tint = useMemo(() => new THREE.Color(), [])
  const glowAt = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    for (const p of pieces) {
      const on = p.group === active
      p.mesh.position.z = damp(p.mesh.position.z, on ? 0.16 : 0, 7, dt)
      const mat = p.mesh.material as THREE.MeshStandardMaterial
      tint.copy(p.base).multiplyScalar(active < 0 || on ? 1 : 0.42)
      mat.color.lerp(tint, 1 - Math.exp(-7 * dt))
    }
    if (glow.current && active >= 0) {
      const c = centres[active]
      glow.current.position.lerp(glowAt.set(c.x, c.y - 0.12, 0.7), 1 - Math.exp(-6 * dt))
      glow.current.intensity = damp(glow.current.intensity, 2.4, 6, dt)
    }
    if (root.current) {
      const tx = reduced ? 0 : state.pointer.y * -0.1
      const ty = reduced ? 0 : state.pointer.x * 0.16
      root.current.rotation.x = damp(root.current.rotation.x, tx, 4, dt)
      root.current.rotation.y = damp(root.current.rotation.y, ty, 4, dt)
    }
  })

  return (
    <group>
      <hemisphereLight args={['#ffffff', '#1a1714', 0.55]} />
      <directionalLight position={[-3, 5, 5]} intensity={1.7} color="#fff2e2" />
      <directionalLight position={[3, 2, -4]} intensity={0.6} color="#c3cad8" />
      <group ref={root} position-y={-1}>
        {pieces.map((p, i) => (
          <primitive key={i} object={p.mesh} />
        ))}
        <pointLight ref={glow} color={PURPLE} intensity={0} distance={2.2} decay={2} />
      </group>
    </group>
  )
}

export default function BadgeModel3D({ active }: { active: number }) {
  return (
    <Canvas
      className="proof__canvas"
      aria-hidden="true"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 30, position: [0, 0.1, 7] }}
    >
      <Badge active={active} />
    </Canvas>
  )
}
