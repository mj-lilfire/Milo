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

  check("weather system exists", await page.evaluate(() => !!window.game.sailing.weather));

  for (const state of ["calm", "breezy", "squall", "storm"]) {
    await page.evaluate((st) => {
      const g = window.game;
      g.sailing.weather.set(st, { instant: true });
      g.sailing.weather.apply(g.sailing.ocean, g.sailing.sky, g.sailing.scene, g.sailing.basePalette);
    }, state);
    await page.waitForTimeout(900);

    const r = await page.evaluate(async () => {
      const { getSwell, sampleHeight } = await import("/src/world/ocean.js");
      const g = window.game;
      const t = g.engine.elapsed;
      // Sample the sea over a patch to see how big it is running.
      let peak = 0;
      for (let i = 0; i < 400; i++) {
        peak = Math.max(peak, Math.abs(sampleHeight(i * 3.7, i * 2.3, t)));
      }
      return {
        swell: +getSwell().toFixed(2),
        peak: +peak.toFixed(2),
        shaderSwell: +g.sailing.ocean.uniforms.uSwell.value.toFixed(2),
        fog: +(g.sailing.scene.fog.density * 1e5).toFixed(2),
        rain: g.sailing.weather.rain.visible,
        rainOpacity: +g.sailing.weather.rain.material.opacity.toFixed(2),
        sun: +g.sailing.sky.sunLight.intensity.toFixed(2),
        hud: document.getElementById("weather").textContent.trim(),
        hudClass: document.getElementById("weather").className,
        shipY: +g.sailing.ship.group.position.y.toFixed(2),
        seaAtShip: +sampleHeight(g.sailing.position.x, g.sailing.position.y, t).toFixed(2),
      };
    });
    console.log(`  ${state.padEnd(7)} swell=${r.swell} peak=${r.peak}m fog=${r.fog}e-5 sun=${r.sun} rain=${r.rain}(${r.rainOpacity}) hud="${r.hud}"${r.hudClass ? " [" + r.hudClass + "]" : ""}`);

    check(`${state}: shader and sampler agree on swell`, r.swell === r.shaderSwell, `${r.swell} vs ${r.shaderSwell}`);
    // The hull must ride the sea it is actually in, whatever the state.
    check(`${state}: hull rides the real sea`, Math.abs(r.shipY - r.seaAtShip) < 3.5,
      `ship y=${r.shipY}, sea=${r.seaAtShip}`);
  }

  const calm = await page.evaluate(async () => {
    const { getSwell } = await import("/src/world/ocean.js");
    window.game.sailing.weather.set("calm", { instant: true });
    window.game.sailing.weather.apply(window.game.sailing.ocean, window.game.sailing.sky,
      window.game.sailing.scene, window.game.sailing.basePalette);
    return getSwell();
  });
  const storm = await page.evaluate(async () => {
    const { getSwell } = await import("/src/world/ocean.js");
    window.game.sailing.weather.set("storm", { instant: true });
    window.game.sailing.weather.apply(window.game.sailing.ocean, window.game.sailing.sky,
      window.game.sailing.scene, window.game.sailing.basePalette);
    return getSwell();
  });
  check("a storm sea is much bigger than a calm one", storm > calm * 2.4, `${calm.toFixed(2)} -> ${storm.toFixed(2)}`);

  await page.waitForTimeout(1500);
  await page.screenshot({ path: (process.env.SHOTS || "screenshots") + "/10-storm.png" });

  // Weather should survive a save and reload.
  await page.evaluate(() => window.game.save());
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("grandline.save.v1")).sea.weather);
  check("weather is saved", saved && saved.state === "storm", JSON.stringify(saved));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.click("#btn-continue");
  await page.waitForTimeout(3500);
  const restored = await page.evaluate(() => window.game.sailing.weather.state);
  check("weather is restored on resume", restored === "storm", restored);

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(fails === 0 ? "\nWEATHER OK" : `\n${fails} PROBLEM(S)`);
  process.exit(fails ? 1 : 0);
})();
