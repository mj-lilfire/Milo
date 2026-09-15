const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://127.0.0.1:8099/";
const SHOTS = process.env.SHOTS || "screenshots";
require("fs").mkdirSync(SHOTS, { recursive: true });

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

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.click("#btn-new");
  await page.waitForTimeout(2500);
  const settle = async () => {
    await page.waitForFunction(() => !window.game.busy, null, { timeout: 25000 });
    await page.waitForTimeout(1400);
  };

  // Sign the whole crew on, then make landfall.
  await page.evaluate(() => {
    const g = window.game;
    ["swordsman", "navigator", "sniper", "cook", "doctor"].forEach((c) => g.progress.recruit(c));
    g.progress.currentIndex = 1;
  });
  await page.evaluate(() => window.game.dock(1));
  await settle();

  const ashore = await page.evaluate(() => {
    const e = window.game.exploring;
    return {
      followers: e.followers.length,
      names: e.followers.map((f) => f.def.name),
      allHaveState: e.followers.every((f) => !!f.follower),
    };
  });
  check("the whole crew comes ashore", ashore.followers === 5, ashore.names.join(", "));
  check("each has follow behaviour", ashore.allHaveState);

  // Walk inland and see whether they come.
  const start = await page.evaluate(() => {
    const g = window.game;
    return {
      player: { x: g.player.position.x, z: g.player.position.z },
      crew: g.exploring.followers.map((f) => ({ x: f.rig.group.position.x, z: f.rig.group.position.z })),
    };
  });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(6000);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(1200);

  const moved = await page.evaluate(() => {
    const g = window.game;
    const p = g.player.position;
    return {
      player: { x: p.x, z: p.z },
      crew: g.exploring.followers.map((f) => ({
        x: f.rig.group.position.x,
        y: f.rig.group.position.y,
        z: f.rig.group.position.z,
        dist: Math.hypot(f.rig.group.position.x - p.x, f.rig.group.position.z - p.z),
        ground: g.exploring.island.terrain.heightAt(f.rig.group.position.x, f.rig.group.position.z),
      })),
    };
  });
  const playerWent = Math.hypot(moved.player.x - start.player.x, moved.player.z - start.player.z);
  check("the captain walked inland", playerWent > 8, `${playerWent.toFixed(1)} units`);

  const crewWent = moved.crew.map((c, i) =>
    Math.hypot(c.x - start.crew[i].x, c.z - start.crew[i].z));
  // Whoever happened to spawn nearest the captain's destination walks least,
  // so the group has to have moved rather than every individual clearing a bar.
  const avgWent = crewWent.reduce((a, b) => a + b, 0) / crewWent.length;
  check("the crew followed", crewWent.every((d) => d > 1.5) && avgWent > 5,
    `moved ${crewWent.map((d) => d.toFixed(0)).join(", ")} (avg ${avgWent.toFixed(1)})`);
  check("they keep station near the captain", moved.crew.every((c) => c.dist < 12),
    moved.crew.map((c) => c.dist.toFixed(1)).join(", "));
  check("nobody is standing in the air or the sea",
    moved.crew.every((c) => Math.abs(c.y - c.ground) < 0.4 && c.ground > -1),
    moved.crew.map((c) => `y${c.y.toFixed(1)}/g${c.ground.toFixed(1)}`).join(" "));

  // Nobody should be stacked on top of anyone else.
  const closest = await page.evaluate(() => {
    const f = window.game.exploring.followers;
    let min = Infinity;
    for (let i = 0; i < f.length; i++) {
      for (let j = i + 1; j < f.length; j++) {
        const a = f[i].rig.group.position, b = f[j].rig.group.position;
        min = Math.min(min, Math.hypot(a.x - b.x, a.z - b.z));
      }
    }
    return min;
  });
  check("they don't stack on each other", closest > 0.9, `closest pair ${closest.toFixed(2)}`);

  // --- do they fight? -----------------------------------------------------
  const fight = await page.evaluate(async () => {
    const g = window.game;
    g.progress.setStep("shells", 1);
    g.exploring.refreshObjective();
    const foe = g.exploring.enemies.find((e) => e.alive);
    if (!foe) return { ok: false, why: "no enemies spawned" };
    // Put the captain and the party right on top of the fight.
    g.player.position.set(foe.group.position.x, foe.group.position.y, foe.group.position.z + 4);
    for (const f of g.exploring.followers) {
      f.rig.group.position.set(foe.group.position.x + 2, foe.group.position.y, foe.group.position.z + 3);
      f.follower.attackCooldown = 0;
    }
    const before = foe.hp;
    await new Promise((r) => setTimeout(r, 3500));
    return { ok: true, before, after: foe.hp, name: foe.name };
  });
  check("the crew join the fight", fight.ok && fight.after < fight.before,
    fight.why || `${fight.name} ${fight.before} -> ${fight.after}`);

  // They should still be people you can talk to.
  await page.evaluate(() => {
    const g = window.game;
    const zoro = g.exploring.followers.find((f) => f.def.name === "Zoro");
    g.player.position.set(zoro.rig.group.position.x, zoro.rig.group.position.y, zoro.rig.group.position.z + 1.8);
    g.player.yaw = 0;
  });
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(700);
  check("a crewmate is still worth talking to",
    await page.evaluate(() => window.game.dialogue.active));
  await page.evaluate(() => window.game.dialogue.cancel());

  await page.screenshot({ path: SHOTS + "/15-crew-ashore.png" });
  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(fails === 0 ? "\nCREW OK" : `\n${fails} PROBLEM(S)`);
  process.exit(fails ? 1 : 0);
})();
