import { askGroq } from "./groqClient.js";
import { askGeminiStream, askGeminiSync } from "./geminiClient.js";
import { askHuggingFace } from "./huggingfaceClient.js";
import { askTogether } from "./togetherClient.js";
import { askMistral } from "./mistralClient.js";

// ─── Model Registry ──────────────────────────────────────────
// Ordered by preference per task type. A single OpenRouter entry
// suffices — askAI handles model fallback internally.

const TASK_MODELS = {
  speedster: [
    { provider: "together", model: "meta-llama/Llama-3-70b-chat-hf" },
    { provider: "mistral", model: "mistral-small-latest" },
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "openrouter", model: "openrouter" },
    { provider: "gemini", model: "gemini-2.0-flash-lite" },
    { provider: "huggingface", model: "mistralai/Mistral-7B-Instruct-v0.3" },
  ],
  specialist: [
    { provider: "openrouter", model: "openrouter" },
    { provider: "together", model: "meta-llama/Llama-3-70b-chat-hf" },
    { provider: "mistral", model: "mistral-small-latest" },
    { provider: "gemini", model: "gemini-2.0-flash-lite" },
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "huggingface", model: "mistralai/Mistral-7B-Instruct-v0.3" },
  ],
  architect: [
    { provider: "openrouter", model: "openrouter" },
    { provider: "together", model: "meta-llama/Llama-3-70b-chat-hf" },
    { provider: "mistral", model: "mistral-small-latest" },
    { provider: "gemini", model: "gemini-2.0-flash-lite" },
    { provider: "groq", model: "llama-3.3-70b-versatile" },
  ],
};

export const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

// ─── Health Metrics ──────────────────────────────────────────
const providerState = new Map();

function isProviderReady(provider) {
  const s = providerState.get(provider);
  if (!s) return true;
  if (Date.now() >= s.until) {
    providerState.delete(provider);
    return true;
  }
  return false;
}

function tripProvider(provider) {
  const prev = providerState.get(provider) || { failCount: 0 };
  const failCount = prev.failCount + 1;
  const duration = Math.min(30000 * Math.pow(2, failCount - 1), 480000);
  providerState.set(provider, { failCount, until: Date.now() + duration });
}

function resetProvider(provider) {
  providerState.delete(provider);
}

// ─── OpenRouter call ─────────────────────────────────────────
export async function askAI(messages, key, options = {}) {
  const {
    models = FREE_MODELS,
    systemPrompt = "You are a helpful AI assistant.",
    temperature = 0.7,
    stream = false,
    top_p,
    frequency_penalty,
    presence_penalty,
    max_tokens,
  } = options;

  const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];
  const triedErrors = [];

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const cleanKey = String(key || "").replace(/[^\x00-\x7F]/g, "").trim();

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://chatforge.app",
          "X-Title": "ChatForge",
          "User-Agent": "ChatForge/2.0",
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          stream,
          temperature,
          top_p,
          frequency_penalty,
          presence_penalty,
          max_tokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errBody = {};
        try { errBody = await response.json(); } catch {}
        const msg = errBody?.error?.message || `HTTP ${response.status}`;

        if (response.status === 429 || response.status === 503 || msg.toLowerCase().includes("capacity") || msg.toLowerCase().includes("rate limit")) {
          triedErrors.push(`${model}: rate limited`);
          // Small delay to let rate limit cool down before next model
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        const isHardAuthFail = (response.status === 401 || response.status === 403) &&
          (msg.toLowerCase().includes("invalid api key") || msg.toLowerCase().includes("unauthorized"));
        if (isHardAuthFail) {
          throw new Error(`Authentication failed: ${msg}`);
        }

        triedErrors.push(`${model}: ${msg}`);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = err.name === "AbortError" ? "timed out (30s)" : err.message;
      if (errMsg.includes("Authentication failed")) throw err;
      triedErrors.push(`${model}: ${errMsg}`);
      continue;
    }
  }

  throw new Error(`OpenRouter failed all models: ${triedErrors.join(" | ")}`);
}

// ─── Task type detection ─────────────────────────────────────
const CODE_KEYWORDS = [
  "function ", "class ", "const ", "let ", "var ", "import ", "export ",
  "debug", "error", "bug", "fix ", "refactor", "optimize",
  "react", "component", "api", "sql", "json", "html", "css",
  "code", "script", "algorithm", "compile", "syntax", "type ",
];

export function detectTaskType(messages) {
  const lastMsg = messages[messages.length - 1]?.content || "";
  const lower = lastMsg.toLowerCase();

  const hasCodeKeywords = CODE_KEYWORDS.some(kw => lower.includes(kw));

  if (hasCodeKeywords) return "specialist";
  if (lower.length < 150 && !lower.includes("```")) return "speedster";
  if (messages.length > 15 || lower.includes("find bug") || lower.includes("search") || lower.includes("read_file")) return "specialist";
  return "architect";
}

