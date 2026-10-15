import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { film, type Tier } from '../../state/store'
import { activeWorld, chapter, CUTS, localT } from '../../story/timeline'
import { COPY } from '../../story/copy'
import { clamp, easeOutCubic, lerp, remap, seeded, smoothstep } from '../../lib/math'
import { figureGeometry } from '../geometry/figure'
import { atmo } from '../Atmosphere'
import { KineticWord } from '../parts/KineticWord'
import { Dust } from '../parts/Dust'
import { AimedSpot } from '../parts/AimedSpot'

/**
 * Chapter 02 · But trust is different.
 * Out of the black, the camera walks through hundreds of identical figures,
 * each tied by a thread to a floating property block. Then the crowd fractures:
 * figures fade, ghost, turn to wireframe or break into shards, and their
 * threads snap. Six stay solid and connected, with a faint purple rim.
 */
export const CH02 = {
  /** Chapter-local window in which the crowd fractures. */
  fracture: [0.38, 0.74] as [number, number],
  /** When the six solid figures take on their purple rim (film 24%). */
  rim: [0.7, 0.8] as [number, number],
  walk: { from: 9, to: -9, creep: 1.6 },
  /** Where the six who stay solid are standing. */
  solid: [
    [-1.6, -14],
    [1.35, -16.5],
    [-3.4, -19.2],
    [3.1, -21],
    [-0.45, -23.6],
    [2.1, -27.5],
  ] as [number, number][],
}

const SKY = new THREE.Color('#070707')
/** The fog bank the camera rises into; Chapter 03 opens inside the same tone. */
// Grey enough to read as fog, not as another fade to black.
export const FOG_BANK = new THREE.Color('#1a1b1e')

/** Each figure's fate when the crowd fractures. */
const FATE = { dim: 0, ghost: 1, wire: 2, frag: 3, solid: 4 } as const
type Fate = (typeof FATE)[keyof typeof FATE]

/** Shader and CPU must agree on how far along each figure's fracture is. */
const FRACTURE_SPAN = 0.35
const figureProgress = (distort: number, delay: number) => clamp((distort - delay) / FRACTURE_SPAN)

/**
 * The way out: after "You earn it." the camera rises past the six towards the
 * floating blocks, and the fog closes until the frame is one tone. Chapter 03
 * starts inside that same fog, still rising.
 */
export const ch02Rise = (p: number) => smoothstep(remap(p, CUTS.ch02to03 - 0.013, CUTS.ch02to03))

export function ch02Camera(t: number, p: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const w = easeOutCubic(remap(t, 0.12, 0.78))
  const z = lerp(CH02.walk.from, CH02.walk.to, w) - smoothstep(remap(t, 0.78, 1)) * CH02.walk.creep
  const x = Math.sin(w * 3.1) * 0.55
  // Footsteps follow distance travelled, so they stop when the camera does.
  const stride = Math.sin(z * 2.4) * 0.018 * (1 - remap(t, 0.7, 0.85))
  pos.set(x, 1.62 + stride, z)
  const lookUp = 0.3 * smoothstep(remap(t, 0.28, 0.45)) - 0.3 * smoothstep(remap(t, 0.58, 0.78))
  const rise = ch02Rise(p)
  pos.y += rise * rise * 4.5
  look.set(x * 0.4, 1.65 + lookUp + rise * 6, z - 14)
}

type Walker = {
  x: number
  z: number
  homeX: number
  homeZ: number
  heading: number
  speed: number
  phase: number
  fate: Fate
  delay: number
  scale: number
}

