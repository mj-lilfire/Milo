/**
 * The player's voyage state, and the rules for reading and changing it.
 *
 * Every gameplay decision — which line an islander speaks, whether a door is
 * open, where the Log Pose points — is a pure function of this object, which
 * makes saving and restoring the whole game a matter of one JSON blob.
 */
export class Progress {
  constructor(route) {
    this.route = route;
    this.currentIndex = 0;
    this.completed = [];
    this.visited = [];
    this.flags = {};
    this.crew = [];
    this.berries = 0;
    this.steps = {};
    this.health = 100;
    this.maxHealth = 100;
    // The ship takes damage separately from the captain, and both are spent
    // currency in their own way: one sends you back to the jetty, the other
    // costs Berries to put right.
    this.hull = 100;
    this.upgrades = { sail: 0, cannon: 0, hull: 0 };
  }

  get maxHull() {
    return 100 + (this.upgrades.hull || 0) * 45;
  }

  /** Top speed under sail, improved by rigging upgrades. */
  get maxSpeed() {
    return 17 + (this.upgrades.sail || 0) * 3.4;
  }

  repairHull(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  damageHull(amount) {
    this.hull = Math.max(0, this.hull - amount);
    return this.hull <= 0;
  }

  upgrade(kind) {
    this.upgrades[kind] = (this.upgrades[kind] || 0) + 1;
    if (kind === "hull") this.hull = this.maxHull;
    return this.upgrades[kind];
  }

  // --- quest steps ----------------------------------------------------------

  step(islandId) {
    return this.steps[islandId] ?? 0;
  }

  /** Move an island's quest to its next step. Returns the new step. */
  advance(islandId) {
    this.steps[islandId] = this.step(islandId) + 1;
    return this.steps[islandId];
  }

  setStep(islandId, n) {
    this.steps[islandId] = n;
  }

  // --- flags ----------------------------------------------------------------

  setFlag(name) { this.flags[name] = true; }
  clearFlag(name) { delete this.flags[name]; }
  hasFlag(name) { return !!this.flags[name]; }

  // --- crew and purse -------------------------------------------------------

  recruit(id) {
    if (!this.crew.includes(id)) this.crew.push(id);
  }

  hasCrew(id) { return this.crew.includes(id); }

  addBerries(n) {
    this.berries = Math.max(0, this.berries + n);
  }

  // --- route ----------------------------------------------------------------

  get currentIsland() {
    return this.route[Math.min(this.currentIndex, this.route.length - 1)];
  }

  isComplete(islandId) { return this.completed.includes(islandId); }

  markVisited(islandId) {
    if (!this.visited.includes(islandId)) this.visited.push(islandId);
  }

  /** Finish an island and point the Log Pose at the next one. */
  completeIsland(islandId) {
    if (!this.completed.includes(islandId)) this.completed.push(islandId);
    const idx = this.route.findIndex((i) => i.id === islandId);
    if (idx === this.currentIndex && this.currentIndex < this.route.length - 1) {
      this.currentIndex++;
    }
  }

  /** Islands the player is allowed to make landfall on. */
  isUnlocked(index) {
    return index <= this.currentIndex;
  }

  get finished() {
    return this.completed.length >= this.route.length;
  }

  // --- persistence ----------------------------------------------------------

  toJSON() {
    return {
      currentIndex: this.currentIndex,
      completed: this.completed,
      visited: this.visited,
      flags: this.flags,
      crew: this.crew,
      berries: this.berries,
      steps: this.steps,
      health: this.health,
      hull: this.hull,
      upgrades: this.upgrades,
    };
  }

  static fromJSON(route, data) {
    const p = new Progress(route);
    if (!data) return p;
    p.currentIndex = Math.min(data.currentIndex ?? 0, route.length - 1);
    p.completed = Array.isArray(data.completed) ? data.completed : [];
    p.visited = Array.isArray(data.visited) ? data.visited : [];
    p.flags = data.flags && typeof data.flags === "object" ? data.flags : {};
    p.crew = Array.isArray(data.crew) ? data.crew : [];
    p.berries = Number(data.berries) || 0;
    p.steps = data.steps && typeof data.steps === "object" ? data.steps : {};
    p.health = Number(data.health) || p.maxHealth;
    p.upgrades = (data.upgrades && typeof data.upgrades === "object")
      ? { sail: 0, cannon: 0, hull: 0, ...data.upgrades }
      : { sail: 0, cannon: 0, hull: 0 };
    p.hull = Number(data.hull) || p.maxHull;
    return p;
  }
}

/**
 * Does a `when` clause match the current state?
 *
 * All listed conditions must hold. An empty clause always matches, which makes
 * it the natural fallback at the end of a talk list.
 */
export function matches(when, progress, islandId) {
  if (!when) return true;
  if (when.questStep !== undefined && progress.step(islandId) !== when.questStep) return false;
  if (when.minStep !== undefined && progress.step(islandId) < when.minStep) return false;
  if (when.maxStep !== undefined && progress.step(islandId) > when.maxStep) return false;
  if (when.flag && !progress.hasFlag(when.flag)) return false;
  if (when.notFlag && progress.hasFlag(when.notFlag)) return false;
  if (when.hasCrew && !progress.hasCrew(when.hasCrew)) return false;
  if (when.lacksCrew && progress.hasCrew(when.lacksCrew)) return false;
  if (when.completed && !progress.isComplete(when.completed)) return false;
  if (when.islandDone !== undefined && progress.isComplete(islandId) !== when.islandDone) return false;
  if (when.minBerries !== undefined && progress.berries < when.minBerries) return false;
  if (when.upgradeUnder) {
    const { kind, level } = when.upgradeUnder;
    if ((progress.upgrades?.[kind] ?? 0) >= level) return false;
  }
  return true;
}

/**
 * Apply a talk's effects.
 * @returns {object[]} notices the caller should surface (toasts, fanfares).
 */
export function applyEffects(effects, progress, islandId, ctx = {}) {
  const notices = [];
  if (!effects) return notices;

  if (effects.advance) {
    progress.advance(islandId);
    notices.push({ type: "objective" });
  }
  if (effects.setStep !== undefined) {
    progress.setStep(islandId, effects.setStep);
    notices.push({ type: "objective" });
  }
  if (effects.flag) {
    for (const f of [].concat(effects.flag)) progress.setFlag(f);
  }
  if (effects.clearFlag) {
    for (const f of [].concat(effects.clearFlag)) progress.clearFlag(f);
  }
  if (effects.berries) {
    progress.addBerries(effects.berries);
    notices.push({
      type: "toast",
      text: (effects.berries > 0 ? "+" : "") + effects.berries.toLocaleString("en-US") + " Berries",
      sound: effects.berries > 0 ? "pickup" : null,
    });
  }
  if (effects.recruit) {
    const member = ctx.crewById?.(effects.recruit);
    if (member && !progress.hasCrew(effects.recruit)) {
      progress.recruit(effects.recruit);
      notices.push({ type: "recruit", text: `${member.name} joined the crew!`, id: effects.recruit });
    }
  }
  if (effects.heal) {
    progress.health = Math.min(progress.maxHealth, progress.health + effects.heal);
    notices.push({ type: "toast", text: "Patched up", sound: "pickup" });
  }
  if (effects.repair) {
    const before = progress.hull;
    progress.repairHull(effects.repair);
    notices.push({
      type: "toast",
      text: `Hull repaired (+${Math.round(progress.hull - before)})`,
      sound: "pickup",
    });
    notices.push({ type: "vitals" });
  }
  if (effects.upgrade) {
    const level = progress.upgrade(effects.upgrade);
    const names = { sail: "Rigging", cannon: "Gunnery", hull: "Hull plating" };
    notices.push({ type: "upgrade", text: `${names[effects.upgrade]} improved — level ${level}` });
  }
  if (effects.completeIsland) {
    if (!progress.isComplete(islandId)) {
      progress.completeIsland(islandId);
      notices.push({ type: "islandComplete" });
    }
  }
  if (effects.custom) notices.push({ type: "custom", name: effects.custom });
  return notices;
}
