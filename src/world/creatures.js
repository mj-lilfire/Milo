import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, makeRng, range } from "../core/utils.js";
import { box, cyl, cone, ico, sphere, at, merge, propMaterial } from "./geom.js";

/**
 * Things that live in the sea.
 *
 * The sea king is built as a head plus a chain of body segments. Rather than
 * animating the chain with a formula, each segment samples where the head was
 * a moment ago, so the body genuinely follows the head through its turns and
 * dives. That one trick is most of why it reads as a living animal instead of
 * a wiggling tube.
 */

const SEGMENT_COUNT = 13;
const SEGMENT_GAP = 4.3;          // world units between segments
const TRAIL_SAMPLES = 260;

export function createSeaKing(seed = 1, palette = {}) {
  const rng = makeRng(seed);
  const material = propMaterial();
  const group = new THREE.Group();

  const hide = palette.hide ?? 0x2f6a5e;
  const belly = palette.belly ?? 0xcfc08a;
  const spine = palette.spine ?? 0x1f4a44;

  // --- head ---------------------------------------------------------------
  const headGroup = new THREE.Group();
  const headParts = [
    at(box(4.6, 3.4, 7.4, hide), { z: 1.0 }),
    at(cone(2.6, 4.2, hide, 6), { z: 5.6, rx: Math.PI / 2 }),
    at(box(4.0, 0.9, 6.2, belly), { y: -1.5, z: 1.2 }),
    // Brow ridges, which do most of the work in making it look like a predator.
    at(box(1.4, 1.0, 3.0, spine), { x: -1.5, y: 1.7, z: 1.4, rz: -0.25 }),
    at(box(1.4, 1.0, 3.0, spine), { x: 1.5, y: 1.7, z: 1.4, rz: 0.25 }),
  ];
  for (const side of [-1, 1]) {
    headParts.push(at(sphere(0.85, 0xe8d24a, 7), { x: side * 1.9, y: 1.0, z: 2.6 }));
    headParts.push(at(sphere(0.42, 0x14140f, 6), { x: side * 2.2, y: 1.0, z: 3.2 }));
    // Horns
    headParts.push(at(cone(0.6, 3.2, spine, 5), {
      x: side * 1.6, y: 2.2, z: -1.4, rx: -0.9, rz: side * 0.35,
    }));
  }
  headGroup.add(new THREE.Mesh(merge(headParts), material));

  // Lower jaw on its own pivot so it can open.
  const jaw = new THREE.Group();
  jaw.position.set(0, -1.4, 0.6);
  const jawParts = [at(box(3.8, 1.2, 6.0, hide), { z: 2.2 }), at(box(3.4, 0.5, 5.4, belly), { y: -0.5, z: 2.2 })];
  for (let i = 0; i < 5; i++) {
    const z = 0.4 + i * 1.2;
    jawParts.push(at(cone(0.3, 1.1, 0xf2ead6, 4), { x: -1.4, y: 0.9, z }));
    jawParts.push(at(cone(0.3, 1.1, 0xf2ead6, 4), { x: 1.4, y: 0.9, z }));
  }
  jaw.add(new THREE.Mesh(merge(jawParts), material));
  headGroup.add(jaw);
  // Upper teeth
  const upperTeeth = [];
  for (let i = 0; i < 5; i++) {
    const z = 1.0 + i * 1.2;
    upperTeeth.push(at(cone(0.3, 1.1, 0xf2ead6, 4), { x: -1.4, y: -1.0, z, rx: Math.PI }));
    upperTeeth.push(at(cone(0.3, 1.1, 0xf2ead6, 4), { x: 1.4, y: -1.0, z, rx: Math.PI }));
  }
  headGroup.add(new THREE.Mesh(merge(upperTeeth), material));
  headGroup.scale.setScalar(1.5);
  group.add(headGroup);

  // --- body ---------------------------------------------------------------
  const segments = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const t = i / SEGMENT_COUNT;
    const r = 3.6 * (1 - t * 0.74) + 0.5;
    const parts = [
      at(cyl(r, r * 1.04, SEGMENT_GAP * 1.25, hide, 7), { rx: Math.PI / 2 }),
      at(box(r * 1.5, 0.5, SEGMENT_GAP * 1.2, belly), { y: -r * 0.85 }),
      at(cone(r * 0.55, r * 1.5, spine, 4), { y: r * 0.95, rz: 0 }),
    ];
    if (i % 3 === 1 && i < SEGMENT_COUNT - 3) {
      for (const side of [-1, 1]) {
        parts.push(at(cone(r * 0.4, r * 2.2, spine, 4), {
          x: side * r * 0.9, y: -r * 0.2, rz: side * 1.35,
        }));
      }
    }
    const mesh = new THREE.Mesh(merge(parts), material);
    group.add(mesh);
    segments.push(mesh);
  }

  return { group, headGroup, jaw, segments, material, rng };
}

