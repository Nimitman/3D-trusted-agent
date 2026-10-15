import * as THREE from 'three'
import { CH05_BEATS, LOCK_GROUPS, seatTime } from '../../story/ch05'
import { clamp, lerp, remap, smoothstep } from '../../lib/math'
import { track, type Key } from '../../lib/track'
import { centroidOf, EXPLODED, outlineOf, type PieceName } from '../geometry/keystone'
import { extrudeOutline } from '../geometry/keystone3d'
import { glowTexture, stoneTexture } from '../materials/textures'

/**
 * Chapter 05 · The badge.
 * Same world, same pieces as Chapter 04. The camera pulls back, the glass turns
 * to stone, and the badge locks together in its build order: plinth (Verified),
 * left pier (Responsive), right pier (Quality), the ring of stones (Consistent),
 * and last the keystone (Trusted), which keeps its purple glow.
 */

/** Orbit: angle, distance, eye height, look height. Starts where Chapter 04 ends. */
const ORBIT: Key[] = [
  { t: CH05_BEATS.start, v: [1.45, 4.1, 2.0, 1.6] },
  // During the locks the badge sits a little higher, leaving room for each name below it.
  { t: 0.3, v: [0.95, 5.8, 1.9, 1.18] },
  { t: 0.5, v: [0.7, 6.0, 1.7, 1.18] },
  { t: 0.75, v: [0.55, 6.2, 1.85, 1.55] },
  // Keystone seated: settle low again so TRUSTED has room under the plinth.
  { t: 0.88, v: [0.42, 6.3, 1.9, 1.3] },
  // Back a little and look low, so the whole arch sits high with room for its name below.
  { t: 1, v: [0.32, 6.8, 1.75, 1.25] },
]
const o: number[] = []
const portraitness = (aspect: number) => clamp((1 - aspect) / 0.45)

export function ch05Camera(t: number, pos: THREE.Vector3, look: THREE.Vector3, aspect = 1.6) {
  track(ORBIT, t, o)
  // On a narrow screen, stand further back so the whole badge fits across
  // (the same factor as Chapter 04, so the hand-over is seamless).
  const r = o[1] * lerp(1, 1.6, portraitness(aspect))
  pos.set(Math.sin(o[0]) * r, o[2], Math.cos(o[0]) * r)
  look.set(0, o[3], 0)
}

const ALL: PieceName[] = LOCK_GROUPS.flat()
const PURPLE = new THREE.Color('#7a45ff')
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

type Stone = {
  name: PieceName
  mesh: THREE.Mesh
  home: THREE.Vector3
  float: THREE.Vector3
  rot: THREE.Euler
  seat: number
}

