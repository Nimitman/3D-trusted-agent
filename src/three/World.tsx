import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { film } from '../state/store'
import { activeWorld, type ChapterId } from '../story/timeline'

/**
 * Renders a chapter's world only while the camera is in it. Hidden worlds
 * cost nothing: three skips invisible groups, including their reflector passes.
 */
export function World({ id, children }: { id: ChapterId; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = activeWorld(film().p) === id
  })
  return <group ref={ref}>{children}</group>
}
