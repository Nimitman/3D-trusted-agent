import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { film, type Tier } from '../../state/store'
import { activeWorld, localT } from '../../story/timeline'
import { CH03_BEATS, SET_X } from '../../story/ch03'
import { clamp, lerp, remap, seeded, smoothstep, window4 } from '../../lib/math'
import { track, type Key } from '../../lib/track'
import { atmo } from '../Atmosphere'
import { Dust } from '../parts/Dust'
import { FOG_BANK } from './Ch02Crowd'
import { Ch03Moments, LIT_FLOOR_Y } from './Ch03Moments'

/**
 * Chapter 03 · The moments that matter.
 * Out of the fog bank a tower appears at night: twelve dark floors and one lit.
 * The camera rises to it, passes through the glass of the lit floor, and
 * tracks past four small sets where an agent does the right thing.
 */
const FLOORS = 12
const STOREY = 3.2
const WIDTH = 34
const DEPTH = 11
const FACADE_Z = DEPTH / 2
// Just lighter than the building, so the tower stands as a silhouette against the night.
const SKY = new THREE.Color('#10141b')

/** Camera position and look target over chapter-local time. */
const KEYS: Key[] = [
  { t: 0.119, v: [6, 2.5, 46, 4, 9, 0] },
  { t: 0.22, v: [5, 8.5, 36, 0, 12, 0] },
  { t: 0.3, v: [-3, 13, 22, -7, 14, 0] },
  { t: 0.355, v: [-8.2, 14.3, 8.5, -8, 14, 0] },
  { t: 0.39, v: [-8, 14.3, 3.9, -7.2, 13.7, 0] },
  { t: 0.47, v: [-6.3, 14.25, 3.3, -6.8, 13.6, 0] },
  { t: 0.535, v: [0.2, 14.3, 3.7, 0, 13.6, 0] },
  { t: 0.6, v: [1.3, 14.25, 3.3, 0.3, 13.6, 0] },
  { t: 0.665, v: [6, 14.35, 4.3, 6.4, 13.6, 0] },
  { t: 0.74, v: [6.9, 14.3, 4, 6.9, 13.5, 0] },
  { t: 0.8, v: [14.1, 14.2, 3.8, 14.2, 13.6, 0] },
  { t: 0.92, v: [14.7, 14.15, 2.8, 14.4, 13.6, -0.5] },
  { t: 0.955, v: [14.8, 14.12, 2.7, 14.3, 13.65, -0.3] },
  // Into the phone's glow, which swells until it fills the frame: the cut to Chapter 04.
  { t: 1, v: [13.66, 13.94, 1.0, 13.58, 13.92, 0.26] },
]
const out: number[] = []

/**
 * What each moment needs in frame on a narrow screen: the centre of its action
 * and its width, in metres. On landscape screens the keyframes already fit.
 */
const SET_FRAMES = [
  { cx: SET_X[0], width: 3.2 },
  { cx: SET_X[1] + 0.35, width: 3.9 },
  { cx: SET_X[2] - 1.15, width: 4.1 },
  // The buyer stands far back, so perspective already pulls them towards the centre.
  { cx: SET_X[3] + 0.55, width: 4.3 },
]
/** The furthest back the camera can stand inside the lit floor's glass. */
const ROOM_FRONT = 5.0
/** Depth of the sets' action, for working out how much the lens must see. */
const SET_DEPTH_Z = -0.4

/** 0 on landscape screens, rising to 1 on a phone held upright. */
const portraitness = (aspect: number) => clamp((1 - aspect) / 0.45)

/** How much the current moment is being framed for a narrow screen, filled in by ch03Camera. */
const fit = { width: 0, distance: 1, blend: 0 }

export function ch03Camera(t: number, pos: THREE.Vector3, look: THREE.Vector3, aspect = 1.6) {
  track(KEYS, t, out)
  pos.set(out[0], out[1], out[2])
  look.set(out[3], out[4], out[5])
  fit.blend = 0

  const k = portraitness(aspect)
  if (k <= 0 || t < CH03_BEATS.enter) return

  // Blend between moments the same way the camera tracks between them.
  let total = 0
  let cx = 0
  let width = 0
  CH03_BEATS.moments.forEach(([a, b], i) => {
    const w = window4(t, a - 0.02, a + 0.02, b - 0.02, b + 0.02)
    total += w
    cx += w * SET_FRAMES[i].cx
    width += w * SET_FRAMES[i].width
  })
  if (total < 0.001) return
  const blend = k * Math.min(1, total)
  // Pan to the centre of the action and step back as far as the room allows.
  const dx = (cx / total - look.x) * blend
  pos.x += dx
  look.x += dx
  pos.z = lerp(pos.z, Math.min(ROOM_FRONT, pos.z + 1.3), blend)
  fit.width = width / total
  fit.distance = pos.z - SET_DEPTH_Z
  fit.blend = blend
}