// ─── Smart Router ────────────────────────────────────────────
export async function smartRouter(messages, keys, options = {}) {
  const taskType = options.smartTaskType && options.smartTaskType !== "auto"
    ? options.smartTaskType
    : detectTaskType(messages);
  const routingMode = options.routingMode || "smart";
  const errors = [];

  let candidates = [];
  if (routingMode === "smart") {
    candidates = [...TASK_MODELS[taskType]];
  } else if (TASK_MODELS[routingMode]) {
    candidates = [...TASK_MODELS[routingMode]];
  } else {
    // Single provider mode — only the forced provider, no fallback chain
    const forced = TASK_MODELS.speedster.find(m => m.provider === routingMode)
      || TASK_MODELS.specialist.find(m => m.provider === routingMode)
      || TASK_MODELS.architect.find(m => m.provider === routingMode);
    if (forced) {
      candidates = [forced];
    }
  }

  const availableProviders = Object.entries(keys).filter(([_, v]) => v).map(([p]) => p);

  const chain = candidates
    .filter(m => availableProviders.includes(m.provider))
    .filter(m => isProviderReady(m.provider));

  // Only one entry per provider (askAI handles OpenRouter model fallback internally)
  const seenProviders = new Set();
  const deduped = [];
  for (const c of chain) {
    if (!seenProviders.has(c.provider)) {
      seenProviders.add(c.provider);
      deduped.push(c);
    }
  }

  for (const { provider, model } of deduped) {
    const key = keys[provider];
    if (!key) continue;

    try {
      console.log(`[Router] → ${provider} (${taskType})`);

      if (provider === "groq") {
        const res = await askGroq(messages, key, { ...options, model });
        resetProvider(provider);
        return { stream: res, provider: "groq", isGenerator: false };
      }

      if (provider === "together") {
        const res = await askTogether(messages, key, { ...options, model });
        resetProvider(provider);
        return { stream: res, provider: "together", isGenerator: false };
      }

      if (provider === "mistral") {
        const res = await askMistral(messages, key, { ...options, model });
        resetProvider(provider);
        return { stream: res, provider: "mistral", isGenerator: false };
      }

      if (provider === "gemini") {
        const useStream = options.stream !== false;
        if (!useStream) {
          const res = await askGeminiSync(messages, key, { ...options, model });
          resetProvider(provider);
          return { stream: res, provider: "gemini", isGenerator: false };
        }
        const gen = askGeminiStream(messages, key, { ...options, model });
        // Eagerly validate Gemini — consume first chunk to catch quota/network
        // errors at router time so fallback to next provider works
        const first = await gen.next();
        if (first.done) {
          // Empty response — skip to next provider
          continue;
        }
        const firstChunk = first.value;
        const validatedGen = (async function* () {
          yield firstChunk;
          yield* gen;
        })();
        resetProvider(provider);
        return { stream: validatedGen, provider: "gemini", isGenerator: true };
      }

      if (provider === "openrouter") {
        const finalModels = options.model
          ? [options.model, ...FREE_MODELS.filter(m => m !== options.model)]
          : FREE_MODELS;
        const useStream = options.stream !== false;
        const res = await askAI(messages, key, { ...options, models: finalModels, stream: useStream });
        resetProvider(provider);
        return { stream: res, provider: "openrouter", isGenerator: false };
      }

      if (provider === "huggingface") {
        const res = await askHuggingFace(messages, key, { ...options, model });
        resetProvider(provider);
        return { stream: res, provider: "huggingface", isGenerator: false };
      }
    } catch (err) {
      const errMsg = err.message || "Unknown error";
      console.warn(`[Router] ✗ ${provider}: ${errMsg}`);

      const isRateLimit = errMsg.includes("RATE_LIMIT_EXHAUSTED") ||
        errMsg.includes("rate limit") || errMsg.includes("429") ||
        errMsg.includes("capacity") || errMsg.includes("timed out");

      if (isRateLimit) {
        tripProvider(provider);
        const s = providerState.get(provider);
        const waitSec = s ? Math.ceil((s.until - Date.now()) / 1000) : 0;
        errors.push(`${provider}: rate limited (backoff ${waitSec}s)`);
      } else {
        errors.push(`${provider}: ${errMsg}`);
      }
    }
  }

  const errorDetails = errors.length > 0 ? `\n\nFallback Details:\n${errors.join("\n")}` : "";
  throw new Error(`AI Connection Failed. All available providers failed.${errorDetails}`);
}
