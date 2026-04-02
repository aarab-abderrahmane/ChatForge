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
      const cleanKey = String(key || "").replace(/[^\x00-\x7F]/g, "").trim();
      let payload = { userId };

      const isOR = cleanKey.startsWith("sk-or-v1-");
      const isGroq = cleanKey.startsWith("gsk_");
      const isGemini = cleanKey.startsWith("AIza");

      if (isGroq) payload.groq = cleanKey;
      else if (isGemini) payload.gemini = cleanKey;
      else payload.openrouter = cleanKey;

      const res = await fetch(`${BASE_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.type === "success") {
        const results = data.results || {};
        const successEntry = Object.entries(results).find(([_, r]) => r.ok);

        if (successEntry) {
          const [provider] = successEntry;
          await KeysService.saveKeys({ [provider]: cleanKey });
          return { type: "success", response: "ok" };
        } else {
          // If the key FORMAT is correct but the SERVICE is failing (429, 503, etc.)
          // we allow them in but with a warning.
          if (isOR || isGroq || isGemini) {
            const providerName = isOR ? "OpenRouter" : isGroq ? "Groq" : "Gemini";
            await KeysService.saveKeys({ [isOR ? "openrouter" : isGroq ? "groq" : "gemini"]: cleanKey });
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
      if (cleanKey.startsWith("sk-or-v1-") || cleanKey.startsWith("gsk_") || cleanKey.startsWith("AIza")) {
        await KeysService.saveKeys({ openrouter: cleanKey }); // default to OR if uncertain
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
  getKeysStatus: async (userId) => {
    try {
      return await KeysService.getStatus();
    } catch {
      return { openrouter: false, groq: false, gemini: false, huggingface: false };
    }
  },




  // ── NORMAL CHAT (Text Only) ────────────────────────────────────
  chat: async (userId, messages, skillPrompt, model, parameters = {}, signal) => {
    try {
      const keys = await KeysService.getKeys();
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

      // نرسل الطلب إلى مسار /chat العادي بدون workspaceState
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            userId, 
            messages, 
            skillPrompt, 
            model, 
            parameters: safeParams, 
            clientKeys,
            isAgent: false // تأكيد أن هذه دردشة عادية
        }),
        signal,
      });
      return res;
    } catch (error) {
      console.error("API Chat error:", error);
      throw error;
    }
  },

  // ── WORKSPACE AGENT (JSON/Tasks Logic) ─────────────────────────
  agentChat: async (userId, messages, skillPrompt, model, parameters = {}, workspaceState = null, signal) => {
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

      const res = await fetch(`${BASE_URL}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messages, skillPrompt, model, parameters: safeParams, workspaceState, clientKeys }),
        signal,
      });
      return res;
    } catch (error) {
      throw error;
    }
  },
};