/** Builds the stone badge and returns its root plus a per-frame update. */
export function createAssembly(env: THREE.Texture, shadows: boolean) {
  const root = new THREE.Group()
  const grain = stoneTexture(7)
  const glow = glowTexture()

  const mat = (color: string, rough: number, metal = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      roughnessMap: metal ? null : grain,
      bumpMap: grain,
      bumpScale: 0.8,
      envMap: env,
      envMapIntensity: metal ? 1.4 : 0.35,
      transparent: true,
      opacity: 0,
    })
  const materials = {
    plinth: mat('#57534d', 0.85),
    pier: mat('#c4bdb1', 0.8),
    ring: mat('#d8d2c6', 0.75),
    key: mat('#e9e4da', 0.32, 0.65),
  }
  const materialFor = (n: PieceName) =>
    n === 'plinth' ? materials.plinth : n === 'key' ? materials.key : n.startsWith('pier') ? materials.pier : materials.ring

  const stones: Stone[] = ALL.map((name) => {
    const outline = outlineOf(name)
    const [cx, cy] = centroidOf(outline)
    const geo = extrudeOutline(outline)
    geo.translate(-cx, -cy, 0)
    const mesh = new THREE.Mesh(geo, materialFor(name))
    mesh.castShadow = shadows
    mesh.receiveShadow = shadows
    const e = EXPLODED[name]
    // The keystone waits higher, above the gap it will fill.
    const float =
      name === 'key' ? new THREE.Vector3(cx, cy + 0.5, 0.15) : new THREE.Vector3(cx + e.dx, cy + e.dy, e.dz)
    root.add(mesh)
    return {
      name,
      mesh,
      home: new THREE.Vector3(cx, cy, 0),
      float,
      rot: name === 'key' ? new THREE.Euler(0, 0, 0.12) : new THREE.Euler(0, e.ry, e.rz),
      seat: seatTime(name),
    }
  })

  // Studio light for stone: a soft key with shadow, and a cool rim from behind.
  const key = new THREE.DirectionalLight('#fff2e2', 0)
  key.position.set(-3, 6, 4)
  key.castShadow = shadows
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 4, bottom: -1.5, near: 0.5, far: 20 })
  key.shadow.bias = -0.0005
  const rim = new THREE.DirectionalLight('#c3cad8', 0)
  rim.position.set(2, 3, -5)
  const keyTarget = new THREE.Object3D()
  keyTarget.position.set(0, 1, 0)
  key.target = keyTarget
  rim.target = keyTarget
  root.add(key, rim, keyTarget)

  // Purple: a flash under each group as it seats, then a steady glow from the keystone.
  const flash = new THREE.PointLight(PURPLE, 0, 3.5, 2)
  const flashGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: PURPLE.clone().multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
  )
  const keyLight = new THREE.PointLight(PURPLE, 0, 3, 2)
  const keyGlow = new THREE.Sprite(flashGlow.material.clone())
  root.add(flash, flashGlow, keyLight, keyGlow)

  const groupCentre = (g: number, out: THREE.Vector3) => {
    out.set(0, 0, 0)
    for (const n of LOCK_GROUPS[g]) out.add(stones.find((s) => s.name === n)!.home)
    return out.divideScalar(LOCK_GROUPS[g].length)
  }
  const centres = LOCK_GROUPS.map((_, g) => groupCentre(g, new THREE.Vector3()))
  const tmpE = new THREE.Euler()

  /** Pose of a piece at time t: floating, easing home, then seated with a small click. */
  function pose(s: Stone, t: number, now: number, target: THREE.Object3D) {
    const a = easeInOutCubic(remap(t, s.seat - CH05_BEATS.travel, s.seat))
    const click = Math.sin(Math.PI * remap(t, s.seat, s.seat + 0.015)) * 0.014
    const bob = Math.sin(now * 0.6 + s.seat * 40) * 0.015 * (1 - a)
    target.position.lerpVectors(s.float, s.home, a)
    target.position.y += bob - click
    tmpE.set(lerp(s.rot.x, 0, a), lerp(s.rot.y, 0, a), lerp(s.rot.z, 0, a))
    target.rotation.copy(tmpE)
  }

  /**
   * t: Chapter 05 local time. glass: Chapter 04's meshes by piece name, which
   * travel with their stone twins until the stone has fully replaced them.
   */
  function update(
    t: number,
    now: number,
    glass: Map<string, { mesh: THREE.Mesh; orb: THREE.Sprite }>,
    edges: THREE.LineBasicMaterial,
    /** Chapter 06's quiet: the studio light gives way to one light from above. */
    quiet = 0,
  ) {
    const active = t > CH05_BEATS.start
    root.visible = active
    if (!active) {
      edges.opacity = 0.42
      return
    }

    const stone = smoothstep(remap(t, CH05_BEATS.stone[0], CH05_BEATS.stone[1]))
    materials.plinth.opacity = stone
    materials.pier.opacity = stone
    materials.ring.opacity = stone
    const keyIn = smoothstep(remap(t, CH05_BEATS.keyAppears, CH05_BEATS.keyAppears + 0.04))
    materials.key.opacity = keyIn
    edges.opacity = 0.42 * (1 - stone)

    for (const s of stones) {
      pose(s, t, now, s.mesh)
      s.mesh.visible = s.name === 'key' ? keyIn > 0.001 : stone > 0.001
      const g = glass.get(s.name)
      if (g) {
        pose(s, t, now, g.mesh)
        g.mesh.scale.setScalar(1)
        g.mesh.visible = stone < 0.97
        g.orb.position.copy(g.mesh.position)
        ;(g.orb.material as THREE.SpriteMaterial).opacity *= 1 - stone
      }
    }

    key.intensity = 1.8 * stone * (1 - quiet)
    rim.intensity = 0.9 * stone * (1 - quiet * 0.6)

    // A purple flash under whichever group most recently seated (the first four).
    let pulse = 0
    let last = -1
    CH05_BEATS.locks.slice(0, 4).forEach((lock, g) => {
      if (t >= lock) {
        last = g
        pulse = Math.exp(-(t - lock) / 0.016)
      }
    })
    if (last >= 0) {
      flash.position.copy(centres[last]).add(new THREE.Vector3(0, -0.15, 0.45))
      flashGlow.position.copy(flash.position)
    }
    flash.intensity = 6 * pulse
    flashGlow.material.opacity = 0.85 * pulse
    flashGlow.scale.setScalar(0.6 + pulse * 0.9)

    // The keystone seats last and keeps its glow.
    const k = stones[stones.length - 1]
    const settle = smoothstep(remap(t, k.seat - 0.01, k.seat + 0.03))
    const waiting = keyIn * (1 - settle) * 0.35
    keyLight.position.copy(k.mesh.position).add(new THREE.Vector3(0, -0.28, 0.35))
    keyLight.intensity = 1.05 * settle + 0.5 * waiting + 4 * Math.exp(-Math.max(0, t - k.seat) / 0.02) * (t >= k.seat ? 1 : 0)
    keyGlow.position.copy(keyLight.position)
    keyGlow.material.opacity = 0.32 * settle + waiting
    keyGlow.scale.setScalar(0.9)
  }

  return { root, update }
}
