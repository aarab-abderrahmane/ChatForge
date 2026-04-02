import cors from "cors";
import express from "express";
import { connectDB } from "./db.js";
import fs from "node:fs";
import path from "node:path";
import { askGroq, validateGroqKey } from "./groqClient.js";
import { askGeminiStream, validateGeminiKey } from "./geminiClient.js";
import { askHuggingFace, validateHuggingFaceKey } from "./huggingfaceClient.js";

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Fallback Cache (for when MongoDB is down)
const CACHE_FILE = path.join(process.cwd(), ".keys_cache.json");

function loadMemoryCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  } catch (err) {
    console.warn("Failed to load keys cache file:", err.message);
  }
  return { apikeys: {}, health: {} };
}

const BACKEND_MEMORY_CACHE = loadMemoryCache();

function saveMemoryCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(BACKEND_MEMORY_CACHE, null, 2));
  } catch (err) {
    console.warn("Failed to save keys cache file:", err.message);
  }
}

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
    if (!client) {
      return { exists: !!BACKEND_MEMORY_CACHE.apikeys[userId]?.encryptedKey, res: "Memory Check" };
    }
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
  const update = {};
  if (keys.openrouter !== undefined) update.encryptedKey = encrypt(keys.openrouter);
  if (keys.groq !== undefined) update.encryptedGroq = encrypt(keys.groq);
  if (keys.gemini !== undefined) update.encryptedGemini = encrypt(keys.gemini);
  if (keys.huggingface !== undefined) update.encryptedHuggingFace = encrypt(keys.huggingface);

  // Fallback to Memory & Local File
  BACKEND_MEMORY_CACHE.apikeys[userId] = { ...BACKEND_MEMORY_CACHE.apikeys[userId], ...update };
  saveMemoryCache();

  try {
    const client = await connectDB();
    if (!client) return; // Silent return, memory cache is already updated
    const db = client.db(process.env.APP_NAME);
    await db.collection("apikeys").updateOne(
      { userId },
      { $set: update },
      { upsert: true }
    );
  } catch (err) {
    console.warn("Failed to persist keys to MongoDB, using memory fallback.", err.message);
  }
}

export async function getUserKeys(userId) {
  let user = BACKEND_MEMORY_CACHE.apikeys[userId];

  try {
    const client = await connectDB();
    if (client) {
      const db = client.db(process.env.APP_NAME);
      const dbUser = await db.collection("apikeys").findOne({ userId });
      if (dbUser) user = dbUser;
    }
  } catch (err) {
    console.warn("DB fetch failed, using memory cache", err.message);
  }

  if (!user) return { openrouter: null, groq: null, gemini: null, huggingface: null };
  return {
    openrouter: user.encryptedKey ? decrypt(user.encryptedKey).trim() : null,
    groq: user.encryptedGroq ? decrypt(user.encryptedGroq).trim() : null,
    gemini: user.encryptedGemini ? decrypt(user.encryptedGemini).trim() : null,
    huggingface: user.encryptedHuggingFace ? decrypt(user.encryptedHuggingFace).trim() : null,
  };
}

