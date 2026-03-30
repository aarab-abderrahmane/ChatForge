const BASE_URL = "http://localhost:5000/api";

export const api = {

  // ── Legacy: check if OpenRouter key exists ──────────────────────
  checkKeyExists: async (userId) => {
    try {
      const res = await fetch(`${BASE_URL}/key-exists`, {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      return await res.json();
    } catch {
      return { exists: false, res: "error" };
    }
  },

  // ── Legacy: test & save single OpenRouter key ───────────────────
  testKey: async (key, userId) => {
    try {
      const res = await fetch(`${BASE_URL}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ APIkey: key, userId }),
      });
      return await res.json();
    } catch (error) {
      return { type: "error", response: `Connection error: ${error}` };
    }
  },

  // ── Save multiple provider keys ─────────────────────────────────
  // keys = { openrouter?: string, groq?: string, gemini?: string }
  saveKeys: async (userId, keys) => {
    try {
      const res = await fetch(`${BASE_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...keys }),
      });
      return await res.json();
    } catch (error) {
      return { type: "error", results: {}, error: String(error) };
    }
  },

  // ── Get which providers are active ─────────────────────────────
  getKeysStatus: async (userId) => {
    try {
      const res = await fetch(`${BASE_URL}/keys-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      return await res.json(); // { openrouter: bool, groq: bool, gemini: bool }
    } catch {
      return { openrouter: false, groq: false, gemini: false };
    }
  },

  // ── Send message (streaming) ────────────────────────────────────
  chat: async (userId, messages, skillPrompt, model, parameters, signal) => {
    try {
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messages, skillPrompt, model, parameters }),
        signal,
      });
      return res;
    } catch (error) {
      throw error;
    }
  },
};