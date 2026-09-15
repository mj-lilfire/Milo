import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, damp, dampAngle, lerp, makeRng, range } from "../core/utils.js";
import { sampleHeight } from "../world/ocean.js";
import { createSeaKing, createPatrolShip, Trail, SEGMENT_COUNT, SEGMENT_GAP } from "../world/creatures.js";
import { disposeGeometry } from "../core/engine.js";

const GRAVITY = 16;
const BALL_SPEED = 78;
const MAX_BALLS = 28;
const OPEN_SEA = 210;       // how far from land an encounter may begin

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * Everything that happens to you between islands.
 *
 * Encounters are deliberately survivable and escapable: a sea king can be
 * driven off or simply outrun, and a patrol will break off if you put enough
 * water between you. The sea should feel dangerous, not like a wall.
 */
export class Encounters {
  constructor(ctx, scene) {
    this.ctx = ctx;          // { audio, hud, progress, engine }
    this.scene = scene;
    this.rng = makeRng(90210);

    this.balls = [];
    this.buildBallPool();

    this.seaKing = null;
    this.patrol = null;
    this.cooldown = range(this.rng, 25, 55);
    this.reload = 0;
    this.splashes = [];
    this.buildSplashPool();

    this.onHullDamage = null;
    this.enabled = true;
  }

  // --- pools ---------------------------------------------------------------

  buildBallPool() {
    const geo = new THREE.SphereGeometry(0.42, 8, 6);
    const mine = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const theirs = new THREE.MeshLambertMaterial({ color: 0x4a3a30 });
    this.ballGeo = geo;
    this.ballMats = { mine, theirs };
    for (let i = 0; i < MAX_BALLS; i++) {
      const mesh = new THREE.Mesh(geo, mine);
      mesh.visible = false;
      this.scene.add(mesh);
      this.balls.push({
        mesh, alive: false, fromPlayer: true, life: 0,
        vel: new THREE.Vector3(),
      });
    }
  }

