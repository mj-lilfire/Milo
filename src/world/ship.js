import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { clamp, lerp } from "../core/utils.js";
import { box, cyl, cone, ico, sphere, at, merge, propMaterial, paint, flatten } from "./geom.js";

/**
 * The player's caravel.
 *
 * Local axes: +Z is the bow, +X starboard, Y up. The deck is a walkable
 * surface described by `deckHeight` / `clampToDeck` rather than real collision
 * geometry — on a hull that is pitching and rolling under the player, an
 * analytic deck is both cheaper and far less prone to flinging them into the
 * sea than a mesh query.
 */

export const SHIP = {
  length: 22,
  beam: 8,
  deckY: 2.2,
  sternDeckY: 3.4,
  helm: new THREE.Vector3(0, 3.4, -6.8),
  mastX: 0,
  mastZ: 1.2,
  boardPoint: new THREE.Vector3(0, 2.2, 4.4),
  crewStations: [
    new THREE.Vector3(-2.6, 2.2, 3.4),
    new THREE.Vector3(2.6, 2.2, 3.0),
    new THREE.Vector3(-2.8, 2.2, -1.6),
    new THREE.Vector3(2.9, 2.2, -2.2),
    new THREE.Vector3(-1.6, 2.2, 6.2),
    new THREE.Vector3(1.8, 2.2, 6.6),
    new THREE.Vector3(0, 3.4, -5.4),
  ],
};

/** Half-width of the hull at a given distance along the keel. */
export function halfBeamAt(z) {
  const t = clamp(Math.abs(z) / (SHIP.length / 2), 0, 1);
  // Fine at the bow, fuller amidships, slightly tucked at the stern.
  const taper = z > 0 ? 1 - Math.pow(t, 2.1) * 0.92 : 1 - Math.pow(t, 2.6) * 0.55;
  return (SHIP.beam / 2) * Math.max(taper, 0.08);
}

/** Walkable height at a local deck position. */
export function deckHeight(x, z) {
  if (z < -4.6) return SHIP.sternDeckY;
  if (z < -3.2) return lerp(SHIP.deckY, SHIP.sternDeckY, (z + 3.2) / -1.4);
  return SHIP.deckY;
}

/** Keep a local position inside the bulwarks. Mutates and returns the vector. */
export function clampToDeck(v) {
  v.z = clamp(v.z, -SHIP.length / 2 + 1.5, SHIP.length / 2 - 1.3);
  const limit = Math.max(halfBeamAt(v.z) - 0.75, 0.35);
  v.x = clamp(v.x, -limit, limit);

  // Push out of the mast rather than letting the player stand inside it.
  const dx = v.x - SHIP.mastX;
  const dz = v.z - SHIP.mastZ;
  const d = Math.hypot(dx, dz);
  if (d < 0.85 && d > 0.0001) {
    v.x = SHIP.mastX + (dx / d) * 0.85;
    v.z = SHIP.mastZ + (dz / d) * 0.85;
  }
  return v;
}

function jollyRogerTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 176;
  const g = c.getContext("2d");
  g.fillStyle = "#14141c";
  g.fillRect(0, 0, 256, 176);
  g.fillStyle = "#f4f1e8";

  // Crossbones
  g.save();
  g.translate(128, 96);
  for (const rot of [-0.6, 0.6]) {
    g.save();
    g.rotate(rot);
    g.fillRect(-62, -6, 124, 12);
    for (const ex of [-62, 62]) {
      g.beginPath();
      g.arc(ex, -8, 11, 0, Math.PI * 2);
      g.arc(ex, 8, 11, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  g.restore();

  // Skull
  g.beginPath();
  g.ellipse(128, 78, 42, 38, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(108, 104, 40, 20);
  g.fillStyle = "#14141c";
  g.beginPath();
  g.ellipse(113, 76, 11, 13, 0, 0, Math.PI * 2);
  g.ellipse(143, 76, 11, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(124, 96, 8, 12);
  for (let i = 0; i < 3; i++) g.fillRect(112 + i * 13, 108, 5, 14);

  // Straw hat over the skull
  g.fillStyle = "#e8c86a";
  g.beginPath();
  g.ellipse(128, 44, 62, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(100, 20, 56, 24);
  g.fillStyle = "#c23b2e";
  g.fillRect(100, 34, 56, 9);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the ship. Returns a group plus the handles sailing code animates:
 * sails, flag, rudder, wake and the wheel.
 */
export function createShip() {
  const group = new THREE.Group();
  const material = propMaterial();

  const HULL = 0x7a4a26;
  const HULL_DARK = 0x5c3619;
  const DECK = 0xc29a5f;
  const TRIM = 0xe8d5a8;
  const RAIL = 0x8a5a2a;

  const parts = [];

  // --- hull: stacked cross-sections along the keel ------------------------
  const segs = 11;
  for (let i = 0; i < segs; i++) {
    const z0 = -SHIP.length / 2 + (i / segs) * SHIP.length;
    const z1 = -SHIP.length / 2 + ((i + 1) / segs) * SHIP.length;
    const zc = (z0 + z1) / 2;
    const w = halfBeamAt(zc) * 2;
    const depth = 3.0 - Math.pow(Math.abs(zc) / (SHIP.length / 2), 2) * 1.1;
    parts.push(at(box(w, depth, z1 - z0 + 0.05, i % 2 ? HULL : HULL_DARK), {
      y: SHIP.deckY - depth / 2, z: zc,
    }));
  }
  // Keel and a stripe of trim along the waterline.
  parts.push(at(box(0.7, 0.5, SHIP.length * 0.94, HULL_DARK), { y: -0.5 }));
  for (const side of [-1, 1]) {
    for (let i = 0; i < segs; i++) {
      const zc = -SHIP.length / 2 + ((i + 0.5) / segs) * SHIP.length;
      const hw = halfBeamAt(zc);
      parts.push(at(box(0.18, 0.34, SHIP.length / segs + 0.05, TRIM), {
        x: side * hw, y: SHIP.deckY - 0.55, z: zc,
      }));
    }
  }

  // --- decks ---------------------------------------------------------------
  for (let i = 0; i < segs; i++) {
    const zc = -SHIP.length / 2 + ((i + 0.5) / segs) * SHIP.length;
    const w = halfBeamAt(zc) * 2 - 0.3;
    parts.push(at(box(w, 0.18, SHIP.length / segs + 0.05, i % 2 ? DECK : 0xb98d52), {
      y: SHIP.deckY - 0.09, z: zc,
    }));
  }
  // Raised quarterdeck at the stern.
  parts.push(at(box(halfBeamAt(-7) * 2 - 0.5, 0.2, 5.4, DECK), { y: SHIP.sternDeckY - 0.1, z: -6.9 }));
  parts.push(at(box(halfBeamAt(-5) * 2 - 0.8, 1.3, 0.3, HULL), { y: SHIP.deckY + 0.6, z: -4.7 }));
  // Steps up to it.
  const stepCount = 5;
  for (let i = 0; i < stepCount; i++) {
    const t = (i + 1) / stepCount;
    parts.push(at(box(1.8, 0.16, 0.46, DECK), {
      y: SHIP.deckY + (SHIP.sternDeckY - SHIP.deckY) * t - 0.08,
      z: -3.2 - i * 0.42,
    }));
  }

  // --- bulwarks ------------------------------------------------------------
  for (const side of [-1, 1]) {
    for (let i = 0; i < segs; i++) {
      const zc = -SHIP.length / 2 + ((i + 0.5) / segs) * SHIP.length;
      const hw = halfBeamAt(zc);
      const base = zc < -4.6 ? SHIP.sternDeckY : SHIP.deckY;
      parts.push(at(box(0.22, 0.95, SHIP.length / segs + 0.05, RAIL), {
        x: side * (hw - 0.1), y: base + 0.48, z: zc,
      }));
      parts.push(at(box(0.34, 0.14, SHIP.length / segs + 0.05, TRIM), {
        x: side * (hw - 0.1), y: base + 1.0, z: zc,
      }));
    }
  }

  // --- bow: stem post and ram figurehead ----------------------------------
  parts.push(at(box(0.5, 2.6, 1.6, HULL_DARK), { y: SHIP.deckY + 0.5, z: 10.3, rx: -0.35 }));
  const headZ = 11.2, headY = SHIP.deckY + 1.5;
  parts.push(at(ico(0.95, TRIM, 0), { y: headY, z: headZ, sz: 1.35 }));
  parts.push(at(cone(0.42, 0.9, TRIM, 5), { y: headY - 0.25, z: headZ + 1.0, rx: Math.PI / 2 }));
  for (const side of [-1, 1]) {
    parts.push(at(cyl(0.12, 0.2, 1.1, 0xd8c090, 5), {
      x: side * 0.7, y: headY + 0.55, z: headZ - 0.15, rz: side * 0.9, rx: -0.4,
    }));
    parts.push(at(sphere(0.13, 0x1a1a1a, 6), { x: side * 0.42, y: headY + 0.2, z: headZ + 0.72 }));
  }
  // Bowsprit
  parts.push(at(cyl(0.13, 0.18, 5.0, RAIL, 6), { y: SHIP.deckY + 1.9, z: 12.0, rx: Math.PI / 2 - 0.22 }));

  // --- stern cabin ---------------------------------------------------------
  // A cabin tucked beneath the raised quarterdeck — its roof IS that deck, so
  // the helmsman is standing on it rather than inside it.
  const cabinH = SHIP.sternDeckY - SHIP.deckY;
  parts.push(at(box(5.4, cabinH, 3.6, HULL), { y: SHIP.deckY + cabinH / 2, z: -9.2 }));
  parts.push(at(box(0.9, cabinH * 0.85, 0.14, 0x4a3320), { y: SHIP.deckY + cabinH * 0.42, z: -7.38 }));
  for (const side of [-1, 1]) {
    parts.push(at(box(0.8, 0.6, 0.12, 0x9fd0e0), {
      x: side * 1.5, y: SHIP.deckY + cabinH * 0.55, z: -11.02,
    }));
  }
  // Stern lantern, on the taffrail behind the wheel.
  parts.push(at(cyl(0.1, 0.12, 0.8, 0x2b2b2b, 5), { y: SHIP.sternDeckY + 0.5, z: -9.3 }));
  parts.push(at(box(0.46, 0.6, 0.46, 0xffe9a8), { y: SHIP.sternDeckY + 1.1, z: -9.3 }));

  // --- deck clutter --------------------------------------------------------
  const clutter = [
    { g: cyl(0.5, 0.5, 1.2, 0x8a5a2a, 9), x: -2.4, z: -1.0 },
    { g: cyl(0.5, 0.5, 1.2, 0x8a5a2a, 9), x: -2.4, z: 0.3 },
    { g: box(1.2, 1.0, 1.2, 0x6b4a2a), x: 2.6, z: -1.2 },
    { g: box(0.9, 0.8, 0.9, 0x6b4a2a), x: 2.7, z: 0.2 },
    { g: cyl(0.28, 0.3, 0.7, 0xd8c090, 8), x: -1.9, z: 5.4 },
  ];
  for (const c of clutter) {
    c.g.computeBoundingBox();
    const h = c.g.boundingBox.max.y - c.g.boundingBox.min.y;
    parts.push(at(c.g, { x: c.x, z: c.z, y: SHIP.deckY + h / 2 }));
  }

  // Hatch and capstan
  parts.push(at(box(2.2, 0.12, 2.2, 0x6b4a2a), { y: SHIP.deckY + 0.06, z: 3.6 }));
  parts.push(at(cyl(0.45, 0.6, 0.9, RAIL, 8), { y: SHIP.deckY + 0.45, z: 7.6 }));

  group.add(new THREE.Mesh(merge(parts), material));

  // --- mast, spars and rigging --------------------------------------------
  const rig = [];
  const mastH = 15;
  rig.push(at(cyl(0.26, 0.4, mastH, RAIL, 8), { x: SHIP.mastX, y: SHIP.deckY + mastH / 2, z: SHIP.mastZ }));
  rig.push(at(box(11.5, 0.26, 0.26, RAIL), { y: SHIP.deckY + mastH * 0.78, z: SHIP.mastZ }));
  rig.push(at(box(8.5, 0.22, 0.22, RAIL), { y: SHIP.deckY + mastH * 0.47, z: SHIP.mastZ }));
  // Crow's nest
  rig.push(at(cyl(1.15, 0.95, 0.7, RAIL, 9), { y: SHIP.deckY + mastH * 0.86, z: SHIP.mastZ }));
  // Shrouds: each one is solved from where it is made fast on the rail to
  // where it meets the mast, so they land on the ship instead of hanging in
  // the air near it.
  const shroudTop = SHIP.deckY + mastH * 0.78;
  const rise = shroudTop - SHIP.deckY - 0.3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const foot = side * (1.7 + i * 0.8);
      const length = Math.hypot(foot, rise);
      rig.push(at(cyl(0.04, 0.04, length, 0x3a2a1c, 4), {
        x: SHIP.mastX + foot / 2,
        y: SHIP.deckY + 0.3 + rise / 2,
        z: SHIP.mastZ,
        rz: Math.atan2(foot, rise),
      }));
    }
  }
  group.add(new THREE.Mesh(merge(rig), material));

  // --- sails (animated separately so they can furl) ------------------------
  const sailMat = new THREE.MeshLambertMaterial({
    color: 0xf2ead6, side: THREE.DoubleSide, vertexColors: true,
  });

  const mainSail = new THREE.Mesh(
    paint(flatten(new THREE.PlaneGeometry(10.8, 7.6, 8, 6)), 0xf5efdd),
    sailMat
  );
  mainSail.position.set(SHIP.mastX, SHIP.deckY + mastH * 0.6, SHIP.mastZ - 0.35);
  group.add(mainSail);

  const topSail = new THREE.Mesh(
    paint(flatten(new THREE.PlaneGeometry(7.8, 4.2, 6, 4)), 0xf5efdd),
    sailMat
  );
  topSail.position.set(SHIP.mastX, SHIP.deckY + mastH * 0.315, SHIP.mastZ - 0.3);
  group.add(topSail);

  const jib = new THREE.Mesh(
    paint(flatten(new THREE.PlaneGeometry(4.4, 5.0, 4, 4)), 0xeee6d0),
    sailMat
  );
  // Forward and high, hung off the bowsprit: anywhere lower and it fills the
  // view of a player standing amidships.
  jib.position.set(0, SHIP.deckY + 6.4, 10.4);
  jib.rotation.y = Math.PI / 2;
  jib.rotation.x = 0.12;
  group.add(jib);

  // Save rest positions so wind animation can work from a known base.
  for (const s of [mainSail, topSail, jib]) {
    s.userData.base = s.geometry.attributes.position.array.slice();
  }

  // --- flag ---------------------------------------------------------------
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.5, 8, 5),
    new THREE.MeshBasicMaterial({ map: jollyRogerTexture(), side: THREE.DoubleSide })
  );
  flag.position.set(SHIP.mastX + 1.15, SHIP.deckY + mastH - 0.9, SHIP.mastZ);
  flag.userData.base = flag.geometry.attributes.position.array.slice();
  group.add(flag);

  // --- ship's wheel --------------------------------------------------------
  const wheelGroup = new THREE.Group();
  wheelGroup.position.copy(SHIP.helm);
  const wheelParts = [at(cyl(0.09, 0.11, 1.0, RAIL, 6), { y: -0.5 })];
  const hub = [];
  hub.push(at(cyl(0.16, 0.16, 0.22, 0x4a3320, 8), { rz: Math.PI / 2 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    hub.push(at(box(0.08, 1.16, 0.08, RAIL), { rz: a + Math.PI / 2, x: 0, y: 0 }));
    hub.push(at(box(0.11, 0.28, 0.11, TRIM), {
      x: Math.cos(a) * 0.66, y: Math.sin(a) * 0.66, rz: a + Math.PI / 2,
    }));
  }
  const wheel = new THREE.Mesh(merge(hub), material);
  wheel.position.y = 0.55;
  wheelGroup.add(wheel);
  wheelGroup.add(new THREE.Mesh(merge(wheelParts), material));
  group.add(wheelGroup);

  // --- rudder --------------------------------------------------------------
  const rudder = new THREE.Mesh(at(box(0.22, 2.4, 1.5, HULL_DARK), { y: -1.0, z: -0.4 }), material);
  rudder.position.set(0, SHIP.deckY - 1.2, -SHIP.length / 2 - 0.1);
  group.add(rudder);

  // --- wake and bow foam ---------------------------------------------------
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true,
  });
  const bowFoam = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 7, 1, true), foamMat);
  bowFoam.rotation.x = -Math.PI / 2;
  bowFoam.position.set(0, 0.12, 7.5);
  group.add(bowFoam);

  const wakeGeo = new THREE.PlaneGeometry(7, 34, 1, 8);
  wakeGeo.rotateX(-Math.PI / 2);
  const wakeMat = foamMat.clone();
  // Fade the trail out along its length so it dissolves instead of stopping.
  const alpha = [];
  const pos = wakeGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getZ(i) + 17) / 34;
    const v = clamp(1 - t, 0, 1);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v;
    alpha.push(v);
  }
  wakeGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  wakeMat.vertexColors = true;
  const wake = new THREE.Mesh(wakeGeo, wakeMat);
  wake.position.set(0, 0.1, -SHIP.length / 2 - 15);
  group.add(wake);

  return {
    group,
    wheelGroup,
    wheel,
    rudder,
    sails: { main: mainSail, top: topSail, jib },
    flag,
    bowFoam,
    wake,
    material,
    sailMat,
  };
}

