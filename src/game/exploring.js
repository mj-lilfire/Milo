import * as THREE from "../../vendor/three-0.160.1.module.min.js";
import { TAU, clamp, damp, makeRng, hashString, range } from "../core/utils.js";
import { Ocean, sampleHeight } from "../world/ocean.js";
import { Sky } from "../world/sky.js";
import { buildIsland, createChest, resolvePlace, LAND_MIN_HEIGHT } from "../world/island.js";
import { createCharacter, createLabel } from "../world/character.js";
import { Enemy, playerStrike } from "./combat.js";
import { matches } from "./quests.js";
import { makeFollower, updateParty } from "./followers.js";
import { disposeObject } from "../core/engine.js";
import { SHIP } from "../world/ship.js";

const _v = new THREE.Vector3();
const INTERACT_RANGE = 3.4;

/**
 * Ashore.
 *
 * An island scene is built on landfall and torn down on departure — one island
 * is resident at a time, which keeps memory flat however far you sail. Islands
 * are built in their own local space centred on the origin; only the sea scene
 * uses world coordinates.
 */
export class ExploringMode {
  constructor(ctx) {
    this.ctx = ctx; // { engine, input, hud, audio, player, progress, dialogue, crewById }
    this.scene = null;
    this.island = null;
    this.spec = null;
    this.npcs = [];
    this.enemies = [];
    this.chests = [];
    this.attackCooldown = 0;
    this.hurtFlash = 0;
    this.dying = false;

    this.onDepart = null;
    this.onQuestChanged = null;
  }

  // --- construction ---------------------------------------------------------

  enter(spec, shipGroup) {
    const { engine, player, progress, audio } = this.ctx;
    this.spec = spec;
    this.scene = new THREE.Scene();

    const climate = spec.landSky || {};
    this.scene.fog = new THREE.FogExp2(climate.horizon ?? 0xcfe4ef, climate.fogDensity ?? 0.0016);

    this.sky = new Sky(this.scene, { clouds: 16, birds: 5, seed: hashString(spec.id) });
    this.sky.setPalette({
      top: climate.top ?? 0x3d81c4,
      horizon: climate.horizon ?? 0xcfe4ef,
      sunColor: climate.sun ?? 0xfff0cc,
      haze: climate.haze ?? 0.4,
      sunIntensity: climate.sunIntensity ?? 2.2,
      ambientSky: climate.ambientSky ?? 0xbcd8e8,
      ambientGround: climate.ambientGround ?? 0x4a5f52,
      ambientIntensity: climate.ambientIntensity ?? 1.15,
      cloudColor: climate.cloud ?? 0xffffff,
      cloudOpacity: climate.cloudOpacity ?? 0.82,
    });

    this.ocean = new Ocean(this.scene, { rings: 92, segments: 112, maxRadius: 5000 });
    const water = spec.landWater || spec.seaWater || {};
    this.ocean.setPalette({
      deep: water.deep ?? 0x0a3b5c,
      shallow: water.shallow ?? 0x2d8fae,
      sky: climate.horizon ?? 0x9fc9e2,
      fog: climate.horizon ?? 0xbcd8e8,
      fogDensity: climate.fogDensity ?? 0.0016,
    });
    this.ocean.setSunDirection(this.sky.sunDirection);

    this.island = buildIsland(spec);
    this.scene.add(this.island.group);

    // The ship comes ashore with us — it's moved between scenes rather than
    // duplicated, so there is only ever one hull in memory.
    this.shipGroup = shipGroup;
    if (shipGroup) {
      this.scene.add(shipGroup);
      const m = this.island.dock.mooring;
      shipGroup.position.set(m.x, -0.35, m.z);
      shipGroup.rotation.set(0, this.island.dock.angle + Math.PI / 2, 0);
      shipGroup.updateMatrixWorld(true);
    }

    this.spawnNpcs();
    this.enemyGroups = null;
    this.fading = [];
    this.syncEnemies();
    this.spawnChests();
    this.spawnBeacons();
    this.buildQuestMarker();

    // Step off the gangplank onto the jetty.
    const landing = this.island.dock.landing;
    player.position.copy(landing);
    player.velocityY = 0;
    player.onGround = true;
    player.yaw = this.island.dock.angle; // look down the jetty, toward land
    player.pitch = 0;
    player.onFootstep = () => {
      const h = this.island.terrain.heightAt(player.position.x, player.position.z);
      audio.step(h < 1.4);
    };

    this.scene.add(engine.camera);
    engine.setScene(this.scene);
    audio.setAmbience(spec.ambience || "shore");

    progress.markVisited(spec.id);
    this.attackCooldown = 0;
    this.dying = false;
    this.refreshObjective();
  }