/**
 * Lens for Chapter 03. On narrow screens, widen just enough that the current
 * moment's whole width fits across the frame, capped so it never fish-eyes.
 */
export function ch03Fov(baseFov: number, aspect: number) {
  if (fit.blend <= 0) return baseFov
  const half = Math.atan((fit.width * 0.54) / fit.distance)
  const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) / aspect))
  return lerp(baseFov, clamp(needed, baseFov, 80), fit.blend)
}

const TOWER_CENTRE = new THREE.Vector3(0, (FLOORS * STOREY) / 2, 0)

export function Ch03Tower({ tier }: { tier: Tier }) {
  const full = tier === 'full'

  const built = useMemo(() => {
    const rnd = seeded(31)
    // Slab edges sit a touch above the glass so the storeys read at night.
    const slabMat = new THREE.MeshStandardMaterial({ color: '#56524b', roughness: 0.9, emissive: '#16140f' })
    const glassMat = new THREE.MeshStandardMaterial({ color: '#141920', roughness: 0.3, metalness: 0.55 })
    const mullionMat = new THREE.MeshStandardMaterial({ color: '#24221f', roughness: 0.6, metalness: 0.4 })

    // Slabs: one draw call.
    const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(WIDTH, 0.35, DEPTH), slabMat, FLOORS + 1)
    const m = new THREE.Matrix4()
    for (let i = 0; i <= FLOORS; i++) slabs.setMatrixAt(i, m.makeTranslation(0, i * STOREY - 0.175, 0))
    slabs.receiveShadow = true

    // Mullions up the whole front, offset so the camera's way in falls between two.
    const mullionXs: number[] = []
    for (let x = -WIDTH / 2 + 0.85; x < WIDTH / 2; x += 1.7) mullionXs.push(x)
    const mullions = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, FLOORS * STOREY, 0.14), mullionMat, mullionXs.length)
    mullionXs.forEach((x, i) => mullions.setMatrixAt(i, m.makeTranslation(x, (FLOORS * STOREY) / 2, FACADE_Z)))

    // Dark glass on every floor but the lit one, with a few rooms still awake.
    const panes: { y: number; lit: boolean }[] = []
    const windows: [number, number, number][] = []
    for (let i = 0; i < FLOORS; i++) {
      const y = i * STOREY + STOREY / 2
      const lit = y > LIT_FLOOR_Y && y < LIT_FLOOR_Y + STOREY
      panes.push({ y, lit })
      if (!lit && rnd() < 0.55) {
        const n = 1 + Math.floor(rnd() * 2)
        for (let k = 0; k < n; k++) windows.push([(rnd() - 0.5) * (WIDTH - 4), y, rnd()])
      }
    }
    return { slabs, mullions, panes, windows, glassMat }
  }, [])

  const cityLights = useMemo(() => {
    const rnd = seeded(77)
    const n = full ? 320 : 140
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const warm = new THREE.Color('#ffc58a')
    const cool = new THREE.Color('#9fb3c8')
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const r = 55 + Math.pow(rnd(), 0.7) * 170
      pos.set([Math.cos(a) * r, 0.3 + rnd() * 6, Math.sin(a) * r - 40], i * 3)
      const c = (rnd() < 0.7 ? warm : cool).clone().multiplyScalar(0.35 + rnd() * 0.5)
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [full])
  const cityMat = useRef<THREE.PointsMaterial>(null)

  useFrame(({ camera }) => {
    const p = film().p
    if (activeWorld(p) !== 'ch03') return
    const t = localT(p, 'ch03')

    // Emerge from the fog bank at a steady rate, solved for the tower's distance
    // like Chapter 01's doorway; once inside, a light haze keeps far sets dim.
    const emerge = smoothstep(remap(t, CH03_BEATS.emerge[0], CH03_BEATS.emerge[1]))
    const ahead = Math.max(4, camera.position.distanceTo(TOWER_CENTRE))
    const visible = clamp(emerge, 0.002, 0.985)
    const outside = Math.max(0.02, Math.sqrt(-Math.log(visible)) / ahead)
    const inside = remap(t, CH03_BEATS.enter - 0.02, CH03_BEATS.enter + 0.02)
    atmo.color.copy(FOG_BANK).lerp(SKY, emerge)
    atmo.density = outside * (1 - inside) + 0.04 * inside

    if (cityMat.current) cityMat.current.opacity = emerge * (1 - inside * 0.7)
  })

  return (
    <group>
      <hemisphereLight args={['#8d97aa', '#050505', 0.3]} />
      {/* Moonlight from the front left: catches slab edges and mullions so the tower has a body. */}
      <directionalLight position={[-40, 60, 50]} intensity={1.1} color="#9aa6bb" />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#0b0a09" roughness={0.6} />
      </mesh>
      <points geometry={cityLights}>
        <pointsMaterial ref={cityMat} vertexColors size={2.4} sizeAttenuation={false} transparent depthWrite={false} fog={false} opacity={0} />
      </points>

      <primitive object={built.slabs} />
      <primitive object={built.mullions} />

      {built.panes.map((pane, i) =>
        pane.lit ? (
          // The lit floor's glass: barely there, the camera passes through it.
          <mesh key={i} position={[0, pane.y, FACADE_Z + 0.02]}>
            <planeGeometry args={[WIDTH, STOREY - 0.35]} />
            <meshStandardMaterial color="#a9b6bd" roughness={0.05} metalness={0.2} transparent opacity={0.06} depthWrite={false} />
          </mesh>
        ) : (
          <mesh key={i} position={[0, pane.y, FACADE_Z - 0.05]} material={built.glassMat}>
            <planeGeometry args={[WIDTH, STOREY - 0.35]} />
          </mesh>
        ),
      )}
      {built.windows.map(([x, y, warmth], i) => (
        <mesh key={i} position={[x, y - 0.3, FACADE_Z - 0.02]}>
          <planeGeometry args={[1.5, 1.4]} />
          <meshBasicMaterial color={new THREE.Color('#ffb97a').multiplyScalar(0.03 + warmth * 0.07)} />
        </mesh>
      ))}

      {/* The lit floor's back wall and ends, so the interior reads as a room. */}
      <mesh position={[0, LIT_FLOOR_Y + STOREY / 2, -DEPTH / 2 + 0.3]}>
        <planeGeometry args={[WIDTH, STOREY]} />
        <meshStandardMaterial color="#14120f" roughness={0.95} />
      </mesh>

      <Interior />
      <Ch03Moments tier={tier} />

      <Dust
        count={full ? 220 : 90}
        source={DUST_SOURCE}
        bounds={DUST_BOUNDS}
        opacity={0.16}
        fade={dustFade}
      />
    </group>
  )
}

