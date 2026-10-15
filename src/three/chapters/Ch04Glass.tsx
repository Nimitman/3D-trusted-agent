import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { film, type Tier } from '../../state/store'
import { activeWorld, localT } from '../../story/timeline'
import { CH04_BEATS, CH04_PIECES, departure, landing } from '../../story/ch04'
import { lerp, remap, seeded, smoothstep } from '../../lib/math'
import { track, type Key } from '../../lib/track'
import { centroidOf, EXPLODED, outlineOf, type Outline } from '../geometry/keystone'
import { extrudeOutline } from '../geometry/keystone3d'
import { glowTexture } from '../materials/textures'
import { atmo } from '../Atmosphere'
import { Dust } from '../parts/Dust'
import { createAssembly } from './Ch05Assembly'
import { quietAt, StoryField } from './Ch06Quiet'
import { AimedSpot } from '../parts/AimedSpot'
import { CH05_BEATS } from '../../story/ch05'

/**
 * Chapter 04 · Trust is built in small moments.
 * Out of the white-out a single light remains. It travels to a point in the
 * dark and becomes a piece of glass with the light still inside it. Three more
 * follow, one per moment, then the rest arrive quicker. Seen close and turning,
 * the pieces never resolve into a shape: that is Chapter 05's reveal.
 */
const SKY = new THREE.Color('#060606')
const TUNGSTEN = new THREE.Color('#ffc58a')
/** The structure floats, like the doorway in Chapter 01. */
const LIFT = 0.6
const CENTRE = new THREE.Vector3(0, LIFT + 1.0, 0)

/** Orbit: angle around the structure, distance, eye height, look height. */
const ORBIT: Key[] = [
  { t: 0.18, v: [-0.12, 2.6, 1.55, 1.6] },
  { t: 0.4, v: [0.35, 3.3, 1.75, 1.65] },
  { t: 0.7, v: [0.9, 3.7, 1.3, 1.7] },
  { t: 0.95, v: [1.35, 4.0, 1.95, 1.6] },
  { t: 1, v: [1.45, 4.1, 2.0, 1.6] },
]
const o: number[] = []

/** 0 on landscape screens, rising to 1 on a phone held upright. */
const portraitness = (aspect: number) => Math.min(1, Math.max(0, (1 - aspect) / 0.45))

export function ch04Camera(t: number, pos: THREE.Vector3, look: THREE.Vector3, aspect = 1.6) {
  track(ORBIT, t, o)
  // On a narrow screen, stand further back so the gathering pieces stay in frame.
  // Chapters 05 and 06 use the same factor, so the camera never jumps between them.
  const r = o[1] * lerp(1, 1.6, portraitness(aspect))
  pos.set(Math.sin(o[0]) * r, o[2], Math.cos(o[0]) * r)
  look.set(0, o[3], 0)
}

/** Where the white-out was: just in front of the camera as the chapter opens. */
function whiteoutPoint() {
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  // Landscape framing: the white-out sits on the line of sight either way.
  ch04Camera(CH04_BEATS.recede[0], pos, look)
  return pos.lerp(look, 0.42).sub(new THREE.Vector3(0, LIFT, 0))
}

type Piece = {
  mesh: THREE.Mesh
  home: THREE.Vector3
  start: THREE.Vector3
  control: THREE.Vector3
  orb: THREE.Sprite
  land: number
  depart: number
  index: number
}

function bezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, s: number, out: THREE.Vector3) {
  const u = 1 - s
  return out.set(
    u * u * a.x + 2 * u * s * c.x + s * s * b.x,
    u * u * a.y + 2 * u * s * c.y + s * s * b.y,
    u * u * a.z + 2 * u * s * c.z + s * s * b.z,
  )
}

/** A soft overshoot as a piece settles into being. */
const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2)

