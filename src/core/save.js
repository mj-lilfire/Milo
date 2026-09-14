const KEY = "grandline.save.v1";

/**
 * Progress lives in localStorage. Saves are small and written on every
 * meaningful beat (landfall, quest step, departure) because a tablet browser
 * can be swiped away at any moment without warning.
 */
export const Save = {
  has() {
    try { return localStorage.getItem(KEY) !== null; } catch { return false; }
  },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.version === 1 ? data : null;
    } catch {
      return null;
    }
  },

  write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), ...state }));
      return true;
    } catch {
      // Private browsing or a full quota — the voyage still works, it just
      // won't survive a reload. Not worth interrupting the player over.
      return false;
    }
  },

  clear() {
    try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  },
};