  buildSplashPool() {
    const geo = new THREE.ConeGeometry(1.2, 3.4, 7, 1, true);
    this.splashGeo = geo;
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.splashes.push({ mesh, life: 0 });
    }
  }

  splash(x, z, scale = 1) {
    const s = this.splashes.find((p) => p.life <= 0);
    if (!s) return;
    s.life = 0.7;
    s.scale = scale;
    s.mesh.position.set(x, 0, z);
    s.mesh.visible = true;
    this.ctx.audio.splash();
  }

  // --- player gunnery ------------------------------------------------------

  get reloaded() {
    return this.reload <= 0;
  }

  /** Reload time, shortened by cannon upgrades. */
  get reloadTime() {
    return Math.max(0.7, 1.9 - (this.ctx.progress.upgrades?.cannon ?? 0) * 0.3);
  }

  get cannonDamage() {
    return 34 + (this.ctx.progress.upgrades?.cannon ?? 0) * 12;
  }

  /**
   * Fire where the player is looking.
   * @returns true if a shot went off
   */
  fire(originWorld, dirWorld) {
    if (!this.reloaded) return false;
    const ball = this.balls.find((b) => !b.alive);
    if (!ball) return false;

    this.reload = this.reloadTime;
    ball.alive = true;
    ball.fromPlayer = true;
    ball.life = 6;
    ball.mesh.material = this.ballMats.mine;
    ball.mesh.position.copy(originWorld);
    ball.mesh.visible = true;
    // A little elevation so the shot arcs instead of ploughing into the swell.
    ball.vel.copy(dirWorld).normalize().multiplyScalar(BALL_SPEED);
    ball.vel.y += 9;
    this.ctx.audio.cannon();
    return true;
  }

  fireAtPlayer(from, targetPos) {
    const ball = this.balls.find((b) => !b.alive);
    if (!ball) return;
    ball.alive = true;
    ball.fromPlayer = false;
    ball.life = 7;
    ball.mesh.material = this.ballMats.theirs;
    ball.mesh.position.copy(from);
    ball.mesh.visible = true;

    // Lead the target a little, and miss sometimes — a patrol that never
    // misses is just a damage tax.
    const flight = from.distanceTo(targetPos) / BALL_SPEED;
    _v.copy(targetPos).sub(from);
    _v.y += 0.5 * GRAVITY * flight * flight;
    _v.normalize().multiplyScalar(BALL_SPEED);
    _v.x += range(this.rng, -7, 7);
    _v.z += range(this.rng, -7, 7);
    ball.vel.copy(_v);
    this.ctx.audio.cannon();
  }

  updateBalls(dt, time, shipPos) {
    for (const b of this.balls) {
      if (!b.alive) continue;
      b.life -= dt;
      b.vel.y -= GRAVITY * dt;
      b.mesh.position.addScaledVector(b.vel, dt);

      const p = b.mesh.position;
      let done = b.life <= 0;

      if (!done && p.y < sampleHeight(p.x, p.z, time)) {
        this.splash(p.x, p.z, 1);
        done = true;
      }

      if (!done && b.fromPlayer) {
        for (const target of [this.seaKing, this.patrol]) {
          if (!target || !target.alive) continue;
          const s = target.hitSphere(_w);
          if (p.distanceToSquared(s) < s.r * s.r) {
            target.takeDamage(this.cannonDamage);
            this.splash(p.x, p.z, 1.4);
            this.ctx.audio.thud();
            done = true;
            break;
          }
        }
      } else if (!done && shipPos && p.distanceToSquared(shipPos) < 90) {
        this.onHullDamage?.(9);
        this.ctx.audio.thud();
        done = true;
      }

      if (done) {
        b.alive = false;
        b.mesh.visible = false;
      }
    }

    for (const s of this.splashes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const t = 1 - s.life / 0.7;
      s.mesh.scale.setScalar((0.5 + t * 1.4) * (s.scale || 1));
      s.mesh.position.y = t * 1.6;
      s.mesh.material.opacity = (1 - t) * 0.75;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  // --- spawning ------------------------------------------------------------

  /**
   * @param nearestLand  distance to the closest island, so encounters only
   *                     start in open water and never ambush you at a jetty
   */
  maybeSpawn(dt, shipPos, nearestLand, weather, progress) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    if (nearestLand < OPEN_SEA) return;
    if (this.seaKing || this.patrol) return;

    this.cooldown = range(this.rng, 45, 100);

    // Sea kings like heavy water; patrols come out once you are notorious.
    const kingChance = 0.25 + weather * 0.45;
    const wantKing = this.rng() < kingChance || progress.crew.length < 1;

    if (wantKing) this.spawnSeaKing(shipPos);
    else this.spawnPatrol(shipPos);
  }

  spawnSeaKing(shipPos) {
    const angle = this.rng() * TAU;
    const dist = range(this.rng, 110, 170);
    const pos = new THREE.Vector3(
      shipPos.x + Math.sin(angle) * dist, -14, shipPos.z + Math.cos(angle) * dist);
    this.seaKing = new SeaKing(this, pos);
    this.scene.add(this.seaKing.group);
    this.ctx.hud.toast("Something large is moving out there…", 4200);
  }

  spawnPatrol(shipPos) {
    const angle = this.rng() * TAU;
    const dist = range(this.rng, 150, 220);
    const pos = new THREE.Vector3(
      shipPos.x + Math.sin(angle) * dist, 0, shipPos.z + Math.cos(angle) * dist);
    this.patrol = new PatrolShip(this, pos);
    this.scene.add(this.patrol.group);
    this.ctx.hud.toast("A Marine patrol has your heading", 4200);
  }

  clear(which) {
    const target = which === "king" ? this.seaKing : this.patrol;
    if (!target) return;
    this.scene.remove(target.group);
    target.dispose();
    if (which === "king") this.seaKing = null;
    else this.patrol = null;
  }

  // --- frame ---------------------------------------------------------------

  update(dt, time, shipPos, shipHeading, { weather = 0, nearestLand = 9999, progress } = {}) {
    if (!this.enabled) return;
    this.reload = Math.max(0, this.reload - dt);

    this.updateBalls(dt, time, shipPos);
    this.maybeSpawn(dt, shipPos, nearestLand, weather, progress);

    if (this.seaKing) {
      this.seaKing.update(dt, time, shipPos);
      if (this.seaKing.finished) this.clear("king");
    }
    if (this.patrol) {
      this.patrol.update(dt, time, shipPos, shipHeading);
      if (this.patrol.finished) this.clear("patrol");
    }
  }

  /** Reward and remove a defeated threat. */
  reward(amount, message) {
    const { progress, hud, audio } = this.ctx;
    progress.addBerries(amount);
    hud.setBerries(progress.berries);
    hud.toast(message + "  +" + amount.toLocaleString("en-US"), 4000);
    audio.fanfare();
  }

  dispose() {
    this.clear("king");
    this.clear("patrol");
    for (const b of this.balls) this.scene.remove(b.mesh);
    for (const s of this.splashes) {
      this.scene.remove(s.mesh);
      s.mesh.material.dispose();
    }
    this.ballGeo.dispose();
    this.splashGeo.dispose();
    this.ballMats.mine.dispose();
    this.ballMats.theirs.dispose();
  }
}

