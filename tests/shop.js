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
  await page.waitForTimeout(2500);
  const settle = async () => {
    await page.waitForFunction(() => !window.game.busy, null, { timeout: 25000 });
    await page.waitForTimeout(1200);
  };
  await page.evaluate(() => { window.game.progress.currentIndex = 1; });
  await page.evaluate(() => window.game.dock(1));
  await settle();

  const found = await page.evaluate(() => {
    const t = window.game.exploring.npcs.find((n) => n.def.id.startsWith("trader:"));
    return { found: !!t, name: t?.def.name, above: t ? +t.rig.group.position.y.toFixed(1) : null };
  });
  check("a trader is ashore", found.found, JSON.stringify(found));
  check("the trader is on dry land", found.above > 0.8, `y=${found.above}`);

  // Broke: only the free option should be on offer.
  const openShop = async () => {
    await page.evaluate(() => {
      const g = window.game;
      const t = g.exploring.npcs.find((n) => n.def.id.startsWith("trader:"));
      g.player.position.set(t.rig.group.position.x, t.rig.group.position.y, t.rig.group.position.z + 1.6);
      g.player.yaw = 0;
    });
    await page.waitForTimeout(350);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(500);
    // Read past the greeting to the choices.
    for (let i = 0; i < 4; i++) {
      const hasChoices = await page.evaluate(() => document.querySelectorAll(".choice").length > 0);
      if (hasChoices) break;
      await page.keyboard.press("KeyE");
      await page.waitForTimeout(300);
    }
    return page.evaluate(() => [...document.querySelectorAll(".choice")].map((c) => c.textContent));
  };

  await page.evaluate(() => { window.game.progress.berries = 0; });
  let choices = await openShop();
  check("with no money, only the polite exit is offered", choices.length === 1, JSON.stringify(choices));
  await page.evaluate(() => window.game.dialogue.cancel());
  await page.waitForTimeout(300);

  // Flush: everything unlocks.
  await page.evaluate(() => { window.game.progress.berries = 20000; window.game.progress.hull = 40; });
  choices = await openShop();
  check("with money, the full list appears", choices.length === 6, JSON.stringify(choices.length));
  check("prices are shown", choices.some((c) => c.includes("฿2,200")), choices.join(" | "));
  check("upgrade levels are shown", choices.some((c) => c.includes("lvl 1")), choices.join(" | "));

  // Buy the rigging.
  const before = await page.evaluate(() => ({
    berries: window.game.progress.berries,
    speed: window.game.progress.maxSpeed,
  }));
  const idx = choices.findIndex((c) => c.includes("rigging"));
  await page.evaluate((i) => document.querySelectorAll(".choice")[i]
    .dispatchEvent(new PointerEvent("pointerup", { bubbles: true })), idx);
  await page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => window.game.dialogue.active))) break;
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(280);
  }
  const after = await page.evaluate(() => ({
    berries: window.game.progress.berries,
    speed: window.game.progress.maxSpeed,
    sail: window.game.progress.upgrades.sail,
  }));
  check("buying charges you", after.berries === before.berries - 2200, `${before.berries} -> ${after.berries}`);
  check("the upgrade takes effect", after.sail === 1 && after.speed > before.speed,
    `sail lvl ${after.sail}, speed ${before.speed} -> ${after.speed}`);

  // Repairs.
  const hullBefore = await page.evaluate(() => window.game.progress.hull);
  choices = await openShop();
  const rIdx = choices.findIndex((c) => c.includes("Patch"));
  await page.evaluate((i) => document.querySelectorAll(".choice")[i]
    .dispatchEvent(new PointerEvent("pointerup", { bubbles: true })), rIdx);
  await page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => window.game.dialogue.active))) break;
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(280);
  }
  const hullAfter = await page.evaluate(() => window.game.progress.hull);
  check("repairs mend the hull", hullAfter > hullBefore, `${hullBefore} -> ${hullAfter}`);

  // Upgrades cap out.
  const capped = await page.evaluate(async () => {
    const g = window.game;
    g.progress.upgrades.sail = 3;
    g.progress.berries = 50000;
    const { matches } = await import("/src/game/quests.js");
    return matches({ minBerries: 2200, upgradeUnder: { kind: "sail", level: 3 } }, g.progress, "shells");
  });
  check("a maxed upgrade drops off the list", capped === false);

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.screenshot({ path: (process.env.SHOTS || "screenshots") + "/13-shop.png" });
  await browser.close();
  console.log(fails === 0 ? "\nSHOP OK" : `\n${fails} PROBLEM(S)`);
  process.exit(fails ? 1 : 0);
})();
