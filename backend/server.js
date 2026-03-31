import cors from "cors";
import express from "express";
import { connectDB } from "./db.js";
import { askGroq, validateGroqKey } from "./groqClient.js";
import { askGeminiStream, validateGeminiKey } from "./geminiClient.js";

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────
export function encrypt(text) {
  return Buffer.from(text).toString("base64");
}

export function decrypt(text) {
  return Buffer.from(text, "base64").toString("utf8");
}

// ─────────────────────────────────────────────
// Single-key helpers (legacy — OpenRouter only)
// ─────────────────────────────────────────────
export async function saveUserKey(encryptedKey, userId) {
  const client = await connectDB();
  const db = client.db(process.env.APP_NAME);
  await db.collection("apikeys").updateOne(
    { userId },
    { $set: { encryptedKey } },
    { upsert: true }
  );
}

export async function getUserKey(userId) {
  try {
    const client = await connectDB();
    const db = client.db(process.env.APP_NAME);
    const user = await db.collection("apikeys").findOne({ userId });
    if (user && user.encryptedKey) {
      return { exists: true, res: decrypt(user.encryptedKey).trim() };
    }
    return { exists: false, res: "User not found. Please provide a valid API key ⚠️." };
  } catch {
    return { exists: false, res: "Unable to fetch user key. Please try again later ❌." };
  }
}

export async function check_key_Exists(userId) {
  try {
    const client = await connectDB();
    const db = client.db(process.env.APP_NAME);
    const user = await db.collection("apikeys").findOne({ userId });
    if (user && user.encryptedKey) return { exists: true, res: "key Exists" };
    return { exists: false, res: "User not found. Please provide a valid API key ⚠️." };
  } catch {
    return { exists: false, res: "Unable to fetch user key. Please try again later ❌." };
  }
}

// ─────────────────────────────────────────────
// Multi-provider key helpers
// ─────────────────────────────────────────────
export async function saveUserKeys(userId, keys) {
  const client = await connectDB();
  const db = client.db(process.env.APP_NAME);
  const update = {};
  if (keys.openrouter !== undefined) update.encryptedKey = encrypt(keys.openrouter);
  if (keys.groq !== undefined) update.encryptedGroq = encrypt(keys.groq);
  if (keys.gemini !== undefined) update.encryptedGemini = encrypt(keys.gemini);
  await db.collection("apikeys").updateOne(
    { userId },
    { $set: update },
    { upsert: true }
  );
}

export async function getUserKeys(userId) {
  try {
    const client = await connectDB();
    const db = client.db(process.env.APP_NAME);
    const user = await db.collection("apikeys").findOne({ userId });
    if (!user) return { openrouter: null, groq: null, gemini: null };
    return {
      openrouter: user.encryptedKey ? decrypt(user.encryptedKey).trim() : null,
      groq: user.encryptedGroq ? decrypt(user.encryptedGroq).trim() : null,
      gemini: user.encryptedGemini ? decrypt(user.encryptedGemini).trim() : null,
    };
  } catch {
    return { openrouter: null, groq: null, gemini: null };
  }
}

// ─────────────────────────────────────────────
// OpenRouter free models (fallback list)
// ─────────────────────────────────────────────
export const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.1-405b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-large-preview:free",
];

// ─────────────────────────────────────────────
// OpenRouter call (streaming)
// ─────────────────────────────────────────────
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

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5000",
          "X-OpenRouter-Title": "ChatForge",
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
        const errorData = await response.json();
        const code = errorData?.error?.code || response.status;
        const msg = errorData?.error?.message || `HTTP ${response.status}`;
        console.warn(`[ChatForge] Model "${model}" failed (${code}): ${msg}`);
        triedErrors.push(`${model}: ${msg}`);
        if ([400, 404, 429, 500, 503].includes(Number(code)) ||
          msg.includes("rate-limit") || msg.includes("Provider returned error") ||
          msg.includes("No endpoints")) continue;
        throw new Error(msg);
      }

      console.log(`[ChatForge] ✓ Serving via OpenRouter: ${model}`);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        triedErrors.push(`${model}: timed out`);
        continue;
      }
      if (!triedErrors.find((e) => e.startsWith(model))) throw err;
    }
  }

  throw new Error("All AI models are currently unavailable. Please try again later.");
}

