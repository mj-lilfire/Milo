import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, damp, dampAngle } from "../core/utils.js";
import { box, cyl, cone, sphere, at, merge, propMaterial } from "./geom.js";
import { shadowed } from "../core/engine.js";

/**
 * Procedural low-poly people.
 *
 * Characters are assembled from a spec (colours, hat, gear) rather than loaded
 * as models, so the whole cast costs nothing to download and every islander can
 * be a distinct silhouette. Limbs hang off pivot groups at the shoulder and hip
 * so the same animator drives idle, walking, talking and sword swings.
 */

// Every character in the game draws with this one material, so it must survive
// island teardown — see disposeObject.
const SHARED_MATERIAL = propMaterial();
SHARED_MATERIAL.userData.persistent = true;

function hatGeometry(kind, colors) {
  switch (kind) {
    case "straw":
      return merge([
        at(cyl(2.05, 2.2, 0.06, 0xe8c86a, 12), { y: 0.02, sx: 1, sz: 1 }),
        at(cyl(1.05, 1.15, 0.42, 0xe8c86a, 10), { y: 0.22 }),
        at(cyl(1.12, 1.12, 0.12, 0xc23b2e, 10), { y: 0.12 }),
      ]);
    case "bandana":
      return merge([
        at(box(1.9, 0.55, 1.75, colors.accent || 0x2f7f4f), { y: 0.05 }),
        at(box(0.28, 0.9, 0.22, colors.accent || 0x2f7f4f), { x: -0.9, y: -0.3, z: -0.7, rz: 0.4 }),
      ]);
    case "marine":
      return merge([
        at(cyl(1.2, 1.15, 0.42, 0xf2f2f0, 10), { y: 0.2 }),
        at(cyl(1.35, 1.35, 0.1, 0x20406b, 10), { y: 0.0 }),
        at(box(1.4, 0.09, 0.7, 0x20406b), { z: 1.0, y: 0.02 }),
      ]);
    case "chef":
      return merge([at(cyl(1.25, 1.05, 1.5, 0xf7f7f5, 10), { y: 0.75 })]);
    case "cap":
      return merge([
        at(sphere(1.1, colors.accent || 0x8a4b2a, 8), { y: 0.0, sy: 0.55 }),
        at(box(1.2, 0.1, 0.8, colors.accent || 0x8a4b2a), { z: 0.95 }),
      ]);
    case "tricorn":
      return merge([
        at(cone(1.7, 0.7, 0x1e1e28, 3), { y: 0.3, ry: Math.PI / 6 }),
        at(cyl(1.0, 1.05, 0.5, 0x1e1e28, 8), { y: 0.25 }),
      ]);
    case "top":
      return merge([
        at(cyl(1.2, 1.25, 0.08, 0x2a2118, 10), { y: 0.02 }),
        at(cyl(0.85, 0.85, 1.5, 0x2a2118, 10), { y: 0.78 }),
      ]);
    case "antlers":
      return merge([
        at(cyl(0.9, 1.0, 0.9, 0xd94f4f, 8), { y: 0.4 }),
        at(cyl(0.12, 0.14, 1.1, 0x6b4a2a, 5), { x: -0.7, y: 0.9, rz: 0.5 }),
        at(cyl(0.12, 0.14, 1.1, 0x6b4a2a, 5), { x: 0.7, y: 0.9, rz: -0.5 }),
      ]);
    default:
      return null;
  }
}

function hairGeometry(kind, color) {
  switch (kind) {
    case "short":
      return merge([at(box(1.65, 0.7, 1.6, color), { y: 0.55 })]);
    case "long":
      return merge([
        at(box(1.7, 0.75, 1.65, color), { y: 0.55 }),
        at(box(1.55, 1.8, 0.5, color), { y: -0.5, z: -0.75 }),
      ]);
    case "spiky":
      return merge([
        at(box(1.65, 0.55, 1.6, color), { y: 0.5 }),
        at(cone(0.34, 0.8, color, 4), { x: -0.45, y: 1.05, rz: 0.35 }),
        at(cone(0.34, 0.8, color, 4), { x: 0.2, y: 1.1, rz: -0.2 }),
        at(cone(0.3, 0.7, color, 4), { x: 0.6, y: 0.95, rz: -0.5 }),
      ]);
    case "swirl":
      return merge([
        at(box(1.7, 0.7, 1.6, color), { y: 0.55 }),
        at(box(1.2, 0.6, 0.7, color), { x: 0.3, y: 0.85, z: 0.75, rz: -0.35 }),
      ]);
    default:
      return null;
  }
}

