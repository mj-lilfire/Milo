import { Engine } from "./core/engine.js";
import { Input } from "./core/input.js";
import { Hud } from "./core/hud.js";
import { Audio } from "./core/audio.js";
import { Save } from "./core/save.js";
import { Player } from "./game/player.js";
import { Progress } from "./game/quests.js";
import { DialogueRunner } from "./game/dialogue.js";
import { SailingMode } from "./game/sailing.js";
import { ExploringMode } from "./game/exploring.js";
import { ROUTE } from "./data/islands.js";
import { CREW, crewById } from "./data/crew.js";

/**
 * Boots the game and owns the state machine: title -> sailing <-> ashore.
 *
 * Only one mode updates at a time and only one scene is resident, which is
 * what keeps a tablet comfortable however long the voyage runs.
 */
class Game {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.engine = new Engine(this.canvas);
    this.input = new Input(this.canvas);
    this.hud = new Hud(this.input);
    this.audio = new Audio();
    this.player = new Player();
    this.dialogue = new DialogueRunner(this.hud, this.audio);

    this.progress = new Progress(ROUTE);
    this.state = "title";
    this.busy = false;

    const ctx = {
      engine: this.engine,
      input: this.input,
      hud: this.hud,
      audio: this.audio,
      player: this.player,
      progress: this.progress,
      dialogue: this.dialogue,
      route: ROUTE,
      crewById,
      onCrewChanged: () => this.onCrewChanged(),
      onIslandComplete: (spec) => this.onIslandComplete(spec),
    };
    this.ctx = ctx;

    this.sailing = new SailingMode(ctx);
    this.exploring = new ExploringMode(ctx);

    this.sailing.onDock = (index) => this.dock(index);
    this.sailing.onTalkCrew = (member) => this.talkToCrew(member);
    this.exploring.onDepart = () => this.depart();

    this.bindUi();
    this.engine.addUpdater((dt, time) => this.update(dt, time));
    this.engine.start();

