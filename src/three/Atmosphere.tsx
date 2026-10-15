import { useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The scene has one sky and one fog. The world the camera is in writes what
 * it wants here each frame; this component applies it. Keeps chapters from
 * fighting over scene.fog.
 */
export const atmo = {
  color: new THREE.Color('#030303'),
  density: 0.085,
}

export function Atmosphere() {
  const scene = useThree((s) => s.scene)

  useLayoutEffect(() => {
    const background = new THREE.Color().copy(atmo.color)
    const fog = new THREE.FogExp2(atmo.color.getHex(), atmo.density)
    scene.background = background
    scene.fog = fog
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene])

  // Runs after the chapters (positive priority would take over rendering, so
  // this relies on mount order instead: Atmosphere mounts last).
  useFrame(() => {
    const fog = scene.fog as THREE.FogExp2
    fog.color.copy(atmo.color)
    fog.density = atmo.density
    ;(scene.background as THREE.Color).copy(atmo.color)
  })

  return null
}