// ─────────────────────────────────────────────
// OpenRouter free models (fallback list)
// ─────────────────────────────────────────────
export const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free"
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
  let rateLimitStrikes = 0;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const cleanKey = String(key || "").replace(/[^\x00-\x7F]/g, "").trim();

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cleanKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://chatforge.app",
          "X-Title": "ChatForge",
          "User-Agent": "ChatForge/2.0"
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
        try { errBody = await response.json(); } catch (e) { }
        const msg = errBody?.error?.message || `HTTP ${response.status}`;
        console.warn(`[OpenRouter Debug] Model: ${model}, Status: ${response.status}, Error: ${msg}`);

        // Fail-fast on multiple rate limits
        if (response.status === 429 || response.status === 503 || msg.toLowerCase().includes("capacity") || msg.toLowerCase().includes("rate limit")) {
          rateLimitStrikes++;
          if (rateLimitStrikes >= 2) {
            throw new Error(`RATE_LIMIT_EXHAUSTED: ${msg}`);
          }
        }

        // Only hard-fail on confirmed auth errors (invalid key, not just missing header quirks)
        const msgLower = msg.toLowerCase();
        const isHardAuthFail = (response.status === 401 || response.status === 403) &&
          (msgLower.includes("invalid api key") ||
            msgLower.includes("invalid key") ||
            msgLower.includes("unauthorized") ||
            msgLower.includes("no auth") ||
            msgLower.includes("api key not found"));
        if (isHardAuthFail) {
          throw new Error(`Authentication failed: ${msg}`);
        }
        triedErrors.push(`${model}: ${msg}`);
        continue;
      }

      console.log(`[ChatForge] ✓ Serving via OpenRouter: ${model} (Streaming: ${stream})`);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = err.name === "AbortError" ? "timed out (30s)" : err.message;
      console.warn(`[ChatForge] Model "${model}" error: ${errMsg}`);

      if (errMsg.includes("RATE_LIMIT_EXHAUSTED")) {
        throw err; // Bubble up immediately to trip the circuit breaker
      }

      triedErrors.push(`${model}: ${errMsg}`);
      continue;
    }
  }

  throw new Error(`OpenRouter failed all models: ${triedErrors.join(" | ")}`);
}

