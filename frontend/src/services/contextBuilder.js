import { ConversationsService } from './db';
import { api } from './api';

/**
 * Limits to prevent Payload Too Large (413) errors
 */
const MAX_MESSAGE_CONTENT = 1000;
const MAX_SUMMARY_CONTENT = 1000;
const MAX_HISTORY_FOR_SUMMARY = 10;
const MAX_TOTAL_PAYLOAD_SIZE = 150000; // ~150KB threshold for warning

// Max characters of file text content to inject per file
const MAX_FILE_CONTENT_CHARS = 8000;
// Max characters of total injected file content across all files
const MAX_TOTAL_FILE_CHARS = 20000;

const truncate = (text, max = MAX_MESSAGE_CONTENT, isCode = false) => {
    if (!text) return "";
    const effectiveMax = isCode ? max * 5 : max;
    return text.length > effectiveMax ? text.slice(0, effectiveMax) + "..." : text;
};

/**
 * Detects if the message is a request to continue
 */
const isContinuation = (text) => {
    const lower = text.toLowerCase().trim();
    const keywords = [
        "continue", "keep going", "finish", "more", "next", "استمر", "كمل", "تابع", "كود", "تكملة"
    ];
    return keywords.some(kw => lower.includes(kw)) && lower.length < 30;
};

/**
 * Detects if a string contains significant code blocks or patterns
 */
const hasCodeHighDensity = (text) => {
    if (!text) return false;
    const codePatterns = [
        "```", "function ", "const ", "let ", "var ", "import ", "export ", "class ",
        "<html>", "<body>", "<div>", "return ", "await ", "async ", "=>"
    ];
    const count = codePatterns.reduce((acc, p) => acc + (text.includes(p) ? 1 : 0), 0);
    return count >= 3 || text.includes("```");
};

