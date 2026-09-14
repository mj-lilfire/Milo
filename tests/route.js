const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://127.0.0.1:8099/";
const SHOTS = process.env.SHOTS || "screenshots/route";

const errors = [];
let failures = 0;
function check(name, cond, detail = "") {
  if (!cond) { failures++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
  return cond;
}

require("fs").mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.click("#btn-new");
  await page.waitForTimeout(3000);

  // Record every geometry disposal so teardown can be audited by name rather
  // than by watching a counter race the transition fades.
  await page.evaluate(async () => {
    const THREE = await import("/vendor/three-0.160.1.module.min.js");
    window.__disposed = new Set();
    const orig = THREE.BufferGeometry.prototype.dispose;
    THREE.BufferGeometry.prototype.dispose = function () {
      window.__disposed.add(this.uuid);
      return orig.call(this);
    };
  });

  // dock() and depart() are async; wait for the transition to actually finish.
  const settle = async () => {
    await page.waitForFunction(() => !window.game.busy, null, { timeout: 25000 });
    await page.waitForTimeout(1500);
  };

  const residency = [];
  const count = await page.evaluate(() => window.game.sailing.islandProxies.length);
  console.log(`Walking the whole route: ${count} islands\n`);

  for (let i = 0; i < count; i++) {
    // Unlock up to this island and land on it.
    await page.evaluate((idx) => {
      window.game.progress.currentIndex = idx;
      window.game.exploring.ctx.progress = window.game.progress;
    }, i);
    await page.evaluate((idx) => window.game.dock(idx), i);
    await settle();

    const info = await page.evaluate(() => {
      const g = window.game;
      const e = g.exploring;
      return {
        state: g.state,
        id: e.spec?.id,
        name: e.spec?.name,
        npcs: e.npcs.length,
        enemies: e.enemies.length,
        chests: e.chests.length,
        beacons: (e.beacons || []).length,
        colliders: e.island?.colliders.length,
        calls: g.engine.renderer.info.render.calls,
        tris: g.engine.renderer.info.render.triangles,
        playerY: g.player.position.y,
        groundY: e.island.terrain.heightAt(g.player.position.x, g.player.position.z),
        objective: document.getElementById("objective-task").textContent,
        steps: e.spec.quest.steps.length,
      };
    });

    const ok =
      check(`${info.name}: lands`, info.state === "island") &
      check(`${info.name}: has islanders`, info.npcs >= 1, `${info.npcs}`) &
      check(`${info.name}: has scenery collision`, info.colliders > 20, `${info.colliders}`) &
      check(`${info.name}: player is above water`, info.playerY > 0.5, `y=${info.playerY.toFixed(2)}`) &
      check(`${info.name}: draw calls stay low`, info.calls < 150, `${info.calls}`) &
      check(`${info.name}: objective set`, info.objective.length > 8, info.objective);

    // Walk each quest step and confirm the world keeps up: objective text
    // changes, and gated enemies actually appear when their step arrives.
    let stepReport = [];
    for (let s = 0; s < info.steps; s++) {
      const r = await page.evaluate((step) => {
        const g = window.game;
        g.progress.setStep(g.exploring.spec.id, step);
        g.exploring.refreshObjective();
        return {
          objective: document.getElementById("objective-task").textContent,
          enemies: g.exploring.enemies.filter((e) => e.alive).length,
          marker: g.exploring.marker.visible,
        };
      }, s);
      stepReport.push(`s${s}:${r.enemies}f${r.marker ? "+m" : ""}`);
      check(`${info.name}: step ${s} has an objective`, r.objective.length > 8, r.objective);
    }

    // Any island with a fight must actually field one at some point.
    const hasFightData = await page.evaluate(() => (window.game.exploring.spec.enemies || []).length > 0);
    const everFought = stepReport.some((s) => Number(s.split(":")[1].split("f")[0]) > 0);
    if (hasFightData) check(`${info.name}: enemies appear on their step`, everFought, stepReport.join(" "));

    // Land a hit on whatever is out there.
    if (hasFightData) {
      const combat = await page.evaluate(async () => {
        const g = window.game;
        const spec = g.exploring.spec;
        const grp = (spec.enemies || [])[0];
        g.progress.setStep(spec.id, grp.when?.minStep ?? 1);
        g.exploring.refreshObjective();
        const foe = g.exploring.enemies.find((e) => e.alive);
        if (!foe) return { ok: false, why: "nobody spawned" };
        const before = foe.hp;
        g.player.position.set(foe.group.position.x, foe.group.position.y, foe.group.position.z + 1.6);
        g.player.yaw = 0;
        g.exploring.attackCooldown = 0;
        g.exploring.tryAttack();
        return { ok: foe.hp < before, before, after: foe.hp, name: foe.name };
      });
      check(`${info.name}: a swing connects`, combat.ok, combat.why || `${combat.name} ${combat.before}->${combat.after}`);
    }

    console.log(
      `  ${String(i + 1).padStart(2)}. ${info.name.padEnd(18)} ` +
      `npc:${String(info.npcs).padStart(2)} chest:${info.chests} beacon:${info.beacons} ` +
      `col:${String(info.colliders).padStart(3)} calls:${String(info.calls).padStart(3)} ` +
      `tris:${String(Math.round(info.tris / 1000)).padStart(3)}k  steps[${stepReport.join(" ")}]` +
      (ok ? "" : "   <-- PROBLEM")
    );

    await page.screenshot({ path: `${SHOTS}/${String(i + 1).padStart(2, "0")}-${info.id}.png` });

    // Note what the island owned, then confirm teardown released all of it
    // apart from the ship, which sails on with us.
    const owned = await page.evaluate(() => {
      const set = new Set();
      window.game.exploring.scene.traverse((o) => {
        if (o.geometry && !o.isSprite) set.add(o.geometry.uuid);
      });
      return [...set];
    });
    const shipParts = await page.evaluate(() => {
      const set = new Set();
      window.game.sailing.ship.group.traverse((o) => {
        if (o.geometry && !o.isSprite) set.add(o.geometry.uuid);
      });
      return set.size;
    });
    const before = await page.evaluate(
      () => window.game.engine.renderer.info.memory.geometries);

    await page.evaluate(() => window.game.depart());
    await settle();
    const back = await page.evaluate(() => window.game.state);
    check(`${info.name}: puts back to sea`, back === "sailing", back);

    const escaped = await page.evaluate(
      (uuids) => uuids.filter((u) => !window.__disposed.has(u)).length, owned);
    check(`${info.name}: island memory released`, escaped <= shipParts,
      `${escaped} geometries survived, ship accounts for ${shipParts}`);

    const after = await page.evaluate(
      () => window.game.engine.renderer.info.memory.geometries);
    residency.push({ name: info.name, before, after, delta: after - before });
  }

  // --- recruitment reaches the deck ---------------------------------------
  const crewOnDeck = await page.evaluate(async () => {
    const g = window.game;
    g.progress.crew = [];
    ["swordsman", "navigator", "sniper", "cook", "doctor", "princess"].forEach((c) => g.progress.recruit(c));
    g.sailing.refreshCrew();
    return { rigs: g.sailing.crewRigs.length, onShip: g.sailing.crewGroup.children.length };
  });
  check("a full crew stands on deck", crewOnDeck.rigs === 6 && crewOnDeck.onShip === 6, JSON.stringify(crewOnDeck));

  // --- memory must plateau, not climb with every landfall -----------------
  // The sea scene uploads a little more of itself as more of the route comes
  // into view, so the count legitimately rises early. What must not happen is
  // a fixed cost per landfall that never comes back.
  console.log("\n  resident geometries, ashore -> back at sea:");
  for (const r of residency) {
    console.log(`    ${r.name.padEnd(18)} ${String(r.before).padStart(4)} -> ${String(r.after).padStart(4)}  (${r.delta >= 0 ? "+" : ""}${r.delta})`);
  }
  // The strict guarantee is the per-island "island memory released" audit
  // above, which names every geometry that survives teardown. This is the
  // looser companion check, and it cannot demand a non-positive delta: the sea
  // scene keeps uploading more of itself as further islands come into view, so
  // a departure can legitimately end a few geometries up.
  const worst = Math.max(...residency.map((r) => r.delta));
  const netto = residency[residency.length - 1].after - residency[0].after;
  check("no per-landfall memory cost", worst <= 8,
    `worst landfall left +${worst} geometries behind`);
  check("most landfalls give memory back", residency.filter((r) => r.delta < 0).length >= 8,
    `${residency.filter((r) => r.delta < 0).length}/11 freed on departure, net +${netto} across the route`);

  const tex = await page.evaluate(() => window.game.engine.renderer.info.memory.textures);
  check("textures are released between islands", tex < 40, `${tex} textures`);

  check("no console errors across the whole route", errors.length === 0, errors.slice(0, 5).join(" | "));

  await browser.close();
  console.log(failures === 0 ? "\nROUTE OK — every island playable" : `\n${failures} PROBLEM(S)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("CRASHED:", e); process.exit(1); });