function makeCrowd(count: number) {
  const rnd = seeded(7)
  const walkers: Walker[] = CH02.solid.map(([x, z]) => ({
    x,
    z,
    homeX: x,
    homeZ: z,
    heading: rnd() * Math.PI * 2,
    speed: 0.35 + rnd() * 0.2,
    phase: rnd() * 10,
    fate: FATE.solid,
    delay: 0.1,
    scale: 0.97 + rnd() * 0.06,
  }))
  while (walkers.length < count) {
    const x = (rnd() - 0.5) * 32
    const z = 7 - rnd() * 46
    if (Math.abs(x) < 1.1) continue
    if (CH02.solid.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 1.3)) continue
    const u = rnd()
    const fate: Fate = u < 0.3 ? FATE.dim : u < 0.64 ? FATE.ghost : u < 0.77 ? FATE.wire : FATE.frag
    // The fracture starts far away and rolls towards the camera.
    const distance = Math.hypot(x, z + 12)
    const delay = clamp(0.62 * (1 - distance / 34) + (rnd() - 0.5) * 0.22, 0, 0.64)
    walkers.push({
      x,
      z,
      homeX: x,
      homeZ: z,
      heading: rnd() * Math.PI * 2,
      speed: 0.55 + rnd() * 0.55,
      phase: rnd() * 10,
      fate,
      delay,
      scale: 0.93 + rnd() * 0.14,
    })
  }
  return walkers
}

/** The crowd's skin: standard stone-grey, with each figure's fate applied in the shader. */
function crowdMaterial(uniforms: Record<string, THREE.IUniform>) {
  const m = new THREE.MeshStandardMaterial({ color: '#8f8a82', roughness: 0.8, metalness: 0, alphaHash: true })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aFate;
        attribute float aDelay;
        uniform float uDistort;
        varying float vFate;
        varying float vF;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFate = aFate;
        vF = clamp((uDistort - aDelay) / ${FRACTURE_SPAN.toFixed(2)}, 0.0, 1.0);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRim;
        uniform vec3 uRimColor;
        varying float vFate;
        varying float vF;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float f = smoothstep(0.0, 1.0, vF);
        if (vFate < 0.5) {          // dim: sinks into the dark
          diffuseColor.rgb *= mix(1.0, 0.3, f);
          diffuseColor.a *= 1.0 - f;
        } else if (vFate < 1.5) {   // ghost: still there, no longer present
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.78, 0.74), f * 0.6);
          diffuseColor.a *= mix(1.0, 0.13, f);
        } else if (vFate < 2.5) {   // wire: the body goes, the outline stays
          diffuseColor.a *= 1.0 - f;
        } else if (vFate < 3.5) {   // fragment: the body gives way to shards
          diffuseColor.a *= 1.0 - smoothstep(0.0, 0.45, f);
        } else {                    // solid: becomes more itself
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.87, 0.82), f);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (vFate > 3.5) {
          float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.5);
          totalEmissiveRadiance += uRimColor * rim * uRim;
        }`,
      )
  }
  return m
}

/** Soft contact shadows that fade with the figure they belong to. */
function blobMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aAlpha;
      varying vec2 vUv;
      varying float vA;
      void main() {
        vUv = uv;
        vA = aAlpha;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv;
      varying float vA;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.15, 1.0, d)) * vA * 0.6);
        #include <fog_fragment>
      }`,
  })
}

/** A block floats above its person at an offset, trailing behind as they walk. */
type Thread = { walker: number; ox: number; by: number; oz: number; bx: number; bz: number; block: THREE.Mesh }

