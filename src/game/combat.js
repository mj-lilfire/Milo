import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, damp, range, makeRng, hashString } from "../core/utils.js";
import { createCharacter, createLabel } from "../world/character.js";
import { disposeGeometry } from "../core/engine.js";

const _v = new THREE.Vector3();

/** Shared flat sprites for the little health pips over an enemy's head. */
function healthBarPair() {
  const back = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0x1a0f0a, depthTest: false, transparent: true, opacity: 0.85,
  }));
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xd6452f, depthTest: false, transparent: true,
  }));
  back.scale.set(1.3, 0.15, 1);
  fill.scale.set(1.24, 0.1, 1);
  back.renderOrder = 60;
  fill.renderOrder = 61;
  return { back, fill };
}

/**
 * A hostile islander.
 *
 * The AI is deliberately readable rather than clever: wander, notice, close in,
 * telegraph, swing. A player should always be able to see a hit coming and
 * step out of it, which matters a lot when they are aiming with a thumb.
 */
export class Enemy {
  constructor(spec, position, terrain, index = 0) {
    const rng = makeRng(hashString((spec.id || "foe") + index));
    this.spec = spec;
    this.name = spec.name || "Marine";
    this.terrain = terrain;

    this.rig = createCharacter(spec.look || {});
    this.group = this.rig.group;
    this.group.position.copy(position);

    this.home = position.clone();
    this.maxHp = spec.hp ?? 60;
    this.hp = this.maxHp;
    this.damage = spec.damage ?? 9;
    this.speed = spec.speed ?? 3.4;
    this.aggroRange = spec.aggroRange ?? 18;
    this.attackRange = spec.attackRange ?? 2.4;
    this.attackCooldown = spec.attackCooldown ?? 1.9;

    this.state = "idle";
    this.cooldown = range(rng, 0, 1.4);
    this.stun = 0;
    this.deadTimer = 0;
    this.hitLanded = false;
    this.wanderAngle = rng() * TAU;
    this.wanderTimer = range(rng, 1, 4);
    this.rng = rng;

    const label = createLabel(this.name, { sub: spec.title || "" });
    label.position.y = 2.55;
    label.scale.multiplyScalar(0.78);
    this.label = label;
    this.group.add(label);

    const { back, fill } = healthBarPair();
    back.position.y = 2.15;
    fill.position.y = 2.15;
    this.group.add(back, fill);
    this.bar = { back, fill };
    this.barVisible = false;
    back.visible = fill.visible = false;

    this.onDefeated = null;
    this.onHitPlayer = null;
  }

  get alive() { return this.hp > 0; }

  takeDamage(amount, fromDir) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.stun = 0.35;
    this.state = this.hp > 0 ? "hurt" : "dead";
    this.barVisible = true;
    this.bar.back.visible = this.bar.fill.visible = true;