/** A small room of light panels, for the glass to reflect. Built once, used only here. */
function useGlassEnvironment() {
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const s = new THREE.Scene()
    s.add(new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x0b0b0b, side: THREE.BackSide })))
    const panel = (w: number, h: number, x: number, y: number, z: number, ry: number, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.97, k * 0.92), side: THREE.DoubleSide }))
      m.position.set(x, y, z)
      m.rotation.y = ry
      s.add(m)
    }
    panel(2, 7, -9.9, 1, -2, Math.PI / 2, 2.4)
    panel(2, 7, 9.9, 1, 3, -Math.PI / 2, 0.8)
    panel(8, 1.5, 0, 4.9, 0, 0, 1.2)
    const tex = pm.fromScene(s, 0.04).texture
    pm.dispose()
    return tex
  }, [gl])
}

export function Ch04Glass({ tier }: { tier: Tier }) {
  const full = tier === 'full'
  const env = useGlassEnvironment()
  const glow = useMemo(() => glowTexture(), [])

  const glass = useMemo(
    () =>
      full
        ? new THREE.MeshPhysicalMaterial({
            color: '#f3efe8',
            roughness: 0.08,
            transmission: 1,
            thickness: 0.45,
            ior: 1.5,
            envMap: env,
            envMapIntensity: 2.2,
            attenuationColor: new THREE.Color('#d8cdb8'),
            attenuationDistance: 2.2,
            specularIntensity: 1,
          })
        : new THREE.MeshStandardMaterial({
            color: '#d9d4cb',
            roughness: 0.15,
            transparent: true,
            opacity: 0.38,
            envMap: env,
            envMapIntensity: 2,
          }),
    [full, env],
  )

  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ece7de', transparent: true, opacity: 0.42, depthWrite: false }),
    [],
  )

  const pieces = useMemo<Piece[]>(() => {
    const rnd = seeded(19)
    const origin = whiteoutPoint()
    return CH04_PIECES.map((name, index) => {
      const outline: Outline = outlineOf(name)
      const [cx, cy] = centroidOf(outline)
      const geo = extrudeOutline(outline)
      geo.translate(-cx, -cy, 0)
      const e = EXPLODED[name]
      const home = new THREE.Vector3(cx + e.dx, cy + e.dy, e.dz)
      const mesh = new THREE.Mesh(geo, glass)
      // Fine edges, like a glass architectural model: transmissive glass in a dark
      // room otherwise shows only the dark behind it.
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat))
      mesh.position.copy(home)
      mesh.rotation.set(0, e.ry, e.rz)
      mesh.scale.setScalar(0.0001)

      // The first light is the white-out itself; the others come in from the dark.
      const side = index % 2 === 0 ? -1 : 1
      const start =
        index === 0
          ? origin.clone()
          : home.clone().add(new THREE.Vector3(side * (3 + rnd() * 2), 1.5 + rnd() * 2, 1.5 + rnd() * 2.5))
      const control = start.clone().lerp(home, 0.5).add(new THREE.Vector3(0, 0.9 + rnd() * 0.6, 0))

      const orb = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: TUNGSTEN.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
      )
      return { mesh, home, start, control, orb, land: landing(index), depart: departure(index), index }
    })
  }, [glass, glow, edgeMat])

  // Chapter 05 plays here too, on these same pieces.
  const assembly = useMemo(() => createAssembly(env, full), [env, full])
  const glassByName = useMemo(
    () => new Map(pieces.map((pc) => [CH04_PIECES[pc.index] as string, { mesh: pc.mesh, orb: pc.orb }])),
    [pieces],
  )

  const panelRefs = useRef<(THREE.Mesh | null)[]>([])
  // Chapter 06: everything in here falls into darkness, leaving only the badge.
  const surroundings = useRef<THREE.Group>(null)
  const envMaterials = useRef<THREE.MeshStandardMaterial[]>([])
  useEffect(() => {
    const list: THREE.MeshStandardMaterial[] = []
    surroundings.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material
      if (m instanceof THREE.MeshStandardMaterial) {
        m.transparent = true
        m.needsUpdate = true
        list.push(m)
      }
    })
    envMaterials.current = list
  }, [])
  const badge = useRef<THREE.Group>(null)
  const overhead = useRef<THREE.SpotLight>(null)
  const travelLight = useRef<THREE.PointLight>(null)
  const heart = useRef<THREE.PointLight>(null)
  const recede = useRef<THREE.Sprite>(null)
  const camera = useThree((s) => s.camera)

  useFrame((state) => {
    const p = film().p
    if (activeWorld(p) !== 'ch04') return
    const t = localT(p, 'ch04')
    const now = state.clock.elapsedTime
    const t5 = localT(p, 'ch05')
    const stone = smoothstep(remap(t5, CH05_BEATS.stone[0], CH05_BEATS.stone[1]))
    const quiet = quietAt(p)
    atmo.color.copy(SKY)
    atmo.density = lerp(lerp(0.045, 0.03, stone), 0.022, quiet)
    for (const m of envMaterials.current) m.opacity = 1 - quiet
    if (surroundings.current) surroundings.current.visible = quiet < 0.999
    // Alone in the dark, the badge lifts a little and floats.
    if (badge.current) badge.current.position.y = LIFT + quiet * 0.35 + Math.sin(now * 0.5) * 0.02 * quiet
    if (overhead.current) overhead.current.intensity = 55 * quiet

    // The white-out from Chapter 03, shrinking back into the first light.
    const back = smoothstep(remap(t, CH04_BEATS.recede[0], CH04_BEATS.recede[1]))
    if (recede.current) {
      recede.current.position.copy(camera.position).lerp(CENTRE, 0.3)
      recede.current.scale.setScalar(lerp(3.2, 0.05, back))
      ;(recede.current.material as THREE.SpriteMaterial).opacity = 1 - back
    }

    let landed = 0
    let travelling: THREE.Vector3 | null = null
    for (const pc of pieces) {
      const travel = remap(t, pc.depart, pc.land)
      const grow = smoothstep(remap(t, pc.land - 0.025, pc.land + 0.02))
      const bob = Math.sin(now * 0.6 + pc.index * 1.7) * 0.015
      pc.mesh.position.set(pc.home.x, pc.home.y + bob, pc.home.z)
      pc.mesh.scale.setScalar(grow > 0 ? Math.max(0.0001, easeOutBack(grow)) : 0.0001)
      pc.mesh.visible = grow > 0

      const m = pc.orb.material as THREE.SpriteMaterial
      if (travel <= 0) {
        // The first light is already there, inside the white-out.
        m.opacity = pc.index === 0 ? back : 0
        pc.orb.position.copy(pc.start)
        pc.orb.scale.setScalar(0.34)
      } else if (travel < 1) {
        bezier(pc.start, pc.control, pc.home, smoothstep(travel), pc.orb.position)
        m.opacity = Math.min(1, travel * 6)
        pc.orb.scale.setScalar(pc.index < 4 ? 0.34 : 0.22)
        travelling = pc.orb.position
      } else {
        // Landed: a flash, then an ember that stays inside the glass.
        const since = remap(t, pc.land, pc.land + 0.06)
        pc.orb.position.copy(pc.mesh.position)
        pc.orb.scale.setScalar(lerp(0.6, 0.13, smoothstep(since)))
        m.opacity = lerp(1, 0.55, since)
        landed++
      }
      m.color.copy(TUNGSTEN).multiplyScalar(2.6)
    }

    if (travelLight.current) {
      travelLight.current.intensity = travelling ? 2.2 : 0
      if (travelling) travelLight.current.position.copy(travelling)
    }
    // The warmth inside the glass gives way to studio light on stone.
    if (heart.current) heart.current.intensity = 0.4 * landed * (1 - stone)

    // The light panels were there for the glass to bend; once it's stone they fade.
    panelRefs.current.forEach((m) => {
      if (m) m.visible = stone < 0.99
      if (m) ((m.material as THREE.MeshBasicMaterial).opacity = 1 - stone)
    })

    assembly.update(t5, now, glassByName, edgeMat, quiet)
  })

  const ring = useMemo(() => {
    // Dark slabs and two tall light panels on the far side of the orbit, so the
    // glass always has something to bend.
    const rnd = seeded(3)
    const slabs: { x: number; z: number; ry: number; w: number; h: number }[] = []
    for (let a = 2.4; a < 5.4; a += 0.32) {
      const r = 6 + rnd() * 1.4
      slabs.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, ry: a, w: 0.7 + rnd() * 0.8, h: 5 + rnd() * 3 })
    }
    // Off to either side of the line of sight, so the glass picks them up at its edges.
    const panels = [2.75, 4.15].map((a) => ({ x: Math.sin(a) * 7.5, z: Math.cos(a) * 7.5, ry: a }))
    return { slabs, panels }
  }, [])

  return (
    <group>
      <hemisphereLight args={['#ffffff', '#000000', 0.08]} />
      <directionalLight position={[2, 8, 4]} intensity={0.6} />

      <group ref={surroundings}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#0c0b0a" roughness={0.45} />
        </mesh>
        {ring.slabs.map((s, i) => (
          <mesh key={i} position={[s.x, s.h / 2, s.z]} rotation-y={s.ry}>
            <boxGeometry args={[s.w, s.h, 0.5]} />
            <meshStandardMaterial color="#1b1a18" roughness={0.9} />
          </mesh>
        ))}
        {ring.panels.map((pn, i) => (
          <mesh key={i} ref={(m) => void (panelRefs.current[i] = m)} position={[pn.x, 2.7, pn.z]} rotation-y={pn.ry}>
            <planeGeometry args={[0.45, 5]} />
            <meshBasicMaterial color={new THREE.Color(1, 0.96, 0.9).multiplyScalar(i === 0 ? 0.38 : 0.26)} side={THREE.DoubleSide} transparent />
          </mesh>
        ))}
        <Dust count={full ? 300 : 120} source={DUST.source} bounds={DUST.bounds} opacity={0.3} fade={dustOut} />
      </group>

      <AimedSpot ref={overhead} position={[0, 7.5, 1.2]} aim={[0, LIFT + 1.2, 0]} angle={0.36} penumbra={0.9} intensity={0} decay={2} color="#fff2e2" />
      <StoryField />

      <group ref={badge} position-y={LIFT}>
        {pieces.map((pc) => (
          <primitive key={`m${pc.index}`} object={pc.mesh} />
        ))}
        {pieces.map((pc) => (
          <primitive key={`o${pc.index}`} object={pc.orb} />
        ))}
        <pointLight ref={travelLight} color="#ffc58a" intensity={0} distance={4} decay={2} />
        <pointLight ref={heart} position={[0, 1.1, 0]} color="#ffc58a" intensity={0} distance={5} decay={2} />
        <primitive object={assembly.root} />
      </group>

      <sprite ref={recede}>
        <spriteMaterial map={glow} color={TUNGSTEN.clone().multiplyScalar(9)} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>

      {/* Dust that stays for the quiet: a few motes drifting through the overhead light. */}
      <Dust count={full ? 160 : 70} source={QUIET_DUST.source} bounds={QUIET_DUST.bounds} opacity={0.35} fade={quietAt} />
    </group>
  )
}

/** The room's dust goes with the room. */
const dustOut = (p: number) => 1 - quietAt(p)

const QUIET_DUST = {
  source: [0, 6, 1] as [number, number, number],
  bounds: { x: 2.5, y: [0.5, 5] as [number, number], z: [-1.5, 2.5] as [number, number] },
}

const DUST = {
  source: [0, LIFT + 1.1, 0] as [number, number, number],
  bounds: { x: 5, y: [0.2, 4.2] as [number, number], z: [-5, 5] as [number, number] },
}
