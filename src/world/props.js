import { TAU, range, makeRng } from "../core/utils.js";
import { box, cyl, cone, ico, sphere, at, merge, groundAt, vary } from "./geom.js";

/**
 * The scenery kit.
 *
 * Every builder returns `{ geo, collider }` where the geometry is baked at the
 * origin with its base on y = 0, and the collider is the cylinder the player
 * bumps into (or null for things you can walk through, like grass tufts).
 * The island builder transforms and merges them wholesale.
 */

export const palm = (rng, p) => {
  const h = range(rng, 7, 12);
  const lean = range(rng, 0.06, 0.22);
  const dir = rng() * TAU;
  const parts = [];

  // Trunk as a stack of short segments so it can curve.
  const segs = 6;
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const segH = h / segs;
    const r = 0.42 * (1 - t * 0.45);
    const off = lean * segH * t * 3;
    x += Math.cos(dir) * off;
    z += Math.sin(dir) * off;
    parts.push(at(cyl(r * 0.92, r, segH * 1.06, vary(p.trunk, rng), 6), {
      x, y: y + segH / 2, z,
      rz: -Math.cos(dir) * lean * t * 2,
      rx: Math.sin(dir) * lean * t * 2,
    }));
    y += segH;
  }

  // Fronds: flattened cones fanned around the crown.
  const fronds = 7 + Math.floor(rng() * 3);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * TAU + rng() * 0.4;
    const droop = range(rng, 0.55, 1.0);
    const len = range(rng, 3.6, 5.4);
    parts.push(at(cone(0.95, len, vary(p.leaf, rng, 0.1), 4), {
      x: x + Math.cos(a) * len * 0.42,
      y: y + 0.4 - droop * 0.9,
      z: z + Math.sin(a) * len * 0.42,
      rx: Math.sin(a) * (Math.PI / 2 - droop),
      rz: -Math.cos(a) * (Math.PI / 2 - droop),
      sy: 1, sx: 0.34, sz: 1,
    }));
  }
  // Coconuts
  if (rng() > 0.45) {
    for (let i = 0; i < 3; i++) {
      const a = rng() * TAU;
      parts.push(at(ico(0.34, 0x6b4a2a), { x: x + Math.cos(a) * 0.5, y: y - 0.3, z: z + Math.sin(a) * 0.5 }));
    }
  }
  return { geo: groundAt(merge(parts)), collider: { r: 0.75, h } };
};

