import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { connectDB } from "./db.js";
import fs from "node:fs";
import path from "node:path";
import { validateGroqKey } from "./groqClient.js";
import { validateGeminiKey } from "./geminiClient.js";
import { validateHuggingFaceKey } from "./huggingfaceClient.js";
import { smartRouter, detectTaskType, FREE_MODELS, askAI } from "./smartRouter.js";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true);
  },
  credentials: true,
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

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
// Crypto helpers — AES-256-GCM
// ─────────────────────────────────────────────
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY = crypto.scryptSync(
  process.env.ENCRYPTION_SECRET || "ChatForge-Default-Secret-Change-In-Production-!!",
  "salt",
  32
);

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${enc}`;
}

export function decrypt(encoded) {
  try {
    const [ivHex, authTagHex, enc] = encoded.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(authTag);
    let dec = decipher.update(enc, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch {
    return encoded;
  }
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

// ─── Router moved to ./smartRouter.js ───



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
// POST /api/chat — main chat endpoint  (normal chat)
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { userId, messages, skillPrompt, model, parameters, clientKeys } = req.body;
  console.log(req.body)
  let keys = clientKeys;
  if (!keys || (!keys.openrouter && !keys.groq && !keys.gemini && !keys.huggingface)) {
    keys = await getUserKeys(userId);
  }
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
    { "title": "Task name (specific, actionable, atomic)", "status": "pending", "priority": "high|medium|low" }
  ],
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

    // Track completed outputs for reflection
    const allCompletedOutputs = [];
    const allCompletedTaskTitles = [];

    // ═══════════════════════════════════════════
    // STEP 1: ARCHITECT — Plan the goal
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
        add_tasks: [{ title: userGoal, status: "pending", priority: "high" }],
        answer: architectResult.text,
      };
    }

    // Emit the action event for the frontend
    const architectAction = {};
    if (architectPayload.add_tasks && architectPayload.add_tasks.length > 0) {
      architectAction.add_tasks = architectPayload.add_tasks;
    }
    sendEvent({ type: "action", payload: architectAction });

    sendEvent({
      type: "agent_done",
      agent: "architect",
      summary: architectPayload.answer || "Planning complete.",
    });

    // ═══════════════════════════════════════════
    // STEP 2: EXECUTE — Work through tasks
    // ═══════════════════════════════════════════
    // Build the pending task list from architect output + any existing workspace pending tasks
    let pendingTasks = [];

    // Merge architect tasks
    if (architectPayload.add_tasks && Array.isArray(architectPayload.add_tasks)) {
      pendingTasks = architectPayload.add_tasks
        .filter(t => t.status !== "completed" && t.status !== "done")
        .map(t => ({ title: t.title, priority: t.priority || "medium" }));
    }

    // Also pull pending tasks from workspace state if available
    if (workspaceState && workspaceState.pendingTaskTitles && Array.isArray(workspaceState.pendingTaskTitles)) {
      for (const title of workspaceState.pendingTaskTitles) {
        if (!pendingTasks.some(t => t.title === title)) {
          pendingTasks.push({ title, priority: "medium" });
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
            tasksToRun.push({ title: newTask.title, priority: newTask.priority || "medium" });
          }
        }
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
    // STEP 3: REFLECT — Review the work
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

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  const status = err.status || err.statusCode || 500;
  if (res.headersSent) return;
  res.status(status).json({ error: err.message || "Internal server error" });
});

export default app;
startServer();
