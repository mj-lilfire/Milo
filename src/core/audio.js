/**
 * All audio is synthesised at runtime — no sample files to download, which
 * keeps the whole game small enough to cache offline on a tablet.
 *
 * iOS will not let an AudioContext make a sound until it has been resumed
 * inside a real user gesture, so `unlock()` is wired to the first tap.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.nodes = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise(2);
    this.ready = true;
    this.ctx.resume();
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Brownian-ish noise: less hissy than white, reads as water and wind.
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.75;
  }

  // --- ambience -------------------------------------------------------------

  /** Cross-fade a looping bed. `kind` is "sea", "shore", "wind" or "none". */
  setAmbience(kind) {
    if (!this.ready || this.ambienceKind === kind) return;
    this.ambienceKind = kind;
    const now = this.ctx.currentTime;
    if (this.nodes.amb) {
      const old = this.nodes.amb;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setTargetAtTime(0, now, 0.6);
      setTimeout(() => { try { old.src.stop(); } catch { /* already stopped */ } }, 2500);
      this.nodes.amb = null;
    }
    if (kind === "none") return;

    const presets = {
      sea:   { cutoff: 520, q: 1.2, gain: 0.16, lfo: 0.09, sweep: 260 },
      shore: { cutoff: 700, q: 1.0, gain: 0.13, lfo: 0.14, sweep: 300 },
      wind:  { cutoff: 340, q: 2.0, gain: 0.12, lfo: 0.06, sweep: 180 },
    };
    const p = presets[kind] || presets.sea;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = p.cutoff;
    filter.Q.value = p.q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(p.gain, now, 1.2);

    // Slow swell on the cutoff so the bed breathes like surf instead of hiss.
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = p.lfo;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = p.sweep;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.nodes.amb = { src, gain, lfo };
  }

  // --- one-shots ------------------------------------------------------------

  /** Short filtered-noise burst: footsteps, swings, splashes. */
  burst({ freq = 900, q = 1, decay = 0.12, gain = 0.3, type = "lowpass", sweepTo = null }) {
    if (!this.ready || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, now);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, now + decay);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + decay + 0.05);
  }

  /** Pitched blip: UI, chimes, fanfares. */
  tone({ freq = 440, decay = 0.2, gain = 0.18, type = "triangle", slideTo = null, delay = 0 }) {
    if (!this.ready || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + decay);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }

  // --- named cues -----------------------------------------------------------

  step(onSand) {
    this.burst(onSand
      ? { freq: 1400, decay: 0.09, gain: 0.10, sweepTo: 400 }
      : { freq: 800, decay: 0.07, gain: 0.09, sweepTo: 300 });
  }

  splash() { this.burst({ freq: 2200, decay: 0.35, gain: 0.2, sweepTo: 300 }); }
  swing()  { this.burst({ freq: 3000, decay: 0.16, gain: 0.22, sweepTo: 600, type: "bandpass", q: 2 }); }
  hit()    { this.burst({ freq: 280, decay: 0.2, gain: 0.35 }); this.tone({ freq: 140, decay: 0.16, gain: 0.2, type: "square", slideTo: 70 }); }
  hurt()   { this.tone({ freq: 320, decay: 0.3, gain: 0.22, type: "sawtooth", slideTo: 110 }); }
  click()  { this.tone({ freq: 660, decay: 0.07, gain: 0.14, type: "square" }); }
  talk()   { this.tone({ freq: 520 + Math.random() * 180, decay: 0.05, gain: 0.07, type: "square" }); }
  pickup() { this.tone({ freq: 880, decay: 0.12, gain: 0.18 }); this.tone({ freq: 1320, decay: 0.2, gain: 0.14, delay: 0.09 }); }

  /** Rising four-note flourish for quest completion and recruitment. */
  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, decay: i === 3 ? 0.7 : 0.24, gain: 0.16, delay: i * 0.12 }));
  }

  /** Deep bell on making landfall. */
  bell() {
    this.tone({ freq: 196, decay: 1.6, gain: 0.16, type: "sine" });
    this.tone({ freq: 392, decay: 1.2, gain: 0.09, type: "sine" });
    this.tone({ freq: 587, decay: 0.8, gain: 0.05, type: "sine" });
  }

  gull() {
    const base = 900 + Math.random() * 500;
    this.tone({ freq: base, decay: 0.16, gain: 0.05, type: "sawtooth", slideTo: base * 1.7 });
    this.tone({ freq: base * 1.1, decay: 0.2, gain: 0.04, type: "sawtooth", slideTo: base * 0.7, delay: 0.18 });
  }
}
