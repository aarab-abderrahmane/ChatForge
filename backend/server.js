import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { validateGroqKey } from "./groqClient.js";
import { validateGeminiKey } from "./geminiClient.js";
import { validateHuggingFaceKey } from "./huggingfaceClient.js";
import { validateTogetherKey } from "./togetherClient.js";
import { validateMistralKey } from "./mistralClient.js";
import { smartRouter, FREE_MODELS, askAI } from "./smartRouter.js";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  throw new Error("ALLOWED_ORIGINS environment variable must be set in production");
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "500kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
const keysLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
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
  const { userId, messages, skillPrompt, model, parameters, clientKeys } = req.body;

  if (!clientKeys || (!clientKeys.openrouter && !clientKeys.groq && !clientKeys.gemini && !clientKeys.huggingface)) {
    return res.status(401).json({ response: "No API keys found! Please add at least one key in Settings.", type: "error" });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (userId && !UUID_RE.test(userId)) {
    return res.status(400).json({ response: "Invalid userId format.", type: "error" });
  }

  const KEY_PATTERNS = {
    openrouter: /^sk-or-v1-/,
    groq: /^gsk_/,
    gemini: /^AIzaSy/,
    huggingface: /^hf_/,
  };
  for (const [provider, key] of Object.entries(clientKeys)) {
    if (key && KEY_PATTERNS[provider] && !KEY_PATTERNS[provider].test(key)) {
      return res.status(401).json({ response: `Invalid ${provider} API key format.`, type: "error" });
    }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ response: "Messages must be a non-empty array.", type: "error" });
  }

  const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  if (totalChars > 100000) {
    return res.status(400).json({ response: "Message payload too large (max 100,000 characters).", type: "error" });
  }

  if (skillPrompt && skillPrompt.length > 5000) {
    return res.status(400).json({ response: "Skill prompt too long (max 5,000 characters).", type: "error" });
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
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
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

  res.json({ type: "success", results });
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
  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;
  res.status(status).json({ error: message });
});

export default app;
startServer();
