import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { film, type Tier } from '../../state/store'
import { activeWorld, chapter, localT } from '../../story/timeline'
import { atmo } from '../Atmosphere'
import { COPY } from '../../story/copy'
import { clamp, lerp, remap, smoothstep } from '../../lib/math'
import { OUTLINES } from '../geometry/keystone'
import { extrudeOutline, openingShape } from '../geometry/keystone3d'
import { glowTexture, stoneTexture } from '../materials/textures'
import { createPortalLight, PORTAL_HOTSPOT } from '../materials/portalLight'
import { KineticWord, FONT } from '../parts/KineticWord'
import { Dust } from '../parts/Dust'
import { AimedSpot } from '../parts/AimedSpot'

/**
 * Chapter 01 · Everyone is an agent.
 * A point of light in the dark becomes a floating stone doorway: the badge's
 * arch with its keystone missing. Three words wait at different depths and the
 * last one, AGENT, passes through the camera.
 */
export const CH01 = {
  startZ: 14,
  travel: 38,
  archZ: -30,
  archScale: 1.8,
  /** Gap between the floor and the bottom of the plinth: the doorway floats. */
  archLift: 0.55,
  /** Chapter-local times at which the camera draws level with each word. */
  pass: { everyone: 0.57, canBe: 0.72, agent: 0.857 },
}

/** Camera depth along the dolly. Slow out of the dark, quicker into AGENT. */
export const ch01CameraZ = (t: number) => CH01.startZ - CH01.travel * (0.4 * t + 0.6 * t * t)

const archBaseY = CH01.archLift + 0.24 * CH01.archScale
export const ch01Look = new THREE.Vector3(0, archBaseY + 1.35 * CH01.archScale - 0.2, CH01.archZ)


const SKY = '#030303'

const DUST = {
  source: [0, archBaseY + PORTAL_HOTSPOT[1] * CH01.archScale, CH01.archZ] as [number, number, number],
  bounds: { x: 7, y: [0.1, 5.5] as [number, number], z: [-33, 16] as [number, number] },
  fade: (p: number) => lerp(0.08, 1, smoothstep(remap(localT(p, 'ch01'), 0.04, 0.4))),
}

