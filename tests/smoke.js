const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://127.0.0.1:8099/";
const SHOTS = process.env.SHOTS || "screenshots";

const errors = [];
const logs = [];

function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!cond) process.exitCode = 1;
  return cond;
}

require("fs").mkdirSync(SHOTS, { recursive: true });

/** The prompt text the player can actually see — "" when it is hidden. */
async function visiblePrompt(page) {
  return page.evaluate(() => {
    const el = document.getElementById("prompt");
    return el.classList.contains("hidden") ? "" : el.textContent;
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [
      "--use-gl=angle", "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader", "--disable-gpu-sandbox",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 1,
  });

  page.on("console", (m) => {
    logs.push(`[${m.type()}] ${m.text()}`);
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // --- boot ---------------------------------------------------------------
  check("page boots without errors", errors.length === 0, errors.slice(0, 4).join(" | "));
  check("title screen visible", await page.isVisible("#title-card"));
  check("game object exists", await page.evaluate(() => !!window.game));
  await page.screenshot({ path: `${SHOTS}/01-title.png` });

  // --- start a voyage -----------------------------------------------------
  await page.click("#btn-new");
  await page.waitForTimeout(4000);

  const sailing = await page.evaluate(() => ({
    state: window.game.state,
    islands: window.game.sailing.islandProxies.length,
    routeLength: window.game.sailing.ctx.route.length,
    sceneChildren: window.game.sailing.scene.children.length,
    hasShip: !!window.game.sailing.ship,
    drawCalls: window.game.engine.renderer.info.render.calls,
    triangles: window.game.engine.renderer.info.render.triangles,
    px: window.game.engine.pixelRatio,
  }));
  check("entered sailing mode", sailing.state === "sailing", JSON.stringify(sailing));
  check("every island on the route is present at sea",
    sailing.islands === sailing.routeLength, `${sailing.islands} of ${sailing.routeLength}`);
  check("sea renders geometry", sailing.triangles > 10000, `${sailing.triangles} tris`);
  check("sea draw calls stay low", sailing.drawCalls < 120, `${sailing.drawCalls} calls`);
  await page.screenshot({ path: `${SHOTS}/02-deck.png` });

  // --- take the helm and sail ---------------------------------------------
  await page.evaluate(() => {
    const g = window.game;
    g.player.position.set(g.sailing.constructor ? 0 : 0, 3.4, -6.6);
    g.player.position.z = -6.6;
  });
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(400);
  check("took the helm", await page.evaluate(() => window.game.sailing.atHelm));

  const before = await page.evaluate(() => ({ ...window.game.sailing.position }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(2500);
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => ({
    pos: { ...window.game.sailing.position },
    speed: window.game.sailing.speed,
    throttle: window.game.sailing.throttle,
  }));
  const moved = Math.hypot(after.pos.x - before.x, after.pos.y - before.y);
  check("ship makes way under sail", moved > 1 && after.speed > 3,
    `moved ${moved.toFixed(1)} units, speed ${after.speed.toFixed(1)}, throttle ${after.throttle.toFixed(2)}`);
  await page.screenshot({ path: `${SHOTS}/03-helm.png` });

  // Sails stay trimmed when the stick is released — the core sailing feel.
  await page.waitForTimeout(600);
  check("sails stay set after releasing the stick",
    await page.evaluate(() => window.game.sailing.throttle > 0.2));

  // --- navigate to the first island and dock ------------------------------
  await page.evaluate(() => {
    const g = window.game;
    const spec = g.sailing.islandProxies[0].spec;
    const a = spec.dockAngle;
    const d = spec.terrain.radius + 34;
    g.sailing.position.set(spec.world.x + Math.sin(a) * d, spec.world.z + Math.cos(a) * d);
    g.sailing.throttle = 0;
    g.sailing.speed = 0;
  });
  await page.waitForTimeout(600);

  // The wheel outranks the anchor, so bringing her alongside and then stepping
  // away from the helm is the intended two-beat docking flow. The prompt at
  // the wheel says so.
  const atHelmPrompt = await visiblePrompt(page);
  check("the helm prompt explains how to dock", atHelmPrompt.includes("drop anchor"), atHelmPrompt);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(600);
  check("stepping away from the wheel offers the anchor",
    (await visiblePrompt(page)).includes("Drop anchor"));

  await page.keyboard.press("KeyE");
  await page.waitForTimeout(6000);

  const island = await page.evaluate(() => {
    const e = window.game.exploring;
    return {
      state: window.game.state,
      id: e.spec?.id,
      npcs: e.npcs.length,
      colliders: e.island?.colliders.length,
      drawCalls: window.game.engine.renderer.info.render.calls,
      triangles: window.game.engine.renderer.info.render.triangles,
      objective: document.getElementById("objective-task").textContent,
      playerY: window.game.player.position.y,
    };
  });
  check("made landfall", island.state === "island" && island.id === "foosha", JSON.stringify(island));
  check("islanders spawned", island.npcs >= 2, `${island.npcs} npcs`);
  check("scenery has collision", island.colliders > 40, `${island.colliders} colliders`);
  check("island draw calls stay low", island.drawCalls < 120, `${island.drawCalls} calls`);
  check("player stands on the jetty", island.playerY > 0.5, `y=${island.playerY.toFixed(2)}`);
  check("objective is shown", island.objective.length > 10, island.objective);
  await page.screenshot({ path: `${SHOTS}/04-landfall.png` });

  // --- walk ashore --------------------------------------------------------
  const startPos = await page.evaluate(() => ({ ...window.game.player.position }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(5000);
  await page.keyboard.up("KeyW");
  const walked = await page.evaluate(() => ({
    pos: { ...window.game.player.position },
    onGround: window.game.player.onGround,
  }));
  const dist = Math.hypot(walked.pos.x - startPos.x, walked.pos.z - startPos.z);
  check("player walks ashore", dist > 8, `moved ${dist.toFixed(1)} units`);
  check("player stays grounded", walked.onGround && walked.pos.y > -2, `y=${walked.pos.y.toFixed(2)}`);
  await page.screenshot({ path: `${SHOTS}/05-ashore.png` });

  // --- placement audit across every island --------------------------------
  const terrainReport = await page.evaluate(async () => {
    const { ROUTE } = await import("./src/data/islands.js");
    const { Terrain } = await import("./src/world/terrain.js");
    const { resolvePlace, LAND_MIN_HEIGHT } = await import("./src/world/island.js");

    return ROUTE.map((spec) => {
      const t = new Terrain({ ...spec.terrain, id: spec.id, palette: spec.palette });
      // Resolve exactly the way the game does, safety net included.
      const resolve = (place, safe) => place ? resolvePlace(place, t, safe ? LAND_MIN_HEIGHT : 0) : null;

      const wet = [];
      const steep = [];
      const checkSpot = (label, place, { slope = true, safe = true } = {}) => {
        const p = resolve(place, safe);
        if (!p) return;
        const h = t.heightAt(p.x, p.z);
        if (h < 0.8) wet.push(`${label}(h=${h.toFixed(1)})`);
        else if (slope && t.slopeAt(p.x, p.z) > 0.55) steep.push(`${label}`);
      };

      for (const [k, v] of Object.entries(spec.places || {})) checkSpot("place:" + k, v);
      for (const n of spec.npcs || []) if (!n.nearDock) checkSpot("npc:" + n.id, n.at);
      for (const c of spec.chests || []) checkSpot("chest", c.at);
      for (const b of spec.beacons || []) checkSpot("beacon:" + b.id, b.at);
      for (const st of spec.structures || []) checkSpot("struct:" + st.prop, st.at, { slope: false, safe: false });
      for (const g of spec.enemies || []) {
        checkSpot("foes:" + (g.id || "?"), g.around, { slope: false });
        if (g.boss) checkSpot("boss:" + g.boss.id, g.boss.at || g.around, { slope: false });
      }

      const dock = t.shorePoint(spec.dockAngle ?? 0, 1.6);
      const markers = (spec.quest?.steps || []).map((s) => s.marker).filter(Boolean);
      const known = new Set([...Object.keys(spec.places || {}), "dock", "shore"]);

      return {
        id: spec.id,
        centre: t.heightAt(0, 0),
        offshore: t.heightAt(t.radius * 1.4, 0),
        dockOk: Number.isFinite(dock.x) && Math.hypot(dock.x, dock.z) > 10,
        wet, steep,
        badMarkers: markers.filter((m) => !known.has(m)),
      };
    });
  });

  let terrainOk = true;
  for (const r of terrainReport) {
    if (r.centre < 1) { console.log(`   ${r.id}: centre underwater (${r.centre.toFixed(2)})`); terrainOk = false; }
    if (r.offshore > -3) { console.log(`   ${r.id}: no open water offshore (${r.offshore.toFixed(2)})`); terrainOk = false; }
    if (!r.dockOk) { console.log(`   ${r.id}: dock placement failed`); terrainOk = false; }
    if (r.wet.length) { console.log(`   ${r.id}: UNDERWATER -> ${r.wet.join(", ")}`); terrainOk = false; }
    if (r.steep.length) { console.log(`   ${r.id}: on a cliff face -> ${r.steep.join(", ")}`); terrainOk = false; }
    if (r.badMarkers.length) { console.log(`   ${r.id}: unknown markers -> ${r.badMarkers.join(", ")}`); terrainOk = false; }
  }
  check("everything is placed on dry, walkable ground", terrainOk);

  // --- talk to an islander ------------------------------------------------
  const talked = await page.evaluate(() => {
    const g = window.game;
    const npc = g.exploring.npcs.find((n) => n.def.id === "makino");
    if (!npc) return { ok: false, why: "innkeeper missing" };
    g.player.position.set(npc.rig.group.position.x, npc.rig.group.position.y, npc.rig.group.position.z + 1.8);
    g.player.yaw = 0; // look down -Z, toward her
    return { ok: true };
  });
  check("innkeeper is on the island", talked.ok, talked.why || "");
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(700);
  const dlg = await page.evaluate(() => ({
    active: window.game.dialogue.active,
    visible: !document.getElementById("dialogue").classList.contains("hidden"),
    text: document.getElementById("dlg-text").textContent,
  }));
  check("dialogue opens", dlg.active && dlg.visible, dlg.text.slice(0, 60));
  await page.screenshot({ path: `${SHOTS}/06-dialogue.png` });

  // Read the whole conversation through and confirm it advances the quest.
  for (let i = 0; i < 10; i++) {
    if (!(await page.evaluate(() => window.game.dialogue.active))) break;
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(250);
  }
  const questStep = await page.evaluate(() => window.game.progress.step("foosha"));
  check("conversation advanced the quest", questStep === 1, `step ${questStep}`);

  // --- save and reload ----------------------------------------------------
  await page.evaluate(() => window.game.save());
  const saved = await page.evaluate(() => !!localStorage.getItem("grandline.save.v1"));
  check("progress is saved", saved);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.click("#btn-continue");
  await page.waitForTimeout(3500);
  const resumed = await page.evaluate(() => ({
    state: window.game.state,
    step: window.game.progress.step("foosha"),
  }));
  check("voyage resumes from save", resumed.state === "sailing" && resumed.step === 1, JSON.stringify(resumed));
  await page.screenshot({ path: `${SHOTS}/07-resumed.png` });

  // --- journal ------------------------------------------------------------
  await page.click("#btn-journal");
  await page.waitForTimeout(500);
  const journal = await page.evaluate(async () => {
    const { ROUTE } = await import("./src/data/islands.js");
    return {
      visible: !document.getElementById("journal").classList.contains("hidden"),
      rows: document.querySelectorAll(".route-item").length,
      expected: ROUTE.length,
    };
  });
  check("captain's log lists the whole route",
    journal.visible && journal.rows === journal.expected,
    `${journal.rows} rows, ${journal.expected} islands`);
  await page.screenshot({ path: `${SHOTS}/08-journal.png` });

  // --- leaving an island and getting back under way -----------------------
  // Regression: departing leaves the ship inside the island's docking range,
  // and the anchor prompt used to outrank the helm there — so the only action
  // on offer was to go straight back ashore, with no way to build speed and
  // leave. A softlock, and invisible to any test that departs by calling the
  // method instead of pressing the button.
  await page.click("#btn-journal-close");
  await page.waitForTimeout(400);

  const settle = async () => {
    await page.waitForFunction(() => !window.game.busy, null, { timeout: 25000 });
    await page.waitForTimeout(1500);
  };

  await page.evaluate(() => window.game.dock(0));
  await settle();

  // Board the way a player does: walk to the end of the jetty, look at the
  // ship, press Use.
  await page.evaluate(() => {
    const g = window.game;
    const { landing, mooring } = g.exploring.island.dock;
    g.player.position.copy(landing);
    g.player.yaw = Math.atan2(-(mooring.x - landing.x), -(mooring.z - landing.z));
  });
  await page.waitForTimeout(400);
  const boardPrompt = await visiblePrompt(page);
  check("the moored ship offers to set sail", boardPrompt.includes("Set sail"), boardPrompt);

  await page.keyboard.press("KeyE");
  await settle();
  check("pressing Use at the ship puts to sea",
    await page.evaluate(() => window.game.state === "sailing"));

  const justLeft = await visiblePrompt(page);
  check("departing does not immediately offer to dock again",
    !justLeft.includes("Drop anchor"), justLeft || "(no prompt)");

  // The wheel must be reachable even with the island still alongside.
  await page.evaluate(() => window.game.player.position.set(0, 3.4, -5.0));
  await page.waitForTimeout(400);
  const wheelPrompt = await visiblePrompt(page);
  check("the helm is reachable right after departing",
    wheelPrompt.includes("Take the helm"), wheelPrompt || "(no prompt)");

  await page.keyboard.press("KeyE");
  await page.waitForTimeout(700);
  check("taking the helm does not dump the player back ashore",
    await page.evaluate(() => window.game.state === "sailing" && window.game.sailing.atHelm));

  // Sail clear, then return: the anchor must be on offer again.
  await page.evaluate(() => {
    const g = window.game;
    const s = g.sailing.islandProxies[0].spec;
    const d = s.terrain.radius + 340;
    g.sailing.position.set(
      s.world.x + Math.sin(s.dockAngle) * d, s.world.z + Math.cos(s.dockAngle) * d);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const g = window.game;
    const s = g.sailing.islandProxies[0].spec;
    const d = s.terrain.radius + 34;
    g.sailing.position.set(
      s.world.x + Math.sin(s.dockAngle) * d, s.world.z + Math.cos(s.dockAngle) * d);
    g.sailing.atHelm = false;
    g.player.position.set(0, 2.2, 4.4);  // amidships, clear of the wheel
  });
  await page.waitForTimeout(700);
  const backPrompt = await visiblePrompt(page);
  check("sailing back to an island offers the anchor again",
    backPrompt.includes("Drop anchor"), backPrompt || "(no prompt)");
  await page.screenshot({ path: `${SHOTS}/09-round-trip.png` });

  // --- final error sweep --------------------------------------------------
  check("no console errors during play", errors.length === 0, errors.slice(0, 6).join(" | "));

  await browser.close();
  console.log("\n--- console output ---");
  console.log(logs.slice(-20).join("\n") || "(silent)");
})().catch((e) => {
  console.error("SMOKE TEST CRASHED:", e);
  process.exit(1);
});
