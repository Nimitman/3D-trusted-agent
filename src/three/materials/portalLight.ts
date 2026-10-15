import * as THREE from 'three'
import { ARCH } from '../geometry/keystone'

/** Centre of the light inside the doorway, in the arch's local metres. */
export const PORTAL_HOTSPOT: [number, number] = [0, 0.82]

const vertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform float uSpread;
  uniform float uIntensity;
  uniform float uTime;
  uniform vec2 uHot;
  uniform float uTop;
  varying vec2 vPos;

  void main() {
    // A gaussian around the hot spot. At spread 0 it is a point; at 1 it
    // covers the whole opening, so the dot and the doorway are one light.
    vec2 d = (vPos - uHot) * vec2(1.0, 0.82);
    float radius = mix(0.035, 1.5, pow(uSpread, 0.85));
    float glow = exp(-dot(d, d) / (radius * radius) * 1.6);

    // Once open, the light pools slightly towards the floor, like a lit room beyond.
    float floorBias = mix(1.0, 1.12 - 0.35 * (vPos.y / uTop), uSpread);
    // A very slow breath, so the light feels alive rather than painted.
    float breath = 1.0 + 0.025 * sin(uTime * 0.9);

    // The centre stays near white; the edges warm towards amber as it spreads.
    vec3 hot = vec3(1.0, 0.95, 0.88);
    vec3 warm = vec3(1.0, 0.72, 0.45);
    // As the doorway opens, only the very centre stays white.
    vec3 color = mix(warm, hot, smoothstep(mix(0.25, 0.8, uSpread), 1.0, glow));

    // Keep total energy roughly steady: a point is intense, a full doorway softer.
    float energy = mix(9.0, 2.4, uSpread);
    gl_FragColor = vec4(color * glow * floorBias * breath * energy * uIntensity, 1.0);
  }
`

/** The light that fills the doorway in Chapter 01. Drive uSpread 0 → 1 with scroll. */
export function createPortalLight() {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uSpread: { value: 0 },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uHot: { value: new THREE.Vector2(...PORTAL_HOTSPOT) },
      uTop: { value: ARCH.h + ARCH.r1 },
    },
  })
}
