import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU } from "../core/utils.js";

/**
 * Wave train shared by the GPU (for the surface) and the CPU (for buoyancy).
 *
 * These four numbers are the single source of truth: the GLSL below is
 * generated from this table, so a hull sitting on `sampleHeight` is sitting on
 * exactly the water the player can see. Drifting the two apart is the classic
 * way to end up with a boat that hovers, so they are deliberately not typed
 * out twice.
 */
const WAVES = [
  { dir: [1.0, 0.35], length: 62, amp: 1.45, speed: 0.85 },
  { dir: [-0.6, 1.0], length: 38, amp: 0.85, speed: 1.15 },
  { dir: [0.8, -0.7], length: 21, amp: 0.42, speed: 1.45 },
  { dir: [0.2, 1.0], length: 11, amp: 0.18, speed: 1.9 },
].map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1]);
  return {
    dx: w.dir[0] / len,
    dz: w.dir[1] / len,
    k: TAU / w.length,
    amp: w.amp,
    speed: w.speed,
  };
});

/** Surface height at a world position. Matches the vertex shader exactly. */
export function sampleHeight(x, z, time) {
  let h = 0;
  for (const w of WAVES) {
    h += Math.sin((x * w.dx + z * w.dz) * w.k + time * w.speed * w.k * 6) * w.amp;
  }
  return h;
}

/** Analytic surface normal — used to tilt the ship with the swell. */
export function sampleNormal(x, z, time, out = new THREE.Vector3()) {
  let dx = 0, dz = 0;
  for (const w of WAVES) {
    const phase = (x * w.dx + z * w.dz) * w.k + time * w.speed * w.k * 6;
    const c = Math.cos(phase) * w.amp * w.k;
    dx += c * w.dx;
    dz += c * w.dz;
  }
  return out.set(-dx, 1, -dz).normalize();
}

/** Emit the wave sum as GLSL so shader and sampler can never disagree. */
function waveGLSL(fn) {
  return WAVES.map((w) =>
    `  ${fn} += sin((p.x * ${w.dx.toFixed(6)} + p.y * ${w.dz.toFixed(6)}) * ${w.k.toFixed(6)} + uTime * ${(w.speed * w.k * 6).toFixed(6)}) * ${w.amp.toFixed(4)};`
  ).join("\n");
}

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

float waveHeight(vec2 p) {
  float h = 0.0;
${waveGLSL("h")}
  return h;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float h = waveHeight(world.xz);
  world.y += h;
  vWorld = world.xyz;
  vHeight = h;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

float waveHeight(vec2 p) {
  float h = 0.0;
${waveGLSL("h")}
  return h;
}

// Central differences on the same wave sum give a normal that survives the
// coarse tessellation of the far field far better than interpolated ones.
vec3 waveNormal(vec2 p) {
  float e = 0.6;
  float hL = waveHeight(p - vec2(e, 0.0));
  float hR = waveHeight(p + vec2(e, 0.0));
  float hD = waveHeight(p - vec2(0.0, e));
  float hU = waveHeight(p + vec2(0.0, e));
  return normalize(vec3(hL - hR, 2.0 * e, hD - hU));
}

void main() {
  vec3 normal = waveNormal(vWorld.xz);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  float fres = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  fres = clamp(fres, 0.0, 1.0);

  float slope = 1.0 - normal.y;
  vec3 body = mix(uDeep, uShallow, clamp(slope * 3.0 + 0.15, 0.0, 1.0));
  vec3 color = mix(body, uSky, fres * 0.75);

  vec3 halfVec = normalize(uSun + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 90.0);
  color += uSunColor * spec * 0.9;

  // Foam rides the very tops of the crests and the steepest faces.
  float crest = smoothstep(1.35, 2.25, vHeight + slope * 2.4);
  color = mix(color, vec3(0.96, 0.98, 1.0), crest * 0.7);

  float fogAmount = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
  color = mix(color, uFogColor, clamp(fogAmount, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * A disc of water centred on the viewer, with rings spaced geometrically so
 * the mesh is dense underfoot and coarse at the horizon.
 *
 * One mesh rather than "detail tile plus flat skirt": two meshes meant two
 * different colours meeting at a hard circle a few hundred metres out, which
 * was the most obvious artefact in the whole sea. A single surface cannot seam
 * against itself.
 */
function radialSeaGeometry(innerRadius, maxRadius, rings, segments) {
  const positions = [0, 0, 0];
  const indices = [];
  const ratio = Math.pow(maxRadius / innerRadius, 1 / rings);

  for (let i = 0; i <= rings; i++) {
    const r = innerRadius * Math.pow(ratio, i);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * TAU;
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }

  for (let j = 0; j < segments; j++) {
    indices.push(0, 1 + ((j + 1) % segments), 1 + j);
  }
  for (let i = 0; i < rings; i++) {
    const inner = 1 + i * segments;
    const outer = 1 + (i + 1) * segments;
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      indices.push(inner + j, outer + j2, outer + j);
      indices.push(inner + j, inner + j2, outer + j2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * The sea surface.
 *
 * Vertex displacement gets coarse toward the horizon, but the fragment shader
 * derives its normals analytically from world position rather than from the
 * mesh, so distant water keeps its shading detail however few triangles are
 * carrying it.
 */
export class Ocean {
  constructor(scene, { rings = 108, segments = 128, maxRadius = 7000 } = {}) {
    const uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0a3b5c) },
      uShallow: { value: new THREE.Color(0x2d8fae) },
      uSky: { value: new THREE.Color(0x9fc9e2) },
      uSun: { value: new THREE.Vector3(0.4, 0.72, 0.56).normalize() },
      uSunColor: { value: new THREE.Color(0xfff2d0) },
      uFogColor: { value: new THREE.Color(0xbcd8e8) },
      uFogDensity: { value: 0.00042 },
    };
    this.uniforms = uniforms;

    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(
      radialSeaGeometry(1.2, maxRadius, rings, segments),
      this.material
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  /** Tint the whole sea — used to shift mood between climates. */
  setPalette({ deep, shallow, sky, sun, fog, fogDensity }) {
    if (deep) this.uniforms.uDeep.value.set(deep);
    if (shallow) this.uniforms.uShallow.value.set(shallow);
    if (sky) this.uniforms.uSky.value.set(sky);
    if (sun) this.uniforms.uSunColor.value.set(sun);
    if (fog) this.uniforms.uFogColor.value.set(fog);
    if (fogDensity !== undefined) this.uniforms.uFogDensity.value = fogDensity;
  }

  setSunDirection(v) {
    this.uniforms.uSun.value.copy(v).normalize();
  }

  update(time, cameraPos) {
    this.uniforms.uTime.value = time;
    // Waves are evaluated in world space, so the disc can simply follow the
    // camera without the pattern sliding along with it.
    this.mesh.position.x = cameraPos.x;
    this.mesh.position.z = cameraPos.z;
  }
}
