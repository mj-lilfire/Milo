import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, makeRng, hashString, range } from "../core/utils.js";
import { Terrain } from "./terrain.js";
import { buildProp } from "./props.js";
import { box, cyl, at, merge, propMaterial } from "./geom.js";
import { disposeObject, shadowed } from "../core/engine.js";

/**
 * Turns an island data spec into geometry, colliders and anchor points.
 *
 * Scenery is scattered deterministically from the island id, so a given island
 * looks the same on every device and every visit, and the whole batch is merged
 * into a single mesh before it reaches the GPU.
 */

/** Height content must clear to count as standing on dry, reachable ground. */
export const LAND_MIN_HEIGHT = 1.2;

/**
 * Resolve a spec position into world XZ. Accepts several shorthand forms.
 *
 * With `minHeight` set, a spot that lands in the water is walked back toward
 * the island's centre until it is on dry land. Island silhouettes come from
 * noise, so a hand-written "about three quarters of the way out" can fall off
 * the shore on one island and not another; this makes every authored position
 * reachable without having to tune each one against the terrain function.
 */
export function resolvePlace(place, terrain, minHeight = 0) {
  let x, z;
  if (place.x !== undefined) {
    x = place.x;
    z = place.z;
  } else if (place.shore !== undefined) {
    const p = terrain.shorePoint(place.shore, place.shoreHeight ?? 1.2);
    x = p.x;
    z = p.z;
  } else {
    const dist = (place.dist ?? 0.5) * terrain.radius;
    x = Math.sin(place.angle || 0) * dist;
    z = Math.cos(place.angle || 0) * dist;
  }

  if (minHeight > 0) {
    const d = Math.hypot(x, z);
    if (d > 1) {
      const ux = x / d, uz = z / d;
      let r = d;
      for (let i = 0; i < 60 && r > 2; i++) {
        if (terrain.heightAt(x, z) >= minHeight && terrain.slopeAt(x, z) < 0.6) break;
        r *= 0.96;
        x = ux * r;
        z = uz * r;
      }
    }
  }
  return { x, z };
}

/** A jetty running from the shore out over the water. */
function buildDock(terrain, angle, palette) {
  const parts = [];
  const colliders = [];
  const platforms = [];

  const dirX = Math.sin(angle), dirZ = Math.cos(angle);
  const shore = terrain.shorePoint(angle, 1.6);
  const deckY = 1.9;
  const length = 22;
  const width = 4.4;

  // Start just inland so the planks meet the beach cleanly.
  const startX = shore.x - dirX * 3;
  const startZ = shore.z - dirZ * 3;

  const planks = 15;
  for (let i = 0; i < planks; i++) {
    const t = i / (planks - 1);
    const x = startX + dirX * length * t;
    const z = startZ + dirZ * length * t;
    parts.push(at(box(width, 0.22, length / planks + 0.06, i % 2 ? 0x8a5f33 : 0x7a5129), {
      x, y: deckY, z, ry: angle,
    }));
  }
  platforms.push({
    cx: startX + dirX * length * 0.5,
    cz: startZ + dirZ * length * 0.5,
    halfW: width / 2,
    halfD: length / 2,
    angle,
    y: deckY + 0.11,
  });

  // Posts down into the seabed.
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const x = startX + dirX * length * t;
    const z = startZ + dirZ * length * t;
    const ground = terrain.heightAt(x, z);
    const h = Math.max(deckY - ground, 1) + 0.6;
    for (const side of [-1, 1]) {
      parts.push(at(cyl(0.2, 0.24, h, 0x5c3e22, 6), {
        x: x + Math.cos(angle) * side * (width / 2 - 0.3),
        z: z - Math.sin(angle) * side * (width / 2 - 0.3),
        y: deckY - h / 2,
      }));
    }
  }

  // Handrail on one side only, so the player can still step off toward land.
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = startX + dirX * length * t;
    const z = startZ + dirZ * length * t;
    parts.push(at(cyl(0.1, 0.12, 1.1, 0x5c3e22, 5), {
      x: x + Math.cos(angle) * (width / 2 - 0.2),
      z: z - Math.sin(angle) * (width / 2 - 0.2),
      y: deckY + 0.55,
    }));
  }
  parts.push(at(box(0.14, 0.14, length, 0x5c3e22), {
    x: startX + dirX * length * 0.5 + Math.cos(angle) * (width / 2 - 0.2),
    z: startZ + dirZ * length * 0.5 - Math.sin(angle) * (width / 2 - 0.2),
    y: deckY + 1.05, ry: angle,
  }));

  // Mooring bollards mark where the ship ties up.
  const endX = startX + dirX * length, endZ = startZ + dirZ * length;
  for (const side of [-1, 1]) {
    parts.push(at(cyl(0.22, 0.26, 0.9, 0x4a3320, 7), {
      x: endX + Math.cos(angle) * side * 1.4,
      z: endZ - Math.sin(angle) * side * 1.4,
      y: deckY + 0.45,
    }));
  }

  return {
    geo: merge(parts),
    colliders,
    platforms,
    /** Where the player stands when they step off the ship. */
    landing: new THREE.Vector3(endX - dirX * 2.5, deckY + 0.11, endZ - dirZ * 2.5),
    /** Where the ship sits while moored. */
    mooring: new THREE.Vector3(endX + dirX * 9, 0, endZ + dirZ * 9),
    angle,
    inland: new THREE.Vector3(startX - dirX * 4, 0, startZ - dirZ * 4),
  };
}

/**
 * Build everything static about an island.
 * @returns {object} group, terrain, colliders, platforms, dock, places
 */
