import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, lerp, smoothstep, fbm, hashString } from "../core/utils.js";
import { grade } from "./geom.js";

/**
 * Island terrain.
 *
 * The surface is defined by an analytic `heightAt` first and a mesh second, so
 * the player walks on exactly the function that was tessellated — no raycasts,
 * no mesh queries, and no chance of the two disagreeing at a cliff edge.
 */

const sstep = (edge0, edge1, x) => smoothstep(clamp((x - edge0) / (edge1 - edge0), 0, 1));

/**
 * @param {object} spec
 *   radius      — shoreline distance from the island centre
 *   baseHeight  — height of the flat interior above sea level
 *   relief      — how much noise rides on top
 *   noiseScale  — feature size of that noise
 *   peaks       — [{x, z, height, radius}] mountains added on top
 *   flats       — [{x, z, r, height}] forced-level ground for towns and docks
 *   shelfDepth  — how deep the seabed drops past the shore
 */
export class Terrain {
  constructor(spec) {
    this.spec = spec;
    this.radius = spec.radius;
    this.seed = hashString(spec.id || "island");
    this.peaks = spec.peaks || [];
    this.flats = spec.flats || [];
    this.baseHeight = spec.baseHeight ?? 2.6;
    this.relief = spec.relief ?? 5.0;
    this.noiseScale = spec.noiseScale ?? 55;
    this.shelfDepth = spec.shelfDepth ?? 14;
    this.palette = spec.palette;
  }

  /** Island mask: 1 well inland, 0 past the surf line. */
  mask(d) {
    return 1 - sstep(this.radius * 0.62, this.radius * 1.06, d);
  }

  heightAt(x, z) {
    const d = Math.hypot(x, z);
    const m = this.mask(d);

    const n = fbm(x / this.noiseScale, z / this.noiseScale, 4, this.seed);
    let h = m * (this.baseHeight + n * this.relief);

    for (const p of this.peaks) {
      const pd = Math.hypot(x - p.x, z - p.z) / p.radius;
      // Gaussian shoulders read as a mountain; the ridge noise stops it
      // looking like a perfect cone.
      const ridge = 1 + fbm(x / 26, z / 26, 3, this.seed + 31) * 0.22;
      h += p.height * Math.exp(-pd * pd * 1.6) * m * ridge;
    }

    h -= (1 - m) * this.shelfDepth;

    for (const f of this.flats) {
      const fd = Math.hypot(x - f.x, z - f.z);
      const w = 1 - sstep(f.r * 0.55, f.r, fd);
      h = lerp(h, f.height, w);
    }
    return h;
  }

  /** Surface normal by central differences on `heightAt`. */
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.8;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  /** 0 = flat, 1 = vertical. */
  slopeAt(x, z) {
    return 1 - this.normalAt(x, z).y;
  }

  /**
   * Walk outward along a bearing to find where the land meets the sea.
   * Used to site docks and beach spawns.
   */
  shorePoint(angle, targetHeight = 0.6) {
    const dx = Math.sin(angle), dz = Math.cos(angle);
    let lo = 0, hi = this.radius * 1.4;
    // The height function is monotonic enough near the shore for a bisection.
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.heightAt(dx * mid, dz * mid) > targetHeight) lo = mid;
      else hi = mid;
    }
    const r = (lo + hi) / 2;
    return new THREE.Vector3(dx * r, this.heightAt(dx * r, dz * r), dz * r);
  }

  /** Rejection-sample a point matching a height band and slope limit. */
  samplePoint(rng, { minH = 1.4, maxH = 999, maxSlope = 0.45, maxTries = 60, minR = 0, maxR = 1 } = {}) {
    for (let i = 0; i < maxTries; i++) {
      const a = rng() * TAU;
      // sqrt keeps the scatter even across the disc instead of clustering
      // everything around the centre.
      const r = this.radius * lerp(minR, maxR, Math.sqrt(rng()));
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const h = this.heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (this.slopeAt(x, z) > maxSlope) continue;
      return { x, z, h };
    }
    return null;
  }

  colorAt(h, slope) {
    const p = this.palette;
    const c = new THREE.Color();
    // Ground goes through the same grade as everything else, or the terrain
    // would be the one vivid thing in an otherwise muted world.
    if (h < -0.35) return grade(c.set(p.seabed || 0x5c6f52));
    if (h < 1.15) {
      // Wet sand right at the waterline, dry sand above it.
      return grade(c.set(p.sand).lerp(new THREE.Color(p.wetSand || p.sand), clamp(1 - h / 1.15, 0, 1) * 0.55));
    }
    if (slope > 0.42) return grade(c.set(p.rock));
    const highT = clamp((h - (this.spec.highBand ?? 22)) / 16, 0, 1);
    const base = new THREE.Color(p.ground);
    if (highT > 0) base.lerp(new THREE.Color(p.high || p.rock), highT);
    if (slope > 0.26) base.lerp(new THREE.Color(p.rock), (slope - 0.26) / 0.16 * 0.7);
    return grade(base);
  }

  /**
   * Tessellate the terrain. Non-indexed with computed normals gives the
   * faceted look the rest of the art style uses.
   */
  buildMesh({ segments = 110 } = {}) {
    const size = this.radius * 2.45;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.heightAt(pos.getX(i), pos.getZ(i)));
    }

    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();

    const fp = flat.attributes.position;
    const normals = flat.attributes.normal;
    const colors = new Float32Array(fp.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < fp.count; i++) {
      const y = fp.getY(i);
      const slope = 1 - normals.getY(i);
      c.copy(this.colorAt(y, slope));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    flat.computeBoundingSphere();
    geo.dispose();

    const mesh = new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = "terrain";
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * An underwater skirt so the island doesn't end in a visible cliff of
   * nothing when the player looks over the side of the shelf.
   */
  buildSkirt() {
    const r = this.radius * 1.22;
    const geo = new THREE.CylinderGeometry(r, r * 1.5, this.shelfDepth * 2.2, 26, 1, true);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: this.palette.seabed || 0x3d5548,
      side: THREE.BackSide,
    }));
    mesh.position.y = -this.shelfDepth * 1.1 + 1;
    return mesh;
  }
}