function gearGeometry(kind, colors) {
  switch (kind) {
    case "swords":
      // Three sheaths at the hip — the silhouette does the characterisation.
      return merge([-0.35, 0, 0.35].map((off, i) =>
        at(cyl(0.055, 0.07, 1.5, [0x1f3d2b, 0xf2f2f0, 0x2a2a34][i], 6), {
          x: -0.42, y: -0.15, z: off * 0.4 - 0.1, rx: 0.35, rz: 0.32,
        })));
    case "slingshot":
      return merge([
        at(cyl(0.05, 0.06, 0.7, 0x8a5a2a, 5), { y: -0.1 }),
        at(cyl(0.04, 0.05, 0.45, 0x8a5a2a, 5), { x: -0.14, y: 0.35, rz: 0.45 }),
        at(cyl(0.04, 0.05, 0.45, 0x8a5a2a, 5), { x: 0.14, y: 0.35, rz: -0.45 }),
      ]);
    case "rifle":
      return merge([
        at(box(0.09, 1.4, 0.09, 0x2f2f33), { rz: 0.5, y: -0.1 }),
        at(box(0.16, 0.38, 0.13, 0x5a3b1e), { x: -0.32, y: -0.42, rz: 0.5 }),
      ]);
    case "staff":
      return merge([
        at(cyl(0.06, 0.07, 1.9, 0x6b4a2a, 6), { y: -0.1 }),
        at(sphere(0.18, 0.9, 8), { y: 0.9 }),
      ]);
    case "backpack":
      return merge([at(box(0.62, 0.7, 0.3, 0x6b4a2a), { z: -0.32, y: -0.1 })]);
    default:
      return null;
  }
}

/**
 * @param {object} spec
 *   shirt, pants, skin, hairColor, accent — hex colours
 *   hat    — straw | bandana | marine | chef | cap | tricorn | top | antlers
 *   hair   — short | long | spiky | swirl
 *   gear   — swords | slingshot | rifle | staff | backpack
 *   scale  — 1 is roughly player height
 */
