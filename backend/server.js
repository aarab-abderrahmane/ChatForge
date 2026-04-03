import cors from "cors";
import express from "express";
import { connectDB } from "./db.js";
import fs from "node:fs";
import path from "node:path";
import { askGroq, validateGroqKey } from "./groqClient.js";
import { askGeminiStream, validateGeminiKey, askGeminiSync } from "./geminiClient.js";
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
// Task-type detection - Dual-Model Orchestration
// ─────────────────────────────────────────────

function detectTaskType(messages) {
  const lastMsg = messages[messages.length - 1]?.content || "";
  const lower = lastMsg.toLowerCase();

  // Speedster: Short UI updates, instant micro-tasks, small fixes
  if (lower.length < 150 && !lower.includes("```")) return "speedster";

  // Specialist: Massive file analysis, reading history, finding bugs
  // Characterized by large prompts or multiple files, tool calls for reading
  if (messages.length > 15 || lower.includes("find bug") || lower.includes("search") || lower.includes("read_file")) return "specialist";

  // Architect: High-level planning, complex logic, task breakdown
  return "architect";
}

// ─────────────────────────────────────────────
// Smart Router — picks provider, then falls back
// ─────────────────────────────────────────────
export async function smartRouter(messages, keys, options = {}) {
  const taskType = detectTaskType(messages);

  // Determine priority order
  const routingMode = options.routingMode || "smart";
  let order;

  if (routingMode === "smart") {
    if (taskType === "speedster") {
      // Speedster -> Groq (Llama 3)
      order = ["groq", "gemini", "openrouter", "huggingface"];
    } else if (taskType === "specialist") {
      // Specialist -> Gemini 1.5 Flash (massive context)
      order = ["gemini", "openrouter", "groq", "huggingface"];
    } else {
      // Architect -> OpenRouter (Qwen 2.5 72B / Llama 3.3 70B)
      order = ["openrouter", "gemini", "groq", "huggingface"];
    }
  } else if (routingMode === "groq") {
    order = ["groq", "gemini", "huggingface", "openrouter"];
  } else if (routingMode === "gemini") {
    order = ["gemini", "huggingface", "groq", "openrouter"];
  } else if (routingMode === "openrouter") {
    order = ["openrouter", "gemini", "huggingface", "groq"];
  } else if (routingMode === "huggingface") {
    order = ["huggingface", "groq", "gemini", "openrouter"];
  } else {
    // default (should not be reached due to above)
    order = ["openrouter", "gemini", "groq", "huggingface"];
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
        const useStream = options.stream !== false;
        if (!useStream) {
          const res = await askGeminiSync(messages, key, options);
          if (health) delete BACKEND_MEMORY_CACHE.health[provider];
          return { stream: res, provider: "gemini", isGenerator: false };
        } else {
          const gen = askGeminiStream(messages, key, options);
          if (health) delete BACKEND_MEMORY_CACHE.health[provider];
          return { stream: gen, provider: "gemini", isGenerator: true };
        }
      }

      if (provider === "openrouter") {
        const finalModels = options.model
          ? [options.model, ...FREE_MODELS.filter((m) => m !== options.model)]
          : FREE_MODELS;
        const useStream = options.stream !== false;
        const res = await askAI(messages, key, { ...options, models: finalModels, stream: useStream });
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
// POST /api/search — Tavily web search for agent
// ─────────────────────────────────────────────
app.post("/api/search", async (req, res) => {
  const { query, userId } = req.body;
  if (!query) return res.status(400).json({ error: "query is required" });

  const TAVILY_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_KEY) return res.status(503).json({ error: "Tavily API key not configured" });

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
    });
    const data = await response.json();
    res.json({
      answer: data.answer || "",
      results: (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content?.slice(0, 400),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ─────────────────────────────────────────────
// POST /api/agent — main chat endpoint
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
      // Build conversation summary if provided
      const memorySummary = workspaceState.conversationSummary
        ? `\n==== LONG-TERM MEMORY (Summary of earlier conversation) ====\n${workspaceState.conversationSummary}\n`
        : "";

      finalSystemPrompt = `### ROLE: ULTRA-AUTONOMOUS LOGIC ENGINE (ReAct Framework)
You are not a chatbot. You are a workspace execution engine running a continuous loop of:
  OBSERVE → THINK → PLAN → EXECUTE → REPEAT

==== WORKSPACE IDENTITY ====
Name: ${workspaceState.name || "Untitled Workspace"}
Type/Format: ${workspaceState.type}
Description: ${workspaceState.description}
Current Phase: ${workspaceState.currentPhase}
All Phases: ${workspaceState.allPhases || workspaceState.currentPhase}

${workspaceState.immortalRules}
${memorySummary}
==== WORKSPACE STATE ====
Active / Pending Tasks:
${workspaceState.activeTasks}

Completed Tasks:
${workspaceState.completedTasks}

Existing Files (Names Only):
${workspaceState.filesOutput}
=========================

### ⚠️ CRITICAL RULES (UNBREAKABLE — Override everything else)
1. ALWAYS use 'createRoot' from 'react-dom/client' for index.js (React 18).
2. ATOMICITY: Do not try to write the whole app at once. Complete exactly ONE task per response.
   - Turn 1: Setup structure/theme.
   - Turn 2: Logic hooks.
   - Turn 3: UI Components.
3. STATE AWARENESS: Look at the 'Existing Files' list provided. If App.jsx or index.js already exists, DO NOT initialize it again. EDIT or APPEND to it. Always read a file using \`read_file\` before modifying it.
4. JSON ONLY: If your code is long, prioritize finishing the code block over the 'answer' text.
5. LAW OF VERIFICATION: Strictly forbidden from marking a task "complete" unless you provided FULL, WORKING CODE in 'save_outputs'.
6. LAW OF CONTINUITY: If pending tasks remain, you MUST set "requires_approval": false to trigger the next loop automatically.

### 🛠 TOOL CALLS
You have access to the following tools. If you need to use a tool, specify it in the "tool_calls" array. The system will execute it and return results before you give your final answer.
- {"tool": "read_file", "fileName": "exact_file_name"}
- {"tool": "web_search", "query": "your search query here"}

### 👻 GHOST TASK DISCOVERY (Proactive Intelligence)
Whenever you receive a broad user request, you MUST automatically deduce the necessary sub-tasks and include them in the 'add_tasks' array. For example, if asked to "Build a Login Page", proactively add "Ghost Tasks" such as "Setup User Auth Provider" and "Create Password Reset Flow". Never wait for the user to specify obvious technical prerequisites.

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
  "tool_calls": [{"tool": "read_file", "fileName": "App.jsx"}],
  "observation": "What I see right now: files present, tasks pending/done, errors detected.",
  "phase": "Brainstorming | Planning | Executing | Review/Testing | Completed",
  "add_tasks": [{"title": "Atomic Task Name", "status": "pending"}],
  "complete_tasks": ["Exact title of the ONE task finished this turn"],
  "save_outputs": [{"fileName": "filename.ext", "content": "FULL CODE — NEVER PARTIAL OR STUBBED", "language": "javascript"}],
  "answer": "🔍 OBSERVATION: ...\\n🤔 REASONING: ...\\n🗺️ LIVE PLAN: ...\\n🛠️ ACTION: ...\\n🔁 STATUS: ...",
  "requires_approval": false,
  "timeline_event": "One short sentence describing what you did this turn, for the activity log."
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

    let currentMessages = [...messages];
    let loopCount = 0;
    const MAX_LOOPS = 4;
    let finalPayloadText = "";
    let finalProvider = null;

    while (loopCount < MAX_LOOPS) {
      loopCount++;
      const options = {
        systemPrompt: finalSystemPrompt,
        model,
        ...(parameters || {}),
        stream: false, // Internal loop requests shouldn't be streamed as SSE
      };

      try {
        const { stream: respData, provider } = await smartRouter(currentMessages, keys, options);
        finalProvider = provider;
        let responseText = "";

        // Depending on provider and how we handle stream: false
        // For Gemini, we might still get a generator. For OpenRouter, a fetch Response.
        if (respData.text) {
          // It's a fetch Response object from OpenRouter/Groq/HF without streaming
          const bodyJSON = await respData.json();
          responseText = bodyJSON.choices?.[0]?.message?.content || "";
        } else if (respData.next) {
          // Generator from Gemini (geminiClient ignores stream=false sometimes)
          for await (const chunk of respData) responseText += chunk;
        }

        // Try extracting JSON
        let parsedJSON = null;
        try {
          const match = responseText.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
          const rawPayload = match ? match[1] : responseText;
          parsedJSON = JSON.parse(rawPayload.trim());
        } catch (e) {
          // Ignore, just consider it failed parse
        }

        if (parsedJSON && parsedJSON.tool_calls && parsedJSON.tool_calls.length > 0) {
          // We have tools to execute!
          const toolResults = [];
          for (const tc of parsedJSON.tool_calls) {

            if (tc.tool === "read_file") {
              const fileData = workspaceState?.rawOutputs?.find(f => f.filename === tc.fileName);
              if (fileData) {
                toolResults.push(`File ${tc.fileName}:\n${fileData.content}`);
              } else {
                toolResults.push(`File ${tc.fileName} not found.`);
              }
            }

            if (tc.tool === "web_search" && tc.query) {
              // Notify frontend that a search is happening
              res.write(`data: ${JSON.stringify({ searching: tc.query })}\n\n`);
              try {
                const TAVILY_KEY = process.env.TAVILY_API_KEY;
                if (TAVILY_KEY) {
                  const searchRes = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      api_key: TAVILY_KEY,
                      query: tc.query,
                      search_depth: "basic",
                      max_results: 4,
                      include_answer: true,
                    }),
                  });
                  const searchData = await searchRes.json();
                  const summary = searchData.answer || "";
                  const snippets = (searchData.results || [])
                    .map(r => `- ${r.title}: ${r.content?.slice(0, 300)}`)
                    .join("\n");
                  toolResults.push(`Web Search Results for "${tc.query}":\n${summary}\n${snippets}`);
                } else {
                  toolResults.push(`Web search unavailable: TAVILY_API_KEY not set.`);
                }
              } catch (searchErr) {
                toolResults.push(`Web search failed: ${searchErr.message}`);
              }
            }
          }
          currentMessages.push({ role: "assistant", content: responseText });
          currentMessages.push({ role: "user", content: `Tool Results:\n${toolResults.join("\n\n")}\n\nContinue executing the task based on these results. Submit final answer without using tools.` });
          continue; // Loop again!
        } else {
          // No tools to execute, this is the final answer!
          finalPayloadText = responseText;
          break;
        }
      } catch (err) {
        throw err;
      }
    }

    // Now manually stream the finalPayloadText as SSE to the frontend
    const chunkSize = 50;
    for (let i = 0; i < finalPayloadText.length; i += chunkSize) {
      const chunk = finalPayloadText.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
    }

    // Send provider info as final SSE event so the frontend can display the badge
    const badgeProvider = finalProvider || "unknown";
    res.write(`data: ${JSON.stringify({ provider: badgeProvider, done: true })}\n\n`);
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


// ═══════════════════════════════════════════════
// AGENT ORCHESTRATOR — Helper Functions & Prompts
// ═══════════════════════════════════════════════

/**
 * Parse an LLM text response and extract JSON.
 * Handles: raw JSON, markdown ```json fences, leading/trailing text.
 */
function parseAgentResponse(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  // Try raw JSON first
  try {
    return JSON.parse(trimmed);
  } catch (_) { /* continue */ }

  // Try extracting from markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) { /* continue */ }
  }

  // Try finding the outermost { ... } block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_) { /* continue */ }
  }

  return null;
}

/**
 * Classify a task title as "researcher" or "coder" based on keywords.
 */
function detectTaskAgentType(taskTitle) {
  if (!taskTitle) return "coder";
  const lower = taskTitle.toLowerCase();
  const researchKeywords = ["research", "search", "find", "analyze", "investigate", "lookup", "look up", "explore", "compare", "review", "survey", "gather"];
  if (researchKeywords.some(kw => lower.includes(kw))) return "researcher";
  return "coder";
}

/**
 * Build a human-readable workspace context string from the workspace state object.
 */
function buildWorkspaceContext(workspaceState) {
  if (!workspaceState) return "No workspace context available.";

  const parts = [];

  parts.push(`==== WORKSPACE CONTEXT ====`);
  if (workspaceState.name) parts.push(`Name: ${workspaceState.name}`);
  if (workspaceState.type) parts.push(`Type: ${workspaceState.type}`);
  if (workspaceState.description) parts.push(`Description: ${workspaceState.description}`);
  if (workspaceState.currentPhase) parts.push(`Current Phase: ${workspaceState.currentPhase}`);
  if (workspaceState.allPhases) parts.push(`All Phases: ${workspaceState.allPhases}`);

  if (workspaceState.immortalRules) {
    parts.push(`\n==== IMMORTAL RULES ====\n${workspaceState.immortalRules}`);
  }

  if (workspaceState.activeTasks) {
    parts.push(`\n==== ACTIVE / PENDING TASKS ====\n${workspaceState.activeTasks}`);
  }

  if (workspaceState.completedTasks) {
    parts.push(`\n==== COMPLETED TASKS ====\n${workspaceState.completedTasks}`);
  }

  if (workspaceState.filesOutput) {
    parts.push(`\n==== EXISTING FILES ====\n${workspaceState.filesOutput}`);
  }

  if (workspaceState.conversationSummary) {
    parts.push(`\n==== CONVERSATION MEMORY ====\n${workspaceState.conversationSummary}`);
  }

  // Include raw outputs if available (for file content awareness)
  if (workspaceState.rawOutputs && Array.isArray(workspaceState.rawOutputs) && workspaceState.rawOutputs.length > 0) {
    parts.push(`\n==== FILE CONTENTS (for reference) ====\n${workspaceState.rawOutputs.map(f => `--- ${f.filename} ---\n${f.content}`).join("\n\n")}`);
  }

  parts.push(`===========================`);
  return parts.join("\n");
}

// ─────────────────────────────────────────────
// System Prompts for Sub-Agents
// ─────────────────────────────────────────────

const ARCHITECT_PROMPT = `You are the ARCHITECT — a strategic planning agent in a multi-agent orchestrator system.
Your SOLE responsibility is to receive a high-level goal and break it into atomic, independently-completable tasks.

You MUST return ONLY a valid JSON object. No markdown, no text outside the JSON.

## RESPONSE FORMAT
{
  "thought": "Your reasoning: what does the user want? How should we break it down? What order makes sense?",
  "add_tasks": [
    { "title": "Task name (specific, actionable, atomic)", "status": "pending", "priority": "high|medium|low", "phase": "Executing" }
  ],
  "phase": "Planning",
  "answer": "A brief, clear summary of the plan for the user. 2-4 sentences explaining what tasks were created and why."
}

## RULES
1. Break the goal into 3-8 small, atomic tasks that can be completed independently.
2. Each task should be specific enough that a coder or researcher agent can execute it in one shot.
3. Order tasks logically — setup before features, features before polish.
4. Use "high" priority for critical-path tasks, "medium" for enhancements, "low" for nice-to-haves.
5. If research is needed ( APIs, libraries, best practices ), create research tasks.
6. Never create tasks that are vague like "Build the app" — instead create "Create App.jsx with header component".
7. Consider what files already exist (from workspace context) and avoid duplicating work.
`;

const CODER_PROMPT = `You are the CODER — an elite code-generation agent in a multi-agent orchestrator system.
Your job is to write complete, production-quality code for a single assigned task.

You MUST return ONLY a valid JSON object. No markdown, no text outside the JSON.

## RESPONSE FORMAT
{
  "thought": "Your reasoning: what file(s) need to be created or updated? What approach will you take?",
  "save_outputs": [
    { "fileName": "path/to/file.ext", "content": "FULL COMPLETE CODE — no stubs, no TODOs, no placeholders", "type": "file" }
  ],
  "complete_tasks": ["Exact title of the task you just completed"],
  "answer": "A brief summary of what you built. Mention file names and key decisions."
}

## RULES
1. ALWAYS write COMPLETE, WORKING code. Never use TODO, FIXME, "// your code here", or placeholder comments.
2. Always use 'createRoot' from 'react-dom/client' for React 18 index.js/index.jsx files (NOT ReactDOM.render).
3. Look at existing files in the workspace context — don't re-create files that already exist. Extend them.
4. Each save_output entry must have the FULL file content, not a diff or snippet.
5. Use modern best practices: functional components, hooks, clean imports.
6. If the task involves styling, use Tailwind CSS classes or inline styles — whichever fits the project.
7. Handle errors gracefully. Include loading states and empty states where appropriate.
8. Import paths should be relative (e.g., '../components/Header').
9. For index files, always include createRoot and a clean render call.
10. Complete the task fully in ONE response. Do not leave anything half-done.
`;

const RESEARCHER_PROMPT = `You are the RESEARCHER — an information-gathering agent in a multi-agent orchestrator system.
Your job is to investigate topics, find information, and return structured findings.

You have access to the web_search tool. Use it to gather up-to-date information.

You MUST return ONLY a valid JSON object. No markdown, no text outside the JSON.

## RESPONSE FORMAT
{
  "thought": "Your reasoning: what information is needed? What search queries will help?",
  "tool_calls": [
    { "tool": "web_search", "query": "your search query here" }
  ],
  "save_outputs": [
    { "fileName": "research-topic-name.md", "content": "Structured findings document with key insights, links, and recommendations", "type": "research" }
  ],
  "complete_tasks": ["Exact title of the research task you just completed"],
  "answer": "A concise summary of your key findings. 2-4 sentences."
}

## RULES
1. Formulate specific, targeted search queries — not overly broad ones.
2. If you need to search, ALWAYS use the tool_calls array with web_search.
3. After receiving search results, synthesize the findings into a clear, structured document.
4. Save your research as a markdown file in save_outputs so it persists in the workspace.
5. Include specific URLs, code examples, and actionable recommendations in your research output.
6. Mark the task as complete ONLY after you have synthesized findings into a save_output.
`;

const REFLECTOR_PROMPT = `You are the REFLECTOR — a quality-review agent in a multi-agent orchestrator system.
Your job is to review all completed work and ensure quality, completeness, and correctness.

You MUST return ONLY a valid JSON object. No markdown, no text outside the JSON.

## RESPONSE FORMAT
{
  "thought": "Your analysis: Is the work complete? Are there bugs? Missing features? Quality issues?",
  "save_outputs": [
    { "fileName": "path/to/file.ext", "content": "Fixed/improved full file content", "type": "fix" }
  ],
  "answer": "A brief quality assessment. What looks good, what needs improvement, what was fixed."
}

## RULES
1. Review all outputs for correctness, completeness, and best practices.
2. Check for: missing imports, broken references, TODO comments left behind, incomplete features.
3. If you find issues, include the FIXED file in save_outputs with type "fix".
4. If everything looks good, return an empty save_outputs array.
5. Be specific about what you found — don't just say "looks good" without actually reviewing.
6. For React projects, ensure createRoot is used (not ReactDOM.render) and hooks follow rules of hooks.
7. Consider UX: are there loading states, error boundaries, responsive design?
`;

/**
 * Run a sub-agent by calling smartRouter with the appropriate system prompt.
 * Returns { text: string, parsed: object|null }
 */
async function runSubAgent(agentType, messages, keys, options = {}) {
  const systemPrompts = {
    architect: ARCHITECT_PROMPT,
    coder: CODER_PROMPT,
    researcher: RESEARCHER_PROMPT,
    reflector: REFLECTOR_PROMPT,
  };

  const systemPrompt = systemPrompts[agentType];
  if (!systemPrompt) throw new Error(`Unknown agent type: ${agentType}`);

  const routerOptions = {
    ...options,
    systemPrompt,
    stream: false,
    temperature: agentType === "architect" || agentType === "reflector" ? 0.4 : 0.6,
  };

  const { stream: respData } = await smartRouter(messages, keys, routerOptions);
  let responseText = "";

  // Consume response — handle both fetch Response objects and generators
  if (respData.text) {
    const bodyJSON = await respData.json();
    responseText = bodyJSON.choices?.[0]?.message?.content || "";
  } else if (respData.next) {
    for await (const chunk of respData) responseText += chunk;
  }

  const parsed = parseAgentResponse(responseText);

  return { text: responseText, parsed };
}


// ═══════════════════════════════════════════════
// POST /api/agent/run — Orchestrator Endpoint (SSE)
// ═══════════════════════════════════════════════
app.post("/api/agent/run", async (req, res) => {
  const { userId, goal, messages: incomingMessages, model, parameters, workspaceState, clientKeys } = req.body;

  // ── Key Resolution ──
  let keys = clientKeys;
  if (!keys || (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface)) {
    keys = await getUserKeys(userId);
  }

  if (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface) {
    return res.status(401).json({ error: "No API keys found! Please add at least one key in Settings." });
  }

  // ── SSE Headers ──
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // ── SSE Helper ──
  function sendEvent(data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {
      // Client disconnected, ignore
    }
  }

  // ── Web Search Helper (Tavily) ──
  async function executeWebSearch(query) {
    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_KEY) return "Web search unavailable: TAVILY_API_KEY not configured.";

    try {
      const searchRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query,
          search_depth: "basic",
          max_results: 5,
          include_answer: true,
        }),
      });
      const data = await searchRes.json();
      const summary = data.answer || "No summary available.";
      const snippets = (data.results || [])
        .map(r => `- ${r.title} (${r.url}): ${r.content?.slice(0, 300)}`)
        .join("\n");
      return `Summary: ${summary}\n\nResults:\n${snippets}`;
    } catch (err) {
      return `Web search failed: ${err.message}`;
    }
  }

  // ── Stream text as agent_stream chunks ──
  function streamAgentText(text) {
    const chunkSize = 60;
    for (let i = 0; i < text.length; i += chunkSize) {
      sendEvent({ type: "agent_stream", content: text.slice(i, i + chunkSize) });
    }
  }

  try {
    // Determine the goal
    const userGoal = goal || (incomingMessages && incomingMessages[incomingMessages.length - 1]?.content) || "Build something useful";
    const workspaceCtx = buildWorkspaceContext(workspaceState);

    // ── INIT EVENT ──
    sendEvent({ type: "init", goal: userGoal });

    // Track completed outputs across all phases for reflection
    const allCompletedOutputs = [];
    const allCompletedTaskTitles = [];

    // ═══════════════════════════════════════════
    // PHASE 1: ARCHITECT — Plan the goal
    // ═══════════════════════════════════════════
    sendEvent({ type: "agent_start", agent: "architect", message: "Planning tasks for your goal..." });

    const architectMessages = [
      {
        role: "user",
        content: `${workspaceCtx}\n\n==== USER GOAL ====\n${userGoal}\n\nBreak this goal into atomic, executable tasks. Consider what already exists in the workspace.`
      },
    ];

    const architectResult = await runSubAgent("architect", architectMessages, keys, { model, ...(parameters || {}) });

    // Stream the architect's full response text
    streamAgentText(architectResult.text);

    // Parse and emit action
    let architectPayload = architectResult.parsed;
    if (!architectPayload) {
      architectPayload = {
        thought: "Failed to parse architect response.",
        add_tasks: [{ title: userGoal, status: "pending", priority: "high", phase: "Executing" }],
        phase: "Planning",
        answer: architectResult.text,
      };
    }

    // Emit the action event for the frontend
    const architectAction = {};
    if (architectPayload.add_tasks && architectPayload.add_tasks.length > 0) {
      architectAction.add_tasks = architectPayload.add_tasks;
    }
    if (architectPayload.phase) {
      architectAction.phase = architectPayload.phase;
    }
    sendEvent({ type: "action", payload: architectAction });

    sendEvent({
      type: "agent_done",
      agent: "architect",
      summary: architectPayload.answer || "Planning complete.",
    });

    // ═══════════════════════════════════════════
    // PHASE 2: EXECUTE — Work through tasks
    // ═══════════════════════════════════════════
    // Build the pending task list from architect output + any existing workspace pending tasks
    let pendingTasks = [];

    // Merge architect tasks
    if (architectPayload.add_tasks && Array.isArray(architectPayload.add_tasks)) {
      pendingTasks = architectPayload.add_tasks
        .filter(t => t.status !== "completed" && t.status !== "done")
        .map(t => ({ title: t.title, priority: t.priority || "medium", phase: t.phase || "Executing" }));
    }

    // Also pull pending tasks from workspace state if available
    if (workspaceState && workspaceState.pendingTaskTitles && Array.isArray(workspaceState.pendingTaskTitles)) {
      for (const title of workspaceState.pendingTaskTitles) {
        if (!pendingTasks.some(t => t.title === title)) {
          pendingTasks.push({ title, priority: "medium", phase: "Executing" });
        }
      }
    }

    const MAX_TASKS = 5;
    const tasksToRun = pendingTasks.slice(0, MAX_TASKS);
    const totalTasks = tasksToRun.length;

    sendEvent({ type: "iteration", number: 0, total: totalTasks, task: "Starting execution..." });

    for (let i = 0; i < tasksToRun.length; i++) {
      const task = tasksToRun[i];
      const taskNum = i + 1;
      const agentType = detectTaskAgentType(task.title);

      sendEvent({ type: "iteration", number: taskNum, total: totalTasks, task: task.title });
      sendEvent({ type: "agent_start", agent: agentType, message: `Working on: ${task.title}` });

      // Build the task prompt
      const taskPrompt = `${workspaceCtx}\n\n==== YOUR TASK ====\n${task.title}\n\nExecute this task completely. Return ONLY valid JSON with your results.`;

      const taskMessages = [{ role: "user", content: taskPrompt }];

      let taskResult = await runSubAgent(agentType, taskMessages, keys, { model, ...(parameters || {}) });

      // ── Handle researcher tool_calls ──
      if (agentType === "researcher" && taskResult.parsed && taskResult.parsed.tool_calls && taskResult.parsed.tool_calls.length > 0) {
        for (const tc of taskResult.parsed.tool_calls) {
          if (tc.tool === "web_search" && tc.query) {
            sendEvent({ type: "tool_call", tool: "web_search", query: tc.query });
            const searchResult = await executeWebSearch(tc.query);
            sendEvent({ type: "tool_result", result: searchResult });

            // Re-call the researcher with results appended
            taskMessages.push({ role: "assistant", content: taskResult.text });
            taskMessages.push({
              role: "user",
              content: `Here are the search results:\n\n${searchResult}\n\nNow synthesize these findings and return your final JSON response with save_outputs and complete_tasks.`,
            });

            taskResult = await runSubAgent("researcher", taskMessages, keys, { model, ...(parameters || {}) });
          }
        }
      }

      // Stream the task response
      streamAgentText(taskResult.text);

      // Parse and emit action
      let taskPayload = taskResult.parsed;
      if (!taskPayload) {
        taskPayload = {
          thought: "Task executed but response could not be parsed as JSON.",
          save_outputs: [],
          complete_tasks: [task.title],
          answer: taskResult.text,
        };
      }

      // Emit action for the frontend
      const taskAction = {};
      if (taskPayload.save_outputs && taskPayload.save_outputs.length > 0) {
        taskAction.save_outputs = taskPayload.save_outputs;
        allCompletedOutputs.push(...taskPayload.save_outputs);
      }
      if (taskPayload.complete_tasks && taskPayload.complete_tasks.length > 0) {
        taskAction.complete_tasks = taskPayload.complete_tasks;
        allCompletedTaskTitles.push(...taskPayload.complete_tasks);
      }
      if (taskPayload.add_tasks && taskPayload.add_tasks.length > 0) {
        taskAction.add_tasks = taskPayload.add_tasks;
        // Add newly discovered tasks to the queue (if within budget)
        for (const newTask of taskPayload.add_tasks) {
          if (newTask.status !== "completed" && newTask.status !== "done" && tasksToRun.length < MAX_TASKS + 3) {
            tasksToRun.push({ title: newTask.title, priority: newTask.priority || "medium", phase: newTask.phase || "Executing" });
          }
        }
      }
      if (taskPayload.phase) {
        taskAction.phase = taskPayload.phase;
      }

      if (Object.keys(taskAction).length > 0) {
        sendEvent({ type: "action", payload: taskAction });
      }

      sendEvent({
        type: "agent_done",
        agent: agentType,
        summary: taskPayload.answer || `Completed: ${task.title}`,
      });
    }

    // ═══════════════════════════════════════════
    // PHASE 3: REFLECT — Review the work
    // ═══════════════════════════════════════════
    sendEvent({ type: "agent_start", agent: "reflector", message: "Reviewing all work for quality..." });

    // Build a summary of everything that was done
    const reflectContext = `${workspaceCtx}\n\n==== COMPLETED WORK SUMMARY ====\n\nTasks Completed:\n${allCompletedTaskTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nFiles Created/Updated:\n${allCompletedOutputs.map(o => `- ${o.fileName} (${o.type || "file"})`).join("\n")}\n\nPlease review this work for quality, correctness, and completeness. If you find issues, include fixed files in save_outputs.`;

    const reflectorMessages = [{ role: "user", content: reflectContext }];

    const reflectorResult = await runSubAgent("reflector", reflectorMessages, keys, { model, ...(parameters || {}) });

    // Stream the reflector's response
    streamAgentText(reflectorResult.text);

    // Parse and emit action if fixes are needed
    const reflectorPayload = reflectorResult.parsed;
    if (reflectorPayload) {
      const reflectAction = {};
      if (reflectorPayload.save_outputs && reflectorPayload.save_outputs.length > 0) {
        reflectAction.save_outputs = reflectorPayload.save_outputs;
        allCompletedOutputs.push(...reflectorPayload.save_outputs);
      }
      if (Object.keys(reflectAction).length > 0) {
        sendEvent({ type: "action", payload: reflectAction });
      }

      sendEvent({
        type: "agent_done",
        agent: "reflector",
        summary: reflectorPayload.answer || "Review complete.",
      });
    } else {
      sendEvent({
        type: "agent_done",
        agent: "reflector",
        summary: "Review complete (response could not be parsed).",
      });
    }

    // ── DONE EVENT ──
    const totalFiles = allCompletedOutputs.length;
    const totalTasksDone = allCompletedTaskTitles.length;
    sendEvent({
      type: "done",
      summary: `Orchestration complete. ${totalTasksDone} task(s) executed, ${totalFiles} file(s) created/updated.`,
    });

    res.end();
  } catch (error) {
    console.error("[Orchestrator] Fatal error:", error);
    sendEvent({ type: "error", error: error.message });
    res.end();
  }
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