// ─────────────────────────────────────────────
// Task-type detection
// ─────────────────────────────────────────────
const CODE_KEYWORDS = [
  "function", "class ", "def ", "const ", "let ", "var ", "import ",
  "export ", "return", "async ", "await ", "=>", "error", "bug", "debug",
  "code", "script", "program", "compile", "syntax", "algorithm",
  "```", "loop", "array", "object", "api", "http", "sql", "query",
];

function detectTaskType(text) {
  const lower = text.toLowerCase();
  const hasCode = CODE_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasCode) return "code";
  if (text.trim().length < 80) return "short";
  return "creative";
}

// ─────────────────────────────────────────────
// Smart Router — picks provider, then falls back
// ─────────────────────────────────────────────
/**
 * Route a chat request to the best available provider.
 * Returns { stream, provider } where:
 *   - stream is a ReadableStream (for Groq/OpenRouter) or AsyncGenerator (for Gemini)
 *   - provider is "groq" | "gemini" | "openrouter"
 */
export async function smartRouter(messages, keys, options = {}) {
  const taskType = detectTaskType(messages[messages.length - 1]?.content || "");

  // Determine priority order based on task type OR forced routing mode
  const routingMode = options.routingMode || "smart";
  let order;

  if (routingMode !== "smart") {
    // User forced a specific provider. We still keep fallbacks just in case the forced one fails
    if (routingMode === "groq") order = ["groq", "openrouter", "gemini"];
    else if (routingMode === "gemini") order = ["gemini", "openrouter", "groq"];
    else order = ["openrouter", "gemini", "groq"];
  } else {
    // Smart Router mode
    if (taskType === "short") {
      order = ["groq", "gemini", "openrouter"];
    } else if (taskType === "code") {
      order = ["gemini", "groq", "openrouter"];
    } else {
      // creative / long
      order = ["openrouter", "gemini", "groq"];
    }
  }

  const errors = [];

  for (const provider of order) {
    const key = keys[provider];
    if (!key) {
      errors.push(`${provider}: no key configured`);
      continue;
    }

    try {
      if (provider === "groq") {
        const res = await askGroq(messages, key, options);
        return { stream: res, provider: "groq", isGenerator: false };
      }

      if (provider === "gemini") {
        const gen = askGeminiStream(messages, key, options);
        return { stream: gen, provider: "gemini", isGenerator: true };
      }

      if (provider === "openrouter") {
        const finalModels = options.model
          ? [options.model, ...FREE_MODELS.filter((m) => m !== options.model)]
          : FREE_MODELS;
        const res = await askAI(messages, key, { ...options, models: finalModels, stream: true });
        return { stream: res, provider: "openrouter", isGenerator: false };
      }
    } catch (err) {
      console.warn(`[SmartRouter] ${provider} failed: ${err.message}`);
      errors.push(`${provider}: ${err.message}`);
      // continue to next provider
    }
  }

  throw new Error(
    `All providers failed. Please check your API keys in Settings.\n${errors.join(" | ")}`
  );
}

