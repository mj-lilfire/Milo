import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, damp, dampAngle, lerp, makeRng, hashString, range } from "../core/utils.js";
import { Ocean, sampleHeight, sampleNormal } from "../world/ocean.js";
import { Sky } from "../world/sky.js";
import { Terrain } from "../world/terrain.js";
import { createShip, animateShip, SHIP, deckHeight, clampToDeck } from "../world/ship.js";
import { createCharacter, createLabel } from "../world/character.js";
import { cone, ico, at, merge, propMaterial } from "../world/geom.js";
import { disposeGeometry } from "../core/engine.js";

const _wp = new THREE.Vector3();
const _n = new THREE.Vector3();

const DOCK_RANGE = 78;

/**
 * Life at sea.
 *
 * The player walks the deck in the ship's local space and the camera is
 * parented to the hull, so pitch and roll are carried for free and the deck
 * never slides out from under them. Taking the helm swaps the left stick from
 * "walk" to "sail" without changing anything else about the controls.
 */
export class SailingMode {
  constructor(ctx) {
    this.ctx = ctx; // { engine, input, hud, audio, player, progress, route, crewById }
    this.scene = new THREE.Scene();
    this.built = false;

    this.heading = 0;
    this.speed = 0;
    this.throttle = 0;
    this.rudder = 0;
    this.maxSpeed = 17;

    this.atHelm = false;
    this.position = new THREE.Vector2();
    this.crewRigs = [];
    this.islandProxies = [];
    this.nearest = null;
    this.gullTimer = 6;

    this.onDock = null;
    this.onTalkCrew = null;
  }

  build() {
    if (this.built) return;
    const { route } = this.ctx;

    this.scene.fog = new THREE.FogExp2(0xbcd8e8, 0.00042);
    this.ocean = new Ocean(this.scene);
    this.sky = new Sky(this.scene, { clouds: 24, birds: 8, seed: 11 });

    const ship = createShip();
    this.ship = ship;
    this.scene.add(ship.group);
    ship.group.rotation.order = "YXZ";

    this.buildIslandProxies(route);
    this.buildFlotsam();

    this.crewGroup = new THREE.Group();
    ship.group.add(this.crewGroup);

    this.built = true;
  }

  /**
   * Every island is visible from the sea, built from the same height function
   * it uses up close — so the mountain on the horizon really is the mountain
   * you will climb.
   */
  buildIslandProxies(route) {
    const material = propMaterial();
    this.proxyMaterial = material;

    for (const spec of route) {
      const group = new THREE.Group();
      group.position.set(spec.world.x, 0, spec.world.z);

      const terrain = new Terrain({ ...spec.terrain, id: spec.id, palette: spec.palette });
      group.add(terrain.buildMesh({ segments: spec.terrain.proxySegments ?? 46 }));
      group.add(terrain.buildSkirt());

      // A light dusting of vegetation so the silhouette isn't bare rock.
      const rng = makeRng(hashString(spec.id + "|proxy"));
      const blobs = [];
      const count = spec.proxyFoliage ?? 42;
      for (let i = 0; i < count; i++) {
        const p = terrain.samplePoint(rng, { minH: 1.8, maxSlope: 0.5 });
        if (!p) continue;
        const h = range(rng, 5, 11);
        const shape = spec.climate === "snow" || spec.climate === "rocky"
          ? cone(range(rng, 1.6, 3), h, spec.palette.leaf, 5)
          : ico(range(rng, 2.2, 3.8), spec.palette.leaf, 0);
        blobs.push(at(shape, { x: p.x, y: p.h + h * 0.35, z: p.z }));
      }
      if (blobs.length) group.add(new THREE.Mesh(merge(blobs), material));

      this.scene.add(group);
      this.islandProxies.push({ spec, group, terrain });
    }
  }

