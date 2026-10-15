import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { film, type Tier } from '../../state/store'
import { localT } from '../../story/timeline'
import { CH03_BEATS, SET_X, WHITEOUT } from '../../story/ch03'
import { lerp, remap, smoothstep } from '../../lib/math'
import { figureGeometry } from '../geometry/figure'
import { glowTexture } from '../materials/textures'
import { AimedSpot } from '../parts/AimedSpot'

/** Top of the lit floor's slab: the fourth storey. */
export const LIT_FLOOR_Y = 4 * 3.2
const SET_Z = -0.4
const TUNGSTEN = '#ffc58a'

/** Each moment's own clock, 0 → 1 across its window. */
const momentT = (p: number, i: number) => {
  const [a, b] = CH03_BEATS.moments[i]
  return remap(localT(p, 'ch03'), a, b)
}

/** Turn a figure to face a point on the floor (figures face +z by default). */
function face(obj: THREE.Object3D, x: number, z: number) {
  obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z)
}

function houseGeometry() {
  const base = new THREE.BoxGeometry(0.5, 0.3, 0.4)
  base.translate(0, 0.15, 0)
  const roofShape = new THREE.Shape([new THREE.Vector2(-0.29, 0), new THREE.Vector2(0.29, 0), new THREE.Vector2(0, 0.22)])
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 0.44, bevelEnabled: false })
  roof.translate(0, 0.3, -0.22)
  return { base, roof }
}

/** Shared pieces for all four sets. */
function useKit(tier: Tier) {
  return useMemo(() => {
    const figure = figureGeometry(tier === 'full' ? 'full' : 'lite')
    return {
      figure,
      house: houseGeometry(),
      glow: glowTexture(),
      agent: new THREE.MeshStandardMaterial({ color: '#d9d2c5', roughness: 0.7 }),
      other: new THREE.MeshStandardMaterial({ color: '#8f8a81', roughness: 0.8 }),
      model: new THREE.MeshStandardMaterial({ color: '#d6cfc2', roughness: 0.65 }),
      plinth: new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.9 }),
    }
  }, [tier])
}
type Kit = ReturnType<typeof useKit>

function Person({ kit, role, position, lookAt, innerRef }: {
  kit: Kit
  role: 'agent' | 'other'
  position: [number, number, number]
  lookAt: [number, number]
  innerRef?: React.Ref<THREE.Mesh>
}) {
  return (
    <mesh
      ref={(m) => {
        if (m) {
          m.position.set(...position)
          face(m, lookAt[0], lookAt[1])
        }
        if (typeof innerRef === 'function') innerRef(m)
        else if (innerRef) (innerRef as React.MutableRefObject<THREE.Mesh | null>).current = m
      }}
      geometry={kit.figure}
      material={role === 'agent' ? kit.agent : kit.other}
      castShadow
    />
  )
}

function Set({ index, children }: { index: number; children: ReactNode }) {
  return <group position={[SET_X[index], LIT_FLOOR_Y, SET_Z]}>{children}</group>
}

function Pool({ x = 0, z = 0, intensity = 26, angle = 0.62, lightRef, fill = true }: {
  x?: number
  z?: number
  intensity?: number
  angle?: number
  lightRef?: React.Ref<THREE.SpotLight>
  /** Neighbouring pools can share one fill; every light here is paid for by every surface. */
  fill?: boolean
}) {
  return (
    <>
      {/* A soft warm fill from the room side, so the people read, not just the props. */}
      {fill && <pointLight position={[x, 1.7, z + 1.9]} color={TUNGSTEN} intensity={1.6} distance={5} decay={2} />}
    <AimedSpot
      ref={lightRef}
      position={[x, 2.75, z + 0.6]}
      aim={[x, 0, z]}
      angle={angle}
      penumbra={0.9}
      intensity={intensity}
      decay={2}
      color={TUNGSTEN}
    />
    </>
  )
}

