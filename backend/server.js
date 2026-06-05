import cors from "cors";
import helmet from "helmet";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { validateGroqKey } from "./groqClient.js";
import { validateGeminiKey } from "./geminiClient.js";
import { validateHuggingFaceKey } from "./huggingfaceClient.js";
import { validateTogetherKey } from "./togetherClient.js";
import { validateMistralKey } from "./mistralClient.js";
import { smartRouter, FREE_MODELS, askAI } from "./smartRouter.js";
import crypto from "crypto";

// ── In-memory session key store ──────────────────────────────
const keyStore = new Map();
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of keyStore) {
    if (now - entry.createdAt > TOKEN_TTL_MS) keyStore.delete(token);
  }
}, KEY_CLEANUP_INTERVAL_MS);

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  throw new Error("ALLOWED_ORIGINS environment variable must be set in production");
} else if (!process.env.ALLOWED_ORIGINS) {
  console.warn("WARNING: ALLOWED_ORIGINS not set. Using default localhost origins. Set ALLOWED_ORIGINS for production.");
}

app.set("trust proxy", 1);
app.use(helmet());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: ipKeyGenerator,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
const keysLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: ipKeyGenerator,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/chat", chatLimiter);
app.use("/api/keys", keysLimiter);





// ─────────────────────────────────────────────
// POST /api/chat — main chat endpoint  (normal chat)
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { userId, messages, skillPrompt, model, parameters, token } = req.body;

  if (!token) {
    return res.status(401).json({ response: "No session token. Please enter your API keys in Settings.", type: "error" });
  }

  const entry = keyStore.get(token);
  if (!entry || Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    keyStore.delete(token);
    return res.status(401).json({ response: "Session expired or invalid. Please re-enter your keys in Settings.", type: "error" });
  }

  const clientKeys = entry.keys;
  entry.createdAt = Date.now();

  if (!clientKeys || (!clientKeys.openrouter && !clientKeys.groq && !clientKeys.gemini && !clientKeys.huggingface)) {
    keyStore.delete(token);
    return res.status(401).json({ response: "No API keys found! Please add at least one key in Settings.", type: "error" });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (userId && !UUID_RE.test(userId)) {
    return res.status(400).json({ response: "Invalid userId format.", type: "error" });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ response: "Messages must be a non-empty array.", type: "error" });
  }

  const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  if (totalChars > 200000) {
    return res.status(400).json({ response: "Message payload too large (max 200,000 characters).", type: "error" });
  }

  if (skillPrompt && skillPrompt.length > 50000) {
    return res.status(400).json({ response: "Skill prompt too long (max 50,000 characters).", type: "error" });
  }

  const normalizeNFKC = (s) => typeof s === "string" ? s.normalize("NFKC") : "";
  const INJECTION_PATTERNS = /ignore all previous|forget all|you are free|override.*system|jailbreak|system prompt/i;

  if (skillPrompt && INJECTION_PATTERNS.test(normalizeNFKC(skillPrompt))) {
    return res.status(400).json({ response: "Skill prompt contains prohibited patterns.", type: "error" });
  }

  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  if (lastUserMsg?.content && INJECTION_PATTERNS.test(normalizeNFKC(lastUserMsg.content))) {
    return res.status(400).json({ response: "Message contains prohibited patterns.", type: "error" });
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

    const { stream, provider, isGenerator } = await smartRouter(messages, clientKeys, options);

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
    const safeMsg = error.message?.length > 200
      ? error.message.slice(0, 200) + "..."
      : (error.message || "An error occurred");
    res.write(`data: ${JSON.stringify({ error: safeMsg })}\n\n`);
    res.end();
  }
});







// ─────────────────────────────────────────────
// POST /api/keys — save all provider keys
// ─────────────────────────────────────────────
app.post("/api/keys", async (req, res) => {
  const { userId, openrouter, groq, gemini, huggingface, together, mistral } = req.body;
  if (!userId) return res.status(400).json({ type: "error", response: "userId is required." });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ type: "error", response: "Invalid userId format." });
  }

  const results = {};

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
        if (aiRes.ok) {
          const data = await aiRes.json();
          if (data?.choices?.[0]?.message?.content) {
            results.openrouter = { ok: true };
          } else {
            results.openrouter = { ok: false, error: data?.error?.message || "No response from model" };
          }
        } else {
          const errData = await aiRes.json().catch(() => ({}));
          results.openrouter = { ok: false, error: errData?.error?.message || `HTTP ${aiRes.status}` };
        }
      } catch (e) {
        const errMsg = e.message || "";
        const isAuthError = errMsg.toLowerCase().includes("authentication") ||
          errMsg.toLowerCase().includes("invalid api key") ||
          errMsg.toLowerCase().includes("401") ||
          errMsg.toLowerCase().includes("403");
        if (!isAuthError && cleanKey.startsWith("sk-or-v1-")) {
          results.openrouter = { ok: true, warning: "Models are busy, but key format looks valid. Save and try chatting." };
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
        results.huggingface = { ok: true };
      } else {
        results.huggingface = { ok: false, error: "Invalid Hugging Face API key" };
      }
    }
  }

  // Validate & save together
  if (together !== undefined) {
    const key = together.trim();
    if (key) {
      const cleanKey = String(key).replace(/[^\x00-\x7F]/g, "").trim();
      const valid = await validateTogetherKey(cleanKey);
      if (valid) {
        results.together = { ok: true };
      } else {
        results.together = { ok: false, error: "Invalid Together AI API key" };
      }
    }
  }

  // Validate & save mistral
  if (mistral !== undefined) {
    const key = mistral.trim();
    if (key) {
      const cleanKey = String(key).replace(/[^\x00-\x7F]/g, "").trim();
      const valid = await validateMistralKey(cleanKey);
      if (valid) {
        results.mistral = { ok: true };
      } else {
        results.mistral = { ok: false, error: "Invalid Mistral AI API key" };
      }
    }
  }

  const anyOk = Object.values(results).some(r => r.ok);
  let token = null;
  if (anyOk) {
    const validatedKeys = {};
    for (const provider of ["openrouter", "groq", "gemini", "huggingface", "together", "mistral"]) {
      const rawKey = req.body[provider];
      if (rawKey && results[provider]?.ok) {
        validatedKeys[provider] = String(rawKey).replace(/[^\x00-\x7F]/g, "").trim();
      }
    }
    if (Object.keys(validatedKeys).length > 0) {
      token = crypto.randomBytes(32).toString("hex");
      keyStore.set(token, { userId, keys: validatedKeys, createdAt: Date.now() });
    }
  }
  res.json({ type: anyOk ? "success" : "error", results, token });
});



app.get("/", (_, res) => process.env.NODE_ENV === "production"
  ? res.status(404).json({ error: "Not found" })
  : res.json({ message: "ChatForge API" })
);

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
async function startServer() {
  try {
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log("-----------------------------------------");
      console.log(`🚀 Server running on port ${port}`);
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
  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;
  res.status(status).json({ error: message });
});

export default app;
startServer();