// ─────────────────────────────────────────────
// Task-type detection
// ─────────────────────────────────────────────
const CODE_KEYWORDS = [
  "function", "class ", "def ", "const ", "let ", "var ", "import ",
  "export ", "return", "async ", "await ", "=>", "error", "bug", "debug",
  "code", "script", "program", "compile", "syntax", "algorithm",
  "```", "loop", "array", "object", "api", "http", "sql", "query",
  "html", "css", "tailwind", "react", "component", "props", "state",
  "npm", "node", "express", "json", "payload", "endpoint",
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
export async function smartRouter(messages, keys, options = {}) {
  const taskType = detectTaskType(messages[messages.length - 1]?.content || "");

  // Determine priority order
  const routingMode = options.routingMode || "smart";
  let order;

  // Even if a mode is "forced" (e.g. from frontend lock or settings),
  // we still build a fallback chain. The forced provider just goes first.
  if (routingMode === "groq") {
    order = ["groq", "gemini", "huggingface", "openrouter"];
  } else if (routingMode === "gemini") {
    order = ["gemini", "huggingface", "groq", "openrouter"];
  } else if (routingMode === "openrouter") {
    order = ["openrouter", "gemini", "huggingface", "groq"];
  } else if (routingMode === "huggingface") {
    order = ["huggingface", "groq", "gemini", "openrouter"];
  } else {
    // Smart Router mode
    if (taskType === "short") {
      order = ["groq", "gemini", "huggingface", "openrouter"];
    } else if (taskType === "code") {
      order = ["gemini", "huggingface", "groq", "openrouter"];
    } else {
      order = ["openrouter", "gemini", "huggingface", "groq"];
    }
  }

  const errors = [];

  for (const provider of order) {
    // 1. Health Check (Circuit Breaker)
    const health = BACKEND_MEMORY_CACHE.health[provider];
    if (health && health.status === "down" && Date.now() < health.retryAt) {
      const waitSec = Math.ceil((health.retryAt - Date.now()) / 1000);
      console.log(`[Router] Skipping ${provider} (Circuit Breaker active for ${waitSec}s)`);
      errors.push(`${provider}: disabled (rate limit) - retry in ${waitSec}s`);
      continue; // Skip this provider and immediately loop to the next
    }

    // 2. Key Check
    const key = keys[provider];
    if (!key) {
      console.log(`[Router] Skipping ${provider} (No key configured)`);
      errors.push(`${provider}: no key configured`);
      continue;
    }

    try {
      console.log(`[Router] Attempting: ${provider} (TaskType: ${taskType})`);

      if (provider === "groq") {
        const res = await askGroq(messages, key, options);
        if (health) delete BACKEND_MEMORY_CACHE.health[provider];
        return { stream: res, provider: "groq", isGenerator: false };
      }

      if (provider === "gemini") {
        const gen = askGeminiStream(messages, key, options);
        if (health) delete BACKEND_MEMORY_CACHE.health[provider];
        return { stream: gen, provider: "gemini", isGenerator: true };
      }

      if (provider === "openrouter") {
        const finalModels = options.model
          ? [options.model, ...FREE_MODELS.filter((m) => m !== options.model)]
          : FREE_MODELS;
        const res = await askAI(messages, key, { ...options, models: finalModels, stream: true });
        if (health) delete BACKEND_MEMORY_CACHE.health[provider];
        return { stream: res, provider: "openrouter", isGenerator: false };
      }

      if (provider === "huggingface") {
        const res = await askHuggingFace(messages, key, options);
        if (health) delete BACKEND_MEMORY_CACHE.health[provider];
        return { stream: res, provider: "huggingface", isGenerator: false };
      }
    } catch (err) {
      const errMsg = err.message || "Unknown error";
      console.warn(`[SmartRouter] ${provider} failed: ${errMsg}`);

      // 3. Circuit Breaker Logic
      if (errMsg.includes("RATE_LIMIT_EXHAUSTED") || errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("capacity")) {
        console.log(`[Circuit Breaker] Tripping for ${provider} (15m cooldown)`);
        BACKEND_MEMORY_CACHE.health[provider] = {
          status: "down",
          retryAt: Date.now() + 900000 // 15 minutes
        };
      }

      const isRateLimit = errMsg.includes("RATE_LIMIT_EXHAUSTED") || errMsg.includes("rate limit");
      const cleanErrMsg = errMsg.replace("RATE_LIMIT_EXHAUSTED: ", "");
      errors.push(`${provider}: ${isRateLimit ? "Rate Limit Exceeded (Circuit Breaker Tripped)" : cleanErrMsg}`);

      // Crucial: we do NOT break. Let the loop move on to the next provider.
    }
  }

  const errorDetails = errors.length > 0 ? `\n\nFallback Details:\n${errors.join("\n")}` : "";
  throw new Error(
    `AI Connection Failed. All available providers failed. ${errorDetails}`
  );
}

// ─────────────────────────────────────────────
// POST /api/chat — main chat endpoint
// ─────────────────────────────────────────────
app.post("/api/agent", async (req, res) => {
  const { userId, messages, skillPrompt, model, parameters, workspaceState, clientKeys } = req.body;

  let keys = clientKeys;
  if (!keys || (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface)) {
    keys = await getUserKeys(userId);
  }

  // Must have at least one key
  if (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface) {
    return res.status(401).json({ response: "No API keys found! Please add at least one key in Settings.", type: "error" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let finalSystemPrompt = skillPrompt || "You are ChatForge AI.";

    if (workspaceState) {
      finalSystemPrompt = `### ROLE: ULTRA-AUTONOMOUS LOGIC ENGINE (ReAct Framework)
You are not a chatbot. You are a workspace execution engine running a continuous loop of:
  OBSERVE → THINK → PLAN → EXECUTE → REPEAT

==== WORKSPACE IDENTITY ====
Type/Format: ${workspaceState.type}
Description: ${workspaceState.description}
Current Phase: ${workspaceState.currentPhase}

${workspaceState.immortalRules}

==== WORKSPACE STATE ====
Active / Pending Tasks:
${workspaceState.activeTasks}

Completed Tasks:
${workspaceState.completedTasks}

Existing Files (Outputs — READ EVERY FILE BEFORE WRITING CODE):
${workspaceState.filesOutput}
=========================

### ⚠️ THE 4 SUPREME LAWS (UNBREAKABLE — Override everything else)
1. LAW OF ATOMICITY: Complete exactly ONE task per response. Never list multiple tasks as 'complete' in one turn.
2. LAW OF VERIFICATION: Strictly forbidden from marking a task "complete" unless you provided FULL, WORKING CODE in 'save_outputs'.
3. LAW OF CONTINUITY: If pending tasks remain, you MUST set "requires_approval": false to trigger the next loop automatically.
4. LAW OF FULL CONTEXT: Read "Existing Files" above. If a file exists, reference or improve it — never contradict or hallucinate against it.

### 🧠 THE AGENT'S BRAIN (INTERNAL LOGIC)
- NEVER output code without first completing your 'thought' step.
- If a task fails or an error is detected, acknowledge it in 'observation', analyze the cause in 'thought', and fix it this turn.
- You are self-correcting: if you detect dead-end files (e.g., unused CSS), remove or merge them without being asked.
- Never ask "Should I continue?" — if tasks are pending and requires_approval is false, you loop immediately.

### 🎭 THE "WOW" USER EXPERIENCE
Structure your 'answer' field using this exact format every turn:
  🔍 OBSERVATION: What you see in the workspace right now (files, tasks, errors).
  🤔 REASONING: Your logic for the chosen action. Be specific — "I noticed X, so I will Y".
  🗺️ LIVE PLAN: Current task status. Use ⏳ pending, ⚙️ working, ✅ done.
  🛠️ ACTION: What you just built or fixed (file name + summary, not the code itself).
  🔁 STATUS: "Looping to next task..." or "Awaiting approval — all tasks complete."

### WORKSPACE OPERATIONAL FLOW
1. [Brainstorming] → Define vision and goals.
2. [Planning] → Break down into small, atomic, independently-completable tasks.
3. [Executing] → Write code for ONE task at a time. Full code only — no snippets or stubs.
4. [Review/Testing] → Polish, bug fixes, and edge case handling.
5. [Completed] → Only when 100% functional and all tasks are done.

### RESPONSE FORMAT (STRICT JSON ONLY)
Return ONLY a valid JSON object. No text outside it. No markdown fences wrapping it.
{
  "thought": "Step-by-step internal reasoning: current state, root cause of any issue, chosen next action.",
  "observation": "What I see right now: files present, tasks pending/done, errors detected.",
  "phase": "Brainstorming | Planning | Executing | Review/Testing | Completed",
  "add_tasks": [{"title": "Atomic Task Name", "status": "pending"}],
  "complete_tasks": ["Exact title of the ONE task finished this turn"],
  "save_outputs": [{"fileName": "filename.ext", "content": "FULL CODE — NEVER PARTIAL OR STUBBED", "language": "javascript"}],
  "answer": "🔍 OBSERVATION: ...\n🤔 REASONING: ...\n🗺️ LIVE PLAN: ...\n🛠️ ACTION: ...\n🔁 STATUS: ...",
  "requires_approval": false
}

### DOMAIN ADAPTABILITY
- UI work: Use Glassmorphism, Tailwind, or Material Design 3. Every interface must be visually stunning.
- Logic work: Cover all error cases and edge conditions. No TODO stubs — write the real thing.
- Backend work: Production-quality code with proper status codes, validation, and error handling.
- Business/Planning: Act as a Project Manager with strategy docs and detailed atomic task lists.

### 🧠 INTELLIGENCE DIRECTIVES
- User says "Nice", "Good", "Ok", or similar → check if project is truly done. If tasks remain, continue. If done, move to [Completed].
- Never produce placeholder lines like "// add logic here" or "TODO". Always write the complete implementation.
- Every turn must add tangible value: a new feature, a real bug fix, or a measurable UI improvement.
`;
    }

    const options = {
      systemPrompt: finalSystemPrompt,
      model,
      ...(parameters || {}),
    };

    const { stream, provider, isGenerator } = await smartRouter(messages, keys, options);

    if (isGenerator) {
      // Gemini: async generator
      for await (const chunk of stream) {
        res.write(chunk);
      }
    } else {
      // Groq / OpenRouter / HuggingFace: raw fetch Response body
      // We consume the stream manually to ensure SSE compatibility and avoid Node/Web stream mismatches
      const reader = stream.body.getReader ? stream.body.getReader() : null;

      if (reader) {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
        } finally {
          reader.releaseLock();
        }
      } else if (stream.body.on) {
        // Node.js Readable fallback
        await new Promise((resolve, reject) => {
          stream.body.on("data", (chunk) => res.write(chunk));
          stream.body.on("end", resolve);
          stream.body.on("error", reject);
        });
      } else {
        // Fallback for non-streaming response body (unlikely but safe)
        const text = await stream.text();
        res.write(text);
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
// POST /api/chat — main chat endpoint  (normal chat)
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { userId, messages, skillPrompt, model, parameters, clientKeys } = req.body;

  let keys = clientKeys;
  if (!keys || (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface)) {
    keys = await getUserKeys(userId);
  }

  // Must have at least one key
  if (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface) {
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
      // Gemini: async generator
      for await (const chunk of stream) {
        res.write(chunk);
      }
    } else {
      // Groq / OpenRouter / HuggingFace: raw fetch Response body
      // We consume the stream manually to ensure SSE compatibility and avoid Node/Web stream mismatches
      const reader = stream.body.getReader ? stream.body.getReader() : null;

      if (reader) {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
        } finally {
          reader.releaseLock();
        }
      } else if (stream.body.on) {
        // Node.js Readable fallback
        await new Promise((resolve, reject) => {
          stream.body.on("data", (chunk) => res.write(chunk));
          stream.body.on("end", resolve);
          stream.body.on("error", reject);
        });
      } else {
        // Fallback for non-streaming response body (unlikely but safe)
        const text = await stream.text();
        res.write(text);
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
  const { userId, openrouter, groq, gemini, huggingface } = req.body;
  if (!userId) return res.status(400).json({ type: "error", response: "userId is required." });

  const results = {};
  const toSave = {};

  // Validate & save openrouter
  if (openrouter !== undefined) {
    const key = openrouter.trim();
    if (key) {
      const cleanKey = String(key).replace(/[^\x00-\x7F]/g, "").trim();
      try {
        const aiRes = await askAI(
          [{ role: "user", content: "Say hi." }],
          cleanKey,
          { models: [FREE_MODELS[0]], systemPrompt: "Be concise." }
        );
        // askAI returns the raw fetch Response for non-streaming calls
        if (aiRes.ok) {
          const data = await aiRes.json();
          if (data?.choices?.[0]?.message?.content) {
            toSave.openrouter = key;
            results.openrouter = { ok: true };
          } else {
            results.openrouter = { ok: false, error: data?.error?.message || "No response from model" };
          }
        } else {
          const errData = await aiRes.json().catch(() => ({}));
          results.openrouter = { ok: false, error: errData?.error?.message || `HTTP ${aiRes.status}` };
        }
      } catch (e) {
        // If error is NOT an auth failure, the key format is valid but models are busy.
        // Save the key anyway — user can still try chatting.
        const errMsg = e.message || "";
        const isAuthError = errMsg.toLowerCase().includes("authentication") ||
          errMsg.toLowerCase().includes("invalid api key") ||
          errMsg.toLowerCase().includes("401") ||
          errMsg.toLowerCase().includes("403");
        if (!isAuthError && cleanKey.startsWith("sk-or-v1-")) {
          toSave.openrouter = key;
          results.openrouter = { ok: true, warning: "Models are busy, but key was saved. You can start chatting!" };
        } else {
          results.openrouter = { ok: false, error: e.message };
        }
      }
    }
  }

  // Validate & save groq
  if (groq !== undefined) {
    const key = groq.trim();
    if (key) {
      const cleanKey = String(key).replace(/[^\x00-\x7F]/g, "").trim();
      const valid = await validateGroqKey(cleanKey);
      if (valid) {
        toSave.groq = cleanKey;
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
      const cleanKey = String(key).replace(/[^\x00-\x7F]/g, "").trim();
      const valid = await validateGeminiKey(cleanKey);
      if (valid) {
        toSave.gemini = cleanKey;
        results.gemini = { ok: true };
      } else {
        results.gemini = { ok: false, error: "Invalid Gemini API key" };
      }
    }
  }

  // Validate & save huggingface
  if (huggingface !== undefined) {
    const key = huggingface.trim();
    if (key) {
      const cleanKey = String(key).replace(/[^\x00-\x7F]/g, "").trim();
      const valid = await validateHuggingFaceKey(cleanKey);
      if (valid) {
        toSave.huggingface = cleanKey;
        results.huggingface = { ok: true };
      } else {
        results.huggingface = { ok: false, error: "Invalid Hugging Face API key" };
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
    huggingface: !!keys.huggingface,
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
    // Start listening regardless of MongoDB status
    app.listen(5000, () => {
      console.log("-----------------------------------------");
      console.log("🚀 Server running on port 5000");
      console.log("-----------------------------------------");
    });
  } catch (err) {
    console.error("Critical server error:", err);
  }
}

export default app;
startServer();