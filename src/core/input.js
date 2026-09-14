import { clamp } from "./utils.js";

/**
 * Unified input for touch and desktop.
 *
 * Touch layout (the iPad target):
 *   - Left ~45% of the screen: a floating stick. It spawns wherever the thumb
 *     lands rather than sitting in a fixed spot, which is much kinder on a
 *     tablet where hand position drifts.
 *   - Right side: drag to look.
 *   - On-screen buttons (owned by the HUD) call setButton/releaseButton.
 *
 * Desktop: WASD + pointer-lock mouse look, Space / E / Shift / click.
 *
 * Buttons are edge-triggered: `consume(name)` reports a press exactly once, so
 * gameplay code never has to de-bounce a tap itself.
 */
export class Input {
  constructor(target) {
    this.target = target;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.held = new Set();
    this.pressed = new Set();
    this.enabled = true;
    this.lookSensitivity = { touch: 0.0042, mouse: 0.0022 };

    this.stick = { id: null, ox: 0, oy: 0, radius: 64 };
    this.lookPointer = null;
    this.pointers = new Map();

    this.bindTouch();
    this.bindKeyboard();
    this.bindMouse();
  }

  // --- public API -----------------------------------------------------------

  /** True once per press. */
  consume(name) {
    if (this.pressed.has(name)) {
      this.pressed.delete(name);
      return true;
    }
    return false;
  }

  isHeld(name) {
    return this.held.has(name);
  }

  setButton(name) {
    if (!this.held.has(name)) this.pressed.add(name);
    this.held.add(name);
  }

  releaseButton(name) {
    this.held.delete(name);
  }

  /** Read and clear the accumulated look delta. */
  takeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }

  /** Drop all state — used when opening a menu so nothing sticks down. */
  reset() {
    this.move.x = this.move.y = 0;
    this.look.x = this.look.y = 0;
    this.held.clear();
    this.pressed.clear();
    this.stick.id = null;
    this.lookPointer = null;
    this.pointers.clear();
  }

  // --- touch ----------------------------------------------------------------

  bindTouch() {
    const el = this.target;
    const opts = { passive: false };

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      if (!this.enabled) return;
      // Anything tagged as UI (buttons, dialogue) handles its own touches.
      if (e.target.closest("[data-ui]")) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const leftZone = e.clientX < window.innerWidth * 0.45;
      if (leftZone && this.stick.id === null) {
        this.stick.id = e.pointerId;
        this.stick.ox = e.clientX;
        this.stick.oy = e.clientY;
        this.onStickShow?.(e.clientX, e.clientY);
      } else if (this.lookPointer === null) {
        this.lookPointer = e.pointerId;
      }
    }, opts);

    el.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") return;
      if (!this.pointers.has(e.pointerId)) return;
      e.preventDefault();
      const prev = this.pointers.get(e.pointerId);

      if (e.pointerId === this.stick.id) {
        const dx = e.clientX - this.stick.ox;
        const dy = e.clientY - this.stick.oy;
        const len = Math.hypot(dx, dy);
        const r = this.stick.radius;
        // Past the ring, drag the origin along so the stick never "runs out".
        if (len > r) {
          this.stick.ox += dx * (1 - r / len);
          this.stick.oy += dy * (1 - r / len);
        }
        const cx = clamp((e.clientX - this.stick.ox) / r, -1, 1);
        const cy = clamp((e.clientY - this.stick.oy) / r, -1, 1);
        this.move.x = cx;
        this.move.y = -cy; // screen-down is backwards
        this.onStickMove?.(this.stick.ox, this.stick.oy, cx * r, cy * r);
      } else if (e.pointerId === this.lookPointer) {
        this.look.x += (e.clientX - prev.x) * this.lookSensitivity.touch;
        this.look.y += (e.clientY - prev.y) * this.lookSensitivity.touch;
      }

      prev.x = e.clientX;
      prev.y = e.clientY;
    }, opts);

    const end = (e) => {
      if (e.pointerType === "mouse") return;
      this.pointers.delete(e.pointerId);
      if (e.pointerId === this.stick.id) {
        this.stick.id = null;
        this.move.x = this.move.y = 0;
        this.onStickHide?.();
      }
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    };
    el.addEventListener("pointerup", end, opts);
    el.addEventListener("pointercancel", end, opts);

    // Stop Safari from zooming, scrolling or bouncing under the game.
    document.addEventListener("gesturestart", (e) => e.preventDefault(), opts);
    document.addEventListener("touchmove", (e) => {
      if (!e.target.closest("[data-scroll]")) e.preventDefault();
    }, opts);
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320 && !e.target.closest("[data-scroll]")) e.preventDefault();
      lastTouchEnd = now;
    }, opts);
  }

  // --- keyboard -------------------------------------------------------------

  bindKeyboard() {
    const map = {
      KeyW: "up", ArrowUp: "up",
      KeyS: "down", ArrowDown: "down",
      KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
      KeyE: "interact", Enter: "interact",
      Space: "jump",
      KeyF: "attack",
      ShiftLeft: "run", ShiftRight: "run",
      KeyM: "map", Tab: "map",
      Escape: "pause",
    };
    const axes = () => {
      this.move.x = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
      this.move.y = (this.held.has("up") ? 1 : 0) - (this.held.has("down") ? 1 : 0);
    };
    window.addEventListener("keydown", (e) => {
      const name = map[e.code];
      if (!name || e.repeat) return;
      e.preventDefault();
      this.setButton(name);
      axes();
    });
    window.addEventListener("keyup", (e) => {
      const name = map[e.code];
      if (!name) return;
      e.preventDefault();
      this.releaseButton(name);
      axes();
    });
  }

  // --- mouse ----------------------------------------------------------------

  bindMouse() {
    const el = this.target;
    el.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-ui]")) return;
      if (document.pointerLockElement !== el) {
        el.requestPointerLock?.();
      } else if (e.button === 0) {
        this.setButton("attack");
      }
    });
    el.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.releaseButton("attack");
    });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== el) return;
      this.look.x += e.movementX * this.lookSensitivity.mouse;
      this.look.y += e.movementY * this.lookSensitivity.mouse;
    });
  }
}