/**
 * Per-frame ship dressing: wind in the canvas, a turning wheel, rudder angle
 * and foam that responds to speed.
 * @param {number} throttle 0..1  @param {number} rudder -1..1  @param {number} speed
 */
export function animateShip(ship, time, dt, { throttle = 0, rudder = 0, speed = 0 } = {}) {
  const ripple = (mesh, amp, freq, scaleY = 1) => {
    const attr = mesh.geometry.attributes.position;
    const base = mesh.userData.base;
    for (let i = 0; i < attr.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      attr.setY(i, y * scaleY);
      attr.setZ(i, Math.sin(x * freq + time * 3.1) * amp * (0.4 + Math.abs(x) * 0.14)
        + Math.sin(y * freq * 1.7 + time * 2.3) * amp * 0.4);
    }
    attr.needsUpdate = true;
  };

  // Sails belly out under way and hang slack at anchor.
  const fill = 0.25 + throttle * 0.75;
  ripple(ship.sails.main, 0.16 + fill * 0.32, 0.55, fill);
  ripple(ship.sails.top, 0.12 + fill * 0.26, 0.7, fill);
  ripple(ship.sails.jib, 0.1 + fill * 0.2, 0.8, 1);
  ripple(ship.flag, 0.22, 1.5, 1);

  ship.wheel.rotation.z = -rudder * 1.9;
  ship.rudder.rotation.y = rudder * 0.5;

  const s = clamp(Math.abs(speed) / 16, 0, 1);
  ship.bowFoam.material.opacity = s * 0.5;
  ship.bowFoam.scale.set(0.6 + s * 0.7, 0.5 + s * 0.9, 1);
  ship.wake.material.opacity = s * 0.42;
  ship.wake.scale.set(0.5 + s * 0.8, 1, 0.4 + s * 0.9);
}