/**
 * Remembers where the head has been, so the body can follow it.
 *
 * Sampling is by *arc length*, not by frame count. Stepping back a fixed
 * number of entries ties body spacing to frame rate and speed, so a creature
 * that slowed down or hovered would telescope its whole body into its skull.
 * Walking back by distance keeps the spine the same length whatever it does.
 */
export class Trail {
  constructor(size = TRAIL_SAMPLES) {
    this.points = new Array(size);
    for (let i = 0; i < size; i++) this.points[i] = new THREE.Vector3();
    this.size = size;
    this.head = 0;
    this.filled = 0;
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  /**
   * Lay the trail out as a straight line behind `position`, so a creature has
   * a full-length body from the instant it appears rather than growing one.
   */
  reset(position, heading = 0, spacing = 0.4) {
    const dx = -Math.sin(heading) * spacing;
    const dz = -Math.cos(heading) * spacing;
    for (let i = 0; i < this.size; i++) {
      // index 0 is the head; older entries run backwards down the line
      this.points[(this.head - i + this.size * 2) % this.size]
        .set(position.x + dx * i, position.y, position.z + dz * i);
    }
    this.filled = this.size;
  }

  push(position) {
    this.head = (this.head + 1) % this.size;
    this.points[this.head].copy(position);
    this.filled = Math.min(this.filled + 1, this.size);
  }

  /** The point `back` entries behind the head. */
  raw(back) {
    const b = Math.min(back, this.filled - 1);
    return this.points[(this.head - b + this.size * 2) % this.size];
  }

  /**
   * Fill `out` with the points lying at each of `distances` back along the
   * trail. Distances must be increasing; one pass serves them all.
   */
  spine(distances, out) {
    let acc = 0;
    let need = 0;
    let prev = this.raw(0);

    for (let back = 1; back < this.filled && need < distances.length; back++) {
      const cur = this.raw(back);
      const step = prev.distanceTo(cur);
      while (need < distances.length && acc + step >= distances[need]) {
        const t = step > 1e-6 ? (distances[need] - acc) / step : 0;
        out[need].lerpVectors(prev, cur, t);
        need++;
      }
      acc += step;
      prev = cur;
    }

    // Trail too short (it has barely moved): carry on in a straight line so
    // the body still reads as a body.
    if (need < distances.length) {
      const tailDir = this._a.copy(this.raw(Math.max(this.filled - 1, 1)))
        .sub(this.raw(Math.max(this.filled - 2, 0)));
      if (tailDir.lengthSq() < 1e-8) tailDir.set(0, 0, -1);
      tailDir.normalize();
      const last = this.raw(this.filled - 1);
      while (need < distances.length) {
        out[need].copy(last).addScaledVector(tailDir, distances[need] - acc);
        need++;
      }
    }
    return out;
  }
}

export { SEGMENT_COUNT, SEGMENT_GAP };

/**
 * A Marine patrol sloop: smaller and plainer than the player's caravel, and
 * recognisable at a distance by its white hull and blue stripe.
 */
export function createPatrolShip(seed = 2) {
  const rng = makeRng(seed);
  const material = propMaterial();
  const group = new THREE.Group();

  const HULL = 0xe8e6de;
  const TRIM = 0x24406e;
  const WOOD = 0x8a5f33;
  const parts = [];

  const length = 15, beam = 5.4;
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const zc = -length / 2 + ((i + 0.5) / segs) * length;
    const taper = 1 - Math.pow(Math.abs(zc) / (length / 2), 2) * 0.85;
    const w = beam * Math.max(taper, 0.12);
    parts.push(at(box(w, 2.4, length / segs + 0.05, i % 2 ? HULL : 0xd8d5cc), { y: 0.6, z: zc }));
    parts.push(at(box(w + 0.1, 0.4, length / segs + 0.05, TRIM), { y: 1.5, z: zc }));
    parts.push(at(box(w - 0.4, 0.14, length / segs + 0.05, WOOD), { y: 1.85, z: zc }));
  }
  parts.push(at(cone(1.3, 3.0, HULL, 5), { z: length / 2 + 0.9, rx: Math.PI / 2 }));
  parts.push(at(box(3.2, 1.6, 3.0, HULL), { y: 2.6, z: -4.4 }));
  parts.push(at(cyl(0.22, 0.3, 11, WOOD, 6), { y: 6.8, z: 0.5 }));
  parts.push(at(box(6.6, 0.2, 0.2, WOOD), { y: 10.4, z: 0.5 }));
  // Bow chaser
  parts.push(at(cyl(0.22, 0.28, 1.8, 0x2f2f33, 7), { y: 2.2, z: 5.6, rx: Math.PI / 2 - 0.1 }));
  group.add(new THREE.Mesh(merge(parts), material));

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 5.4, 5, 4),
    new THREE.MeshLambertMaterial({ color: 0xf4f2ea, side: THREE.DoubleSide })
  );
  sail.position.set(0, 7.4, 0.2);
  group.add(sail);

  // Marine pennant
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x2f5fa8, side: THREE.DoubleSide })
  );
  flag.position.set(0.95, 11.6, 0.5);
  group.add(flag);

  return { group, sail, material, rng };
}