    this.hud.setLoading(false);
    this.hud.setMode("menu");
    this.hud.showTitle(Save.has());
  }

  // --- ui wiring ------------------------------------------------------------

  bindUi() {
    const unlock = () => this.audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const on = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this.audio.unlock();
        this.audio.click();
        fn();
      });
    };

    on("btn-new", () => this.startNew());
    on("btn-continue", () => this.continueGame());
    on("btn-controls", () => this.showControls());
    on("btn-journal", () => this.openJournal());
    on("btn-journal-close", () => this.closeJournal());
    on("btn-pause", () => this.pause());
    on("btn-resume", () => this.resume());
    on("btn-save-quit", () => this.saveAndQuit());

    // Keyboard shortcuts for the same overlays.
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        if (this.state === "journal") this.closeJournal();
        else if (this.state === "paused") this.resume();
        else if (this.playing) this.pause();
      }
      if (e.code === "KeyM" || e.code === "Tab") {
        if (this.state === "journal") this.closeJournal();
        else if (this.playing) this.openJournal();
      }
    });

    // Losing focus mid-voyage shouldn't leave a key stuck down.
    window.addEventListener("blur", () => this.input.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.input.reset();
        if (this.playing) this.save();
      }
    });
  }

  get playing() {
    return this.state === "sailing" || this.state === "island";
  }

  showControls() {
    const touch = this.hud.isTouch;
    this.hud.showDialogue({
      speaker: "How to sail",
      text: touch
        ? "Left thumb: walk. Drag the right half: look. USE: talk, board, open. "
        + "At the wheel, push the stick forward to set the sails and left/right to steer — "
        + "the sails stay trimmed when you let go."
        : "WASD to walk, mouse to look, E to use, F to strike, Shift to run, M for the log. "
        + "At the wheel, W/S sets the sails and A/D steers.",
      onAdvance: () => this.hud.hideDialogue(),
    });
  }

  // --- lifecycle ------------------------------------------------------------

  async startNew() {
    Save.clear();
    this.progress = Progress.fromJSON(ROUTE, null);
    this.syncProgress();
    this.hud.hideTitle();
    await this.hud.fade(true, 10);
    this.enterSailing({});
    this.hud.banner("EAST BLUE", ROUTE[0].name, "your voyage begins", 4200);
    await this.hud.fade(false, 900);
    this.save();
  }

  async continueGame() {
    const data = Save.load();
    this.progress = Progress.fromJSON(ROUTE, data?.progress);
    this.syncProgress();
    this.hud.hideTitle();
    await this.hud.fade(true, 10);
    this.enterSailing({ position: data?.sea ? { x: data.sea.x, y: data.sea.z } : null, heading: data?.sea?.heading });
    await this.hud.fade(false, 800);
  }

  /** Point every system at the current progress object. */
  syncProgress() {
    this.ctx.progress = this.progress;
    this.sailing.ctx.progress = this.progress;
    this.exploring.ctx.progress = this.progress;
    this.hud.setHealth(this.progress.health / this.progress.maxHealth);
    this.hud.setBerries(this.progress.berries);
  }

  enterSailing(opts) {
    this.state = "sailing";
    this.hud.setMode("sailing");
    this.sailing.enter(opts);
    const target = this.progress.currentIsland;
    this.hud.setObjective(
      this.progress.finished ? "The Grand Line" : "At sea",
      this.progress.finished
        ? "Every island logged. Sail wherever you please."
        : `Make for ${target.name}. ${target.blurb}`
    );
  }

  async dock(index) {
    if (this.busy) return;
    this.busy = true;
    const spec = ROUTE[index];
    this.audio.bell();
    await this.hud.fade(true, 650);
    this.hud.setLoading(true, "Making landfall at " + spec.name + "…");

    this.sailing.exit();
    // Yield a frame so the loading card actually paints before the island
    // build stalls the main thread.
    await new Promise((r) => setTimeout(r, 60));

    this.state = "island";
    this.exploring.enter(spec, this.sailing.ship.group);
    this.hud.setMode("island");
    this.hud.setLoading(false);
    this.hud.banner(spec.sea, spec.name, spec.tagline || spec.blurb, 4000);
    this.save();
    await this.hud.fade(false, 750);
    this.busy = false;
  }

  async depart() {
    if (this.busy) return;
    this.busy = true;
    const spec = this.exploring.spec;
    await this.hud.fade(true, 650);
    this.hud.setLoading(true, "Weighing anchor…");

    const shipGroup = this.sailing.ship.group;
    this.exploring.exit();
    await new Promise((r) => setTimeout(r, 50));

    this.sailing.scene.add(shipGroup);
    this.enterSailing({ fromIsland: spec });
    this.hud.setLoading(false);
    this.save();
    await this.hud.fade(false, 750);
    this.busy = false;
  }

  onCrewChanged() {
    if (this.sailing.built) this.sailing.refreshCrew();
    this.save();
  }

  onIslandComplete(spec) {
    const next = this.progress.currentIsland;
    if (next && next.id !== spec.id) {
      setTimeout(() => {
        this.hud.toast("The Log Pose points to " + next.name);
      }, 2600);
    } else if (this.progress.finished) {
      setTimeout(() => {
        this.hud.banner("THE GRAND LINE", "Every island logged", "you are a captain now", 6000);
      }, 3000);
    }
    this.save();
  }

  /** A word with a crewmate while under way. */
  talkToCrew(member) {
    const npcDef = {
      id: "crew:" + member.id,
      name: member.name,
      talks: member.shipTalks || [{ lines: [member.quip || "Steady as she goes, Captain."] }],
    };
    this.dialogue.start(npcDef, this.progress, {
      islandId: this.progress.currentIsland?.id || "sea",
      crewById,
      onNotice: (n) => {
        if (n.type === "toast") this.hud.toast(n.text);
        this.hud.setBerries(this.progress.berries);
      },
      onFinish: () => {},
    });
  }

  // --- overlays -------------------------------------------------------------

  openJournal() {
    if (!this.playing) return;
    this.returnState = this.state;
    this.state = "journal";
    this.input.reset();
    this.hud.showJournal({
      islands: ROUTE,
      progress: this.progress,
      crew: this.progress.crew.map(crewById).filter(Boolean),
      berries: this.progress.berries,
    });
  }

  closeJournal() {
    if (this.state !== "journal") return;
    this.hud.hideJournal();
    this.state = this.returnState;
  }

  pause() {
    if (!this.playing) return;
    this.returnState = this.state;
    this.state = "paused";
    this.input.reset();
    this.save();
    this.hud.showPause();
  }

  resume() {
    if (this.state !== "paused") return;
    this.hud.hidePause();
    this.state = this.returnState;
  }

  async saveAndQuit() {
    this.save();
    this.hud.hidePause();
    await this.hud.fade(true, 400);
    if (this.state === "paused" && this.returnState === "island") this.exploring.exit();
    else this.sailing.exit();
    this.state = "title";
    this.hud.setMode("menu");
    this.hud.showTitle(true);
    await this.hud.fade(false, 400);
  }

  save() {
    Save.write({
      progress: this.progress.toJSON(),
      sea: this.sailing.built ? this.sailing.serialize() : null,
      island: this.state === "island" ? this.exploring.spec?.id : null,
    });
  }

  // --- frame ----------------------------------------------------------------

  update(dt, time) {
    if (this.busy) return;
    switch (this.state) {
      case "sailing":
        this.sailing.update(dt, time);
        break;
      case "island":
        this.exploring.update(dt, time);
        break;
      default:
        // Menus and overlays: drain input so nothing is queued up on return.
        this.input.consume("interact");
        this.input.consume("attack");
        this.input.consume("jump");
        break;
    }
  }
}

// Surface a boot failure rather than leaving the player on a spinner forever.
try {
  window.game = new Game();
} catch (err) {
  console.error(err);
  const loading = document.getElementById("loading");
  if (loading) {
    loading.innerHTML =
      '<div style="max-width:520px;text-align:center;padding:24px;line-height:1.6">'
      + '<div style="font-size:20px;margin-bottom:10px">The voyage could not set out.</div>'
      + '<div style="opacity:.75;font-size:14px">' + String(err && err.message || err) + "</div>"
      + '<div style="opacity:.6;font-size:13px;margin-top:14px">WebGL must be enabled. '
      + "On iPad: Settings &rsaquo; Apps &rsaquo; Safari &rsaquo; Advanced.</div></div>";
  }
}

// Offline support. Registered after boot so a failed service worker can never
// stop the game from starting.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline play unavailable */ });
  });
}
