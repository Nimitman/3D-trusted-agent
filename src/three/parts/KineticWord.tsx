import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { film } from '../../state/store'
import { damp, remap } from '../../lib/math'

// BASE_URL is '/' in dev and the repo path on GitHub Pages.
export const FONT = {
  display: `${import.meta.env.BASE_URL}fonts/Archivo-Expanded-ExtraBold.ttf`,
  hairline: `${import.meta.env.BASE_URL}fonts/Archivo-Condensed-ExtraLight.ttf`,
}

type Props = {
  children: string
  position: [number, number, number]
  size: number
  font?: string
  /** Distance ahead of the camera at which the word starts and finishes appearing. */
  appear?: [number, number]
  /** Distance at which it starts and finishes fading as the camera reaches it. */
  vanish?: [number, number]
  color?: string
  anchorX?: 'left' | 'center' | 'right'
  /** Film progress before which the word stays hidden, however close it is. */
  showFrom?: number
  /** Film progress from which the word fades away again. Past the end of the film by default. */
  hideFrom?: number
  lineHeight?: number
  /**
   * Draw over anything standing between it and the camera. For lines that must
   * read even when scenery passes in front, like Ch02's headline over the blocks.
   */
  onTop?: boolean
}

/**
 * A headline that sits at a real depth in the scene. It fades in with distance,
 * stays put while the camera travels, and stretches slightly with scroll speed.
 */
export function KineticWord({
  children,
  position,
  size,
  font = FONT.display,
  appear = [24, 12],
  vanish = [2.5, 0.4],
  color = '#ece7de',
  anchorX = 'center',
  showFrom = 0,
  // Must stay finite: remap(p, Infinity, Infinity) is NaN and would hide the word.
  hideFrom = 2,
  lineHeight = 0.9,
  onTop = false,
}: Props) {
  const ref = useRef<THREE.Mesh>(null)
  const stretch = useRef(1)
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, depthTest: !onTop }),
    [color, onTop],
  )

  useFrame(({ camera }, dt) => {
    if (!ref.current) return
    const ahead = camera.position.z - position[2]
    const fadeIn = remap(ahead, appear[0], appear[1])
    const fadeOut = remap(ahead, vanish[1], vanish[0])
    const p = film().p
    const gate = remap(p, showFrom, showFrom + 0.01) * (1 - remap(p, hideFrom, hideFrom + 0.01))
    material.opacity = fadeIn * fadeOut * gate
    ref.current.visible = material.opacity > 0.001

    stretch.current = damp(stretch.current, 1 + Math.abs(film().v) * 0.08, 6, dt)
    ref.current.scale.set(stretch.current, 1, 1)
  })

  return (
    <Text
      ref={ref}
      font={font}
      fontSize={size}
      position={position}
      anchorX={anchorX}
      anchorY="middle"
      letterSpacing={-0.015}
      lineHeight={lineHeight}
      textAlign={anchorX}
      material={material}
      renderOrder={onTop ? 10 : 0}
    >
      {children.toUpperCase()}
    </Text>
  )
}