export function Ch01Portal({ tier }: { tier: Tier }) {
  const full = tier === 'full'
  const aspect = useThree((s) => s.size.width / s.size.height)
  const k = clamp(aspect / 1.6, 0.42, 1)

  const tex = useMemo(() => ({ glow: glowTexture(), stone: stoneTexture() }), [])

  const stones = useMemo(
    () => [OUTLINES.plinth, OUTLINES.pierL, OUTLINES.pierR, ...OUTLINES.voussoirs].map((o) => extrudeOutline(o)),
    [],
  )
  const opening = useMemo(() => new THREE.ShapeGeometry(openingShape(), 24), [])

  const stoneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7d776d',
        roughness: 0.9,
        roughnessMap: tex.stone,
        bumpMap: tex.stone,
        bumpScale: 1.4,
      }),
    [tex],
  )
  const portalMat = useMemo(() => createPortalLight(), [])

  const arch = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const core = useRef<THREE.Sprite>(null)
  const halo = useRef<THREE.Sprite>(null)
  const bornAt = useRef<number | null>(null)

  useFrame((state) => {
    const p = film().p
    const t = localT(p, 'ch01')
    const now = state.clock.elapsedTime
    if (bornAt.current === null) bornAt.current = now
    // The first point of light arrives on its own, before any scroll.
    const dawn = smoothstep(remap(now - bornAt.current, 0.6, 3.2))

    // One light, start to finish: the point is the hot centre of the doorway's
    // glow, and scrolling spreads that glow outward until it fills the opening.
    const spread = smoothstep(remap(t, 0.03, 0.55))
    portalMat.uniforms.uSpread.value = spread
    portalMat.uniforms.uIntensity.value = dawn
    portalMat.uniforms.uTime.value = now

    // Fog is solved each frame so the stone emerges at a steady rate,
    // instead of popping when exponential fog suddenly thins.
    if (activeWorld(p) === 'ch01') {
      const ahead = Math.max(1, state.camera.position.z - CH01.archZ)
      const visible = clamp(smoothstep(remap(t, 0.06, 0.6)), 0.002, 0.98)
      atmo.color.set(SKY)
      atmo.density = Math.max(0.018, Math.sqrt(-Math.log(visible)) / ahead)
    }

    if (light.current) light.current.intensity = 170 * Math.pow(spread, 1.4) * dawn

    if (core.current) {
      // The bloom star opens up and dissolves into the glow it sits in.
      const m = core.current.material as THREE.SpriteMaterial
      m.opacity = dawn * (1 - smoothstep(remap(spread, 0.25, 0.9)))
      const size = lerp(0.9, 2.6, spread)
      core.current.scale.set(size, size, 1)
    }
    if (halo.current) (halo.current.material as THREE.SpriteMaterial).opacity = dawn * lerp(0.06, 0.5, spread)

    if (arch.current) {
      arch.current.position.y = archBaseY + Math.sin(now * 0.45) * 0.035
      arch.current.rotation.z = Math.sin(now * 0.31) * 0.004
    }
  })

  const z = ch01CameraZ
  const at = (t: number) => lerp(chapter('ch01').start, chapter('ch01').end, t)
  const hotspot: [number, number, number] = [0, archBaseY + PORTAL_HOTSPOT[1] * CH01.archScale, CH01.archZ + 0.05]

  return (
    <group>
      <hemisphereLight args={['#cfc8bd', '#000000', 0.04]} />

      {/* Floor: wet stone in full, matte in lite. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[140, 140]} />
        {full ? (
          <MeshReflectorMaterial
            resolution={1024}
            blur={[400, 120]}
            mixBlur={1}
            mixStrength={26}
            roughness={0.92}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            color="#0d0c0b"
            metalness={0.55}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial color="#0d0c0b" roughness={0.45} metalness={0.3} />
        )}
      </mesh>

      {/* The doorway: everything but the keystone. */}
      <group ref={arch} position={[0, archBaseY, CH01.archZ]} scale={CH01.archScale}>
        {stones.map((g, i) => (
          <mesh key={i} geometry={g} material={stoneMat} castShadow receiveShadow />
        ))}
        <mesh geometry={opening} material={portalMat} position-z={-0.02} />
      </group>

      <pointLight ref={light} position={[0, archBaseY + 1.2, CH01.archZ - 1.2]} color="#ffd2a1" intensity={0} decay={2} />
      <AimedSpot
        position={[0, 9, CH01.archZ + 7]}
        aim={[0, archBaseY + 1.5, CH01.archZ]}
        angle={0.35}
        penumbra={1}
        intensity={22}
        color="#d9d1c4"
        decay={2}
      />

      {/* The point of light the film opens on. */}
      <sprite ref={core} position={hotspot} scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={tex.glow} color={new THREE.Color('#fff1de').multiplyScalar(10)} transparent depthWrite={false} fog={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>
      <sprite ref={halo} position={[0, hotspot[1], CH01.archZ - 2]} scale={[12, 12, 1]}>
        <spriteMaterial map={tex.glow} color="#6b4b2f" transparent depthWrite={false} fog={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>

      <Dust
        count={full ? 900 : 320}
        source={DUST.source}
        bounds={DUST.bounds}
        fade={DUST.fade}
      />

      <KineticWord position={[-1.5 * k, 3.15, z(CH01.pass.everyone)]} size={0.95 * k} showFrom={at(0.1)} appear={[30, 18]}>
        {COPY.ch01.words[0]}
      </KineticWord>
      <KineticWord position={[2.5 * k, 2.55, z(CH01.pass.canBe)]} size={1.1 * k} font={FONT.hairline} showFrom={at(0.3)} appear={[30, 18]}>
        {COPY.ch01.words[1]}
      </KineticWord>
      <KineticWord
        position={[-5.6 * k, 2.85, z(CH01.pass.agent) - 0.2]}
        size={0.8 * k}
        font={FONT.hairline}
        anchorX="left"
        appear={[28, 16]}
        showFrom={at(0.48)}
      >
        {COPY.ch01.words[2].split(' ')[0]}
      </KineticWord>
      <KineticWord
        position={[0, 1.55, z(CH01.pass.agent)]}
        size={2.6 * k}
        appear={[28, 16]}
        vanish={[0.5, 0.02]}
        showFrom={at(0.5)}
      >
        {COPY.ch01.words[2].split(' ')[1]}
      </KineticWord>
    </group>
  )
}
