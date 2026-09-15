import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, makeRng, range } from "../core/utils.js";

const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  // Strip translation so the dome is always centred on the viewer.
  vec4 mv = viewMatrix * vec4(position + cameraPosition, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const domeFrag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSun;
uniform float uHaze;
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = max(dir.y, 0.0);
  vec3 color = mix(uHorizon, uTop, pow(h, 0.55));

  float sunDot = max(dot(dir, normalize(uSun)), 0.0);
  color += uSunColor * pow(sunDot, 220.0) * 1.6;         // disc
  color += uSunColor * pow(sunDot, 9.0) * 0.28;          // bloom
  color = mix(color, uHorizon, uHaze * (1.0 - smoothstep(0.0, 0.28, h)));

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Sky dome, sun light, drifting clouds and a few gulls.
 *
 * The dome, the fog and the directional light are all driven from one palette
 * so a climate change (tropical -> arctic -> desert) is a single call.
 */
export class Sky {
  constructor(scene, { clouds = 26, birds = 7, seed = 7 } = {}) {
    this.scene = scene;

    this.uniforms = {
      uTop: { value: new THREE.Color(0x3d81c4) },
      uHorizon: { value: new THREE.Color(0xcfe4ef) },
      uSunColor: { value: new THREE.Color(0xfff0cc) },
      uSun: { value: new THREE.Vector3(0.4, 0.72, 0.56).normalize() },
      uHaze: { value: 0.45 },
    };

    const geo = new THREE.SphereGeometry(1, 24, 16);
    this.dome = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: domeVert,
      fragmentShader: domeFrag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }));
    // Drawn first with depth off, so radius only needs to beat the near plane.
    this.dome.scale.setScalar(4000);
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sunLight = new THREE.DirectionalLight(0xfff1d4, 2.1);
    this.sunLight.position.set(0.4, 0.72, 0.56).multiplyScalar(300);

    // The shadow frustum is a box that travels with the viewer rather than
    // covering the island: a map stretched over a 400-metre island has no
    // resolution left for the things you are actually standing next to.
    this.sunLight.castShadow = true;
    const mobile = /iPad|iPhone|iPod|Android/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const size = mobile ? 1024 : 2048;
    this.sunLight.shadow.mapSize.set(size, size);
    const cam = this.sunLight.shadow.camera;
    const extent = 85;
    cam.left = -extent; cam.right = extent;
    cam.top = extent; cam.bottom = -extent;
    cam.near = 20;
    cam.far = 620;
    cam.updateProjectionMatrix();
    this.sunLight.shadow.bias = -0.0012;
    this.sunLight.shadow.normalBias = 0.5;

    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.ambient = new THREE.HemisphereLight(0xbcd8e8, 0x4a5f52, 1.15);
    scene.add(this.ambient);

    this.cloudGroup = new THREE.Group();
    this.cloudGroup.renderOrder = -50;
    scene.add(this.cloudGroup);
    this.buildClouds(clouds, seed);

    this.birdGroup = new THREE.Group();
    scene.add(this.birdGroup);
    this.buildBirds(birds, seed + 99);

    this.drift = 0;
  }

  buildClouds(count, seed) {
    const rng = makeRng(seed);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: false,
    });
    this.cloudMaterial = material;
    const blobGeo = new THREE.IcosahedronGeometry(1, 1);
    this.cloudGeo = blobGeo;

    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(blobGeo, material);
        m.position.set(range(rng, -28, 28), range(rng, -4, 4), range(rng, -14, 14));
        m.scale.set(range(rng, 14, 26), range(rng, 6, 11), range(rng, 12, 20));
        cloud.add(m);
      }
      const angle = rng() * TAU;
      const dist = range(rng, 300, 1500);
      cloud.position.set(Math.cos(angle) * dist, range(rng, 190, 340), Math.sin(angle) * dist);
      cloud.userData.speed = range(rng, 1.4, 3.4);
      this.cloudGroup.add(cloud);
    }
  }

  buildBirds(count, seed) {
    const rng = makeRng(seed);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide, fog: false });
    // A single chevron reads as a distant seabird at any size.
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, 0, -1.6, 0.35, -0.7, -1.5, 0, -1.4,
      0, 0, 0, 1.6, 0.35, -0.7, 1.5, 0, -1.4,
    ], 3));
    shape.computeVertexNormals();
    this.birdGeo = shape;
    this.birdMat = mat;

    for (let i = 0; i < count; i++) {
      const bird = new THREE.Mesh(shape, mat);
      bird.userData = {
        radius: range(rng, 60, 190),
        height: range(rng, 45, 95),
        phase: rng() * TAU,
        speed: range(rng, 0.09, 0.2),
        flap: range(rng, 5, 9),
      };
      bird.scale.setScalar(range(rng, 1.2, 2.4));
      this.birdGroup.add(bird);
    }
  }

  /**
   * @param {object} p  top / horizon / sun colours, haze strength, light tint.
   */
  setPalette(p) {
    if (p.top) this.uniforms.uTop.value.set(p.top);
    if (p.horizon) this.uniforms.uHorizon.value.set(p.horizon);
    if (p.sunColor) {
      this.uniforms.uSunColor.value.set(p.sunColor);
      this.sunLight.color.set(p.sunColor);
    }
    if (p.haze !== undefined) this.uniforms.uHaze.value = p.haze;
    if (p.sunIntensity !== undefined) this.sunLight.intensity = p.sunIntensity;
    if (p.ambientSky) this.ambient.color.set(p.ambientSky);
    if (p.ambientGround) this.ambient.groundColor.set(p.ambientGround);
    if (p.ambientIntensity !== undefined) this.ambient.intensity = p.ambientIntensity;
    if (p.cloudColor) this.cloudMaterial.color.set(p.cloudColor);
    if (p.cloudOpacity !== undefined) this.cloudMaterial.opacity = p.cloudOpacity;
    if (p.sunDirection) {
      this.uniforms.uSun.value.copy(p.sunDirection).normalize();
      this.sunLight.position.copy(this.uniforms.uSun.value).multiplyScalar(300);
    }
  }

  get sunDirection() {
    return this.uniforms.uSun.value;
  }

  /**
   * Release what the scene graph cannot.
   *
   * A shadow-casting light allocates a render target the first time it draws,
   * and that target is owned by the light rather than by the scene — so
   * disposing the island's objects leaves it behind. One per landfall is a
   * slow but real leak on a device with a fixed texture budget.
   */
  dispose() {
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null;
    this.sunLight.dispose?.();
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    this.cloudGeo?.dispose();
    this.cloudMaterial.dispose();
    this.birdGeo.dispose();
    this.birdMat.dispose();
  }

  update(dt, time, cameraPos) {
    this.drift += dt;

    for (const cloud of this.cloudGroup.children) {
      cloud.position.x += cloud.userData.speed * dt;
      // Wrap around the viewer so the sky never empties out.
      const dx = cloud.position.x - cameraPos.x;
      if (dx > 1600) cloud.position.x -= 3200;
      if (dx < -1600) cloud.position.x += 3200;
      const dz = cloud.position.z - cameraPos.z;
      if (dz > 1600) cloud.position.z -= 3200;
      if (dz < -1600) cloud.position.z += 3200;
    }
    this.cloudGroup.position.y = 0;

    for (const bird of this.birdGroup.children) {
      const u = bird.userData;
      const a = u.phase + time * u.speed;
      bird.position.set(
        cameraPos.x + Math.cos(a) * u.radius,
        u.height + Math.sin(time * 0.4 + u.phase) * 4,
        cameraPos.z + Math.sin(a) * u.radius
      );
      bird.rotation.y = -a + Math.PI / 2;
      bird.rotation.z = Math.sin(time * u.flap + u.phase) * 0.45;
    }

    // The sun light follows the player so island shading stays consistent
    // however far you sail from the origin. The shadow frustum rides along
    // with it, snapped to a grid so shadow edges don't crawl as you walk.
    const snap = 2;
    const sx = Math.round(cameraPos.x / snap) * snap;
    const sz = Math.round(cameraPos.z / snap) * snap;
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(300);
    this.sunLight.position.x += sx;
    this.sunLight.position.z += sz;
    this.sunLight.target.position.set(sx, 0, sz);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.updateMatrixWorld();
  }
}