/**
 * The lit floor as a room: columns, a line of warm light along the ceiling
 * (which is also what reads as the lit band from outside), and dim practicals
 * between the sets so the architecture is there without competing.
 */
function Interior() {
  const columns = useMemo(() => {
    const xs = [-10.5, -3.5, 3.5, 10.5]
    return xs.flatMap((x) => [
      [x, -3.8],
      [x, 4.7],
    ])
  }, [])
  const y = LIT_FLOOR_Y
  return (
    <group>
      {columns.map(([x, z], i) => (
        <mesh key={i} position={[x, y + STOREY / 2 - 0.18, z]}>
          <boxGeometry args={[0.45, STOREY - 0.35, 0.45]} />
          <meshStandardMaterial color="#2c2925" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, y + STOREY - 0.4, 1.4]}>
        <boxGeometry args={[WIDTH - 2, 0.04, 0.1]} />
        <meshBasicMaterial color={new THREE.Color('#ffc58a').multiplyScalar(1.25)} />
      </mesh>
      {[-10.5, -3.5, 3.5, 10.5].map((x) => (
        <pointLight key={x} position={[x, y + STOREY - 0.5, 0.5]} color="#ffc58a" intensity={3} distance={8} decay={2} />
      ))}
    </group>
  )
}

const DUST_SOURCE: [number, number, number] = [3.5, LIT_FLOOR_Y + 2.6, 0]
const DUST_BOUNDS = { x: 17, y: [LIT_FLOOR_Y + 0.1, LIT_FLOOR_Y + 2.9] as [number, number], z: [-5, 5] as [number, number] }
const dustFade = (p: number) => remap(localT(p, 'ch03'), CH03_BEATS.enter - 0.06, CH03_BEATS.enter)
