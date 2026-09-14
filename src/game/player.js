import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { clamp, damp } from "../core/utils.js";

const PITCH_LIMIT = Math.PI / 2 - 0.05;
const _v = new THREE.Vector3();

/**
 * First-person controller.
 *
 * The same object is used ashore and aboard: `stepGround` walks the island
 * heightfield in world space, `stepDeck` walks the ship in its local space,
 * and the sailing code applies the hull transform afterwards. Keeping one
 * controller means look, bob and footstep feel identical in both.
 */
export class Player {
  constructor() {
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.velocityY = 0;
    this.onGround = true;

    this.eyeHeight = 1.68;
    this.radius = 0.46;
    this.walkSpeed = 5.2;
    this.runSpeed = 9.0;
    this.jumpSpeed = 6.4;
    this.gravity = 22;
    this.maxClimb = 1.5;     // rise per unit travelled before a slope blocks
    this.wadeDepth = -1.15;  // terrain height the player refuses to walk past

    this.bobPhase = 0;
    this.bobAmount = 0;
    this.speed = 0;
    this.inWater = false;

    this.onFootstep = null;
    this.lastStep = 0;
  }

  applyLook(input) {
    const look = input.takeLook();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch - look.y, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** World-space XZ movement direction from stick/keys, scaled 0..1. */
  intent(input) {
    const mx = input.move.x;
    const my = input.move.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag < 0.04) return { x: 0, z: 0, mag: 0 };
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Forward is -Z rotated by yaw; strafe is its perpendicular.
    const fx = -sin, fz = -cos;
    const rx = cos, rz = -sin;
    const nx = (fx * my + rx * mx) / (mag || 1);
    const nz = (fz * my + rz * mx) / (mag || 1);
    const len = Math.hypot(nx, nz) || 1;
    return { x: (nx / len) * mag, z: (nz / len) * mag, mag };
  }

  /** Slide out of any prop cylinders the player has ended up inside. */
  resolveColliders(colliders) {
    for (const c of colliders) {
      const dx = this.position.x - c.x;
      const dz = this.position.z - c.z;
      const minDist = c.r + this.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minDist * minDist || d2 < 1e-8) continue;
      // Only block if the player is actually beside it, not standing on top.
      if (this.position.y > c.h + 0.2) continue;
      const d = Math.sqrt(d2);
      const push = (minDist - d) / d;
      this.position.x += dx * push;
      this.position.z += dz * push;
    }
  }

  /** Highest platform surface under the player, or null. */
  platformHeight(platforms, x, z) {
    let best = null;
    for (const p of platforms) {
      const dx = x - p.cx;
      const dz = z - p.cz;
      // Project into the platform's own frame: +lz runs along it, +lx across.
      const s = Math.sin(p.angle), c = Math.cos(p.angle);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) > p.halfW || Math.abs(lz) > p.halfD) continue;
      // Only snap up to a platform the player could step onto.
      if (this.position.y + 0.6 < p.y) continue;
      if (best === null || p.y > best) best = p.y;
    }
    return best;
  }

  groundHeight(world, x, z) {
    const terrainH = world.terrain.heightAt(x, z);
    const plat = world.platforms ? this.platformHeight(world.platforms, x, z) : null;
    return plat !== null && plat > terrainH ? plat : terrainH;
  }

  /**
   * Walk on an island.
   * @param world {terrain, colliders, platforms}
   */
  stepGround(dt, input, world) {
    this.applyLook(input);
    const move = this.intent(input);
    const running = input.isHeld("run");
    const target = (running ? this.runSpeed : this.walkSpeed) * move.mag;

    this.speed = damp(this.speed, target, 12, dt);
    const step = this.speed * dt;

    if (move.mag > 0.01 && step > 0) {
      const curH = this.groundHeight(world, this.position.x, this.position.z);
      // Resolve each axis separately so the player slides along obstacles
      // instead of sticking to them.
      for (const axis of ["x", "z"]) {
        const delta = (axis === "x" ? move.x : move.z) * step;
        if (Math.abs(delta) < 1e-6) continue;
        const nx = this.position.x + (axis === "x" ? delta : 0);
        const nz = this.position.z + (axis === "z" ? delta : 0);
        const nh = this.groundHeight(world, nx, nz);
        if (nh < this.wadeDepth) continue;                       // too deep
        if (this.onGround && (nh - curH) / Math.abs(delta) > this.maxClimb) continue; // too steep
        this.position[axis] = axis === "x" ? nx : nz;
      }
    }

    this.resolveColliders(world.colliders || []);

    const groundY = this.groundHeight(world, this.position.x, this.position.z);
    this.inWater = groundY < 0.05;

    if (input.consume("jump") && this.onGround) {
      this.velocityY = this.jumpSpeed;
      this.onGround = false;
    }

    this.velocityY -= this.gravity * dt;
    this.position.y += this.velocityY * dt;

    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocityY = 0;
      this.onGround = true;
    } else if (this.position.y - groundY < 0.02) {
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.updateBob(dt, move.mag > 0.05 && this.onGround);
  }

  /**
   * Walk the ship's deck. `position` is in the ship's local space here; the
   * caller composes the hull transform onto it.
   */
  stepDeck(dt, input, ship, deckHeight, clampToDeck) {
    this.applyLook(input);
    const move = this.intent(input);
    const running = input.isHeld("run");
    const target = (running ? this.runSpeed * 0.7 : this.walkSpeed * 0.72) * move.mag;
    this.speed = damp(this.speed, target, 12, dt);
    const step = this.speed * dt;

    if (move.mag > 0.01) {
      this.position.x += move.x * step;
      this.position.z += move.z * step;
      clampToDeck(this.position);
    }

    const deckY = deckHeight(this.position.x, this.position.z);
    if (input.consume("jump") && this.onGround) {
      this.velocityY = this.jumpSpeed * 0.8;
      this.onGround = false;
    }
    this.velocityY -= this.gravity * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= deckY) {
      this.position.y = deckY;
      this.velocityY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.updateBob(dt, move.mag > 0.05 && this.onGround);
  }

  updateBob(dt, walking) {
    if (walking) {
      this.bobPhase += dt * (4.2 + this.speed * 0.72);
      this.bobAmount = damp(this.bobAmount, Math.min(this.speed / this.runSpeed, 1), 8, dt);
      // Fire a footstep at each bottom of the bob cycle.
      const cycle = Math.floor(this.bobPhase / Math.PI);
      if (cycle !== this.lastStep) {
        this.lastStep = cycle;
        this.onFootstep?.(this.inWater);
      }
    } else {
      this.bobAmount = damp(this.bobAmount, 0, 9, dt);
    }
  }

  /** Camera offset from the bob, in local space. */
  bobOffset(out = _v) {
    const a = this.bobAmount;
    return out.set(
      Math.cos(this.bobPhase * 0.5) * 0.055 * a,
      Math.abs(Math.sin(this.bobPhase)) * 0.075 * a,
      0
    );
  }

  /** Place a camera at the player's eye in world space. */
  applyToCamera(camera) {
    const bob = this.bobOffset();
    camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight + bob.y,
      this.position.z
    );
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    camera.rotation.z = bob.x * 0.35;
  }

  /** Unit vector the player is looking along. */
  forward(out = new THREE.Vector3()) {
    return out.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
  }
}
