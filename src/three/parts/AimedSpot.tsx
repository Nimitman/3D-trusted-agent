import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'

type Props = Omit<ThreeElements['spotLight'], 'ref'> & { aim: [number, number, number] }

/**
 * A spotlight that actually points where you aim it. three.js only tracks a
 * spot's target if the target is in the scene; left out, it silently points
 * at the world origin. This places the target beside the light.
 */
export const AimedSpot = forwardRef<THREE.SpotLight, Props>(function AimedSpot({ aim, ...props }, ref) {
  const light = useRef<THREE.SpotLight>(null!)
  const target = useRef<THREE.Object3D>(null!)
  useImperativeHandle(ref, () => light.current)

  useLayoutEffect(() => {
    light.current.target = target.current
  }, [])

  return (
    <>
      <spotLight ref={light} {...props} />
      <object3D ref={target} position={aim} />
    </>
  )
})