export function createCharacter(spec = {}) {
  const s = {
    shirt: 0xc8452f, pants: 0x2f3f5a, skin: 0xe8b48a,
    hairColor: 0x2a1d12, accent: 0xe0a733,
    hat: "none", hair: "short", gear: "none", scale: 1,
    ...spec,
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mk = (geo) => new THREE.Mesh(geo, SHARED_MATERIAL);

  // --- torso --------------------------------------------------------------
  // Proportioned rather than boxed: a tapered chest into a narrower waist, a
  // visible neck, and a head a size smaller than the old one. The silhouette
  // is most of what tells a viewer whether they are looking at a person or at
  // a stack of crates.
  const torsoParts = [
    at(box(0.46, 0.44, 0.26, s.shirt), { y: 1.28 }),          // chest
    at(box(0.40, 0.22, 0.235, s.shirt), { y: 1.00 }),         // waist
    at(box(0.44, 0.10, 0.25, s.accent), { y: 0.87 }),         // belt
    at(box(0.38, 0.18, 0.25, s.pants), { y: 0.78 }),          // hips
    at(cyl(0.075, 0.085, 0.13, s.skin, 6), { y: 1.545 }),     // neck
  ];

  // An open coat or jacket, if the character wears one. Two front panels and
  // a back, so it reads as worn over the shirt rather than as another shirt.
  if (s.coat) {
    const c = s.coat;
    // The two front panels nearly meet: leave a wide gap and the shirt behind
    // reads as a bright slab across the chest, which looks like a sandwich
    // board rather than a coat worn open.
    torsoParts.push(at(box(0.21, 0.62, 0.285, c), { x: -0.155, y: 1.18 }));
    torsoParts.push(at(box(0.21, 0.62, 0.285, c), { x: 0.155, y: 1.18 }));
    torsoParts.push(at(box(0.48, 0.64, 0.10, c), { y: 1.20, z: -0.135 }));
    torsoParts.push(at(box(0.52, 0.13, 0.29, c), { y: 1.45 }));   // shoulders
    // A collar, which is what actually says "coat" at a glance.
    torsoParts.push(at(box(0.13, 0.16, 0.10, c), { x: -0.085, y: 1.50, z: 0.115, rz: 0.3 }));
    torsoParts.push(at(box(0.13, 0.16, 0.10, c), { x: 0.085, y: 1.50, z: 0.115, rz: -0.3 }));
  }

  const gear = gearGeometry(s.gear, s);
  if (gear && s.gear !== "slingshot" && s.gear !== "rifle" && s.gear !== "staff") {
    torsoParts.push(at(gear, { y: 1.05 }));
  }
  const torso = mk(merge(torsoParts));
  body.add(torso);

  // --- head ---------------------------------------------------------------
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.61;
  body.add(headPivot);

  const headParts = [
    at(box(0.26, 0.29, 0.255, s.skin), { y: 0.145 }),
    at(box(0.052, 0.042, 0.03, 0x1a1a1a), { x: -0.068, y: 0.175, z: 0.132 }),
    at(box(0.052, 0.042, 0.03, 0x1a1a1a), { x: 0.068, y: 0.175, z: 0.132 }),
    at(box(0.10, 0.03, 0.03, 0x8a5a4a), { y: 0.085, z: 0.132 }),   // mouth
  ];
  const hair = hairGeometry(s.hair, s.hairColor);
  if (hair) headParts.push(at(hair, { y: 0.145, s: 0.155 }));
  const hat = hatGeometry(s.hat, s);
  if (hat) headParts.push(at(hat, { y: 0.285, s: 0.158 }));
  const head = mk(merge(headParts));
  headPivot.add(head);

  // --- limbs --------------------------------------------------------------
  const limb = (w, len, color, px, py) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const mesh = mk(at(box(w, len, w, color), { y: -len / 2 }));
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };

  const sleeve = s.coat || s.shirt;
  const armL = limb(0.13, 0.60, sleeve, -0.295, 1.475);
  const armR = limb(0.13, 0.60, sleeve, 0.295, 1.475);
  // Hands, so a sleeve doesn't just stop in mid-air.
  armL.add(mk(at(box(0.135, 0.13, 0.135, s.skin), { y: -0.655 })));
  armR.add(mk(at(box(0.135, 0.13, 0.135, s.skin), { y: -0.655 })));

  const legL = limb(0.155, 0.80, s.pants, -0.115, 0.80);
  const legR = limb(0.155, 0.80, s.pants, 0.115, 0.80);
  // Boots: a little wider than the leg, which grounds the stance.
  legL.add(mk(at(box(0.185, 0.20, 0.175, s.boots ?? 0x3a2a1c), { y: -0.86 })));
  legR.add(mk(at(box(0.185, 0.20, 0.175, s.boots ?? 0x3a2a1c), { y: -0.86 })));
  legL.add(mk(at(box(0.19, 0.075, 0.28, s.boots ?? 0x3a2a1c), { y: -0.925, z: 0.05 })));
  legR.add(mk(at(box(0.19, 0.075, 0.28, s.boots ?? 0x3a2a1c), { y: -0.925, z: 0.05 })));

  // Held gear rides in the right hand.
  if (gear && (s.gear === "slingshot" || s.gear === "rifle" || s.gear === "staff")) {
    armR.add(mk(at(gear, { y: -0.66 })));
  }

  group.scale.setScalar(s.scale);
  // People cast, but do not receive: at this size self-shadowing is all acne
  // and no benefit.
  shadowed(group, { receive: false });

  const parts = { body, torso, headPivot, armL, armR, legL, legR };
  return new CharacterRig(group, parts, s);
}

/** Drives a built character's pose. One animator, several named states. */
export class CharacterRig {
  constructor(group, parts, spec) {
    this.group = group;
    this.parts = parts;
    this.spec = spec;
    this.state = "idle";
    this.phase = Math.random() * TAU;
    this.blink = 0;
    this.attackTimer = 0;
    this.facing = 0;
    this.targetFacing = 0;
    this.lookAt = null;
  }

  setState(state) {
    if (state === "attack" && this.state !== "attack") this.attackTimer = 0.45;
    this.state = state;
  }

  /** Smoothly turn the whole character toward a yaw angle. */
  faceAngle(yaw) {
    this.targetFacing = yaw;
  }