export function buildIsland(spec) {
  const group = new THREE.Group();
  group.name = "island:" + spec.id;

  const terrain = new Terrain({ ...spec.terrain, id: spec.id, palette: spec.palette });
  const rng = makeRng(hashString(spec.id + "|scatter"));

  const terrainMesh = terrain.buildMesh({ segments: spec.terrain.segments ?? 108 });
  group.add(terrainMesh);
  group.add(terrain.buildSkirt());

  const colliders = [];
  const platforms = [];
  const propGeos = [];
  const decorGeos = []; // no collision — grass, shells, small detail

  // --- dock ---------------------------------------------------------------
  const dock = buildDock(terrain, spec.dockAngle ?? 0, spec.palette);
  propGeos.push(dock.geo);
  platforms.push(...dock.platforms);

  // --- authored structures -------------------------------------------------
  const placed = [];
  let structureIndex = 0;
  for (const s of spec.structures || []) {
    const pos = resolvePlace(s.at, terrain);
    const y = s.y ?? terrain.heightAt(pos.x, pos.z);
    const built = buildProp(s.prop, hashString(spec.id + ":" + s.prop + structureIndex++), spec.palette);
    const rot = s.rotation ?? Math.atan2(-pos.x, -pos.z); // face the island centre
    propGeos.push(at(built.geo, { x: pos.x, y: y - 0.2, z: pos.z, ry: rot, s: s.scale ?? 1 }));
    built.geo.dispose(); // `at` took a copy; the template is done with
    if (built.collider) {
      colliders.push({
        x: pos.x, z: pos.z,
        r: built.collider.r * (s.scale ?? 1),
        h: built.collider.h * (s.scale ?? 1),
      });
    }
    placed.push({ x: pos.x, z: pos.z, r: (built.collider?.r ?? 2) + 2 });
  }

  // --- scattered scenery ---------------------------------------------------
  for (const layer of spec.scatter || []) {
    const band = layer.band || {};
    let made = 0;
    let guard = layer.count * 14;
    while (made < layer.count && guard-- > 0) {
      const p = terrain.samplePoint(rng, band);
      if (!p) continue;
      const spacing = layer.spacing ?? 3.2;
      let blocked = false;
      for (const q of placed) {
        if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 < (q.r + spacing) ** 2) { blocked = true; break; }
      }
      if (blocked) continue;
      // Keep the jetty approach clear so the player can always get ashore.
      if ((p.x - dock.landing.x) ** 2 + (p.z - dock.landing.z) ** 2 < 90) continue;

      const built = buildProp(layer.prop, hashString(spec.id + layer.prop + made), spec.palette);
      const scale = layer.scale ? range(rng, layer.scale[0], layer.scale[1]) : 1;
      const geo = at(built.geo, {
        x: p.x, y: p.h - 0.25, z: p.z, ry: rng() * TAU, s: scale,
      });
      built.geo.dispose();
      if (built.collider) {
        propGeos.push(geo);
        colliders.push({ x: p.x, z: p.z, r: built.collider.r * scale, h: built.collider.h * scale });
        placed.push({ x: p.x, z: p.z, r: built.collider.r * scale + spacing });
      } else {
        decorGeos.push(geo);
      }
      made++;
    }
  }

  const material = propMaterial();
  if (propGeos.length) {
    const mesh = new THREE.Mesh(merge(propGeos), material);
    mesh.name = "props";
    shadowed(mesh);
    group.add(mesh);
  }
  if (decorGeos.length) {
    const mesh = new THREE.Mesh(merge(decorGeos), material);
    mesh.name = "decor";
    shadowed(mesh, { receive: false });
    group.add(mesh);
  }

  // --- named anchor points for quests and NPCs -----------------------------
  const places = {};
  for (const [name, place] of Object.entries(spec.places || {})) {
    const pos = resolvePlace(place, terrain, LAND_MIN_HEIGHT);
    places[name] = new THREE.Vector3(pos.x, terrain.heightAt(pos.x, pos.z), pos.z);
  }
  places.dock = dock.landing.clone();
  places.shore = dock.inland.clone();
  places.shore.y = terrain.heightAt(places.shore.x, places.shore.z);

  return {
    group,
    terrain,
    colliders,
    platforms,
    dock,
    places,
    material,
    dispose() {
      disposeObject(group);
      material.dispose();
    },
  };
}

/** A treasure chest the player can open. Animated, so it stays its own mesh. */
export function createChest(palette = {}) {
  const material = propMaterial();
  const group = new THREE.Group();

  const base = new THREE.Mesh(merge([
    at(box(1.4, 0.8, 0.95, 0x6b4a2a), { y: 0.4 }),
    at(box(1.46, 0.14, 1.0, 0xc9a227), { y: 0.18 }),
    at(box(1.46, 0.14, 1.0, 0xc9a227), { y: 0.66 }),
  ]), material);
  group.add(base);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.8, -0.47);
  const lid = new THREE.Mesh(merge([
    at(box(1.4, 0.42, 0.95, 0x7a5530), { y: 0.2, z: 0.47 }),
    at(box(1.46, 0.12, 1.0, 0xc9a227), { y: 0.38, z: 0.47 }),
    at(box(0.3, 0.3, 0.2, 0xc9a227), { y: 0.1, z: 0.98 }),
  ]), material);
  lidPivot.add(lid);
  group.add(lidPivot);

  return {
    group,
    lidPivot,
    material,
    open: false,
    openAmount: 0,
    update(dt) {
      const target = this.open ? -2.1 : 0;
      this.openAmount += (target - this.openAmount) * Math.min(1, dt * 7);
      lidPivot.rotation.x = this.openAmount;
    },
  };
}