  spawnNpcs() {
    const { progress, crewById } = this.ctx;
    this.npcs = [];
    const all = [...(this.spec.npcs || [])];

    // Recruited crew come ashore with their captain and follow them around.
    const crewDefs = [];
    if (this.spec.crewAshore !== false) {
      progress.crew.forEach((id, i) => {
        const member = crewById(id);
        if (!member) return;
        crewDefs.push({
          id: "crew:" + id,
          crewId: id,
          member,
          name: member.name,
          role: member.role,
          look: member.look,
          at: { angle: (i / 6) * TAU, dist: 0.12 },
          nearDock: true,
          talks: member.shipTalks || [{ lines: [`${member.quip || "Ready when you are, Captain."}`] }],
        });
      });
      all.push(...crewDefs);
    }

    for (const def of all) {
      if (def.when && !matches(def.when, progress, this.spec.id)) continue;
      // Crew come down the jetty onto the beach, not off the end of it: the
      // landing point sits out over open water, so offsetting around it drops
      // people straight into the sea.
      const pos = def.nearDock
        ? resolvePlace(
            this.offsetFrom(this.island.dock.inland, def.at),
            this.island.terrain,
            LAND_MIN_HEIGHT
          )
        : resolvePlace(def.at, this.island.terrain, LAND_MIN_HEIGHT);
      const y = this.island.terrain.heightAt(pos.x, pos.z);

      const rig = createCharacter(def.look || {});
      rig.group.position.set(pos.x, y, pos.z);
      rig.faceAngle(def.facing ?? Math.atan2(-pos.x, -pos.z));
      rig.facing = rig.targetFacing;

      const label = createLabel(def.name, { sub: def.role || "" });
      label.position.y = 2.55;
      label.scale.multiplyScalar(0.8);
      rig.group.add(label);

      this.scene.add(rig.group);
      const record = { def, rig, home: new THREE.Vector3(pos.x, y, pos.z), label };
      if (def.crewId) {
        record.member = def.member;
        makeFollower(record, crewDefs.indexOf(def), crewDefs.length);
      }
      this.npcs.push(record);
    }
    this.followers = this.npcs.filter((n) => n.follower);
  }

  offsetFrom(base, at) {
    const a = at?.angle ?? 0;
    const d = (at?.dist ?? 0.1) * 40;
    return { x: base.x + Math.sin(a) * d, z: base.z + Math.cos(a) * d };
  }

  /**
   * Bring enemy groups in and out of the world as the quest moves.
   *
   * Groups are gated by quest step, and a step can change while the player is
   * standing on the island — so this runs on every objective change, not just
   * on landfall. Spawning only at arrival would leave a camp permanently empty
   * for anyone who took the quest on the spot.
   */
  syncEnemies() {
    const { progress } = this.ctx;
    if (!this.enemyGroups) {
      this.enemyGroups = (this.spec.enemies || []).map((def) => ({
        def, active: false, enemies: [],
      }));
      this.fading = [];
    }

    for (const group of this.enemyGroups) {
      const should = !group.def.when || matches(group.def.when, progress, this.spec.id);
      if (should && !group.active) {
        group.enemies = this.buildGroup(group.def);
        group.active = true;
      } else if (!should && group.active) {
        this.retireGroup(group);
      }
    }
    this.rebuildEnemyList();
  }

  /**
   * A group whose step has passed leaves the world.
   *
   * Anyone mid-collapse is moved to a short-lived list so their fall finishes
   * on screen; everyone else is removed and freed immediately. Dropping the
   * group's array without doing this orphans the bodies in the scene, which
   * is both a visible bug and a steady GPU leak across a long voyage.
   */
  retireGroup(group) {
    for (const e of group.enemies) {
      if (!e.alive && e.deadTimer > -4) {
        this.fading.push(e);
      } else {
        this.scene.remove(e.group);
        e.dispose();
      }
    }
    group.enemies = [];
    group.active = false;
  }

