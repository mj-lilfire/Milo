import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, damp } from "../core/utils.js";

/**
 * The crew ashore.
 *
 * Recruited crewmates disembark with the captain and keep station around them
 * in a loose ring, rather than standing on the jetty where they were spawned.
 * When something hostile comes close they break formation, go for it, and fight
 * — which is what "the crew hit harder alongside you" ought to mean.
 *
 * Deliberately loose: they hold a slot they can drift out of, they separate
 * from each other rather than stacking, and they give up a chase that takes
 * them too far from their captain. Tight formation-keeping looks robotic and
 * makes a narrow jetty impassable.
 */

const SLOT_DIST = 3.2;
const SLOT_SLACK = 1.7;       // how far out of position before they bother moving
const ENGAGE_RANGE = 15;      // how close a threat has to be before they break off
const LEASH = 26;             // how far they will chase from the captain
const ATTACK_RANGE = 2.5;
const CATCH_UP = 34;          // beyond this they are lost, and are brought forward

const _v = new THREE.Vector3();
const _slot = new THREE.Vector3();

/** Attach follow state to a spawned crew record. */
export function makeFollower(record, index, total) {
  // Spread the ring so nobody is directly in front of the captain.
  const spread = TAU * 0.72;
  const t = total <= 1 ? 0.5 : index / (total - 1);
  record.follower = {
    slotAngle: Math.PI + (t - 0.5) * spread,
    slotDist: SLOT_DIST + (index % 3) * 0.75,
    speed: 0,
    attackCooldown: 0.6 + index * 0.23,
    target: null,
    striking: 0,
  };
  return record;
}

/**
 * Move and fight the whole party.
 *
 * @param followers  crew records carrying `.follower`
 * @param world      { terrain, colliders, enemies, player, audio }
 */
export function updateParty(followers, dt, world) {
  const { terrain, colliders, enemies, player } = world;

  for (const rec of followers) {
    const f = rec.follower;
    if (!f) continue;
    const pos = rec.rig.group.position;

    f.attackCooldown -= dt;
    if (f.striking > 0) f.striking -= dt;

    // --- pick a fight, or keep station ------------------------------------
    f.target = nearestThreat(enemies, pos, player.position);

    let desiredX, desiredZ, hurrying = false;

    if (f.target) {
      const t = f.target.group.position;
      desiredX = t.x;
      desiredZ = t.z;
      hurrying = true;
    } else {
      // Slot sits behind the captain, rotating with the way they are facing.
      const a = player.yaw + f.slotAngle;
      _slot.set(
        player.position.x + Math.sin(a) * f.slotDist,
        0,
        player.position.z + Math.cos(a) * f.slotDist
      );
      desiredX = _slot.x;
      desiredZ = _slot.z;
    }

    const dx = desiredX - pos.x;
    const dz = desiredZ - pos.z;
    const dist = Math.hypot(dx, dz);
    const fromCaptain = Math.hypot(pos.x - player.position.x, pos.z - player.position.z);

    // Lost behind a cliff or left on the jetty: bring them up rather than
    // letting the party quietly disband.
    if (fromCaptain > CATCH_UP) {
      const a = player.yaw + f.slotAngle;
      pos.x = player.position.x + Math.sin(a) * f.slotDist;
      pos.z = player.position.z + Math.cos(a) * f.slotDist;
      pos.y = terrain.heightAt(pos.x, pos.z);
      f.speed = 0;
      continue;
    }

    // --- strike ------------------------------------------------------------
    if (f.target && dist < ATTACK_RANGE) {
      rec.rig.faceAngle(Math.atan2(dx, dz));
      if (f.attackCooldown <= 0) {
        f.attackCooldown = 1.5 + Math.random() * 0.6;
        f.striking = 0.4;
        rec.rig.setState("attack");
        const damage = rec.member?.damage ?? 16;
        const d = dist || 1;
        f.target.takeDamage(damage, { x: dx / d, z: dz / d });
        world.audio?.hit();
      }
      f.speed = damp(f.speed, 0, 9, dt);
      settle(pos, terrain);
      rec.rig.update(dt, 0);
      continue;
    }

    // --- move --------------------------------------------------------------
    const threshold = f.target ? ATTACK_RANGE * 0.8 : SLOT_SLACK;
    if (dist > threshold) {
      // Hurry when chasing or badly out of position; stroll when close.
      const want = hurrying ? 6.2 : clamp(2.4 + (dist - SLOT_SLACK) * 1.5, 2.4, 7.4);
      f.speed = damp(f.speed, want, 7, dt);
      const step = Math.min(f.speed * dt, dist);
      const nx = pos.x + (dx / dist) * step;
      const nz = pos.z + (dz / dist) * step;
      // They wade no deeper than the captain would — but if they have somehow
      // ended up out of their depth, they must still be able to get out, or
      // the check that keeps them dry becomes the thing that drowns them.
      const stranded = terrain.heightAt(pos.x, pos.z) <= -0.9;
      if (stranded || terrain.heightAt(nx, nz) > -0.9) {
        pos.x = nx;
        pos.z = nz;
      }
      rec.rig.faceAngle(Math.atan2(dx, dz));
      if (f.striking <= 0) rec.rig.setState("walk");
    } else {
      f.speed = damp(f.speed, 0, 9, dt);
      if (f.striking <= 0) {
        rec.rig.setState("idle");
        // Standing about: turn to the captain, the way a person would.
        if (!f.target && fromCaptain < 9) {
          rec.rig.facePoint(player.position.x, player.position.z);
        }
      }
    }

    separate(rec, followers);
    pushOutOfProps(pos, colliders);
    settle(pos, terrain);
    rec.rig.update(dt, f.speed);
  }
}

/** The closest living enemy worth breaking formation for. */
function nearestThreat(enemies, from, captain) {
  let best = null;
  let bestD = ENGAGE_RANGE;
  for (const e of enemies || []) {
    if (!e.alive) continue;
    const p = e.group.position;
    const d = Math.hypot(p.x - from.x, p.z - from.z);
    // Only worth chasing if it is also near the captain — no wandering off
    // across the island after something that was never a problem.
    if (Math.hypot(p.x - captain.x, p.z - captain.z) > LEASH) continue;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Keep crewmates from standing inside one another. */
function separate(rec, followers) {
  const pos = rec.rig.group.position;
  for (const other of followers) {
    if (other === rec || !other.follower) continue;
    const o = other.rig.group.position;
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const d2 = dx * dx + dz * dz;
    const min = 1.45;
    if (d2 > min * min || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const push = (min - d) / d * 0.5;
    pos.x += dx * push;
    pos.z += dz * push;
  }
}

function pushOutOfProps(pos, colliders) {
  for (const c of colliders || []) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const min = c.r + 0.45;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    pos.x += (dx / d) * (min - d);
    pos.z += (dz / d) * (min - d);
  }
}

function settle(pos, terrain) {
  pos.y = terrain.heightAt(pos.x, pos.z);
}