/** 1 · "There's something you should know." The agent turns the model to show its flaw. */
function MomentListing({ kit }: { kit: Kit }) {
  const model = useRef<THREE.Group>(null)
  const flaw = useRef<THREE.Sprite>(null)
  const agent = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const m = momentT(film().p, 0)
    if (model.current) model.current.rotation.y = smoothstep(remap(m, 0.15, 0.55)) * Math.PI * 0.85
    if (flaw.current) {
      const s = smoothstep(remap(m, 0.35, 0.65))
      ;(flaw.current.material as THREE.SpriteMaterial).opacity = s
      flaw.current.scale.setScalar(lerp(0.05, 0.42, s))
    }
    if (agent.current) {
      agent.current.position.x = lerp(-1.15, -0.85, smoothstep(remap(m, 0.3, 0.5)))
      face(agent.current, 0, 0)
    }
  })

  return (
    <Set index={0}>
      <Pool intensity={30} />
      <mesh position={[0, 0.375, 0]} material={kit.plinth} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.75, 1.2]} />
      </mesh>
      <mesh position={[0, 0.77, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 1]} />
        <meshStandardMaterial color="#e9e3d8" roughness={0.55} />
      </mesh>
      <group ref={model} position={[0, 0.79, 0]}>
        <mesh geometry={kit.house.base} material={kit.model} castShadow />
        <mesh geometry={kit.house.roof} material={kit.model} castShadow />
        {/* The flaw, on the side the listing photo never showed. */}
        <mesh position={[0.08, 0.17, -0.205]}>
          <boxGeometry args={[0.22, 0.012, 0.004]} />
          <meshBasicMaterial color="#1a1612" />
        </mesh>
        <sprite ref={flaw} position={[0.08, 0.17, -0.24]}>
          <spriteMaterial map={kit.glow} color={new THREE.Color(TUNGSTEN).multiplyScalar(2.2)} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
        </sprite>
      </group>
      <Person kit={kit} role="agent" position={[-1.15, 0, 0.35]} lookAt={[0, 0]} innerRef={agent} />
      <Person kit={kit} role="other" position={[1.15, 0, 0.55]} lookAt={[0, 0]} />
    </Set>
  )
}

/** 2 · "This one isn't right for you." The second home fades; the agent steps between. */
function MomentWrongHome({ kit }: { kit: Kit }) {
  const solid = useMemo(() => Object.assign(kit.model.clone(), { transparent: true }), [kit])
  const wire = useMemo(() => new THREE.MeshBasicMaterial({ color: '#a29d93', wireframe: true, transparent: true, opacity: 0 }), [])
  const rightLight = useRef<THREE.SpotLight>(null)
  const agent = useRef<THREE.Mesh>(null)
  const buyer = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const m = momentT(film().p, 1)
    const fade = smoothstep(remap(m, 0.3, 0.65))
    solid.opacity = 1 - fade
    solid.depthWrite = fade < 0.5
    wire.opacity = 0.35 * fade
    if (rightLight.current) rightLight.current.intensity = 24 * (1 - fade * 0.85)
    if (buyer.current) {
      buyer.current.position.x = lerp(1.7, 1.3, smoothstep(remap(m, 0, 0.3)))
      face(buyer.current, 0.85, -0.2)
    }
    if (agent.current) {
      agent.current.position.x = lerp(0.15, 0.62, smoothstep(remap(m, 0.25, 0.5)))
      face(agent.current, buyer.current?.position.x ?? 1.3, 0.95)
    }
  })

  return (
    <Set index={1}>
      {/* One fill between the two plinths covers both pools. */}
      <pointLight position={[0, 1.7, 1.7]} color={TUNGSTEN} intensity={1.8} distance={5} decay={2} />
      <Pool x={-0.85} z={-0.2} intensity={26} angle={0.45} fill={false} />
      <Pool x={0.85} z={-0.2} intensity={24} angle={0.45} lightRef={rightLight} fill={false} />
      <mesh position={[-0.85, 0.3, -0.2]} material={kit.plinth} castShadow receiveShadow>
        <boxGeometry args={[0.75, 0.6, 0.75]} />
      </mesh>
      <mesh position={[0.85, 0.3, -0.2]} material={kit.plinth} castShadow receiveShadow>
        <boxGeometry args={[0.75, 0.6, 0.75]} />
      </mesh>
      <group position={[-0.85, 0.6, -0.2]}>
        <mesh geometry={kit.house.base} material={kit.model} castShadow />
        <mesh geometry={kit.house.roof} material={kit.model} castShadow />
      </group>
      <group position={[0.85, 0.6, -0.2]}>
        <mesh geometry={kit.house.base} material={solid} />
        <mesh geometry={kit.house.roof} material={solid} />
        <mesh geometry={kit.house.base} material={wire} />
        <mesh geometry={kit.house.roof} material={wire} />
      </group>
      <Person kit={kit} role="agent" position={[0.15, 0, 1.1]} lookAt={[1.3, 0.95]} innerRef={agent} />
      <Person kit={kit} role="other" position={[1.7, 0, 0.95]} lookAt={[0.85, -0.2]} innerRef={buyer} />
    </Set>
  )
}