export function Ch02Crowd({ tier }: { tier: Tier }) {
  const full = tier === 'full'
  const count = full ? 420 : 160
  const shardsPer = full ? 9 : 5
  const aspect = useThree((s) => s.size.width / s.size.height)
  const k = clamp(aspect / 1.6, 0.42, 1)

  const uniforms = useMemo(
    () => ({
      uDistort: { value: 0 },
      uRim: { value: 0 },
      uRimColor: { value: new THREE.Color(0.45, 0.27, 1).multiplyScalar(1.15) },
    }),
    [],
  )

  const built = useMemo(() => {
    const walkers = makeCrowd(count)
    const base = figureGeometry(full ? 'full' : 'lite')

    // Bodies: one draw call for the whole crowd.
    const bodyGeo = base.clone()
    bodyGeo.setAttribute('aFate', new THREE.InstancedBufferAttribute(new Float32Array(walkers.map((w) => w.fate)), 1))
    bodyGeo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(new Float32Array(walkers.map((w) => w.delay)), 1))
    const bodies = new THREE.InstancedMesh(bodyGeo, crowdMaterial(uniforms), walkers.length)
    bodies.frustumCulled = false

    // Wireframes for the figures that keep only their outline.
    const wireIdx = walkers.flatMap((w, i) => (w.fate === FATE.wire ? [i] : []))
    const wireMat = new THREE.MeshBasicMaterial({ color: '#8d887f', wireframe: true, transparent: true, opacity: 0, depthWrite: false })
    const wires = new THREE.InstancedMesh(figureGeometry('lite'), wireMat, Math.max(1, wireIdx.length))
    wires.frustumCulled = false

    // Shards for the figures that break apart.
    const fragIdx = walkers.flatMap((w, i) => (w.fate === FATE.frag ? [i] : []))
    const rnd = seeded(13)
    const shardSpec = fragIdx.flatMap((wi) =>
      Array.from({ length: shardsPer }, () => ({
        wi,
        ox: (rnd() - 0.5) * 0.36,
        oy: 0.15 + rnd() * 1.6,
        oz: (rnd() - 0.5) * 0.22,
        size: 0.05 + rnd() * 0.11,
        spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
        rise: 0.4 + rnd() * 1.1,
      })),
    )
    const shardMat = new THREE.MeshStandardMaterial({ color: '#948f86', roughness: 0.7, transparent: true, opacity: 0.9 })
    const shards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), shardMat, Math.max(1, shardSpec.length))
    shards.frustumCulled = false

    // Contact shadows.
    const blobGeo = new THREE.PlaneGeometry(1.1, 1.1)
    blobGeo.rotateX(-Math.PI / 2)
    blobGeo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(walkers.length).fill(1), 1))
    const blobs = new THREE.InstancedMesh(blobGeo, blobMaterial(), walkers.length)
    blobs.frustumCulled = false

    // Threads from heads to floating property blocks.
    const threadWalkers = [
      ...walkers.flatMap((w, i) => (w.fate === FATE.solid ? [i] : [])),
      ...walkers
        .map((w, i) => ({ w, i }))
        .filter(({ w }) => w.fate !== FATE.solid && Math.abs(w.x) < 9 && w.z < -1 && w.z > -30)
        .slice(0, 38)
        .map(({ i }) => i),
    ]
    const threads: Thread[] = threadWalkers.map((wi) => {
      const w = walkers[wi]
      const solid = w.fate === FATE.solid
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.6 + rnd() * 0.8, 0.3 + rnd() * 0.6, 0.5 + rnd() * 0.6),
        new THREE.MeshStandardMaterial({ color: solid ? '#b8b2a7' : '#7c776e', roughness: 0.85, transparent: true }),
      )
      const ox = (rnd() - 0.5) * 0.8
      const oz = (rnd() - 0.5) * 0.6
      const by = 4.3 + rnd() * 1.2
      block.position.set(w.x + ox, by, w.z + oz)
      return { walker: wi, ox, by, oz, bx: w.x + ox, bz: w.z + oz, block }
    })
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(threads.length * 4 * 3), 3))
    lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(threads.length * 4 * 4), 4))
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
    )
    lines.frustumCulled = false

    return { walkers, bodies, wires, wireIdx, shards, shardSpec, blobs, threads, lines }
  }, [count, full, shardsPer, uniforms])

  const overhead = useRef<THREE.SpotLight>(null)
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      mid: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, rawDt) => {
    const { p, v } = film()
    if (activeWorld(p) !== 'ch02') return
    const dt = Math.min(rawDt, 1 / 20)
    const t = localT(p, 'ch02')
    const distort = remap(t, CH02.fracture[0], CH02.fracture[1])
    const rim = smoothstep(remap(t, CH02.rim[0], CH02.rim[1]))
    uniforms.uDistort.value = distort
    uniforms.uRim.value = rim

    const rise = ch02Rise(p)
    atmo.color.copy(SKY).lerp(FOG_BANK, rise)
    atmo.density = lerp(0.05, 0.064, smoothstep(distort)) - 0.008 * rim + Math.pow(rise, 2.2) * 0.9

    if (overhead.current) overhead.current.intensity = 110 * smoothstep(remap(t, 0.62, 0.86))

    const { walkers, bodies, wires, wireIdx, shards, shardSpec, blobs, threads, lines } = built
    const { m, q, e, p: pos, s } = tmp
    // Everyone slows to a stop as the crowd fractures; scrolling fast hurries them.
    const pace = (1 - smoothstep(remap(t, 0.42, 0.72))) * (1 + Math.min(Math.abs(v), 1) * 1.2)
    const blobAlpha = blobs.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute

    walkers.forEach((w, i) => {
      if (pace > 0.001) {
        if (w.fate === FATE.solid) {
          // The six drift around where they stand, never far.
          const away = Math.hypot(w.x - w.homeX, w.z - w.homeZ)
          if (away > 1.2) w.heading = Math.atan2(w.homeZ - w.z, w.homeX - w.x)
        }
        w.x += Math.cos(w.heading) * w.speed * pace * dt
        w.z += Math.sin(w.heading) * w.speed * pace * dt
        if (Math.abs(w.x) < 1.1) {
          w.heading = Math.PI - w.heading
          w.x = Math.sign(w.x || 1) * 1.1
        }
        if (w.x > 16) w.x = -16
        if (w.x < -16) w.x = 16
        if (w.z > 7) w.z = -39
        if (w.z < -39) w.z = 7
        w.phase += dt * w.speed * pace * 6
      }
      const bob = Math.abs(Math.sin(w.phase)) * 0.03 * Math.min(1, pace * 2)
      e.set(0, Math.atan2(Math.cos(w.heading), Math.sin(w.heading)), Math.sin(w.phase) * 0.02 * pace)
      q.setFromEuler(e)
      pos.set(w.x, bob, w.z)
      s.setScalar(w.scale)
      m.compose(pos, q, s)
      bodies.setMatrixAt(i, m)

      const f = figureProgress(distort, w.delay)
      const shadow =
        w.fate === FATE.solid ? 1 : w.fate === FATE.ghost ? lerp(1, 0.2, f) : 1 - smoothstep(remap(f, 0, 0.6))
      blobAlpha.setX(i, shadow)
      pos.y = 0.012
      s.set(w.scale, 1, w.scale)
      m.compose(pos, tmp.q.identity(), s)
      blobs.setMatrixAt(i, m)
    })
    bodies.instanceMatrix.needsUpdate = true
    blobs.instanceMatrix.needsUpdate = true
    blobAlpha.needsUpdate = true

    wireIdx.forEach((wi, j) => {
      bodies.getMatrixAt(wi, m)
      wires.setMatrixAt(j, m)
    })
    wires.instanceMatrix.needsUpdate = true
    ;(wires.material as THREE.MeshBasicMaterial).opacity = 0.2 * smoothstep(remap(distort, 0.15, 0.7))

    shardSpec.forEach((sh, j) => {
      const w = walkers[sh.wi]
      const f = figureProgress(distort, w.delay)
      const grow = smoothstep(clamp(f * 4))
      const spread = 1 + f * 1.8
      pos.set(w.x + sh.ox * spread, sh.oy + Math.pow(f, 1.5) * sh.rise, w.z + sh.oz * spread)
      q.setFromAxisAngle(sh.spin, f * 3.2)
      s.setScalar(sh.size * grow)
      m.compose(pos, q, s)
      shards.setMatrixAt(j, m)
    })
    shards.instanceMatrix.needsUpdate = true
    ;(shards.material as THREE.MeshStandardMaterial).opacity = 0.9 - 0.5 * remap(distort, 0.8, 1)

    const posAttr = lines.geometry.getAttribute('position') as THREE.BufferAttribute
    const colAttr = lines.geometry.getAttribute('color') as THREE.BufferAttribute
    const { a, b, mid } = tmp
    threads.forEach((th, j) => {
      const w = walkers[th.walker]
      const solid = w.fate === FATE.solid
      const snap = solid ? 0 : smoothstep(remap(figureProgress(distort, w.delay), 0, 0.5))
      // Anchored blocks trail their person; snapped ones stop following,
      // drift upward and fade, no longer tied to anyone.
      const follow = (1 - snap) * (1 - Math.exp(-2.5 * dt))
      if (Math.hypot(w.x + th.ox - th.bx, w.z + th.oz - th.bz) > 4) {
        // The person wrapped round the edge of the crowd: move the block with them.
        th.bx = w.x + th.ox
        th.bz = w.z + th.oz
      }
      th.bx += (w.x + th.ox - th.bx) * follow
      th.bz += (w.z + th.oz - th.bz) * follow
      th.block.position.set(th.bx, th.by + snap * 1.4, th.bz)
      th.block.rotation.y = Math.sin(state.clock.elapsedTime * 0.3 + j) * 0.15
      const bm = th.block.material as THREE.MeshStandardMaterial
      bm.opacity = 1 - snap * 0.85

      a.set(w.x, 1.86 * w.scale, w.z)
      b.set(th.bx, th.block.position.y - 0.2, th.bz)
      mid.lerpVectors(a, b, 0.45)
      const lowEnd = tmp.p.lerpVectors(mid, a, snap)
      posAttr.setXYZ(j * 4, a.x, a.y, a.z)
      posAttr.setXYZ(j * 4 + 1, lowEnd.x, lowEnd.y, lowEnd.z)
      const highEnd = tmp.s.lerpVectors(mid, b, snap)
      posAttr.setXYZ(j * 4 + 2, highEnd.x, highEnd.y, highEnd.z)
      posAttr.setXYZ(j * 4 + 3, b.x, b.y, b.z)
      const alpha = solid ? lerp(0.5, 0.85, distort) : 0.42 * (1 - snap)
      for (let n = 0; n < 4; n++) colAttr.setXYZW(j * 4 + n, 0.93, 0.9, 0.85, alpha)
    })
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  })

  const at = (t: number) => lerp(chapter('ch02').start, chapter('ch02').end, t)

  return (
    <group>
      <hemisphereLight args={['#cfc8bd', '#080808', 0.45]} />
      <directionalLight position={[4, 14, 10]} intensity={1.5} color="#f3ede2" />
      <AimedSpot
        ref={overhead}
        position={[0.5, 13, -20]}
        aim={[0.5, 0, -20]}
        angle={0.42}
        penumbra={1}
        intensity={0}
        decay={2}
        color="#f1ebe1"
      />

      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0e0d0c" roughness={0.95} />
      </mesh>

      <primitive object={built.blobs} />
      <primitive object={built.bodies} />
      <primitive object={built.wires} />
      <primitive object={built.shards} />
      <primitive object={built.lines} />
      {built.threads.map((th, i) => (
        <primitive key={i} object={th.block} />
      ))}

      <Dust count={full ? 650 : 220} source={DUST.source} bounds={DUST.bounds} opacity={0.4} />

      <KineticWord
        position={[0, 3.55, -17]}
        size={1.2 * k}
        appear={[27, 15]}
        showFrom={at(0.3)}
        hideFrom={at(0.6)}
        onTop
      >
        {COPY.ch02.headline.replace('trust ', 'trust\n')}
      </KineticWord>
    </group>
  )
}

const DUST = {
  source: [0, 9, -18] as [number, number, number],
  bounds: { x: 14, y: [0.1, 6.5] as [number, number], z: [-40, 10] as [number, number] },
}