  /** Always a fresh array: callers may be mid-iteration over the old one. */
  rebuildEnemyList() {
    this.enemies = [
      ...this.enemyGroups.flatMap((g) => g.enemies),
      ...this.fading,
    ];
  }

  buildGroup(group) {
    const out = [];
    const rng = makeRng(hashString(this.spec.id + (group.id || "foes")));
    const origin = resolvePlace(group.around || { angle: 0, dist: 0.4 }, this.island.terrain, LAND_MIN_HEIGHT);
    const count = group.count ?? 3;
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const r = range(rng, 3, group.radius ?? 18);
      const x = origin.x + Math.sin(a) * r;
      const z = origin.z + Math.cos(a) * r;
      const y = this.island.terrain.heightAt(x, z);
      if (y < 0.6) continue;
      const enemy = new Enemy(
        { ...group.foe, id: (group.id || "foe") + i },
        new THREE.Vector3(x, y, z),
        this.island.terrain,
        i
      );
      enemy.onHitPlayer = (dmg) => this.damagePlayer(dmg);
      enemy.onDefeated = () => this.onEnemyDefeated(group);
      this.scene.add(enemy.group);
      out.push(enemy);
    }
    if (group.boss) {
      const p = resolvePlace(group.boss.at || group.around, this.island.terrain, LAND_MIN_HEIGHT);
      const y = this.island.terrain.heightAt(p.x, p.z);
      const boss = new Enemy(group.boss, new THREE.Vector3(p.x, y, p.z), this.island.terrain, 99);
      boss.isBoss = true;
      boss.onHitPlayer = (dmg) => this.damagePlayer(dmg);
      boss.onDefeated = () => this.onBossDefeated(group);
      this.scene.add(boss.group);
      out.push(boss);
    }
    return out;
  }

  /** Places that advance the quest simply by being reached. */
  spawnBeacons() {
    this.beacons = (this.spec.beacons || []).map((def) => {
      const pos = resolvePlace(def.at, this.island.terrain, LAND_MIN_HEIGHT);
      return { def, x: pos.x, z: pos.z, fired: false };
    });
  }

  checkBeacons() {
    const { progress, player, hud, audio } = this.ctx;
    for (const b of this.beacons) {
      if (b.fired) continue;
      if (progress.step(this.spec.id) !== b.def.advancesStep) continue;
      const d = Math.hypot(player.position.x - b.x, player.position.z - b.z);
      if (d > (b.def.radius ?? 18)) continue;
      b.fired = true;
      progress.advance(this.spec.id);
      audio.click();
      if (b.def.text) hud.toast(b.def.text, 4200);
      if (b.def.flag) progress.setFlag(b.def.flag);
      this.refreshObjective();
    }
  }

  spawnChests() {
    const { progress } = this.ctx;
    this.chests = [];
    for (const def of this.spec.chests || []) {
      if (def.flag && progress.hasFlag(def.flag)) continue;
      const pos = resolvePlace(def.at, this.island.terrain, LAND_MIN_HEIGHT);
      const chest = createChest(this.spec.palette);
      chest.group.position.set(pos.x, this.island.terrain.heightAt(pos.x, pos.z), pos.z);
      chest.group.rotation.y = def.rotation ?? Math.atan2(-pos.x, -pos.z);
      this.scene.add(chest.group);
      this.chests.push({ def, chest });
    }
  }

  /** A gold column over the current objective, so nobody gets lost. */
  buildQuestMarker() {
    const geo = new THREE.CylinderGeometry(1.5, 1.9, 34, 10, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.2,
      side: THREE.DoubleSide, depthWrite: false, fog: true,
    });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  refreshObjective() {
    const { hud, progress } = this.ctx;
    const step = progress.step(this.spec.id);
    const quest = this.spec.quest;
    const done = progress.isComplete(this.spec.id);
    const line = done
      ? "Logged. Set sail when you're ready."
      : quest?.steps?.[step]?.objective ?? "Explore the island.";
    hud.setObjective(this.spec.name, line);

    const targetName = done ? null : quest?.steps?.[step]?.marker;
    if (targetName && this.island.places[targetName]) {
      const p = this.island.places[targetName];
      this.marker.position.set(p.x, p.y + 14, p.z);
      this.marker.visible = true;
    } else if (targetName && targetName === "dock") {
      this.marker.position.copy(this.island.dock.landing).setY(this.island.dock.landing.y + 14);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
    this.syncEnemies();
    this.onQuestChanged?.();
  }

  // --- combat ---------------------------------------------------------------

  damagePlayer(amount) {
    const { progress, audio, hud } = this.ctx;
    if (this.dying) return;
    progress.health = Math.max(0, progress.health - amount);
    this.hurtFlash = 1;
    audio.hurt();
    hud.setHealth(progress.health / progress.maxHealth);
    if (progress.health <= 0) this.knockOut();
  }

  async knockOut() {
    const { hud, progress, player, audio } = this.ctx;
    this.dying = true;
    audio.hurt();
    hud.clearPrompt();
    await hud.fade(true, 700);
    hud.toast("You were knocked out — dragged back to the jetty.");
    progress.health = Math.round(progress.maxHealth * 0.6);
    hud.setHealth(progress.health / progress.maxHealth);
    // Reset the fight rather than leaving a half-cleared camp behind.
    for (const e of this.enemies) {
      if (e.deadTimer < 0) continue; // already sunk; leave it
      e.hp = e.maxHp;
      e.state = "idle";
      e.rig.group.rotation.x = 0;
      e.group.position.copy(e.home);
      e.label.visible = true;
      e.barVisible = false;
      e.bar.back.visible = e.bar.fill.visible = false;
    }
    player.position.copy(this.island.dock.landing);
    player.velocityY = 0;
    player.yaw = this.island.dock.angle; // look down the jetty, toward land
    await hud.fade(false, 700);
    this.dying = false;
  }

  onEnemyDefeated(group) {
    const { progress, hud, audio } = this.ctx;
    audio.hit();
    if (group.rewardEach) {
      progress.addBerries(group.rewardEach);
      hud.toast("+" + group.rewardEach + " Berries");
    }
    const remaining = this.enemies.filter((e) => e.alive && !e.isBoss).length;
    if (remaining === 0 && group.clearAdvancesStep !== undefined
        && progress.step(this.spec.id) === group.clearAdvancesStep) {
      progress.advance(this.spec.id);
      audio.fanfare();
      hud.toast("The way is clear!");
      this.refreshObjective();
    }
  }

  onBossDefeated(group) {
    const { progress, hud, audio } = this.ctx;
    audio.fanfare();
    if (group.boss.reward) {
      progress.addBerries(group.boss.reward);
      hud.setBerries(progress.berries);
    }
    if (group.boss.advancesStep !== undefined
        && progress.step(this.spec.id) === group.boss.advancesStep) {
      progress.advance(this.spec.id);
    }
    if (group.boss.flag) progress.setFlag(group.boss.flag);
    hud.banner("VICTORY", group.boss.name, "defeated", 3200);
    this.refreshObjective();
  }

  tryAttack() {
    const { player, audio, hud } = this.ctx;
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 0.52;
    audio.swing();
    const hits = playerStrike(player, this.enemies, {
      damage: 24 + this.ctx.progress.crew.length * 4, // the crew's help counts
    });
    if (hits.length) audio.hit();
  }

  // --- interaction ----------------------------------------------------------

  /** Nearest thing the player is both close to and roughly looking at. */
  findInteractable() {
    const { player } = this.ctx;
    const fwd = player.forward(_v).setY(0).normalize();
    let best = null;

    const consider = (x, z, payload, range = INTERACT_RANGE) => {
      const dx = x - player.position.x;
      const dz = z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d > range) return;
      // Practically on top of it: there is no meaningful direction to face,
      // and the dot product degenerates to zero, so skip the facing test
      // rather than silently offering nothing.
      const dot = d < 0.8 ? 1 : (dx / d) * fwd.x + (dz / d) * fwd.z;
      if (dot < 0.25) return;
      const score = d - dot * 1.2;
      if (!best || score < best.score) best = { ...payload, score, distance: d };
    };

    for (const npc of this.npcs) {
      consider(npc.rig.group.position.x, npc.rig.group.position.z,
        { kind: "npc", npc, label: `Talk to ${npc.def.name}` });
    }
    for (const c of this.chests) {
      if (c.chest.open) continue;
      consider(c.chest.group.position.x, c.chest.group.position.z,
        { kind: "chest", chest: c, label: "Open the chest" });
    }
    // The ship is a big target; give it a longer reach than a person.
    const m = this.island.dock.mooring;
    consider(m.x, m.z, { kind: "ship", label: "Set sail" }, 14);

    return best;
  }

  interact(target) {
    const { dialogue, progress, hud, audio, crewById } = this.ctx;
    if (!target) return;

    if (target.kind === "ship") {
      this.onDepart?.();
      return;
    }

    if (target.kind === "chest") {
      const { def, chest } = target.chest;
      chest.open = true;
      audio.pickup();
      if (def.berries) {
        progress.addBerries(def.berries);
        hud.setBerries(progress.berries);
        hud.toast("+" + def.berries.toLocaleString("en-US") + " Berries");
      }
      if (def.flag) progress.setFlag(def.flag);
      if (def.item) hud.toast("Found: " + def.item);
      if (def.advancesStep !== undefined && progress.step(this.spec.id) === def.advancesStep) {
        progress.advance(this.spec.id);
        this.refreshObjective();
      }
      return;
    }

    if (target.kind === "npc") {
      const npc = target.npc;
      npc.rig.facePoint(this.ctx.player.position.x, this.ctx.player.position.z);
      npc.rig.setState("talk");
      const started = dialogue.start(npc.def, progress, {
        islandId: this.spec.id,
        crewById,
        onNotice: (n) => this.handleNotice(n),
        onFinish: () => {
          npc.rig.setState("idle");
          this.refreshObjective();
        },
      });
      if (!started) {
        npc.rig.setState("idle");
        hud.toast(npc.def.name + " has nothing more to say.");
      }
    }
  }

  handleNotice(notice) {
    const { hud, audio, progress } = this.ctx;
    switch (notice.type) {
      case "toast":
        hud.toast(notice.text);
        if (notice.sound === "pickup") audio.pickup();
        hud.setBerries(progress.berries);
        break;
      case "recruit":
        audio.fanfare();
        hud.banner("NEW CREWMATE", notice.text.replace(" joined the crew!", ""), "joined the crew");
        this.ctx.onCrewChanged?.();
        this.spawnCrewAshore(notice.id);
        break;
      case "islandComplete":
        audio.fanfare();
        hud.banner("LOGGED", this.spec.name, "the Log Pose is settling…", 3600);
        this.ctx.onIslandComplete?.(this.spec);
        break;
      case "objective":
        audio.click();
        break;
      case "upgrade":
        audio.fanfare();
        hud.toast(notice.text, 4200);
        hud.setHull(progress.hull / progress.maxHull);
        break;
      case "vitals":
        hud.setHull(progress.hull / progress.maxHull);
        hud.setHealth(progress.health / progress.maxHealth);
        break;
      default:
        break;
    }
    this.refreshObjective();
  }

  /** Drop a freshly recruited crewmate into the world right away. */
  spawnCrewAshore(id) {
    const member = this.ctx.crewById(id);
    if (!member) return;
    const p = this.ctx.player.position;
    const x = p.x + Math.sin(this.ctx.player.yaw + 1.2) * 2.4;
    const z = p.z + Math.cos(this.ctx.player.yaw + 1.2) * 2.4;
    const rig = createCharacter(member.look);
    rig.group.position.set(x, this.island.terrain.heightAt(x, z), z);
    const label = createLabel(member.name, { sub: member.role });
    label.position.y = 2.55;
    label.scale.multiplyScalar(0.8);
    rig.group.add(label);
    this.scene.add(rig.group);
    const record = {
      def: {
        id: "crew:" + id, crewId: id, name: member.name, role: member.role,
        talks: member.shipTalks || [{ lines: [member.quip || "Let's go, Captain."] }],
      },
      rig,
      member,
      home: rig.group.position.clone(),
      label,
    };
    // They fall in with the rest of the party immediately, rather than waiting
    // for the next landfall to start following.
    this.followers = this.followers || [];
    makeFollower(record, this.followers.length, this.followers.length + 1);
    this.npcs.push(record);
    this.followers.push(record);
  }

  // --- frame ----------------------------------------------------------------

  update(dt, time) {
    const { input, hud, player, engine, dialogue, progress } = this.ctx;

    if (dialogue.active) {
      // Freeze the world's threats while talking, but keep it animating.
      if (input.consume("interact")) dialogue.advanceFromInput();
      input.consume("attack");
      for (const npc of this.npcs) npc.rig.update(dt, 0);
      for (const e of this.enemies) e.update(dt, player.position, { peaceful: true });
      this.updateWorld(dt, time);
      player.applyToCamera(engine.camera);
      return;
    }

    if (!this.dying) {
      player.stepGround(dt, input, {
        terrain: this.island.terrain,
        colliders: this.island.colliders,
        platforms: this.island.platforms,
      });
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (input.consume("attack")) this.tryAttack();

    // The party moves itself; everyone else just turns to look.
    updateParty(this.followers || [], dt, {
      terrain: this.island.terrain,
      colliders: this.island.colliders,
      enemies: this.enemies,
      player,
      audio: this.ctx.audio,
    });

    for (const npc of this.npcs) {
      const d = npc.rig.group.position.distanceTo(player.position);
      if (!npc.follower) {
        if (d < 6 && npc.rig.state !== "talk") npc.rig.facePoint(player.position.x, player.position.z);
        npc.rig.update(dt, 0);
      }
      npc.label.visible = d < 30;
    }
    for (const e of this.enemies) e.update(dt, player.position, { peaceful: this.dying });
    for (const c of this.chests) c.chest.update(dt);
    this.checkBeacons();
    this.pruneFallen();

    const target = this.findInteractable();
    if (target) {
      hud.setPrompt(target.label);
      if (input.consume("interact")) this.interact(target);
    } else {
      hud.clearPrompt();
      input.consume("interact");
    }

    if (this.marker.visible) {
      this.marker.rotation.y += dt * 0.5;
      this.marker.material.opacity = 0.13 + Math.sin(time * 2.2) * 0.06;
    }

    this.updateWorld(dt, time);
    player.applyToCamera(engine.camera);
  }

  updateWorld(dt, time) {
    const { engine, player } = this.ctx;
    _v.copy(player.position);
    this.ocean.update(time, _v);
    this.sky.update(dt, time, _v);
    if (this.shipGroup) {
      // The moored ship still rides the swell.
      this.shipGroup.position.y = sampleHeight(
        this.shipGroup.position.x, this.shipGroup.position.z, time) - 0.35;
      this.shipGroup.rotation.x = Math.sin(time * 0.7) * 0.02;
      this.shipGroup.rotation.z = Math.sin(time * 0.53 + 1) * 0.03;
    }
  }

  /** Remove bodies once they have sunk out of sight. */
  pruneFallen() {
    let dirty = false;
    const sift = (list) => list.filter((e) => {
      if (e.alive || e.deadTimer > -4) return true;
      this.scene.remove(e.group);
      e.dispose();
      dirty = true;
      return false;
    });
    for (const group of this.enemyGroups || []) group.enemies = sift(group.enemies);
    this.fading = sift(this.fading || []);
    if (dirty) this.rebuildEnemyList();
  }

  exit() {
    const { engine } = this.ctx;
    this.scene.remove(engine.camera);
    if (this.shipGroup) this.scene.remove(this.shipGroup);

    for (const e of this.enemies) e.dispose();
    for (const npc of this.npcs) {
      npc.label.material.map?.dispose();
      npc.label.material.dispose();
    }
    this.sky?.dispose();
    this.island?.dispose();
    if (this.scene) disposeObject(this.scene);

    this.scene = null;
    this.island = null;
    this.npcs = [];
    this.followers = [];
    this.enemies = [];
    this.chests = [];
    this.enemyGroups = null;
    this.fading = [];
  }
}