  /** Turn to face a world position (used when talking to the player). */
  facePoint(x, z) {
    this.targetFacing = Math.atan2(x - this.group.position.x, z - this.group.position.z);
  }

  update(dt, speed = 0) {
    const p = this.parts;
    this.facing = dampAngle(this.facing, this.targetFacing, 9, dt);
    this.group.rotation.y = this.facing;

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && this.state === "attack") this.state = "idle";
    }

    switch (this.state) {
      case "walk": {
        this.phase += dt * (5 + speed * 1.4);
        const sw = Math.sin(this.phase) * (0.5 + Math.min(speed, 6) * 0.06);
        p.legL.rotation.x = sw;
        p.legR.rotation.x = -sw;
        p.armL.rotation.x = -sw * 0.8;
        p.armR.rotation.x = sw * 0.8;
        p.body.position.y = Math.abs(Math.sin(this.phase)) * 0.055;
        p.body.rotation.z = Math.sin(this.phase) * 0.025;
        break;
      }
      case "attack": {
        // Overhead swing that snaps down and eases back.
        const t = 1 - Math.max(this.attackTimer, 0) / 0.45;
        const swing = t < 0.35
          ? -2.2 * (t / 0.35)
          : -2.2 + 3.4 * ((t - 0.35) / 0.65);
        p.armR.rotation.x = swing;
        p.armL.rotation.x = swing * 0.25;
        p.body.rotation.y = Math.sin(t * Math.PI) * -0.4;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        break;
      }
      case "talk": {
        this.phase += dt * 3.2;
        p.headPivot.rotation.x = Math.sin(this.phase * 1.7) * 0.09;
        p.armR.rotation.x = -0.35 + Math.sin(this.phase * 2.1) * 0.3;
        p.armR.rotation.z = -0.25;
        p.armL.rotation.x = Math.sin(this.phase * 1.3) * 0.12;
        p.body.position.y = 0;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        break;
      }
      case "hurt": {
        p.body.rotation.x = -0.3;
        p.headPivot.rotation.x = -0.2;
        break;
      }
      default: {
        // Idle: a slow breath plus an occasional weight shift.
        this.phase += dt * 1.3;
        const b = Math.sin(this.phase);
        p.body.position.y = b * 0.018;
        p.body.rotation.z = damp(p.body.rotation.z, Math.sin(this.phase * 0.31) * 0.04, 3, dt);
        p.armL.rotation.x = damp(p.armL.rotation.x, b * 0.07, 6, dt);
        p.armR.rotation.x = damp(p.armR.rotation.x, -b * 0.07, 6, dt);
        p.armL.rotation.z = damp(p.armL.rotation.z, 0.07, 6, dt);
        p.armR.rotation.z = damp(p.armR.rotation.z, -0.07, 6, dt);
        p.legL.rotation.x = damp(p.legL.rotation.x, 0, 6, dt);
        p.legR.rotation.x = damp(p.legR.rotation.x, 0, 6, dt);
        p.headPivot.rotation.x = damp(p.headPivot.rotation.x, b * 0.03, 4, dt);
        p.body.rotation.x = damp(p.body.rotation.x, 0, 6, dt);
        p.body.rotation.y = damp(p.body.rotation.y, 0, 6, dt);
        break;
      }
    }
  }
}

/**
 * A floating name tag. Canvas-drawn so it needs no font loading and stays
 * crisp — sprites are cheap enough to give every islander one.
 */
export function createLabel(text, { color = "#f3e3c2", sub = "" } = {}) {
  const canvas = document.createElement("canvas");
  const w = 512, h = sub ? 160 : 110;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(13,31,51,0.78)";
  const pad = 10;
  const r = 22;
  ctx.beginPath();
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(224,167,51,0.7)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = "600 46px -apple-system, Helvetica, sans-serif";
  ctx.fillText(text, w / 2, sub ? 70 : 72);
  if (sub) {
    ctx.fillStyle = "rgba(224,167,51,0.95)";
    ctx.font = "500 30px -apple-system, Helvetica, sans-serif";
    ctx.fillText(sub, w / 2, 116);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
  }));
  sprite.scale.set(2.4, 2.4 * (h / w), 1);
  sprite.renderOrder = 50;
  return sprite;
}
