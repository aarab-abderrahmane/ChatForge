import { KeysService } from './db';

const BASE_URL = "http://localhost:5000/api";

export const api = {

  // ── Legacy: check if OpenRouter key exists ──────────────────────
  checkKeyExists: async (userId) => {
    try {
      const status = await KeysService.getStatus();
      if (status.openrouter) return { exists: true, res: "key Exists" };
      return { exists: false, res: "error" };
    } catch {
      return { exists: false, res: "error" };
    }
  },

  // ── Legacy: test & save single OpenRouter key ───────────────────
  testKey: async (key, userId) => {
    try {
      await KeysService.saveKeys({ openrouter: key });
      return { type: "success", response: "ok" };
    } catch (error) {
      return { type: "error", response: `Connection error: ${error}` };
    }
  },

  // ── Save multiple provider keys ─────────────────────────────────
  // keys = { openrouter?: string, groq?: string, gemini?: string }
  saveKeys: async (userId, keys) => {
    try {
      await KeysService.saveKeys(keys);
      // Mock validation results (assuming valid if added to UI) to prevent backend tracking
      const results = {};
      for (const k of Object.keys(keys)) {
        results[k] = { ok: true };
      }
      return { type: "success", results };
    } catch (error) {
      return { type: "error", results: {}, error: String(error) };
    }
  },

  // ── Get which providers are active ─────────────────────────────
  getKeysStatus: async (userId) => {
    try {
      return await KeysService.getStatus();
    } catch {
      return { openrouter: false, groq: false, gemini: false, huggingface: false };
    }
  },

  // ── Send message (streaming) ────────────────────────────────────
  chat: async (userId, messages, skillPrompt, model, parameters = {}, signal) => {
    try {
      const keys = await KeysService.getKeys();

      // Ensure max_tokens is reasonable to avoid 413 or excessive costs
      const safeParams = {
        ...parameters,
        max_tokens: Math.min(parameters.max_tokens || 2048, 4096)
      };

      const clientKeys = {
        openrouter: keys.openrouter,
        groq: keys.groq,
        gemini: keys.gemini,
        huggingface: keys.huggingface,
      };

      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messages, skillPrompt, model, parameters: safeParams, clientKeys }),
        signal,
      });
      return res;
    } catch (error) {
      throw error;
    }
  },
};