/**
 * A sea king.
 *
 * Surfaces at a distance, closes in, strikes, then falls back and circles
 * before coming again — so there is always a window to shoot or to run.
 */
class SeaKing {
  constructor(encounters, position) {
    this.e = encounters;
    const built = createSeaKing(Math.floor(encounters.rng() * 1e6));
    this.group = built.group;
    this.parts = built;
    this.material = built.material;

    this.head = position.clone();
    this.heading = encounters.rng() * TAU;
    this.trail = new Trail();
    this.trail.reset(this.head, this.heading);
    // Arc-lengths down the spine, and scratch vectors to receive them.
    this.spineAt = [];
    this.spineOut = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      this.spineAt.push((i + 1) * SEGMENT_GAP);
      this.spineOut.push(new THREE.Vector3());
    }

    this.maxHp = 220;
    this.hp = this.maxHp;
    this.state = "surfacing";
    this.timer = 0;
    this.strikeCooldown = 4;
    this.jawOpen = 0;
    this.depth = -14;
    this.finished = false;
    this.alive = true;
  }

  hitSphere(out) {
    out.copy(this.head);
    out.r = 5.2;
    return out;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.e.ctx.hud.setThreat(this.hp / this.maxHp, "Sea King");
    if (this.hp <= 0) {
      this.alive = false;
      this.state = "dying";
      this.timer = 3.4;
      this.e.ctx.audio.roar();
      this.e.reward(1800, "The sea king sounds and is gone.");
      this.e.ctx.hud.setThreat(0, null);
    }
  }

  update(dt, time, shipPos) {
    const toShip = _v.copy(shipPos).sub(this.head);
    const dist = Math.hypot(toShip.x, toShip.z);
    let speed = 0;
    let targetDepth = this.depth;

    switch (this.state) {
      case "surfacing": {
        targetDepth = 5.5;
        this.timer += dt;
        if (this.timer > 2.2) {
          this.state = "hunting";
          this.e.ctx.audio.roar();
        }
        break;
      }
      case "hunting": {
        // Reared up out of the water — the silhouette that makes it a sea
        // king rather than a large crocodile.
        targetDepth = 7.5;
        speed = 13;
        this.heading = dampAngle(this.heading, Math.atan2(toShip.x, toShip.z), 1.1, dt);
        this.strikeCooldown -= dt;
        if (dist < 34 && this.strikeCooldown <= 0) {
          this.state = "striking";
          this.timer = 0;
          this.strikeCooldown = range(this.e.rng, 7, 12);
        }
        // Lost interest if the ship simply sails away.
        if (dist > 320) {
          this.state = "leaving";
          this.timer = 0;
        }
        break;
      }
      case "striking": {
        targetDepth = 5.0;
        speed = 26;
        this.timer += dt;
        this.jawOpen = Math.min(1, this.jawOpen + dt * 4);
        this.heading = dampAngle(this.heading, Math.atan2(toShip.x, toShip.z), 3, dt);
        if (dist < 17 && !this.struck) {
          this.struck = true;
          this.e.onHullDamage?.(16);
          this.e.ctx.audio.thud();
        }
        if (this.timer > 2.4) {
          this.state = "hunting";
          this.struck = false;
          this.jawOpen = 0;
        }
        break;
      }
      case "dying": {
        targetDepth = -26;
        speed = 4;
        this.timer -= dt;
        if (this.timer <= 0) this.finished = true;
        break;
      }
      default: { // leaving
        targetDepth = -22;
        speed = 16;
        this.timer += dt;
        if (this.timer > 6) this.finished = true;
        break;
      }
    }

    this.depth = damp(this.depth, targetDepth, 1.4, dt);
    this.head.x += Math.sin(this.heading) * speed * dt;
    this.head.z += Math.cos(this.heading) * speed * dt;
    // Ride the swell, plus a slow porpoising motion of its own.
    this.head.y = sampleHeight(this.head.x, this.head.z, time) + this.depth
      + Math.sin(time * 0.9) * 1.6;

    this.trail.push(this.head);
    this.poseBody(time);
  }

  /** Lay the body out along where the head has been. */
  poseBody(time) {
    this.parts.headGroup.position.copy(this.head);
    this.parts.headGroup.rotation.order = "YXZ";
    this.parts.headGroup.rotation.y = this.heading;
    this.parts.headGroup.rotation.x = Math.sin(time * 1.3) * 0.12;
    this.parts.jaw.rotation.x = this.jawOpen * 0.55;

    this.trail.spine(this.spineAt, this.spineOut);

    // The trail records where the head has been, including its height — but a
    // reared head would then drag the whole body up into the air behind it.
    // So the spine takes its path from the trail and its *height* from the
    // water, blending up to the head over the first few segments to make a
    // neck, and undulating into humps further back.
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = this.parts.segments[i];
      const p = this.spineOut[i];
      seg.position.set(p.x, p.y, p.z);

      const surface = sampleHeight(p.x, p.z, time);
      const undulation = Math.sin(time * 1.9 - i * 0.62) * (1.9 - i * 0.07);
      const swimming = surface - 1.2 + undulation;
      const neck = clamp(1 - i / 3.6, 0, 1);
      seg.position.y = lerp(swimming, this.head.y, neck * neck);

      // Each segment looks at the one ahead of it, which is what sells the
      // body as a single animal rather than a string of beads.
      _w.copy(i === 0 ? this.head : this.parts.segments[i - 1].position);
      seg.lookAt(_w);
    }
  }

  dispose() {
    disposeGeometry(this.group);
    this.material.dispose();
    this.e.ctx.hud.setThreat(0, null);
  }
}