// ─────────────────────────────────────────────
// POST /api/chat — main chat endpoint
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { userId, messages, skillPrompt, model, parameters, clientKeys } = req.body;

  let keys = clientKeys;
  if (!keys || (!keys.openrouter && !keys.groq && !keys.gemini)) {
    keys = await getUserKeys(userId);
  }

  // Must have at least one key
  if (!keys.openrouter && !keys.groq && !keys.gemini) {
    return res.status(401).json({ response: "No API keys found! Please add at least one key in Settings.", type: "error" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const options = {
      systemPrompt: skillPrompt || "You are ChatForge AI.",
      model,
      ...(parameters || {}),
    };

    const { stream, provider, isGenerator } = await smartRouter(messages, keys, options);

    if (isGenerator) {
      // Gemini: async generator of SSE strings
      for await (const chunk of stream) {
        res.write(chunk);
      }
    } else {
      // Groq / OpenRouter: raw fetch Response with SSE body
      const reader = stream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    }

    // Send provider info as final SSE event so the frontend can display the badge
    res.write(`data: ${JSON.stringify({ provider, done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat API error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ─────────────────────────────────────────────
// POST /api/test — validate & save OpenRouter key (legacy)
// ─────────────────────────────────────────────
app.post("/api/test", async (req, res) => {
  const { APIkey, userId } = req.body;
  const cleanKey = APIkey?.trim();
  if (!cleanKey) {
    return res.status(400).json({ type: "error", response: "API Key is required." });
  }

  try {
    const aiRes = await askAI(
      [{ role: "user", content: "Say hello in one sentence." }],
      cleanKey,
      { models: FREE_MODELS, systemPrompt: "You are a helpful assistant. Answer concisely." }
    );
    const answer = await aiRes.json();
    if (answer.error || !answer.choices?.[0]?.message?.content) {
      return res.json({
        response: `⚠️ AI Service Error: ${answer.error?.message || "Provider rejected the request."}`,
        type: "error",
      });
    }
    await saveUserKey(encrypt(cleanKey), userId);
    res.json({ response: "ok", type: "success" });
  } catch (error) {
    console.error("API key test error:", error);
    res.status(500).json({ response: "⚠️ Internal server error while validating key.", type: "error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/keys — save all provider keys
// ─────────────────────────────────────────────
app.post("/api/keys", async (req, res) => {
  const { userId, openrouter, groq, gemini } = req.body;
  if (!userId) return res.status(400).json({ type: "error", response: "userId is required." });

  const results = {};
  const toSave = {};

  // Validate & save openrouter
  if (openrouter !== undefined) {
    const key = openrouter.trim();
    if (key) {
      try {
        const aiRes = await askAI(
          [{ role: "user", content: "Say hi." }],
          key,
          { models: [FREE_MODELS[0]], systemPrompt: "Be concise." }
        );
        const data = await aiRes.json();
        if (data?.choices?.[0]?.message?.content) {
          toSave.openrouter = key;
          results.openrouter = { ok: true };
        } else {
          results.openrouter = { ok: false, error: data?.error?.message || "Validation failed" };
        }
      } catch (e) {
        results.openrouter = { ok: false, error: e.message };
      }
    }
  }

  // Validate & save groq
  if (groq !== undefined) {
    const key = groq.trim();
    if (key) {
      const valid = await validateGroqKey(key);
      if (valid) {
        toSave.groq = key;
        results.groq = { ok: true };
      } else {
        results.groq = { ok: false, error: "Invalid Groq API key" };
      }
    }
  }

  // Validate & save gemini
  if (gemini !== undefined) {
    const key = gemini.trim();
    if (key) {
      const valid = await validateGeminiKey(key);
      if (valid) {
        toSave.gemini = key;
        results.gemini = { ok: true };
      } else {
        results.gemini = { ok: false, error: "Invalid Gemini API key" };
      }
    }
  }

  if (Object.keys(toSave).length > 0) {
    await saveUserKeys(userId, toSave);
  }

  res.json({ type: "success", results });
});

// ─────────────────────────────────────────────
// POST /api/keys-status — returns which providers are active
// ─────────────────────────────────────────────
app.post("/api/keys-status", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ type: "error" });

  const keys = await getUserKeys(userId);
  res.json({
    openrouter: !!keys.openrouter,
    groq: !!keys.groq,
    gemini: !!keys.gemini,
  });
});

// ─────────────────────────────────────────────
// POST /api/key-exists — legacy check (OpenRouter)
// ─────────────────────────────────────────────
app.post("/api/key-exists", async (req, res) => {
  const { userId } = req.body;
  const keystatus = await check_key_Exists(userId);
  res.json(keystatus);
});

app.get("/", (_, res) => res.json({ message: "Welcome to ChatForge" }));

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
async function startServer() {
  try {
    await connectDB();
    app.listen(5000, () => console.log("Server running on port 5000"));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

export default app;
startServer();