const FACT_PATTERNS = [
    { key: "name", label: "Name", patterns: [
        /my name is (\w+)/i, /call me (\w+)/i,
        /you can call me (\w+)/i, /i(?:'m| am) called (\w+)/i,
    ]},
    { key: "location", label: "Location", patterns: [
        /i live in (\w+(?:\s+\w+)?)/i, /i(?:'m| am) from (\w+(?:\s+\w+)?)/i,
    ]},
];

const extractFacts = (text, existingFacts = {}) => {
    if (!text) return existingFacts;
    const newFacts = { ...existingFacts };
    for (const { key, patterns } of FACT_PATTERNS) {
        if (newFacts[key]) continue;
        for (const regex of patterns) {
            const match = text.match(regex);
            if (match) {
                const val = match[1].charAt(0).toUpperCase() + match[1].slice(1);
                if (val.length > 2 && val.length < 50) {
                    newFacts[key] = val;
                }
                break;
            }
        }
    }
    return newFacts;
};

const buildFactsBlock = (userFacts) => {
    const entries = Object.entries(userFacts).filter(([, v]) => v);
    if (!entries.length) return "";
    const factsStr = entries.map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join(" | ");
    return `=== USER FACTS (Always trust these over code examples) ===\n${factsStr}\n\n` +
        "CRITICAL: If user facts above conflict with example data in code or JSON snippets in recent messages, ALWAYS trust user facts.\n\n";
};

// ─── File Content Injection ────────────────────────────────────────────────────

/**
 * Detects if the user's question is explicitly asking to read/analyze the attached files.
 * Used to decide how to phrase the injection block.
 */
const isFileRequest = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    const keywords = [
        "read this", "read the file", "analyze this", "analyse this",
        "check this", "review this", "explain this", "what does this",
        "what is in", "summarize this", "summarise this", "look at this",
        "can you read", "what's in", "parse this", "help with this file",
        "اقرأ", "حلل", "افهم", "راجع", "شرح",
    ];
    return keywords.some(kw => lower.includes(kw));
};

/**
 * Detects if the AI should automatically generate a downloadable file
 * based on the user's message — even if they didn't explicitly say "create a file".
 *
 * This hook is used to append an instruction in the system prompt so the AI
 * wraps its output in  ```file:filename.ext  blocks automatically.
 */
const detectAutoFileOutput = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase();

    // Each entry: { patterns, filename, reason }
    // The first match wins. Filename can be a string or a function(text) => string.
    const rules = [
        // --- Code generation ---
        {
            patterns: ["create a react", "build a react", "write a react", "make a react"],
            filename: (t) => {
                const m = t.match(/(?:component|page|screen|hook)\s+(?:called|named|for)?\s*[`"']?(\w+)/i);
                return m ? `${m[1]}.jsx` : "Component.jsx";
            },
        },
        {
            patterns: ["create a", "build a", "write a", "generate a"],
            subPatterns: [".jsx", ".tsx", "react component", "react hook", "custom hook"],
            filename: "Component.jsx",
        },
        {
            patterns: ["write a python", "create a python", "python script", "make a python"],
            filename: (t) => {
                const m = t.match(/(?:script|program|file|module)\s+(?:called|named|for|that|to)?\s*[`"']?(\w+)/i);
                return m ? `${m[1]}.py` : "script.py";
            },
        },
        {
            patterns: ["create a landing", "build a landing", "make a landing", "landing page"],
            filename: "landing.html",
        },
        {
            patterns: ["html page", "html file", "create html", "write html", "build html"],
            filename: "index.html",
        },
        {
            patterns: ["css file", "stylesheet", "create css", "write css"],
            filename: "styles.css",
        },
        {
            patterns: ["sql script", "sql query", "sql schema", "create table", "database schema"],
            filename: "schema.sql",
        },
        {
            patterns: ["json data", "generate json", "create json", "write json", "json file"],
            filename: "data.json",
        },
        {
            patterns: ["bash script", "shell script", "write a script", "create a script"],
            filename: "script.sh",
        },
        {
            patterns: ["dockerfile", "docker-compose", "docker compose"],
            filename: (t) => lower.includes("compose") ? "docker-compose.yml" : "Dockerfile",
        },
        {
            patterns: ["readme", "read me", "documentation file", "write docs"],
            filename: "README.md",
        },
        {
            patterns: ["write a report", "generate a report", "create a report"],
            filename: "report.md",
        },
        {
            patterns: ["write a cv", "write a resume", "create a cv", "create a resume"],
            filename: "resume.md",
        },
        {
            patterns: ["csv file", "create csv", "export csv", "generate csv"],
            filename: "data.csv",
        },
        {
            patterns: [".env", "environment file", "env file", "config file"],
            filename: ".env.example",
        },
    ];

    for (const rule of rules) {
        const mainMatch = rule.patterns.some(p => lower.includes(p));
        if (!mainMatch) continue;

        // If rule has subPatterns, at least one must also match
        if (rule.subPatterns && !rule.subPatterns.some(p => lower.includes(p))) continue;

        const filename = typeof rule.filename === "function" ? rule.filename(text) : rule.filename;
        return filename;
    }

    return null; // No auto-file generation needed
};

/**
 * Builds the file injection block for the system prompt from attached files.
 * Text files are injected inline; images are handled separately via message content.
 *
 * @param {Array} attachedFiles - [{ name, type, content, isImage, sizeKB }]
 * @returns {{ textBlock: string, imageFiles: Array }}
 */
const buildFileBlock = (attachedFiles = []) => {
    if (!attachedFiles.length) return { textBlock: "", imageFiles: [] };

    const textFiles = attachedFiles.filter(f => !f.isImage);
    const imageFiles = attachedFiles.filter(f => f.isImage);

    if (!textFiles.length && !imageFiles.length) return { textBlock: "", imageFiles: [] };

    let totalChars = 0;
    let textBlock = "";

    if (textFiles.length > 0) {
        textBlock += "=== ATTACHED FILES ===\n";
        textBlock += "The user has attached the following file(s) for you to read and work with:\n\n";

        for (const file of textFiles) {
            if (totalChars >= MAX_TOTAL_FILE_CHARS) {
                textBlock += `[File "${file.name}" omitted — total file content limit reached]\n\n`;
                continue;
            }
            const remaining = MAX_TOTAL_FILE_CHARS - totalChars;
            const content = truncate(file.content, Math.min(MAX_FILE_CONTENT_CHARS, remaining));
            totalChars += content.length;

            textBlock += `--- File: ${file.name} (${file.sizeKB}KB, ${file.type || "text"}) ---\n`;
            textBlock += content;
            textBlock += "\n--- End of file ---\n\n";
        }

        textBlock += "INSTRUCTIONS FOR FILES:\n" +
            "- Treat the above file content as the source of truth for any questions about it.\n" +
            "- If the user asks to edit, improve, or analyze the file, base your response on its actual content.\n" +
            "- If you generate a modified version, output it as a downloadable file block: ```file:filename.ext\n```\n\n";
    }

    if (imageFiles.length > 0) {
        textBlock += `=== ATTACHED IMAGES ===\n${imageFiles.length} image(s) attached. Analyze them as requested.\n\n`;
    }

    return { textBlock, imageFiles };
};

/**
 * Context Builder Logic:
 * 1. Takes current chats and active project (if any).
 * 2. Applies 10-message rule.
 * 3. Injects attached file content into the system prompt.
 * 4. Detects if the AI should auto-generate a downloadable file.
 * 5. Optimized for Payload Size.
 */
export const ContextBuilder = {

    /**
     * Builds the context for the AI call.
     * @param {Array} chats - Current chat history.
     * @param {String} currentSummary - Existing summary from IndexedDB.
     * @param {String} currentQuestion - The fresh question being sent.
     * @param {Object} userFacts - Known user facts.
     * @param {Array} attachedFiles - Files attached to this message: [{ name, type, content, isImage, sizeKB }]
     * @returns {Object} { messages, systemPrompt, summaryUpdateNeeded, updatedFacts }
     */
    build: async (chats, currentSummary = "", currentQuestion = "", userFacts = {}, attachedFiles = []) => {
        // 1. FILTER: Exclude welcome/FAQ messages
        const chatHistory = chats.filter(c =>
            c.type === "ch" &&
            (c.question || c.answer) &&
            typeof c.id === "string" && !c.id.startsWith("welcome-")
        );

        let messages = [];
        let summary = truncate(currentSummary, MAX_SUMMARY_CONTENT);

        // Check if we are in "Code Mode" based on recent history
        const lastFewMessages = chatHistory.slice(-4);
        const codeMode = lastFewMessages.some(c => hasCodeHighDensity(c.question) || hasCodeHighDensity(c.answer));

        const historyForMessages = chatHistory.filter(c => !c.isEphemeral && !!c.answer);

        // 10-message rule logic
        if (historyForMessages.length <= 10) {
            messages = historyForMessages.flatMap(c => [
                { role: "user", content: truncate(c.question, MAX_MESSAGE_CONTENT, codeMode) },
                ...(c.answer ? [{ role: "assistant", content: truncate(c.answer, MAX_MESSAGE_CONTENT, codeMode) }] : [])
            ]);
        } else {
            messages = historyForMessages.slice(-6).flatMap(c => [
                { role: "user", content: truncate(c.question, MAX_MESSAGE_CONTENT, codeMode) },
                ...(c.answer ? [{ role: "assistant", content: truncate(c.answer, MAX_MESSAGE_CONTENT, codeMode) }] : [])
            ]);
        }

        // 2. Build the current user message content.
        // For images: inject them as image content parts (multimodal).
        // For text files: injected via system prompt (see below).
        const { textBlock: fileTextBlock, imageFiles } = buildFileBlock(attachedFiles);

        if (currentQuestion) {
            if (imageFiles.length > 0) {
                // Build a multimodal message content array
                const contentParts = [
                    { type: "text", text: truncate(currentQuestion, MAX_MESSAGE_CONTENT, codeMode) },
                    ...imageFiles.map(img => ({
                        type: "image_url",
                        image_url: { url: img.content }, // base64 data URL
                    })),
                ];
                messages.push({ role: "user", content: contentParts });
            } else {
                messages.push({ role: "user", content: truncate(currentQuestion, MAX_MESSAGE_CONTENT, codeMode) });
            }
        }

        // 3. Extract user facts
        let mergedFacts = extractFacts(currentQuestion, { ...userFacts });
        if (!userFacts || !Object.keys(userFacts).length) {
            for (const c of chatHistory) {
                mergedFacts = extractFacts(c.question, mergedFacts);
                mergedFacts = extractFacts(c.answer, mergedFacts);
            }
        }

        // 4. Auto-file detection: should the AI wrap its output in a file block?
        const autoFileName = detectAutoFileOutput(currentQuestion);

        // 5. Build System Prompt
        let systemPrompt = buildFactsBlock(mergedFacts);

        // Inject file content block (text files only — images handled in messages)
        if (fileTextBlock) {
            systemPrompt += fileTextBlock;
        }

        if (summary) {
            systemPrompt += `Below is a brief summary of the conversation so far for context. HOWEVER, prioritize the LATEST user request above all else.\nSummary: [${summary}]\n\n`;
        }

        // Control layer rules
        systemPrompt += "CONTROL LAYER RULES:\n" +
            "- If the user asks to 'continue', provide ONLY the continuation. Do NOT repeat or restart.\n" +
            "- If the task is related to code, ensure tags are closed and logic is complete.\n" +
            "- Prioritize the LATEST request. If it's a new topic, ignore unrelated history.\n" +
            "- Never hallucinate or restart a generation from zero unless explicitly asked.\n\n";

        // File artifact rules
        systemPrompt += "FILE ARTIFACTS:\n" +
            "- To create a downloadable file, use the markdown code block with language `file:filename.ext`.\n" +
            "- Example: ```file:script.py\nprint('hello')\n``` renders as a file card with download/copy.\n" +
            "- Supported extensions: .md, .txt, .js, .ts, .jsx, .tsx, .py, .html, .css, .json, .csv, .sql, .sh, .yaml, .env, etc.\n" +
            "- Use this for scripts, data exports, reports, and any content the user may want to download.\n\n";

        // Auto-file instruction: prompt the AI to output a file block automatically
        if (autoFileName) {
            systemPrompt += `AUTO-FILE INSTRUCTION:\n` +
                `The user's request is asking you to generate content that should be saved as a file.\n` +
                `IMPORTANT: You MUST wrap your primary output in a file block like this:\n` +
                `\`\`\`file:${autoFileName}\n[your full content here]\n\`\`\`\n` +
                `Use this INSTEAD of a plain code block for the main deliverable.\n` +
                `You may still add explanation text before or after the file block.\n\n`;
        }

        // Diagnostic: Check payload size
        const payloadSize = JSON.stringify({ messages, systemPrompt }).length;
        console.log(`[ContextBuilder] Payload size: ${payloadSize} bytes | Files: ${attachedFiles.length} | AutoFile: ${autoFileName || "none"}`);
        if (payloadSize > MAX_TOTAL_PAYLOAD_SIZE) {
            console.warn(`[ContextBuilder] Large payload detected (${payloadSize} bytes). Consider further truncation.`);
        }

        return {
            messages,
            systemPrompt,
            summaryUpdateNeeded: chatHistory.length > 10,
            updatedFacts: mergedFacts,
            autoFileName, // expose for caller if needed
        };
    },

    /**
     * Smart Router logic (Client-side decision)
     * @param {String} text - Current user message.
     * @param {Object} providerStatus - Which providers have active keys.
     * @param {Array} attachedFiles - Attached files (images require vision-capable models).
     * @returns {String} routingMode
     */
    route(text, providerStatus = { openrouter: true, gemini: true, groq: true, huggingface: false }, attachedFiles = []) {
        const lower = text.toLowerCase();

        const isAvailable = (p) => providerStatus[p] === true;

        // If images are attached, we must use a vision-capable provider
        const hasImages = attachedFiles.some(f => f.isImage);
        if (hasImages) {
            // OpenRouter and Gemini support vision; Groq does not for most models
            if (isAvailable("openrouter")) return "openrouter";
            if (isAvailable("gemini")) return "gemini";
            return "openrouter"; // fallback
        }

        let ideal = "openrouter";

        if (isContinuation(text)) {
            ideal = "openrouter";
        } else {
            const isLongTask = [
                "write a full", "build a", "create a", "develop", "implement", "complete code",
                "full project", "entire", "landing page", "dashboard", "application", "script for",
                "complete the", "continue the"
            ].some(kw => lower.includes(kw));

            if (isLongTask) {
                ideal = "openrouter";
            } else {
                const isCodeTask = [
                    "function", "class", "react", "component", "debug", "error", "fix", "refactor",
                    "sql", "api", "json", "algorithm", "how to", "why does", "explain", "```"
                ].some(kw => lower.includes(kw)) || hasCodeHighDensity(text);

                if (isCodeTask) ideal = "openrouter";
                else if (text.trim().split(/\s+/).length < 15 && isAvailable("groq")) ideal = "groq";
                else if (isAvailable("openrouter")) ideal = "openrouter";
                else if (isAvailable("gemini")) ideal = "gemini";
                else if (isAvailable("huggingface")) ideal = "huggingface";
                else ideal = "openrouter";
            }
        }

        if (isAvailable(ideal)) return ideal;

        const fallbacks = ["openrouter", "together", "mistral", "gemini", "huggingface", "groq"];
        for (const f of fallbacks) {
            if (isAvailable(f)) return f;
        }

        return ideal;
    },

    /**
     * Summarizes the conversation if needed.
     */
    summarize: async (userId, chats, oldSummary = "") => {
        const relevantHistory = chats
            .filter(c => c.type === "ch")
            .slice(-MAX_HISTORY_FOR_SUMMARY);

        const historyText = relevantHistory
            .map(c => `User: ${truncate(c.question, 500)}\nAI: ${truncate(c.answer || "", 500)}`)
            .join("\n\n");

        const trimmedOldSummary = truncate(oldSummary, MAX_SUMMARY_CONTENT);

        const prompt = `Summarize the following conversation in EXACTLY TWO SENTENCES. Keep the most important project details and decisions. \n\nExisting Summary: ${trimmedOldSummary}\n\nNew Conversation:\n${historyText}`;

        try {
            const res = await api.chat(userId, [{ role: "user", content: prompt }], "You are a concise summarizer.", "llama-3.3-70b-versatile", { routingMode: "groq", max_tokens: 150 });
            if (!res.ok) return oldSummary;

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let summary = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6);
                        if (dataStr === "[DONE]") continue;
                        try {
                            const data = JSON.parse(dataStr);
                            summary += data.choices?.[0]?.delta?.content || "";
                        } catch { /* ignore parse errors */ }
                    }
                }
            }
            return summary.trim() || oldSummary;
        } catch (e) {
            console.error("Summarization failed", e);
            return oldSummary;
        }
    }
};