  /** Drifting barrels and crates so the open sea isn't featureless. */
  buildFlotsam() {
    const rng = makeRng(4242);
    const material = propMaterial();
    const geos = [];
    this.flotsam = [];
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Mesh(
        merge([at(ico(range(rng, 0.5, 1.1), 0x6b4a2a, 0), { sy: 0.7 })]),
        material
      );
      g.position.set(range(rng, -2600, 2600), 0, range(rng, -2600, 2600));
      g.userData.spin = range(rng, -0.4, 0.4);
      this.scene.add(g);
      this.flotsam.push(g);
    }
  }

  /** Rebuild the crew standing on deck after a recruitment. */
  refreshCrew() {
    // Rebuilt on every departure, so the old bodies have to be freed or the
    // crew quietly leaks a rig apiece each time you leave an island.
    for (const rig of this.crewRigs) {
      this.crewGroup.remove(rig.group);
      disposeGeometry(rig.group);
    }
    this.crewRigs = [];

    const { progress, crewById } = this.ctx;
    progress.crew.forEach((id, i) => {
      const member = crewById(id);
      if (!member) return;
      const rig = createCharacter(member.look);
      const station = SHIP.crewStations[i % SHIP.crewStations.length];
      rig.group.position.copy(station);
      rig.faceAngle(Math.PI + (i % 2 ? 0.6 : -0.6));
      rig.facing = rig.targetFacing;

      const label = createLabel(member.name, { sub: member.role });
      label.position.y = 2.5;
      label.scale.multiplyScalar(0.72);
      rig.group.add(label);
      rig.crewId = id;
      rig.member = member;

      this.crewGroup.add(rig.group);
      this.crewRigs.push(rig);
    });
  }

  /** Apply an island's sea climate to the sky, fog and water. */
  applyClimate(spec) {
    if (!spec) return;
    const s = spec.seaSky || {};
    this.sky.setPalette({
      top: s.top ?? 0x3d81c4,
      horizon: s.horizon ?? 0xcfe4ef,
      sunColor: s.sun ?? 0xfff0cc,
      haze: s.haze ?? 0.45,
      sunIntensity: s.sunIntensity ?? 2.1,
      ambientSky: s.ambientSky ?? 0xbcd8e8,
      ambientGround: s.ambientGround ?? 0x4a5f52,
      cloudColor: s.cloud ?? 0xffffff,
      cloudOpacity: s.cloudOpacity ?? 0.82,
    });
    const o = spec.seaWater || {};
    this.ocean.setPalette({
      deep: o.deep ?? 0x0a3b5c,
      shallow: o.shallow ?? 0x2d8fae,
      sky: s.horizon ?? 0x9fc9e2,
      fog: s.horizon ?? 0xbcd8e8,
      fogDensity: o.fogDensity ?? 0.00042,
    });
    this.ocean.setSunDirection(this.sky.sunDirection);
    this.scene.fog.color.set(s.horizon ?? 0xbcd8e8);
    this.scene.fog.density = o.fogDensity ?? 0.00042;
  }

  /**
   * @param opts.fromIsland  spec of the island just departed, if any
   */
  enter(opts = {}) {
    this.build();
    const { engine, player, progress, route } = this.ctx;

    const target = progress.currentIsland;
    const from = opts.fromIsland;

    if (from) {
      // Push off from the jetty, pointed at open water.
      const angle = (from.dockAngle ?? 0);
      const dist = from.terrain.radius + 46;
      this.position.set(from.world.x + Math.sin(angle) * dist, from.world.z + Math.cos(angle) * dist);
      this.heading = angle;
    } else if (opts.position) {
      this.position.copy(opts.position);
      this.heading = opts.heading ?? 0;
    } else {
      const start = route[0];
      this.position.set(start.world.x + 240, start.world.z + 260);
      this.heading = Math.atan2(start.world.x - this.position.x, start.world.z - this.position.y);
    }

    this.speed = 0;
    this.throttle = 0;
    this.rudder = 0;
    this.atHelm = false;

    player.position.copy(SHIP.boardPoint);
    player.velocityY = 0;
    player.onGround = true;
    player.yaw = Math.PI;
    player.pitch = -0.05;

    this.ship.group.add(engine.camera);
    engine.camera.rotation.order = "YXZ";

    this.refreshCrew();
    this.applyClimate(target || route[0]);
    engine.setScene(this.scene);
    this.ctx.audio.setAmbience("sea");
    this.syncShipTransform(0);
  }

  exit() {
    const { engine } = this.ctx;
    this.ship.group.remove(engine.camera);
  }

  /** Place the hull on the water and tilt it with the swell. */
  syncShipTransform(time) {
    const g = this.ship.group;
    g.position.x = this.position.x;
    g.position.z = this.position.y;

    // Sample fore and aft so a long hull rides the wave rather than clipping it.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const bowX = this.position.x + fx * 8, bowZ = this.position.y + fz * 8;
    const sternX = this.position.x - fx * 8, sternZ = this.position.y - fz * 8;
    const hBow = sampleHeight(bowX, bowZ, time);
    const hStern = sampleHeight(sternX, sternZ, time);
    g.position.y = (hBow + hStern) / 2 - 0.35;

    sampleNormal(this.position.x, this.position.y, time, _n);
    const pitchFromWave = Math.atan2(hBow - hStern, 16);
    // Lean into the turn, and dig the bow in under power.
    const rollFromTurn = -this.rudder * clamp(this.speed / this.maxSpeed, 0, 1) * 0.22;
    const rollFromWave = Math.atan2(-_n.x * fz + _n.z * fx, 1) * 0.55;

    g.rotation.y = this.heading;
    g.rotation.x = damp(g.rotation.x, -pitchFromWave * 0.85 - this.throttle * 0.02, 6, 1 / 60);
    g.rotation.z = damp(g.rotation.z, rollFromTurn + rollFromWave, 5, 1 / 60);
    g.updateMatrixWorld(true);
  }

  /** Bearing and distance from the ship to a world point. */
  bearingTo(x, z) {
    return {
      bearing: Math.atan2(x - this.position.x, z - this.position.y),
      distance: Math.hypot(x - this.position.x, z - this.position.y),
    };
  }

  findNearestIsland() {
    let best = null;
    for (let i = 0; i < this.islandProxies.length; i++) {
      const p = this.islandProxies[i];
      const angle = p.spec.dockAngle ?? 0;
      const dist = p.spec.terrain.radius + 34;
      const mx = p.spec.world.x + Math.sin(angle) * dist;
      const mz = p.spec.world.z + Math.cos(angle) * dist;
      const d = Math.hypot(mx - this.position.x, mz - this.position.y);
      if (!best || d < best.distance) best = { index: i, spec: p.spec, distance: d, x: mx, z: mz };
    }
    return best;
  }

  update(dt, time) {
    const { input, hud, player, audio, progress, engine } = this.ctx;

    if (this.atHelm) this.updateHelm(dt, input);
    else this.updateOnDeck(dt, input);

    // --- hull motion --------------------------------------------------------
    const drag = 0.45;
    const targetSpeed = this.maxSpeed * this.throttle;
    this.speed = damp(this.speed, targetSpeed, this.throttle > 0.02 ? 0.9 : drag, dt);

    // A ship with no way on answers the helm poorly — that's the whole feel.
    const steerAuthority = clamp(Math.abs(this.speed) / 7, 0, 1);
    this.heading += this.rudder * 0.62 * steerAuthority * dt;

    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.y += Math.cos(this.heading) * this.speed * dt;

    this.keepOffTheRocks();
    this.syncShipTransform(time);

    // --- world --------------------------------------------------------------
    this.ship.group.getWorldPosition(_wp);
    this.ocean.update(time, _wp);
    this.sky.update(dt, time, _wp);
    animateShip(this.ship, time, dt, {
      throttle: this.throttle, rudder: this.rudder, speed: this.speed,
    });

    for (const f of this.flotsam) {
      f.position.y = sampleHeight(f.position.x, f.position.z, time) - 0.2;
      f.rotation.y += f.userData.spin * dt;
      f.rotation.z = Math.sin(time * 1.3 + f.position.x) * 0.12;
    }
    for (const rig of this.crewRigs) rig.update(dt, 0);

    this.gullTimer -= dt;
    if (this.gullTimer <= 0) {
      this.gullTimer = range(Math.random, 9, 26);
      audio.gull();
    }

    // --- navigation readout -------------------------------------------------
    const target = progress.currentIsland;
    if (target) {
      const { bearing, distance } = this.bearingTo(target.world.x, target.world.z);
      hud.updateCompass(this.heading, bearing, target.name, distance);
    } else {
      hud.updateCompass(this.heading, null, "", 0);
    }

    this.updatePrompt();
    player.applyToCamera(engine.camera);
    // The camera lives under the hull, so the player's local position is its
    // local position — pitch and roll come along for free.
    engine.camera.position.set(
      player.position.x,
      player.position.y + player.eyeHeight + player.bobOffset().y,
      player.position.z
    );
  }

  updateOnDeck(dt, input) {
    const { player, audio } = this.ctx;
    player.stepDeck(dt, input, this.ship, deckHeight, clampToDeck);
    player.onFootstep = () => audio.step(false);
  }

  updateHelm(dt, input) {
    const { player } = this.ctx;
    player.applyLook(input);

    // Only move the sail setting when the stick is actually pushed, so the
    // sails stay where they were trimmed instead of dropping on release.
    if (Math.abs(input.move.y) > 0.15) {
      this.throttle = damp(this.throttle, clamp(input.move.y, -0.3, 1), 3.2, dt);
    }
    this.rudder = damp(this.rudder, clamp(input.move.x, -1, 1), 8, dt);

    // Stand abaft the wheel: close enough to be steering it, far enough back
    // that the spokes frame the view instead of filling it.
    player.position.set(SHIP.helm.x, SHIP.sternDeckY, SHIP.helm.z - 1.9);
    player.speed = 0;
  }

  /** Soft barrier so the ship can't be driven up onto an island. */
  keepOffTheRocks() {
    for (const p of this.islandProxies) {
      const dx = this.position.x - p.spec.world.x;
      const dz = this.position.y - p.spec.world.z;
      const d = Math.hypot(dx, dz);
      const limit = p.spec.terrain.radius + 26;
      if (d < limit && d > 0.001) {
        const push = (limit - d) / d;
        this.position.x += dx * push;
        this.position.y += dz * push;
        if (this.speed > 6) {
          this.speed *= 0.4;
          this.ctx.audio.splash();
        }
      }
    }
  }

  updatePrompt() {
    const { hud, input, progress, route } = this.ctx;
    const near = this.findNearestIsland();
    this.nearest = near && near.distance < DOCK_RANGE ? near : null;

    if (this.nearest) {
      const unlocked = progress.isUnlocked(this.nearest.index);
      if (unlocked) {
        hud.setPrompt(`Drop anchor at ${this.nearest.spec.name}`);
        if (input.consume("interact")) {
          this.onDock?.(this.nearest.index);
          return;
        }
      } else {
        hud.setPrompt("The Log Pose hasn't settled here yet", "…");
        input.consume("interact");
      }
      return;
    }

    // Nothing to dock with — offer the helm, or a word with the crew.
    const helmDist = this.atHelm ? 0 : Math.hypot(
      this.ctx.player.position.x - SHIP.helm.x,
      this.ctx.player.position.z - SHIP.helm.z
    );

    if (this.atHelm) {
      hud.setPrompt("Leave the helm");
      if (input.consume("interact")) {
        this.atHelm = false;
        this.ctx.player.position.set(SHIP.helm.x, SHIP.sternDeckY, SHIP.helm.z + 1.5);
        this.ctx.audio.click();
      }
      return;
    }

    if (helmDist < 2.6) {
      hud.setPrompt("Take the helm");
      if (input.consume("interact")) {
        this.atHelm = true;
        this.ctx.audio.click();
      }
      return;
    }

    const crew = this.nearestCrew();
    if (crew) {
      hud.setPrompt(`Talk to ${crew.member.name}`);
      if (input.consume("interact")) {
        this.onTalkCrew?.(crew.member);
      }
      return;
    }

    hud.clearPrompt();
    input.consume("interact");
  }

  nearestCrew() {
    const p = this.ctx.player.position;
    let best = null;
    for (const rig of this.crewRigs) {
      const d = Math.hypot(rig.group.position.x - p.x, rig.group.position.z - p.z);
      if (d < 2.8 && (!best || d < best.d)) best = { d, ...rig, member: rig.member };
    }
    return best;
  }

  /** State worth persisting across a save. */
  serialize() {
    return { x: this.position.x, z: this.position.y, heading: this.heading };
  }
}
