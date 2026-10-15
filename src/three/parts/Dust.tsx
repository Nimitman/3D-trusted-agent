import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { film } from '../../state/store'
import { seeded, damp } from '../../lib/math'

type Props = {
  count: number
  /** Where the light is. Dust near it glows warmer and brighter. */
  source: [number, number, number]
  bounds: { x: number; y: [number, number]; z: [number, number] }
  opacity?: number
  /** Multiplier on opacity from film progress, for scenes that start in near-darkness. */
  fade?: (p: number) => number
}

const vertex = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec3 uSource;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vLight;
  varying float vFade;

  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.07 + aSeed * 6.283) * 0.28;
    p.y += sin(uTime * 0.05 + aSeed * 12.0) * 0.2;
    p.z += cos(uTime * 0.04 + aSeed * 9.0) * 0.2;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Drift away from the pointer, in screen space, more for nearer motes.
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = ndc - uPointer;
    float push = smoothstep(0.28, 0.0, length(d));
    mv.xy += normalize(d + 1e-4) * push * 0.06 * -mv.z;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.5 + aSeed) / -mv.z;

    float dist = length(p - uSource);
    vLight = 0.18 + 3.2 * exp(-dist * 0.16);
    vFade = smoothstep(0.3, 2.0, -mv.z) * (1.0 - smoothstep(28.0, 48.0, -mv.z));
  }
`

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vLight;
  varying float vFade;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, r);
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.7) * vLight, a * vFade * uOpacity);
  }
`

/** Air in the room. Barely noticed, but it gives the dark a volume. */
export function Dust({ count, source, bounds, opacity = 0.55, fade }: Props) {
  const dpr = useThree((s) => s.viewport.dpr)
  const pointer = useRef(new THREE.Vector2())

  const geometry = useMemo(() => {
    const rnd = seeded(21)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 2 * bounds.x
      pos[i * 3 + 1] = bounds.y[0] + rnd() * (bounds.y[1] - bounds.y[0])
      pos[i * 3 + 2] = bounds.z[0] + rnd() * (bounds.z[1] - bounds.z[0])
      seed[i] = rnd()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count, bounds])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(9, 9) },
          uSource: { value: new THREE.Vector3(...source) },
          uSize: { value: 26 },
          uPixelRatio: { value: dpr },
          uOpacity: { value: opacity },
        },
      }),
    [source, dpr, opacity],
  )

  useFrame((state, dt) => {
    const { pointer: target, p } = film()
    material.uniforms.uOpacity.value = opacity * (fade ? fade(p) : 1)
    pointer.current.x = damp(pointer.current.x, target.x, 3, dt)
    pointer.current.y = damp(pointer.current.y, target.y, 3, dt)
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uPointer.value.copy(pointer.current)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
