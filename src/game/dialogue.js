import { matches, applyEffects } from "./quests.js";

/**
 * Conversation runner.
 *
 * A "talk" is a flat list of lines plus optional choices at the end, guarded by
 * a `when` clause. Picking the first talk whose clause matches is enough to
 * express every conversation in the game — recruitment, fetch quests, boss
 * taunts, idle chatter — without the weight of a full dialogue graph.
 */
export class DialogueRunner {
  constructor(hud, audio) {
    this.hud = hud;
    this.audio = audio;
    this.active = false;
    this.onFinish = null;
  }

  /**
   * @param npc      the NPC definition (name + talks)
   * @param progress the voyage state
   * @param ctx      { islandId, crewById, onNotice, onFinish }
   * @returns true if a conversation started
   */
  start(npc, progress, ctx) {
    const talk = (npc.talks || []).find((t) => matches(t.when, progress, ctx.islandId));
    if (!talk) return false;

    this.active = true;
    this.npc = npc;
    this.progress = progress;
    this.ctx = ctx;
    this.talk = talk;
    this.lines = this.resolveLines(talk.lines, progress);
    this.index = 0;
    this.awaitingChoice = false;
    this.pendingEffects = talk.effects;

    this.show();
    return true;
  }

  /** Lines may be plain strings, {speaker, text} objects, or functions. */
  resolveLines(lines, progress) {
    const out = [];
    for (const raw of [].concat(lines || [])) {
      const line = typeof raw === "function" ? raw(progress) : raw;
      if (!line) continue;
      out.push(typeof line === "string" ? { speaker: null, text: line } : line);
    }
    return out;
  }

  show() {
    if (this.index >= this.lines.length) {
      this.showChoicesOrEnd();
      return;
    }
    const line = this.lines[this.index];
    this.audio?.talk();
    this.hud.showDialogue({
      speaker: line.speaker ?? this.npc.name,
      text: line.text,
      onAdvance: () => {
        this.index++;
        this.show();
      },
    });
  }

  showChoicesOrEnd() {
    const choices = (this.talk.choices || []).filter((c) =>
      matches(c.when, this.progress, this.ctx.islandId));

    if (!choices.length) {
      this.finish(this.pendingEffects);
      return;
    }

    this.awaitingChoice = true;
    const last = this.lines[this.lines.length - 1];
    this.hud.showDialogue({
      speaker: last ? (last.speaker ?? this.npc.name) : this.npc.name,
      text: last ? last.text : "",
      choices,
      onChoice: (i) => {
        const choice = choices[i];
        this.audio?.click();
        this.awaitingChoice = false;
        // A choice can lead into more lines before its effects land.
        const followUp = this.resolveLines(choice.lines, this.progress);
        if (followUp.length) {
          this.lines = followUp;
          this.index = 0;
          this.talk = { ...this.talk, choices: choice.choices || null };
          this.pendingEffects = choice.effects ?? this.pendingEffects;
          this.show();
        } else {
          this.finish(choice.effects ?? this.pendingEffects);
        }
      },
    });
  }

  finish(effects) {
    const notices = applyEffects(effects, this.progress, this.ctx.islandId, {
      crewById: this.ctx.crewById,
    });
    this.hud.hideDialogue();
    this.active = false;
    for (const n of notices) this.ctx.onNotice?.(n);
    this.ctx.onFinish?.(effects);
    this.onFinish?.(effects);
  }

  /** Let a key/button press drive the conversation as well as a tap. */
  advanceFromInput() {
    if (!this.active || this.awaitingChoice) return;
    this.index++;
    this.show();
  }

  cancel() {
    if (!this.active) return;
    this.hud.hideDialogue();
    this.active = false;
  }
}
