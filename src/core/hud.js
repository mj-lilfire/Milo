import { TAU, angleDelta, clamp, formatDistance } from "./utils.js";

const $ = (id) => document.getElementById(id);
const CARDINALS = [
  { a: 0, label: "N", cardinal: true },
  { a: Math.PI * 0.25, label: "NE" },
  { a: Math.PI * 0.5, label: "E", cardinal: true },
  { a: Math.PI * 0.75, label: "SE" },
  { a: Math.PI, label: "S", cardinal: true },
  { a: Math.PI * 1.25, label: "SW" },
  { a: Math.PI * 1.5, label: "W", cardinal: true },
  { a: Math.PI * 1.75, label: "NW" },
];

/**
 * Everything the player reads or taps that isn't rendered in WebGL.
 *
 * The HUD owns the DOM and exposes a small imperative surface; gameplay code
 * calls into it and never touches elements directly.
 */
export class Hud {
  constructor(input) {
    this.input = input;
    this.el = {
      compass: $("compass"),
      compassTicks: $("compass-ticks"),
      compassTarget: $("compass-target"),
      compassName: $("compass-label").querySelector(".name"),
      compassDist: $("compass-label").querySelector(".dist"),
      weather: $("weather"),
      weatherText: $("weather").querySelector(".text"),
      objective: $("objective"),
      objWhere: $("objective-where"),
      objTask: $("objective-task"),
      vitals: $("vitals"),
      healthFill: $("health-fill"),
      berries: $("berries"),
      reticle: $("reticle"),
      prompt: $("prompt"),
      stick: $("stick"),
      stickKnob: $("stick-knob"),
      buttons: $("buttons"),
      topButtons: $("top-buttons"),
      banner: $("banner"),
      toasts: $("toasts"),
      dialogue: $("dialogue"),
      dlgSpeaker: $("dlg-speaker"),
      dlgText: $("dlg-text"),
      dlgChoices: $("dlg-choices"),
      dlgMore: $("dlg-more"),
      title: $("title"),
      titleHint: $("title-hint"),
      pause: $("pause"),
      journal: $("journal"),
      journalBody: $("journal-body"),
      fade: $("fade"),
      loading: $("loading"),
    };

    this.isTouch = navigator.maxTouchPoints > 0;
    this.tickEls = [];
    this.buildCompassTicks();
    this.bindButtons();
    this.bindStick();

    this.el.titleHint.innerHTML = this.isTouch
      ? "Left thumb to move &middot; drag the right side to look &middot; tap <b>Use</b> to talk, board and act.<br>Add this page to your Home Screen for full-screen play."
      : "<b>WASD</b> move &middot; <b>mouse</b> look &middot; <b>E</b> use &middot; <b>F</b> strike &middot; <b>Space</b> jump &middot; <b>Shift</b> run &middot; <b>M</b> log";
  }

  buildCompassTicks() {
    for (const c of CARDINALS) {
      const el = document.createElement("div");
      el.className = "tick" + (c.cardinal ? " cardinal" : "");
      el.textContent = c.label;
      this.el.compassTicks.appendChild(el);
      this.tickEls.push({ el, angle: c.a });
    }
  }

