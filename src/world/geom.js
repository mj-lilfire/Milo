import * as THREE from "../../vendor/three-0.160.1.module.min.js";

/**
 * Low-poly geometry kit.
 *
 * Everything an island is made of gets baked down to a handful of merged,
 * vertex-coloured buffers sharing one material. A whole island of palms,
 * houses, crates and rocks therefore costs a couple of draw calls instead of
 * several hundred — the difference between 60fps and a slideshow on a tablet.
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/** Paint every vertex of a geometry one colour. Returns the same geometry. */
export function paint(geo, color) {
  const c = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/**
 * Some three primitives (cylinders, cones, polyhedra) already come back
 * non-indexed; calling toNonIndexed on those just logs a warning.
 */
export const flatten = (g) => {
  if (!g.index) return g;
  const out = g.toNonIndexed();
  g.dispose(); // the indexed original is finished with
  return out;
};

/** Primitive builders. All are non-indexed and vertex-coloured, ready to merge. */
export const box = (w, h, d, color) => paint(flatten(new THREE.BoxGeometry(w, h, d)), color);
export const cyl = (rTop, rBot, h, color, seg = 8) =>
  paint(flatten(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1)), color);
export const cone = (r, h, color, seg = 8) =>
  paint(flatten(new THREE.ConeGeometry(r, h, seg, 1)), color);
export const ico = (r, color, detail = 0) =>
  paint(flatten(new THREE.IcosahedronGeometry(r, detail)), color);
export const sphere = (r, color, seg = 8) =>
  paint(flatten(new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1))), color);
export const plane = (w, d, color) => {
  const g = flatten(new THREE.PlaneGeometry(w, d));
  g.rotateX(-Math.PI / 2);
  return paint(g, color);
};

/**
 * Return a transformed copy. Every argument is optional.
 * @param {object} t  {x,y,z, rx,ry,rz, sx,sy,sz, s}
 */
export function at(geo, t = {}) {
  const g = geo.clone();
  const s = t.s ?? 1;
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
  _q.setFromEuler(_e);
  _m.compose(
    _v.set(t.x || 0, t.y || 0, t.z || 0),
    _q,
    new THREE.Vector3(t.sx ?? s, t.sy ?? s, t.sz ?? s)
  );
  g.applyMatrix4(_m);
  return g;
}

/**
 * Merge non-indexed geometries that share the same attribute set.
 *
 * three's own merge helper lives in the examples bundle, which this build
 * deliberately does not ship; this covers the position/normal/color case the
 * game actually uses and nothing more.
 */
export function merge(geometries) {
  const list = geometries.filter((g) => g && g.attributes.position);
  if (!list.length) return new THREE.BufferGeometry();
  if (list.length === 1) return list[0];

  let total = 0;
  for (const g of list) total += g.attributes.position.count;

  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let offset = 0;
  const white = new Float32Array(0);

  for (const g of list) {
    const p = g.attributes.position.array;
    pos.set(p, offset * 3);
    const c = g.attributes.color ? g.attributes.color.array : white;
    if (c.length) {
      col.set(c, offset * 3);
    } else {
      col.fill(1, offset * 3, offset * 3 + p.length);
    }
    offset += g.attributes.position.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // Non-indexed + computed normals == flat shading, which is the look we want.
  out.computeVertexNormals();
  out.computeBoundingSphere();

  for (const g of list) g.dispose();
  return out;
}

/** The one material every merged prop batch uses. */
export function propMaterial() {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}

/** Shift a geometry so its lowest point sits at y = 0. */
export function groundAt(geo) {
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  return geo;
}

/** Slightly perturb a colour so a batch of props doesn't look stamped out. */
export function vary(color, rng, amount = 0.06) {
  const c = new THREE.Color(color);
  const k = 1 + (rng() - 0.5) * 2 * amount;
  c.multiplyScalar(k);
  c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b);
  return c.getHex();
}
