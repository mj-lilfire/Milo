import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { clamp } from "./utils.js";

/**
 * Owns the WebGL renderer, the camera and the frame loop.
 *
 * Scenes are swapped wholesale (sea <-> island) rather than streamed, so the
 * engine only ever renders whatever `setScene` was last handed.
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // resolved by the pixel-ratio budget below instead
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setClearColor(0x87b9d6);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 9000);
    this.scene = null;

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.updaters = new Set();

    // iPads have plenty of pixels and not much fill rate. Rendering at native
    // 2x on a 12.9" panel is a guaranteed way to sit at 30fps, so cap the
    // budget and let the adaptive step below walk it down further if needed.
    this.maxPixelRatio = this.detectPixelBudget();
    this.pixelRatio = this.maxPixelRatio;
    this.frameSamples = [];

    this.onResize = this.onResize.bind(this);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", () => setTimeout(this.onResize, 250));
    this.onResize();
  }

  detectPixelBudget() {
    const dpr = window.devicePixelRatio || 1;
    const mobile = /iPad|iPhone|iPod|Android/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return mobile ? clamp(dpr, 1, 1.5) : clamp(dpr, 1, 2);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
  }

  setScene(scene) {
    this.scene = scene;
  }

  /** Register a `fn(dt, elapsed)` called once per frame. Returns an unsubscribe. */
  addUpdater(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  /**
   * Keep an eye on frame cost and shed resolution before the frame rate goes.
   * A dropped pixel ratio is far less noticeable than a dropped frame rate.
   */
  adapt(dt) {
    this.frameSamples.push(dt);
    if (this.frameSamples.length < 90) return;
    const avg = this.frameSamples.reduce((a, b) => a + b, 0) / this.frameSamples.length;
    this.frameSamples.length = 0;
    if (avg > 1 / 40 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.onResize();
    } else if (avg < 1 / 58 && this.pixelRatio < this.maxPixelRatio) {
      this.pixelRatio = Math.min(this.maxPixelRatio, this.pixelRatio + 0.25);
      this.onResize();
    }
  }

  start() {
    const tick = () => {
      this.frameHandle = requestAnimationFrame(tick);
      // Backgrounding Safari can hand back a multi-second delta; clamping keeps
      // physics from tunnelling the player through the world on resume.
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;
      for (const fn of this.updaters) fn(dt, this.elapsed);
      if (this.scene) this.renderer.render(this.scene, this.camera);
      this.adapt(dt);
    };
    tick();
  }

  stop() {
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
  }
}

/**
 * Recursively free GPU memory for a subtree. Called when leaving an island.
 *
 * Materials flagged `userData.persistent` are left alone: some are shared by
 * every character in the game and outlive any one scene.
 */
export function disposeObject(root) {
  root.traverse((obj) => {
    // Every Sprite in three shares one static geometry — freeing it through
    // any single sprite would pull the rug out from under all the others.
    if (obj.geometry && !obj.isSprite) obj.geometry.dispose();
    const mat = obj.material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      if (m.userData && m.userData.persistent) continue;
      for (const key of Object.keys(m)) {
        const val = m[key];
        if (val && val.isTexture) val.dispose();
      }
      m.dispose();
    }
  });
}

/** Free just the geometry of a subtree, leaving shared materials intact. */
export function disposeGeometry(root) {
  root.traverse((obj) => {
    if (obj.geometry && !obj.isSprite) obj.geometry.dispose();
    const mat = obj.material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      if (m.userData && m.userData.persistent) continue;
      if (m.map && m.map.isTexture) m.map.dispose();
      m.dispose();
    }
  });
}
