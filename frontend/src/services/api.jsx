import { KeysService } from './db';

const BASE_URL = import.meta.env.VITE_BACKEND_URL + "api";

export const api = {

  // ── Legacy: check if OpenRouter key exists ──────────────────────
  checkKeyExists: async () => {
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
      // eslint-disable-next-line no-control-regex
      const cleanKey = String(key || "").replace(/[^\x00-\x7F]/g, "").trim();
      let payload = { userId };

      const isOR = cleanKey.startsWith("sk-or-v1-");
      const isGroq = cleanKey.startsWith("gsk_");
      const isGemini = cleanKey.startsWith("AIza");
      const isHuggingFace = cleanKey.startsWith("hf_");
      const isTogether = cleanKey.startsWith("tgp_");

      if (isGroq) payload.groq = cleanKey;
      else if (isGemini) payload.gemini = cleanKey;
      else if (isHuggingFace) payload.huggingface = cleanKey;
      else if (isTogether) payload.together = cleanKey;
      else payload.openrouter = cleanKey;

      const res = await fetch(`${BASE_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.type === "success") {
        const results = data.results || {};
        // eslint-disable-next-line no-unused-vars
        const successEntry = Object.entries(results).find(([_, r]) => r.ok);

        if (successEntry) {
          const [provider] = successEntry;
          await KeysService.saveKeys({ [provider]: cleanKey });
          return { type: "success", response: "ok" };
        } else {
          // If the key FORMAT is correct but the SERVICE is failing (429, 503, etc.)
          // we allow them in but with a warning.
          if (isOR || isGroq || isGemini || isHuggingFace || isTogether) {
            const providerName = isOR ? "OpenRouter" : isGroq ? "Groq" : isGemini ? "Gemini" : isHuggingFace ? "HuggingFace" : "Together AI";
            const providerKey = isOR ? "openrouter" : isGroq ? "groq" : isGemini ? "gemini" : isHuggingFace ? "huggingface" : "together";
            await KeysService.saveKeys({ [providerKey]: cleanKey });
            return {
              type: "success",
              response: `warning:${providerName} service is currently busy or unreachable, but your key has been saved. You can try chatting now.`
            };
          }

          const firstErr = Object.values(results).find(r => r.error)?.error;
          return { type: "error", response: firstErr || "Validation failed. Please check your key." };
        }
      }
      return { type: "error", response: data.response || "Server error during validation." };
    } catch (error) {
      // Offline or network error: allow entry if key looks valid
      const cleanKey = String(key || "").trim();
      if (cleanKey.startsWith("sk-or-v1-") || cleanKey.startsWith("gsk_") || cleanKey.startsWith("AIza") || cleanKey.startsWith("hf_") || cleanKey.startsWith("tgp_")) {
        const providerKey = cleanKey.startsWith("gsk_") ? "groq" : cleanKey.startsWith("AIza") ? "gemini" : cleanKey.startsWith("hf_") ? "huggingface" : cleanKey.startsWith("tgp_") ? "together" : "openrouter";
        await KeysService.saveKeys({ [providerKey]: cleanKey });
        return { type: "success", response: "warning:Network issue - key saved in offline mode." };
      }
      return { type: "error", response: `Connection error: ${error.message}` };
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

      const data = await res.json();

      if (data.type === "success") {
        // Only save the keys that were actually validated by the backend
        const validatedKeys = {};
        for (const [provider, result] of Object.entries(data.results)) {
          if (result.ok) {
            validatedKeys[provider] = keys[provider];
          }
        }

        if (Object.keys(validatedKeys).length > 0) {
          await KeysService.saveKeys(validatedKeys);
        }
      }

      return data;
    } catch (error) {
      return { type: "error", results: {}, error: String(error) };
    }
  },

  // ── Get which providers are active ─────────────────────────────
  getKeysStatus: async () => {
    try {
      return await KeysService.getStatus();
    } catch {
      return { openrouter: false, groq: false, gemini: false, huggingface: false, together: false, mistral: false };
    }
  },




  // ── NORMAL CHAT (Text Only) ────────────────────────────────────
  chat: async (userId, messages, skillPrompt, model, parameters = {}, signal) => {
    try {
      const keys = await KeysService.getKeys();
      const safeParams = {
        ...parameters,
        max_tokens: Math.min(parameters.max_tokens || 4096, 16384)
      };

      const clientKeys = {
        openrouter: keys.openrouter,
        groq: keys.groq,
        gemini: keys.gemini,
        huggingface: keys.huggingface,
        together: keys.together,
        mistral: keys.mistral,
      };

      // Free decrypted keys immediately after building clientKeys
      for (const k of Object.keys(keys)) keys[k] = null;

      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messages,
          skillPrompt,
          model,
          parameters: safeParams,
          clientKeys
        }),
        signal,
      });

      // Free the clientKeys reference after the request is sent
      for (const k of Object.keys(clientKeys)) clientKeys[k] = null;

      return res;
    } catch (error) {
      console.error("API Chat error:", error);
      throw error;
    }
  },


};