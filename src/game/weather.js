import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, lerp, damp, makeRng, range } from "../core/utils.js";
import { setSwell } from "../world/ocean.js";

/**
 * Weather at sea.
 *
 * The sea used to be a flat commute between islands. This turns the crossing
 * into something that happens *to* you: the swell builds, the horizon closes
 * in, the ship gets harder to hold on course, and then it passes.
 *
 * States move in a ring rather than jumping at random — a storm always arrives
 * through a squall and leaves through one, so the player gets a minute of
 * warning and a chance to decide whether to run for the island.
 */

const STATES = {
  calm:   { severity: 0.0,  next: ["calm", "breezy", "breezy"],          hold: [50, 110] },
  breezy: { severity: 0.28, next: ["calm", "breezy", "squall", "squall"], hold: [45, 95] },
  squall: { severity: 0.62, next: ["breezy", "breezy", "storm"],         hold: [30, 60] },
  storm:  { severity: 1.0,  next: ["squall"],                            hold: [35, 70] },
};

const LABELS = {
  calm: "Calm", breezy: "A fair breeze", squall: "Squall", storm: "Storm",
};

/** What each state does to the look and feel of the sea. */
const LOOK = {
  swell: [1.0, 2.75],          // wave amplitude multiplier
  fog: [1.0, 3.4],             // multiplier on the climate's fog density
  sun: [1.0, 0.34],            // directional light scale
  cloudOpacity: [0.82, 0.97],
  darken: [0.0, 0.66],         // how far sky colours slide toward slate
};

const STORM_SKY = new THREE.Color(0x2e3a47);
const STORM_SEA = new THREE.Color(0x0a1a28);

export class Weather {
  /**
   * @param opts.audio  for thunder and the rain bed
   * @param opts.onChange  called with (stateName, label) when the sky turns
   */
  constructor({ audio, scene, seed = 1234, onChange = null } = {}) {
    this.audio = audio;
    this.onChange = onChange;
    this.rng = makeRng(seed);

    this.state = "calm";
    this.severity = 0;          // smoothed, 0..1
    this.target = 0;
    this.timer = range(this.rng, 30, 70);
    this.windAngle = this.rng() * TAU;
    this.lightning = 0;         // flash amount, decays
    this.nextStrike = 4;
    this.enabled = true;

    this.buildRain(scene);
  }