/** 3 · "You could ask more. But you may wait longer." The higher ask casts the longer shadow. */
function MomentPrice({ kit, shadows }: { kit: Kit; shadows: boolean }) {
  const ask = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.SpotLight>(null)

  useFrame(() => {
    const m = momentT(film().p, 2)
    if (ask.current) {
      const h = lerp(1.1, 2.5, smoothstep(remap(m, 0.15, 0.55)))
      ask.current.scale.y = h
      ask.current.position.y = h / 2
    }
  })

  return (
    <Set index={2}>
      {/* A low lamp on the floor, so shadows run long across it. */}
      <AimedSpot
        ref={lamp}
        position={[-2.5, 0.42, 0.5]}
        aim={[2.5, 0, -0.2]}
        angle={0.75}
        penumbra={0.35}
        intensity={16}
        decay={2}
        color={TUNGSTEN}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
      />
      <mesh position={[-2.55, 0.2, 0.5]}>
        <cylinderGeometry args={[0.07, 0.09, 0.4, 16]} />
        <meshStandardMaterial color="#2a2724" roughness={0.5} metalness={0.6} />
      </mesh>
      <sprite position={[-2.48, 0.43, 0.5]} scale={[0.5, 0.5, 1]}>
        <spriteMaterial map={kit.glow} color={new THREE.Color(TUNGSTEN).multiplyScalar(2)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh rotation-x={-Math.PI / 2} position={[1, 0.004, 0]} receiveShadow>
        <planeGeometry args={[7, 3.2]} />
        <meshStandardMaterial color="#1b1916" roughness={0.85} />
      </mesh>
      {/* The seller's ask grows; the honest price stays where it is. */}
      <mesh ref={ask} position={[-0.55, 0.55, -0.25]} material={kit.model} castShadow>
        <boxGeometry args={[0.28, 1, 0.28]} />
      </mesh>
      <mesh position={[0.2, 0.5, 0.35]} material={kit.model} castShadow>
        <boxGeometry args={[0.28, 1, 0.28]} />
      </mesh>
      {/* The two stand to the side, so the towers and their shadows stay in view. */}
      <Person kit={kit} role="other" position={[-1.9, 0, 1.25]} lookAt={[-0.55, -0.25]} />
      <Person kit={kit} role="agent" position={[-1.25, 0, 1.75]} lookAt={[-1.9, 1.25]} />
    </Set>
  )
}

/** 4 · "I'm listening." 11:47 PM. One lamp, one call, a line of light between two people. */
const GLOW = new THREE.Color(TUNGSTEN)

function MomentCall({ kit }: { kit: Kit }) {
  const line = useRef<THREE.Mesh>(null)
  const phone = useRef<THREE.PointLight>(null)
  const glow = useRef<THREE.Sprite>(null)
  const from = useMemo(() => new THREE.Vector3(2.8, 0.01, -3.4), [])
  const to = useMemo(() => new THREE.Vector3(-0.45, 0.01, 0.55), [])

  useFrame(() => {
    const m = momentT(film().p, 3)
    const draw = smoothstep(remap(m, 0.2, 0.6))
    if (line.current) {
      const len = from.distanceTo(to) * draw
      line.current.scale.set(1, 1, Math.max(0.0001, len))
      line.current.position.z = len / 2
      line.current.visible = draw > 0.001
    }
    const white = smoothstep(remap(localT(film().p, 'ch03'), WHITEOUT[0], WHITEOUT[1]))
    if (phone.current) phone.current.intensity = lerp(0.6, 2.6, smoothstep(remap(m, 0.3, 0.6))) + white * 30
    if (glow.current) {
      glow.current.scale.setScalar(lerp(0.28, 2.6, white))
      ;(glow.current.material as THREE.SpriteMaterial).color.copy(GLOW).multiplyScalar(lerp(2.4, 9, white))
    }
  })

  const dir = to.clone().sub(from)
  const yaw = Math.atan2(dir.x, dir.z)

  return (
    <Set index={3}>
      {/* A window onto the night city behind. */}
      <mesh position={[0.6, 1.55, -4.6]}>
        <planeGeometry args={[3.4, 1.9]} />
        <meshBasicMaterial color="#1a2129" />
      </mesh>
      <Person kit={kit} role="agent" position={[-0.6, 0, 0.4]} lookAt={[0.4, 2]} />
      <pointLight ref={phone} position={[-0.42, 1.15, 0.7]} color={TUNGSTEN} intensity={0.6} distance={4} decay={2} />
      <sprite ref={glow} position={[-0.42, 1.12, 0.66]} scale={[0.28, 0.28, 1]}>
        <spriteMaterial map={kit.glow} color={new THREE.Color(TUNGSTEN).multiplyScalar(2.4)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <Person kit={kit} role="other" position={[2.8, 0, -3.6]} lookAt={[-0.6, 0.4]} />
      <pointLight position={[2.8, 2.5, -3.2]} color="#a9c0d8" intensity={5} distance={6} decay={2} />
      {/* The call, drawn across the floor from them to the agent. */}
      <group position={from} rotation-y={yaw}>
        <mesh ref={line} position-z={0}>
          <boxGeometry args={[0.012, 0.004, 1]} />
          <meshBasicMaterial color={new THREE.Color('#ece7de').multiplyScalar(1.4)} transparent opacity={0.7} />
        </mesh>
      </group>
    </Set>
  )
}

export function Ch03Moments({ tier }: { tier: Tier }) {
  const kit = useKit(tier)
  return (
    <group>
      <MomentListing kit={kit} />
      <MomentWrongHome kit={kit} />
      <MomentPrice kit={kit} shadows={tier === 'full'} />
      <MomentCall kit={kit} />
    </group>
  )
}