export const broadleaf = (rng, p) => {
  const h = range(rng, 5, 9);
  const parts = [at(cyl(0.34, 0.55, h, vary(p.trunk, rng), 6), { y: h / 2 })];
  const blobs = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * TAU;
    const r = range(rng, 1.9, 3.1);
    parts.push(at(ico(r, vary(p.leaf, rng, 0.12), 0), {
      x: Math.cos(a) * range(rng, 0.5, 1.8),
      y: h + range(rng, -0.6, 1.4),
      z: Math.sin(a) * range(rng, 0.5, 1.8),
      sy: 0.78,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: 0.8, h } };
};

export const pine = (rng, p) => {
  const h = range(rng, 8, 15);
  const parts = [at(cyl(0.3, 0.5, h * 0.4, vary(p.trunk, rng), 6), { y: h * 0.2 })];
  const tiers = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (1 - t) * range(rng, 2.4, 3.4) + 0.7;
    parts.push(at(cone(r, h * 0.42, vary(p.leaf, rng, 0.1), 7), { y: h * (0.25 + t * 0.62) }));
    if (p.snow) parts.push(at(cone(r * 0.62, h * 0.13, 0xf2f7fb, 7), { y: h * (0.25 + t * 0.62) + h * 0.17 }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: 0.9, h } };
};

export const cactus = (rng, p) => {
  const h = range(rng, 3.5, 7);
  const col = vary(p.leaf, rng, 0.1);
  const parts = [at(cyl(0.55, 0.65, h, col, 7), { y: h / 2 })];
  const arms = Math.floor(rng() * 3);
  for (let i = 0; i < arms; i++) {
    const a = rng() * TAU;
    const ay = range(rng, h * 0.35, h * 0.7);
    const armLen = range(rng, 1.2, 2.2);
    parts.push(at(cyl(0.34, 0.34, armLen, col, 6), {
      x: Math.cos(a) * armLen * 0.5, y: ay, z: Math.sin(a) * armLen * 0.5,
      rz: -Math.cos(a) * Math.PI / 2, rx: Math.sin(a) * Math.PI / 2,
    }));
    parts.push(at(cyl(0.32, 0.34, armLen * 1.1, col, 6), {
      x: Math.cos(a) * armLen, y: ay + armLen * 0.55, z: Math.sin(a) * armLen,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: 0.8, h } };
};

export const rock = (rng, p) => {
  const r = range(rng, 0.8, 2.8);
  const parts = [at(ico(r, vary(p.stone, rng, 0.1), 0), { sy: range(rng, 0.6, 1.0), ry: rng() * TAU })];
  if (rng() > 0.5) {
    parts.push(at(ico(r * 0.6, vary(p.stone, rng, 0.1), 0), {
      x: range(rng, -r, r), z: range(rng, -r, r), ry: rng() * TAU,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: r * 0.9, h: r * 1.4 } };
};

export const boulder = (rng, p) => {
  const r = range(rng, 3.5, 7);
  const parts = [at(ico(r, vary(p.stone, rng, 0.08), 1), { sy: range(rng, 0.55, 0.85), ry: rng() * TAU })];
  return { geo: groundAt(merge(parts)), collider: { r: r * 0.85, h: r } };
};

export const barrel = (rng, p) => {
  const h = 1.3;
  const parts = [
    at(cyl(0.5, 0.5, h, vary(p.wood, rng), 9), { y: h / 2 }),
    at(cyl(0.54, 0.54, 0.16, 0x4a3320, 9), { y: h * 0.25 }),
    at(cyl(0.54, 0.54, 0.16, 0x4a3320, 9), { y: h * 0.78 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 0.6, h } };
};

export const crate = (rng, p) => {
  const s = range(rng, 0.9, 1.4);
  const c = vary(p.wood, rng);
  const parts = [
    at(box(s, s, s, c), { y: s / 2, ry: rng() * 0.5 }),
    at(box(s * 1.02, s * 0.12, s * 0.12, 0x3f2c1a), { y: s * 0.75, ry: rng() * 0.5 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: s * 0.75, h: s } };
};

export const house = (rng, p) => {
  const w = range(rng, 5, 9);
  const d = range(rng, 5, 8);
  const h = range(rng, 3.4, 5.2);
  const wall = vary(p.wall, rng, 0.08);
  const roof = vary(p.roof, rng, 0.08);
  const parts = [
    at(box(w, h, d, wall), { y: h / 2 }),
    at(cone(Math.max(w, d) * 0.78, h * 0.62, roof, 4), { y: h + h * 0.31, ry: Math.PI / 4 }),
    at(box(1.1, 2.1, 0.16, p.wood), { y: 1.05, z: d / 2 + 0.02 }),           // door
    at(box(1.0, 1.0, 0.14, 0x8fc2d8), { x: w * 0.28, y: h * 0.62, z: d / 2 + 0.02 }), // window
    at(box(1.0, 1.0, 0.14, 0x8fc2d8), { x: -w * 0.28, y: h * 0.62, z: d / 2 + 0.02 }),
  ];
  if (rng() > 0.5) {
    parts.push(at(box(0.8, 1.8, 0.8, p.stone), { x: w * 0.3, y: h + h * 0.5, z: -d * 0.2 }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: Math.max(w, d) * 0.55, h, box: { w, d } } };
};

export const hut = (rng, p) => {
  const r = range(rng, 2.6, 4);
  const h = range(rng, 2.4, 3.4);
  const parts = [
    at(cyl(r, r * 1.05, h, vary(p.wall, rng), 8), { y: h / 2 }),
    at(cone(r * 1.35, h * 0.85, vary(p.thatch || p.roof, rng), 8), { y: h + h * 0.42 }),
    at(box(1.1, 1.9, 0.2, 0x4a3320), { y: 0.95, z: r * 0.98 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: r * 1.05, h } };
};

export const windmill = (rng, p) => {
  const h = 11;
  const parts = [
    at(cyl(2.1, 3.0, h, vary(p.wall, rng), 9), { y: h / 2 }),
    at(cone(3.3, 2.6, vary(p.roof, rng), 9), { y: h + 1.3 }),
    at(box(1.0, 2.0, 0.2, 0x4a3320), { y: 1.0, z: 2.9 }),
  ];
  const bladeY = h * 0.82;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    parts.push(at(box(0.9, 7.0, 0.22, vary(p.wood, rng)), {
      x: Math.sin(a) * 3.6, y: bladeY + Math.cos(a) * 3.6, z: 3.3, rz: -a,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: 3.1, h } };
};

export const lamppost = (rng, p) => {
  const h = 4.2;
  const parts = [
    at(cyl(0.14, 0.22, h, 0x2b2b2b, 6), { y: h / 2 }),
    at(box(0.7, 0.8, 0.7, 0xffe9a8), { y: h + 0.4 }),
    at(cone(0.6, 0.45, 0x2b2b2b, 4), { y: h + 1.0 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 0.3, h } };
};

export const signpost = (rng, p) => {
  const parts = [
    at(cyl(0.13, 0.15, 2.6, vary(p.wood, rng), 6), { y: 1.3 }),
    at(box(1.9, 0.5, 0.14, vary(p.wood, rng)), { y: 2.1, ry: range(rng, -0.3, 0.3) }),
    at(box(1.6, 0.42, 0.14, vary(p.wood, rng)), { y: 1.55, ry: range(rng, -0.3, 0.3) }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 0.3, h: 2.6 } };
};

export const fence = (rng, p) => {
  const c = vary(p.wood, rng);
  const parts = [
    at(cyl(0.1, 0.12, 1.5, c, 5), { x: -1.5, y: 0.75 }),
    at(cyl(0.1, 0.12, 1.5, c, 5), { x: 1.5, y: 0.75 }),
    at(box(3.2, 0.16, 0.1, c), { y: 1.15 }),
    at(box(3.2, 0.16, 0.1, c), { y: 0.65 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 1.6, h: 1.3, thin: true } };
};

export const tent = (rng, p) => {
  const parts = [
    at(cone(2.6, 3.0, vary(p.accent || p.roof, rng), 6), { y: 1.5 }),
    at(box(1.0, 1.5, 0.1, 0x2b2b2b), { y: 0.75, z: 2.1 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 2.4, h: 3 } };
};

export const watchtower = (rng, p) => {
  const h = 9;
  const parts = [
    at(box(3.4, h, 3.4, vary(p.stone, rng)), { y: h / 2 }),
    at(box(4.2, 0.8, 4.2, vary(p.stone, rng, 0.03)), { y: h + 0.4 }),
    at(box(1.0, 1.6, 0.2, 0x3d2b18), { y: 0.8, z: 1.75 }),
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    parts.push(at(box(0.9, 1.0, 0.9, vary(p.stone, rng, 0.03)), {
      x: Math.cos(a) * 1.7, y: h + 1.3, z: Math.sin(a) * 1.7,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: 2.4, h } };
};

export const cannon = (rng, p) => {
  const parts = [
    at(box(1.6, 0.5, 1.0, vary(p.wood, rng)), { y: 0.45 }),
    at(cyl(0.28, 0.36, 2.2, 0x2f2f33, 8), { y: 0.95, rx: Math.PI / 2 - 0.12 }),
    at(cyl(0.4, 0.4, 0.2, 0x1f1f22, 8), { y: 0.3, x: 0.7, rz: Math.PI / 2 }),
    at(cyl(0.4, 0.4, 0.2, 0x1f1f22, 8), { y: 0.3, x: -0.7, rz: Math.PI / 2 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 1.1, h: 1.2 } };
};

export const flagpole = (rng, p) => {
  const h = 8;
  const parts = [
    at(cyl(0.12, 0.16, h, 0xd8cfc0, 6), { y: h / 2 }),
    at(box(2.4, 1.5, 0.08, p.accent || 0xc8452f), { x: 1.2, y: h - 1.1 }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 0.3, h } };
};

export const grassTuft = (rng, p) => {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(at(cone(0.16, range(rng, 0.5, 1.0), vary(p.leaf, rng, 0.15), 3), {
      x: range(rng, -0.3, 0.3), z: range(rng, -0.3, 0.3), y: 0.35,
      rx: range(rng, -0.3, 0.3), rz: range(rng, -0.3, 0.3),
    }));
  }
  return { geo: groundAt(merge(parts)), collider: null };
};

export const iceSpire = (rng, p) => {
  const h = range(rng, 4, 11);
  const parts = [
    at(cone(range(rng, 1.2, 2.4), h, 0xcfe8f5, 6), { y: h / 2, ry: rng() * TAU }),
  ];
  return { geo: groundAt(merge(parts)), collider: { r: 1.4, h } };
};

export const coral = (rng, p) => {
  const parts = [];
  const c = [0xe07a8a, 0xe0b33a, 0x7ad0c8][Math.floor(rng() * 3)];
  for (let i = 0; i < 5; i++) {
    const a = rng() * TAU;
    parts.push(at(cyl(0.12, 0.3, range(rng, 1, 2.4), c, 5), {
      x: Math.cos(a) * 0.5, z: Math.sin(a) * 0.5, y: 0.9,
      rx: range(rng, -0.5, 0.5), rz: range(rng, -0.5, 0.5),
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: 0.9, h: 2 } };
};

export const deadTree = (rng, p) => {
  const h = range(rng, 6, 11);
  const bark = vary(p.deadWood || 0x4a423a, rng, 0.12);
  const parts = [at(cyl(0.3, 0.7, h, bark, 6), { y: h / 2, rz: range(rng, -0.08, 0.08) })];
  // Bare limbs, thrown out at mean angles — the silhouette does the haunting.
  const limbs = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * TAU + rng() * 0.7;
    const len = range(rng, 2.2, 4.4);
    const ly = range(rng, h * 0.45, h * 0.95);
    parts.push(at(cyl(0.12, 0.26, len, bark, 5), {
      x: Math.cos(a) * len * 0.36, y: ly, z: Math.sin(a) * len * 0.36,
      rz: -Math.cos(a) * 1.05, rx: Math.sin(a) * 1.05,
    }));
    if (rng() > 0.4) {
      parts.push(at(cyl(0.07, 0.13, len * 0.6, bark, 4), {
        x: Math.cos(a) * len * 0.75, y: ly + len * 0.35, z: Math.sin(a) * len * 0.75,
        rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5,
      }));
    }
  }
  return { geo: groundAt(merge(parts)), collider: { r: 0.8, h } };
};

export const gravestone = (rng, p) => {
  const h = range(rng, 1.1, 1.9);
  const stone = vary(p.stone, rng, 0.1);
  const lean = range(rng, -0.22, 0.22);
  const parts = [
    at(box(1.0, h, 0.22, stone), { y: h / 2, rz: lean }),
    at(box(1.3, 0.18, 0.5, stone), { y: 0.09 }),
  ];
  if (rng() > 0.5) parts.push(at(box(0.55, 0.2, 0.24, stone), { y: h * 0.72, rz: lean }));
  return { geo: groundAt(merge(parts)), collider: { r: 0.6, h } };
};

/** A mangrove big enough to build a town in. */
export const mangrove = (rng, p) => {
  const h = range(rng, 30, 52);
  const trunkR = h * 0.055;
  const bark = vary(p.trunk, rng, 0.08);
  const parts = [at(cyl(trunkR * 0.55, trunkR, h, bark, 8), { y: h / 2 })];

  // Stilt roots: the reason a mangrove reads as a mangrove.
  const roots = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * TAU + rng() * 0.3;
    const reach = trunkR * range(rng, 2.6, 4.2);
    parts.push(at(cyl(trunkR * 0.2, trunkR * 0.42, reach * 1.7, bark, 5), {
      x: Math.cos(a) * reach * 0.5, y: reach * 0.62, z: Math.sin(a) * reach * 0.5,
      rz: -Math.cos(a) * 0.55, rx: Math.sin(a) * 0.55,
    }));
  }
  // Canopy
  const blobs = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * TAU;
    parts.push(at(ico(range(rng, h * 0.16, h * 0.26), vary(p.leaf, rng, 0.12), 0), {
      x: Math.cos(a) * h * 0.16, y: h + range(rng, -h * 0.06, h * 0.1), z: Math.sin(a) * h * 0.16,
      sy: 0.72,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: { r: trunkR * 2.4, h } };
};

/** Decorative cloud-stuff for a sky island. Walk straight through it. */
export const cloudPuff = (rng, p) => {
  const parts = [];
  const blobs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    parts.push(at(ico(range(rng, 1.4, 3.2), 0xf4f8fb, 0), {
      x: range(rng, -2.4, 2.4), y: range(rng, 0.4, 1.6), z: range(rng, -2.4, 2.4), sy: 0.55,
    }));
  }
  return { geo: groundAt(merge(parts)), collider: null };
};

export const PROPS = {
  deadTree, gravestone, mangrove, cloudPuff,
  palm, broadleaf, pine, cactus, rock, boulder, barrel, crate, house, hut,
  windmill, lamppost, signpost, fence, tent, watchtower, cannon, flagpole,
  grassTuft, iceSpire, coral,
};

/** Build a prop by name with a deterministic seed. */
export function buildProp(name, seed, palette) {
  const fn = PROPS[name];
  if (!fn) throw new Error("unknown prop: " + name);
  return fn(makeRng(seed), palette);
}
