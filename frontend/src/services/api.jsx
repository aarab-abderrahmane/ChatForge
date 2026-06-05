import { KeysService } from './db';

const BASE_URL = import.meta.env.VITE_BACKEND_URL + "api";

const SESSION_TOKEN_KEY = "chatforge_session_token";
const USER_ID_KEY = "chatforge_user_id";

function getStoredToken() {
  try { return sessionStorage.getItem(SESSION_TOKEN_KEY); } catch { return null; }
}

function getStoredUserId() {
  try { return sessionStorage.getItem(USER_ID_KEY); } catch { return null; }
}

function setStoredSession(token, userId) {
  try {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    else sessionStorage.removeItem(SESSION_TOKEN_KEY);
    if (userId) sessionStorage.setItem(USER_ID_KEY, userId);
    else sessionStorage.removeItem(USER_ID_KEY);
  } catch {}
}

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
      if (data.token) setStoredSession(data.token, userId);

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

  // ── Unified: validate & save one or more provider keys ─────────
  // keys = { openrouter?: string, groq?: string, gemini?: string, ... }
  // Returns { type, results, error } — results maps provider -> { ok, error? }
  validateAndSaveKey: async (userId, keys) => {
    try {
      const res = await fetch(`${BASE_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...keys }),
      });
      const data = await res.json();
      if (data.token) setStoredSession(data.token, userId);

      if (data.type === "success") {
        const validatedKeys = {};
        for (const [provider, result] of Object.entries(data.results || {})) {
          if (result.ok) {
            validatedKeys[provider] = keys[provider];
          }
        }
        if (Object.keys(validatedKeys).length > 0) {
          await KeysService.saveKeys(validatedKeys);
          return data;
        }
        return { type: "error", results: data.results, error: "All provider keys failed validation." };
      }

      // Offline fallback: save keys that have valid format even if backend unreachable
      if (!navigator.onLine || data.type === "error") {
        const fallbackKeys = {};
        for (const [provider, key] of Object.entries(keys)) {
          const cleanKey = String(key || "").trim();
          const validFormat =
            (provider === "openrouter" && cleanKey.startsWith("sk-or-v1-")) ||
            (provider === "groq" && cleanKey.startsWith("gsk_")) ||
            (provider === "gemini" && cleanKey.startsWith("AIza")) ||
            (provider === "huggingface" && cleanKey.startsWith("hf_")) ||
            (provider === "together" && cleanKey.startsWith("tgp_")) ||
            (provider === "mistral" && cleanKey.length > 8);
          if (validFormat) {
            fallbackKeys[provider] = cleanKey;
          }
        }
        if (Object.keys(fallbackKeys).length > 0) {
          await KeysService.saveKeys(fallbackKeys);
          return {
            type: "success",
            results: Object.fromEntries(
              Object.keys(fallbackKeys).map(p => [p, { ok: true, warning: `Offline — key saved locally. Verify connectivity.` }])
            ),
          };
        }
      }

      return { type: "error", results: {}, error: data?.response || "Validation failed." };
    } catch (error) {
      // Network error
      const fallbackKeys = {};
      for (const [provider, key] of Object.entries(keys)) {
        const cleanKey = String(key || "").trim();
        const validFormat =
          (provider === "openrouter" && cleanKey.startsWith("sk-or-v1-")) ||
          (provider === "groq" && cleanKey.startsWith("gsk_")) ||
          (provider === "gemini" && cleanKey.startsWith("AIza")) ||
          (provider === "huggingface" && cleanKey.startsWith("hf_")) ||
          (provider === "together" && cleanKey.startsWith("tgp_")) ||
          (provider === "mistral" && cleanKey.length > 8);
        if (validFormat) {
          fallbackKeys[provider] = cleanKey;
        }
      }
      if (Object.keys(fallbackKeys).length > 0) {
        await KeysService.saveKeys(fallbackKeys);
        return {
          type: "success",
          results: Object.fromEntries(
            Object.keys(fallbackKeys).map(p => [p, { ok: true, warning: `Network issue — key saved locally.` }])
          ),
        };
      }
      return { type: "error", results: {}, error: `Connection error: ${error.message}` };
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
      if (data.token) setStoredSession(data.token, userId);

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




  // ── Restore session: send stored keys to get a fresh token ──
  restoreSession: async () => {
    const uid = getStoredUserId();
    if (!uid) return false;
    const keys = await KeysService.getKeys();
    if (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface && !keys.together && !keys.mistral) {
      return false;
    }
    try {
      const res = await fetch(`${BASE_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, ...keys }),
      });
      const data = await res.json();
      if (data.token) {
        setStoredSession(data.token, uid);
        return true;
      }
    } catch {}
    return false;
  },

  // ── NORMAL CHAT (Text Only) ────────────────────────────────────
  chat: async (userId, messages, skillPrompt, model, parameters = {}, signal, isRetry = false) => {
    try {
      if (userId) setStoredSession(getStoredToken(), userId);

      let token = getStoredToken();
      if (!token) {
        const restored = await api.restoreSession();
        if (!restored) {
          throw new Error("No session. Please enter your API keys in Settings.");
        }
        token = getStoredToken();
      }

      const safeParams = {
        ...parameters,
        max_tokens: Math.min(parameters.max_tokens || 4096, 16384)
      };

      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messages,
          skillPrompt,
          model,
          parameters: safeParams,
          token,
        }),
        signal,
      });

      if (res.status === 401 && !isRetry) {
        setStoredSession(null, null);
        const restored = await api.restoreSession();
        if (restored) {
          return api.chat(userId, messages, skillPrompt, model, parameters, signal, true);
        }
      }

      return res;
    } catch (error) {
      console.error("API Chat error:", error);
      throw error;
    }
  },


};