  /**
   * A column of rain that follows the camera.
   *
   * Drawn as short line segments rather than points: a falling dot reads as
   * snow, and the streak is what makes it rain. Two vertices per drop, one
   * draw call, and the drops are recycled rather than reallocated.
   */
  buildRain(scene) {
    if (!scene) return;
    this.rainCount = 1500;
    this.rainSpan = { x: 85, y: 62, z: 85 };
    this.rainHead = new Float32Array(this.rainCount * 3);
    const verts = new Float32Array(this.rainCount * 6);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainHead[i * 3] = range(this.rng, -this.rainSpan.x, this.rainSpan.x);
      this.rainHead[i * 3 + 1] = range(this.rng, 0, this.rainSpan.y);
      this.rainHead[i * 3 + 2] = range(this.rng, -this.rainSpan.z, this.rainSpan.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xc6d8e4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  get label() {
    return LABELS[this.state];
  }

  /** 0 on a calm day, 1 in the worst of it. Drives everything else. */
  get intensity() {
    return this.severity;
  }

  /** Force a state — used when a save is restored, and by the tests. */
  set(stateName, { instant = false } = {}) {
    if (!STATES[stateName]) return;
    this.state = stateName;
    this.target = STATES[stateName].severity;
    this.timer = range(this.rng, ...STATES[stateName].hold);
    if (instant) this.severity = this.target;
    this.onChange?.(this.state, this.label);
  }

  roll() {
    const options = STATES[this.state].next;
    const pick = options[Math.floor(this.rng() * options.length) % options.length];
    const changed = pick !== this.state;
    this.state = pick;
    this.target = STATES[pick].severity;
    this.timer = range(this.rng, ...STATES[pick].hold);
    // Weather turns slowly; the wind shifts with it.
    this.windAngle += range(this.rng, -0.8, 0.8);
    if (changed) this.onChange?.(this.state, this.label);
  }

  update(dt, cameraPos) {
    if (!this.enabled) return;

    this.timer -= dt;
    if (this.timer <= 0) this.roll();

    // Building is slower than clearing: storms take their time arriving.
    const rate = this.target > this.severity ? 0.09 : 0.14;
    this.severity = damp(this.severity, this.target, rate, dt);

    this.updateRain(dt, cameraPos);
    this.updateLightning(dt);
  }

  updateRain(dt, cameraPos) {
    if (!this.rain) return;
    const t = this.severity;
    const showing = t > 0.3;
    this.rain.visible = showing;
    if (!showing) return;

    this.rain.material.opacity = clamp((t - 0.3) / 0.7, 0, 1) * 0.6;
    if (cameraPos) this.rain.position.set(cameraPos.x, 0, cameraPos.z);

    const head = this.rainHead;
    const verts = this.rain.geometry.attributes.position;
    const fallSpeed = 30 + t * 40;
    const windSpeed = t * 13;
    const wx = Math.sin(this.windAngle) * windSpeed;
    const wz = Math.cos(this.windAngle) * windSpeed;

    // The streak points back along the drop's own velocity, so rain leans
    // with the wind instead of always falling straight down.
    const len = 0.05 + t * 0.03;
    const tailX = -wx * len, tailY = fallSpeed * len, tailZ = -wz * len;

    for (let i = 0; i < this.rainCount; i++) {
      const o = i * 3;
      let x = head[o] + wx * dt;
      let y = head[o + 1] - fallSpeed * dt;
      let z = head[o + 2] + wz * dt;
      if (y < -8) {
        y += this.rainSpan.y;
        x = range(this.rng, -this.rainSpan.x, this.rainSpan.x);
        z = range(this.rng, -this.rainSpan.z, this.rainSpan.z);
      }
      head[o] = x; head[o + 1] = y; head[o + 2] = z;

      const v = i * 6;
      verts.array[v] = x;
      verts.array[v + 1] = y;
      verts.array[v + 2] = z;
      verts.array[v + 3] = x + tailX;
      verts.array[v + 4] = y + tailY;
      verts.array[v + 5] = z + tailZ;
    }
    verts.needsUpdate = true;
  }

  updateLightning(dt) {
    this.lightning = Math.max(0, this.lightning - dt * 4.5);
    if (this.severity < 0.72) return;
    this.nextStrike -= dt;
    if (this.nextStrike > 0) return;
    this.nextStrike = range(this.rng, 6, 20);
    this.lightning = 1;
    this.audio?.thunder(range(this.rng, 0.6, 2.2));
  }

  /**
   * Push the current weather into the scene. Called every frame after update.
   *
   * Takes the island's fair-weather palette as the baseline and slides it
   * toward storm, so each climate keeps its character even in bad weather.
   */
  apply(ocean, sky, scene, base) {
    const t = this.severity;
    const mix = lerp(LOOK.darken[0], LOOK.darken[1], t);

    setSwell(lerp(LOOK.swell[0], LOOK.swell[1], t));

    const top = new THREE.Color(base.top).lerp(STORM_SKY, mix);
    const horizon = new THREE.Color(base.horizon).lerp(STORM_SKY, mix * 0.85);
    const flash = this.lightning * this.lightning;

    sky.setPalette({
      top: top.clone().lerp(new THREE.Color(0xffffff), flash * 0.55),
      horizon: horizon.clone().lerp(new THREE.Color(0xffffff), flash * 0.4),
      sunIntensity: lerp(LOOK.sun[0], LOOK.sun[1], t) * (base.sunIntensity ?? 2.1) + flash * 2.2,
      haze: clamp((base.haze ?? 0.45) + t * 0.3, 0, 1),
      cloudOpacity: lerp(LOOK.cloudOpacity[0], LOOK.cloudOpacity[1], t),
      cloudColor: new THREE.Color(0xffffff).lerp(new THREE.Color(0x6b7885), mix),
      ambientIntensity: lerp(1.15, 0.72, t) + flash * 1.4,
    });

    const fogDensity = (base.fogDensity ?? 0.00042) * lerp(LOOK.fog[0], LOOK.fog[1], t);
    ocean.setPalette({
      deep: new THREE.Color(base.deep ?? 0x0a3b5c).lerp(STORM_SEA, mix),
      shallow: new THREE.Color(base.shallow ?? 0x2d8fae).lerp(STORM_SEA, mix * 0.7),
      sky: horizon,
      fog: horizon,
      fogDensity,
    });
    if (scene.fog) {
      scene.fog.color.copy(horizon);
      scene.fog.density = fogDensity;
    }
  }

  /** How much the weather fights the helm, 0..1. */
  get helmDifficulty() {
    return this.severity;
  }

  toJSON() {
    return { state: this.state, severity: this.severity };
  }

  restore(data) {
    if (!data || !STATES[data.state]) return;
    this.state = data.state;
    this.target = STATES[data.state].severity;
    this.severity = Number(data.severity) || this.target;
    this.timer = range(this.rng, ...STATES[data.state].hold);
  }

  dispose() {
    if (!this.rain) return;
    this.rain.geometry.dispose();
    this.rain.material.dispose();
  }
}
