const { chromium } = require("playwright");
let fails = 0;
const check = (n, c, d = "") => { if (!c) { fails++; console.log(`FAIL  ${n}${d ? " — " + d : ""}`); } else console.log(`PASS  ${n}${d ? " — " + d : ""}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(process.env.BASE || "http://127.0.0.1:8099/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.click("#btn-new");
  await page.waitForTimeout(3000);

  // Out into open water, away from any island.
  await page.evaluate(() => { window.game.sailing.position.set(-900, -900); });
  await page.waitForTimeout(500);

  check("encounters exist", await page.evaluate(() => !!window.game.sailing.encounters));

  // --- sea king -----------------------------------------------------------
  await page.evaluate(() => {
    const g = window.game;
    g.sailing.encounters.spawnSeaKing(g.sailing.ship.group.position);
  });
  await page.waitForTimeout(2500);

  const king = await page.evaluate(() => {
    const k = window.game.sailing.encounters.seaKing;
    return {
      exists: !!k, hp: k?.hp, state: k?.state,
      segments: k?.parts.segments.length,
      inScene: !!k && window.game.sailing.scene.children.includes(k.group),
      headY: +k?.head.y.toFixed(1),
    };
  });
  check("a sea king surfaces", king.exists && king.inScene, JSON.stringify(king));
  check("it has a body", king.segments === 13, `${king.segments} segments`);

  // The body should trail the head rather than sit in a heap.
  const spread = await page.evaluate(() => {
    const k = window.game.sailing.encounters.seaKing;
    const pts = k.parts.segments.map((s) => s.position);
    let min = Infinity, max = 0;
    for (const p of pts) {
      const d = p.distanceTo(k.head);
      min = Math.min(min, d); max = Math.max(max, d);
    }
    return { min: +min.toFixed(1), max: +max.toFixed(1) };
  });
  check("its body trails behind the head", spread.max > 20 && spread.min < 10, JSON.stringify(spread));

  // --- gunnery ------------------------------------------------------------
  const shot = await page.evaluate(() => {
    const g = window.game;
    const e = g.sailing.encounters;
    const k = e.seaKing;
    e.reload = 0;
    const before = k.hp;
    // Aim straight at it and let the ball fly.
    const origin = g.sailing.ship.group.position.clone();
    origin.y += 3;
    const dir = k.head.clone().sub(origin).normalize();
    const ok = e.fire(origin, dir);
    return { fired: ok, before, live: e.balls.filter((b) => b.alive).length };
  });
  check("the cannon fires", shot.fired && shot.live === 1, JSON.stringify(shot));

  check("firing again needs a reload", await page.evaluate(() => {
    const e = window.game.sailing.encounters;
    return e.fire(new (window.THREE_V || Object)(), { x: 0, y: 0, z: 1 }) === false;
  }));

  // Damage it directly and confirm the threat bar and the kill reward.
  const killed = await page.evaluate(() => {
    const g = window.game;
    const k = g.sailing.encounters.seaKing;
    const berriesBefore = g.progress.berries;
    k.takeDamage(20);
    const barShown = !document.getElementById("threat").classList.contains("hidden");
    const barName = document.querySelector(".threat-name").textContent;
    while (k.alive) k.takeDamage(50);
    return {
      barShown, barName,
      state: k.state,
      gained: g.progress.berries - berriesBefore,
    };
  });
  check("hits show a threat bar", killed.barShown && killed.barName === "Sea King", JSON.stringify(killed));
  check("killing it pays out", killed.gained > 0, `+${killed.gained} Berries`);
  check("it dives when beaten", killed.state === "dying", killed.state);
  // Wait on the condition, not the clock: how much simulated time a wall
  // second buys varies a lot with renderer speed.
  const cleaned = await page.waitForFunction(
    () => !window.game.sailing.encounters.seaKing, null, { timeout: 20000 }
  ).then(() => true).catch(() => false);
  check("the carcass is cleaned up", cleaned);

  // --- patrol ship --------------------------------------------------------
  await page.evaluate(() => {
    const g = window.game;
    g.sailing.encounters.spawnPatrol(g.sailing.ship.group.position);
  });
  await page.waitForTimeout(2500);
  const patrol = await page.evaluate(() => {
    const p = window.game.sailing.encounters.patrol;
    return { exists: !!p, hp: p?.hp, dist: p ? +p.position.distanceTo(window.game.sailing.ship.group.position).toFixed(0) : null };
  });
  check("a patrol appears", patrol.exists, JSON.stringify(patrol));

  // --- hull damage and foundering ----------------------------------------
  const hullStart = await page.evaluate(() => window.game.progress.hull);
  await page.evaluate(() => window.game.sailing.damageHull(30));
  await page.waitForTimeout(400);
  const hullAfter = await page.evaluate(() => ({
    hull: window.game.progress.hull,
    bar: document.getElementById("hull-fill").style.width,
  }));
  check("the hull takes damage", hullAfter.hull === hullStart - 30, JSON.stringify(hullAfter));
  check("the hull bar follows", hullAfter.bar.startsWith("70"), hullAfter.bar);

  await page.evaluate(() => { window.game.progress.addBerries(4000); });
  const foundered = await page.evaluate(async () => {
    const g = window.game;
    const before = g.progress.berries;
    g.sailing.damageHull(500);
    await new Promise((r) => setTimeout(r, 2600));
    return {
      hull: g.progress.hull,
      berries: g.progress.berries,
      paid: before - g.progress.berries,
      crippled: g.sailing.crippled,
      state: g.state,
    };
  });
  check("being holed repairs you and charges for it",
    foundered.hull > 0 && foundered.paid > 0 && !foundered.crippled, JSON.stringify(foundered));
  check("being holed is not a game over", foundered.state === "sailing", foundered.state);

  await page.evaluate(() => {
    const g = window.game;
    g.sailing.encounters.spawnSeaKing(g.sailing.ship.group.position);
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: (process.env.SHOTS || "screenshots") + "/11-seaking.png" });

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(fails === 0 ? "\nENCOUNTERS OK" : `\n${fails} PROBLEM(S)`);
  process.exit(fails ? 1 : 0);
})();
