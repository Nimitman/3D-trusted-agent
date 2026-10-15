import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { film } from '../state/store'
import { activeWorld, chapter, localT } from '../story/timeline'
import { damp } from '../lib/math'
import { ch01CameraZ, ch01Look } from './chapters/Ch01Portal'
import { ch02Camera } from './chapters/Ch02Crowd'
import { ch03Camera, ch03Fov } from './chapters/Ch03Tower'
import { ch04Camera } from './chapters/Ch04Glass'
import { ch05Camera } from './chapters/Ch05Assembly'
import { ch06Camera } from './chapters/Ch06Quiet'
import { ch07Camera } from './chapters/Ch07Push'

/**
 * Where the camera should be at film progress p. Each world adds its path
 * here. Worlds change only behind a cut (through black), so paths don't blend.
 */
function cameraAt(p: number, pos: THREE.Vector3, look: THREE.Vector3, aspect: number) {
  if (activeWorld(p) === 'ch07') return ch07Camera(localT(p, 'ch07'), pos, look, aspect)
  if (activeWorld(p) === 'ch04') {
    // Chapters 04 to 07 share a world and one continuous camera.
    if (p >= chapter('ch06').end) return ch07Camera(localT(p, 'ch07'), pos, look, aspect)
    if (p >= chapter('ch05').end) return ch06Camera(localT(p, 'ch06'), pos, look, aspect)
    if (p >= chapter('ch04').end) return ch05Camera(localT(p, 'ch05'), pos, look, aspect)
    return ch04Camera(localT(p, 'ch04'), pos, look, aspect)
  }
  if (activeWorld(p) === 'ch03') return ch03Camera(localT(p, 'ch03'), pos, look, aspect)
  if (activeWorld(p) === 'ch02') return ch02Camera(localT(p, 'ch02'), p, pos, look)
  const t = localT(p, 'ch01')
  pos.set(Math.sin(t * Math.PI) * 0.35, 1.45 + 0.1 * t, ch01CameraZ(t))
  look.copy(ch01Look)
  look.y -= 0.15 * t
}

/** Lens per world: the crowd wants a little more width than the doorway. */
const LENS = { ch01: 35, ch02: 40, ch03: 36, ch04: 34, ch05: 31 } as Record<string, number>
function lensFor(p: number, aspect: number) {
  const world = activeWorld(p)
  const lens = world === 'ch04' && p >= chapter('ch04').end ? LENS.ch05 : LENS[world]
  const base = (lens ?? 35) + (aspect < 1 ? 15 : 0)
  // Chapter 03's sets are wide; on narrow screens its lens is fitted to each one.
  return activeWorld(p) === 'ch03' ? ch03Fov(base, aspect) : base
}

/** A jump this large means a cut happened; move there instead of gliding. */
const CUT_DISTANCE = 6

/**
 * The camera behaves like it's on a dolly: it chases the scroll target through
 * a damped spring, never jumps, and settles in about half a second.
 * Scroll speed widens the lens slightly; the pointer adds a little parallax.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)

  const target = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), [])
  const look = useRef(new THREE.Vector3())
  const fov = useRef(lensFor(0, aspect))

  useLayoutEffect(() => {
    cameraAt(film().p, target.pos, target.look, aspect)
    camera.position.copy(target.pos)
    look.current.copy(target.look)
    camera.lookAt(look.current)
  }, [camera, target, aspect])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const { p, v, pointer } = film()
    cameraAt(p, target.pos, target.look, aspect)
    const baseFov = lensFor(p, aspect)

    // A cut, or a review still (?debug, window.__shoot): go straight there.
    const snap = (window as unknown as { __filmSnap?: boolean }).__filmSnap
    if (snap || camera.position.distanceTo(target.pos) > CUT_DISTANCE) {
      camera.position.copy(target.pos)
      look.current.copy(target.look)
      fov.current = baseFov
    }

    // Pointer parallax and a faint handheld drift.
    const time = state.clock.elapsedTime
    target.pos.x += pointer.x * 0.18 + Math.sin(time * 0.37) * 0.015
    target.pos.y += pointer.y * 0.1 + Math.sin(time * 0.23) * 0.012

    camera.position.x = damp(camera.position.x, target.pos.x, 3, dt)
    camera.position.y = damp(camera.position.y, target.pos.y, 3, dt)
    camera.position.z = damp(camera.position.z, target.pos.z, 4, dt)
    look.current.x = damp(look.current.x, target.look.x, 3, dt)
    look.current.y = damp(look.current.y, target.look.y, 3, dt)
    look.current.z = damp(look.current.z, target.look.z, 3, dt)
    camera.lookAt(look.current)

    const nextFov = damp(fov.current, baseFov + Math.min(Math.abs(v), 1) * 3, 4, dt)
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      fov.current = nextFov
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