  bindButtons() {
    const map = [
      ["btn-interact", "interact"],
      ["btn-attack", "attack"],
      ["btn-jump", "jump"],
      ["btn-run", "run"],
    ];
    for (const [id, name] of map) {
      const el = $(id);
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add("down");
        this.input.setButton(name);
      };
      const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("down");
        this.input.releaseButton(name);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    }
    // Desktop already has the keyboard; the thumb pad only clutters the view.
    if (!this.isTouch) this.el.buttons.classList.add("hidden");
  }

  bindStick() {
    this.input.onStickShow = (x, y) => {
      this.el.stick.style.left = x + "px";
      this.el.stick.style.top = y + "px";
      this.el.stickKnob.style.transform = "translate(0,0)";
      this.el.stick.classList.remove("hidden");
    };
    this.input.onStickMove = (ox, oy, kx, ky) => {
      this.el.stick.style.left = ox + "px";
      this.el.stick.style.top = oy + "px";
      this.el.stickKnob.style.transform = `translate(${kx}px, ${ky}px)`;
    };
    this.input.onStickHide = () => this.el.stick.classList.add("hidden");
  }

  // --- widget visibility ----------------------------------------------------

  /** `sailing` and `island` show gameplay furniture; `menu` hides all of it. */
  setMode(mode) {
    const playing = mode === "sailing" || mode === "island";
    const show = (el, on) => el.classList.toggle("hidden", !on);
    show(this.el.compass, mode === "sailing");
    show(this.el.objective, playing);
    show(this.el.vitals, playing);
    show(this.el.reticle, playing);
    show(this.el.topButtons, playing);
    show(this.el.buttons, playing && this.isTouch);
    // A prompt belongs to the mode that set it. Carrying "Set sail" out to sea
    // (or "Drop anchor" ashore) is never right, so drop it on every change.
    this.clearPrompt();
    if (!playing) this.el.stick.classList.add("hidden");
    // The attack button is dead weight while at sea.
    $("btn-attack").style.visibility = mode === "island" ? "visible" : "hidden";
  }

  setLoading(on, label = "Charting the seas…") {
    this.el.loading.querySelector(".label").textContent = label;
    this.el.loading.classList.toggle("hidden", !on);
  }

  // --- readouts -------------------------------------------------------------

  /**
   * @param {number} heading  where the player is facing, radians, 0 = north
   * @param {number|null} bearing  absolute bearing to the destination
   */
  updateCompass(heading, bearing, name, distance) {
    const half = Math.PI / 2; // the strip covers 90 degrees either side
    for (const t of this.tickEls) {
      const d = angleDelta(heading, t.angle);
      if (Math.abs(d) > half) {
        t.el.style.display = "none";
      } else {
        t.el.style.display = "";
        t.el.style.left = (50 + (d / half) * 50) + "%";
      }
    }
    if (bearing === null || bearing === undefined) {
      this.el.compassTarget.style.display = "none";
      this.el.compassName.textContent = "open sea";
      this.el.compassDist.textContent = "";
      return;
    }
    const d = angleDelta(heading, bearing);
    const off = Math.abs(d) > half;
    this.el.compassTarget.style.display = off ? "none" : "";
    if (!off) this.el.compassTarget.style.left = (50 + (d / half) * 50) + "%";
    this.el.compassName.textContent = name;
    this.el.compassDist.textContent = formatDistance(distance);
  }

  /**
   * The glass. Colour carries the warning faster than the words do, which
   * matters when the player is reading it out of the corner of their eye.
   */
  setWeather(label, severity) {
    if (this._weatherLabel !== label) {
      this._weatherLabel = label;
      this.el.weatherText.textContent = label;
    }
    const cls = severity > 0.72 ? "foul" : severity > 0.4 ? "rough" : "";
    if (this._weatherClass !== cls) {
      this._weatherClass = cls;
      this.el.weather.className = cls;
    }
  }

  setObjective(where, task) {
    this.el.objWhere.textContent = where;
    this.el.objTask.textContent = task;
  }

  setHealth(frac) {
    this.el.healthFill.style.width = clamp(frac, 0, 1) * 100 + "%";
  }

  setBerries(n) {
    this.el.berries.textContent = "฿ " + n.toLocaleString("en-US");
  }

  setPrompt(text, key) {
    const label = key || (this.isTouch ? "USE" : "E");
    this.el.prompt.innerHTML = `<span class="key">${label}</span>${text}`;
    this.el.prompt.classList.remove("hidden");
  }

  clearPrompt() {
    this.el.prompt.classList.add("hidden");
    // Blank it too. A hidden element that still reads "Drop anchor" is a trap
    // for anything inspecting the DOM, tests included.
    this.el.prompt.textContent = "";
  }

  toast(message, ms = 2600) {
    // A run of quick events (weather turning, loot, a recruit) can otherwise
    // stack a column of toasts over the middle of the screen.
    while (this.el.toasts.children.length >= 3) {
      this.el.toasts.firstElementChild.remove();
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    this.el.toasts.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .4s ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 420);
    }, ms);
  }

  banner(sub, main, tag, ms = 3400) {
    const b = this.el.banner;
    b.querySelector(".sub").textContent = sub;
    b.querySelector(".main").textContent = main;
    b.querySelector(".tag").textContent = tag || "";
    b.classList.add("show");
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.remove("show"), ms);
  }

  // --- transitions ----------------------------------------------------------

  fade(on, ms = 500) {
    this.el.fade.style.transitionDuration = ms + "ms";
    this.el.fade.classList.toggle("on", on);
    return new Promise((r) => setTimeout(r, ms));
  }

  // --- dialogue primitives --------------------------------------------------

  showDialogue({ speaker, text, choices, onChoice, onAdvance }) {
    const d = this.el;
    d.dlgSpeaker.textContent = speaker || "";
    d.dlgText.textContent = text;
    d.dlgChoices.innerHTML = "";
    const hasChoices = choices && choices.length;
    d.dlgMore.classList.toggle("hidden", !!hasChoices);
    if (hasChoices) {
      choices.forEach((c, i) => {
        const b = document.createElement("button");
        b.className = "choice";
        b.setAttribute("data-ui", "");
        b.textContent = c.label;
        b.addEventListener("pointerup", (e) => {
          e.stopPropagation();
          onChoice?.(i);
        });
        d.dlgChoices.appendChild(b);
      });
    }
    this._advance = onAdvance;
    d.dialogue.classList.remove("hidden");
    if (!this._dlgBound) {
      d.dialogue.addEventListener("pointerup", (e) => {
        if (e.target.closest(".choice")) return;
        this._advance?.();
      });
      this._dlgBound = true;
    }
  }

  hideDialogue() {
    this.el.dialogue.classList.add("hidden");
    this._advance = null;
  }

  // --- overlays -------------------------------------------------------------

  showTitle(hasSave) {
    $("btn-continue").disabled = !hasSave;
    $("btn-continue").classList.toggle("primary", hasSave);
    $("btn-new").classList.toggle("primary", !hasSave);
    this.el.title.classList.remove("hidden");
  }

  hideTitle() { this.el.title.classList.add("hidden"); }
  showPause() { this.el.pause.classList.remove("hidden"); }
  hidePause() { this.el.pause.classList.add("hidden"); }
  hideJournal() { this.el.journal.classList.add("hidden"); }

  /** Renders the route, crew roster and purse into the journal overlay. */
  showJournal({ islands, progress, crew, berries }) {
    const body = this.el.journalBody;
    body.innerHTML = "";

    const route = document.createElement("div");
    route.className = "journal-section";
    route.innerHTML = "<h3>The Route</h3>";
    islands.forEach((isl, i) => {
      const state = progress.completed.includes(isl.id)
        ? "done"
        : i === progress.currentIndex
          ? "current"
          : i < progress.currentIndex ? "done" : "locked";
      const row = document.createElement("div");
      row.className = "route-item " + state;
      const known = state !== "locked";
      row.innerHTML = `
        <div class="route-num">${i + 1}</div>
        <div>
          <div class="route-name">${known ? isl.name : "Uncharted waters"}</div>
          <div class="route-sea">${known ? isl.sea : "???"}</div>
          <div class="route-desc">${known ? (state === "done" ? "Logged. " : "") + isl.blurb : "The Log Pose has yet to settle."}</div>
        </div>`;
      route.appendChild(row);
    });
    body.appendChild(route);

    const crewSec = document.createElement("div");
    crewSec.className = "journal-section";
    crewSec.innerHTML = "<h3>Crew</h3>";
    const grid = document.createElement("div");
    grid.className = "crew-grid";
    if (!crew.length) {
      grid.innerHTML = "<div style='font-size:13px;opacity:.7'>Sailing alone, for now.</div>";
    }
    for (const c of crew) {
      const chip = document.createElement("div");
      chip.className = "crew-chip";
      chip.innerHTML = `<div class="crew-dot" style="background:${c.color}"></div><div><b>${c.name}</b> — ${c.role}</div>`;
      grid.appendChild(chip);
    }
    crewSec.appendChild(grid);
    body.appendChild(crewSec);

    const purse = document.createElement("div");
    purse.className = "journal-section";
    purse.innerHTML = `<h3>Purse</h3><div style="font-size:15px">฿ ${berries.toLocaleString("en-US")}</div>`;
    body.appendChild(purse);

    this.el.journal.classList.remove("hidden");
  }
}