/** A Marine sloop that gives chase and exchanges fire. */
class PatrolShip {
  constructor(encounters, position) {
    this.e = encounters;
    const built = createPatrolShip(Math.floor(encounters.rng() * 1e6));
    this.group = built.group;
    this.group.rotation.order = "YXZ";
    this.material = built.material;

    this.position = position.clone();
    this.heading = encounters.rng() * TAU;
    this.speed = 0;
    this.maxHp = 160;
    this.hp = this.maxHp;
    this.fireTimer = range(encounters.rng, 2, 5);
    this.alive = true;
    this.finished = false;
    this.sinking = 0;
  }

  hitSphere(out) {
    out.copy(this.position);
    out.y += 2;
    out.r = 4.6;
    return out;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.e.ctx.hud.setThreat(this.hp / this.maxHp, "Marine Patrol");
    if (this.hp <= 0) {
      this.alive = false;
      this.sinking = 4;
      this.e.reward(900, "The patrol strikes her colours.");
      this.e.ctx.hud.setThreat(0, null);
    }
  }

  update(dt, time, shipPos) {
    if (!this.alive) {
      this.sinking -= dt;
      this.group.position.y -= dt * 1.6;
      this.group.rotation.z += dt * 0.25;
      if (this.sinking <= 0) this.finished = true;
      return;
    }

    const dx = shipPos.x - this.position.x;
    const dz = shipPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    // Close to gun range, then hold station alongside rather than ramming.
    const want = dist > 70 ? 15 : dist < 40 ? -6 : 6;
    this.speed = damp(this.speed, want, 1.2, dt);
    this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 0.9, dt);
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;

    if (dist < 110) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = range(this.e.rng, 3.4, 6);
        _w.copy(this.position);
        _w.y += 2.4;
        this.e.fireAtPlayer(_w, shipPos);
      }
    }
    if (dist > 420) this.finished = true;

    this.group.position.set(
      this.position.x,
      sampleHeight(this.position.x, this.position.z, time) - 0.4,
      this.position.z
    );
    this.group.rotation.y = this.heading;
    this.group.rotation.x = Math.sin(time * 0.8) * 0.05;
    this.group.rotation.z = Math.sin(time * 0.62 + 1) * 0.07;
  }

  dispose() {
    disposeGeometry(this.group);
    this.material.dispose();
    this.e.ctx.hud.setThreat(0, null);
  }
}