    // Knock them back a step so hits read clearly.
    if (fromDir) {
      this.group.position.x += fromDir.x * 0.55;
      this.group.position.z += fromDir.z * 0.55;
    }
    if (!this.alive) {
      this.deadTimer = 2.2;
      this.rig.setState("hurt");
      this.label.visible = false;
      this.bar.back.visible = this.bar.fill.visible = false;
      this.onDefeated?.(this);
    }
    return true;
  }

  update(dt, playerPos, opts = {}) {
    const g = this.group.position;

    if (!this.alive) {
      // Topple over and sink away.
      this.deadTimer -= dt;
      this.rig.group.rotation.x = damp(this.rig.group.rotation.x, -Math.PI / 2.1, 5, dt);
      this.group.position.y = damp(this.group.position.y, this.terrain.heightAt(g.x, g.z) - 1.1, 1.2, dt);
      this.rig.update(dt, 0);
      return;
    }

    const dx = playerPos.x - g.x;
    const dz = playerPos.z - g.z;
    const dist = Math.hypot(dx, dz);

    if (this.stun > 0) {
      this.stun -= dt;
      this.rig.setState("hurt");
    } else if (opts.peaceful) {
      this.state = "idle";
    } else if (dist < this.attackRange) {
      this.state = "attack";
    } else if (dist < this.aggroRange) {
      this.state = "chase";
    } else if (this.state !== "idle" && dist > this.aggroRange * 1.5) {
      this.state = "idle";
    }

    switch (this.state) {
      case "chase": {
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        this.moveBy(nx * this.speed * dt, nz * this.speed * dt);
        this.rig.faceAngle(Math.atan2(nx, nz));
        this.rig.setState("walk");
        break;
      }
      case "attack": {
        this.rig.faceAngle(Math.atan2(dx, dz));
        this.cooldown -= dt;
        if (this.cooldown <= 0) {
          this.cooldown = this.attackCooldown;
          this.rig.setState("attack");
          this.hitLanded = false;
        }
        // Damage lands partway through the swing, not on the button press.
        if (this.rig.state === "attack" && !this.hitLanded && this.rig.attackTimer < 0.28) {
          this.hitLanded = true;
          if (dist < this.attackRange + 0.7) this.onHitPlayer?.(this.damage, this);
        }
        if (this.rig.state !== "attack") this.rig.setState("idle");
        break;
      }
      case "hurt": {
        if (this.stun <= 0) this.state = "chase";
        break;
      }
      default: {
        // Idle patrol around the spot they were placed.
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = range(this.rng, 2.5, 6);
          this.wanderAngle = this.rng() * TAU;
        }
        const drift = Math.hypot(g.x - this.home.x, g.z - this.home.z);
        if (drift > 9) this.wanderAngle = Math.atan2(this.home.x - g.x, this.home.z - g.z);
        if (this.wanderTimer > 3.2) {
          this.moveBy(Math.sin(this.wanderAngle) * 1.1 * dt, Math.cos(this.wanderAngle) * 1.1 * dt);
          this.rig.faceAngle(this.wanderAngle);
          this.rig.setState("walk");
        } else {
          this.rig.setState("idle");
        }
        break;
      }
    }

    this.group.position.y = this.terrain.heightAt(g.x, g.z);
    this.rig.update(dt, this.speed);

    if (this.barVisible) {
      const frac = clamp(this.hp / this.maxHp, 0, 1);
      this.bar.fill.scale.x = 1.24 * frac;
      // Shrink from the right edge so the bar drains rather than recentres.
      this.bar.fill.position.x = -(1.24 * (1 - frac)) / 2;
    }
    const near = dist < 26;
    this.label.visible = near;
    if (this.barVisible) this.bar.back.visible = this.bar.fill.visible = near;
  }

  moveBy(dx, dz) {
    const g = this.group.position;
    const nx = g.x + dx, nz = g.z + dz;
    // Don't let them wade out to sea chasing the player.
    if (this.terrain.heightAt(nx, nz) > 0.2) {
      g.x = nx;
      g.z = nz;
    }
  }

  dispose() {
    this.label.material.map?.dispose();
    this.label.material.dispose();
    this.bar.back.material.dispose();
    this.bar.fill.material.dispose();
    // The body is a dozen merged buffers of its own; the shared material it
    // draws with is left alone.
    disposeGeometry(this.group);
  }
}

/**
 * Resolves the player's own swing.
 *
 * A generous cone rather than a precise ray: the player is aiming with a thumb
 * on a moving deck, and whiffing a hit that visually connected feels broken.
 */
export function playerStrike(player, enemies, { reach = 2.9, arc = Math.PI * 0.42, damage = 26 } = {}) {
  const fwd = player.forward(_v).setY(0).normalize();
  const hits = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.group.position.x - player.position.x;
    const dz = e.group.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > reach) continue;
    const dot = (dx / (dist || 1)) * fwd.x + (dz / (dist || 1)) * fwd.z;
    if (dot < Math.cos(arc)) continue;
    e.takeDamage(damage, { x: dx / (dist || 1), z: dz / (dist || 1) });
    hits.push(e);
  }
  return hits;
}
