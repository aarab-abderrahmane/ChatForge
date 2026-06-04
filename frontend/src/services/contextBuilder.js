import { ConversationsService } from './db';
import { api } from './api';

/**
 * Limits to prevent Payload Too Large (413) errors
 */
const MAX_MESSAGE_CONTENT = 3000;
const MAX_AI_RESPONSE_CONTENT = 2000;
const MAX_SUMMARY_CONTENT = 1500;
const MAX_HISTORY_FOR_SUMMARY = 20;
const MAX_TOTAL_PAYLOAD_SIZE = 350000; // ~350KB threshold — payloads above this get aggressively trimmed

// Context cache: keyed by sessionId + messageCount, invalidated on new messages
const contextCache = new Map();
const CACHE_TTL = 30_000; // 30 seconds

// Model used for background summarization
const SUMMARIZE_MODEL = "llama-3.3-70b-versatile";

// Max characters of file text content to inject per file
const MAX_FILE_CONTENT_CHARS = 12000;
// Max characters of total injected file content across all files
const MAX_TOTAL_FILE_CHARS = 30000;

const truncate = (text, max = MAX_MESSAGE_CONTENT, isCode = false) => {
    if (!text) return "";
    const effectiveMax = isCode ? max * 4 : max;
    if (text.length <= effectiveMax) return text;

    if (isCode) {
        const cut = text.slice(0, effectiveMax);
        const lastNewline = cut.lastIndexOf('\n');
        if (lastNewline > effectiveMax * 0.5) {
            return cut.slice(0, lastNewline) + "\n...";
        }
        return cut + "...";
    }

    if (effectiveMax > 600) {
        const keepStart = Math.floor(effectiveMax * 0.6);
        const keepEnd = Math.floor(effectiveMax * 0.3);
        return text.slice(0, keepStart) +
               "\n\n[...middle section trimmed for length...]\n\n" +
               text.slice(-keepEnd);
    }

    const cut = text.slice(0, effectiveMax);
    const sentenceEnd = Math.max(
        cut.lastIndexOf('. '),
        cut.lastIndexOf('.\n'),
        cut.lastIndexOf('! '),
        cut.lastIndexOf('? '),
        cut.lastIndexOf('\n\n')
    );
    if (sentenceEnd > effectiveMax * 0.3) {
        return cut.slice(0, sentenceEnd + 1) + "...";
    }
    return cut + "...";
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
        /my name is (\w+(?:\s+\w+){0,2})/i, /call me (\w+(?:\s+\w+){0,2})/i,
        /you can call me (\w+(?:\s+\w+){0,2})/i, /i(?:'m| am) called (\w+(?:\s+\w+){0,2})/i,
    ]},
    { key: "location", label: "Location", patterns: [
        /i live in (\w+(?:\s+\w+){0,3})/i, /i(?:'m| am) from (\w+(?:\s+\w+){0,3})/i,
        /i(?:'m| am) based in (\w+(?:\s+\w+){0,3})/i,
    ]},
    { key: "profession", label: "Profession", patterns: [
        /i(?:'m| am) (?:a|an) (\w+(?:\s+\w+){0,3})/i,
        /i work as (?:a|an) (\w+(?:\s+\w+){0,3})/i,
        /my job is (\w+(?:\s+\w+){0,3})/i,
        /i(?:'m| am) (?:an?\s+)?(?:aspiring|beginner|experienced|senior|junior)\s+(\w+(?:\s+\w+){0,3})/i,
    ]},
    { key: "language", label: "Language", patterns: [
        /i speak (\w+(?:\s+\w+)?)/i, /my native language is (\w+(?:\s+\w+)?)/i,
        /i(?:'m| am) fluent in (\w+(?:\s+\w+)?)/i,
    ]},
    { key: "preference", label: "Preference", patterns: [
        /i (?:like|love|prefer) (\w+(?:\s+\w+){0,3})/i,
        /my favorite (\w+) is (\w+(?:\s+\w+){0,3})/i,
        /i enjoy (\w+(?:\s+\w+){0,3})/i,
    ]},
];

const extractFacts = (text, existingFacts = {}) => {
    if (!text) return existingFacts;
    const newFacts = { ...existingFacts };
    for (const { key, patterns } of FACT_PATTERNS) {
        for (const regex of patterns) {
            const match = text.match(regex);
            if (match) {
                const raw = match[match.length - 1];
                const val = raw.charAt(0).toUpperCase() + raw.slice(1);
                if (val.length > 2 && val.length < 60) {
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
    return `=== ABOUT THE USER ===\n${factsStr}\n\n` +
        "This is personal information about me. Use it to personalize your responses — " +
        "address me by name, reference my profession, preferences, and other details " +
        "naturally in our conversation. If you're not sure about something, just ask.\n\n";
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

    // ONLY trigger when user explicitly wants a file/download artifact
    const explicitFileIntent = [
        "create a file", "make a file", "generate a file", "save as",
        "download", "export", "write a script", "write a python",
        "write a bash", "create a dockerfile", "write sql",
        "create a csv", "make a spreadsheet", "create a pdf",
        "generate a pdf", "create an html file", "write an html file",
    ];
    const hasExplicitIntent = explicitFileIntent.some(p => lower.includes(p));
    if (!hasExplicitIntent) return null;

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
            patterns: ["bash script", "shell script"],
            filename: "script.sh",
        },
        {
            patterns: ["write a script", "create a script"],
            subPatterns: [".sh", "bash", "shell", "python", ".py", ".js", "powershell", "batch"],
            filename: "script.sh",
        },
        {
            patterns: ["dockerfile", "docker-compose", "docker compose"],
            filename: (t) => lower.includes("compose") ? "docker-compose.yml" : "Dockerfile",
        },
        {
            patterns: ["readme", "documentation file", "write docs"],
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
            patterns: ["environment file", "env file", "config file"],
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
 * Builds an artifact injection block from previously-generated files in the session.
 * This helps the AI modify existing files in-place instead of regenerating them.
 */
const buildArtifactBlock = (artifactFiles = []) => {
    if (!artifactFiles.length) return "";

    const MAX_ARTIFACT_FILE_CHARS = 8000;
    const MAX_TOTAL_ARTIFACT_CHARS = 24000;
    let totalChars = 0;

    // Group files by apparent project (directory-like prefix in filename)
    const groups = {};
    for (const f of artifactFiles) {
        const project = f.filename.includes("/") ? f.filename.split("/")[0] : "main";
        if (!groups[project]) groups[project] = [];
        groups[project].push(f);
    }
    const projectNames = Object.keys(groups);
    const multiProject = projectNames.length > 1;

    let block = "=== WORKSPACE FILES ===\n";
    block += `Current workspace has ${artifactFiles.length} file(s) across ${projectNames.length} project(s): ${projectNames.join(", ")}\n\n`;

    // File manifest: always list filenames even if content is omitted
    for (const project of projectNames) {
        const projectFiles = groups[project];
        const names = projectFiles.map(f => f.filename);
        block += `Project "${project}" files: ${names.join(", ")}\n`;
    }
    block += "\n";

    for (const file of artifactFiles) {
        if (totalChars >= MAX_TOTAL_ARTIFACT_CHARS) {
            block += `[File "${file.filename}" omitted — total file content limit reached]\n\n`;
            continue;
        }
        const remaining = MAX_TOTAL_ARTIFACT_CHARS - totalChars;
        const content = truncate(file.content, Math.min(MAX_ARTIFACT_FILE_CHARS, remaining));
        totalChars += content.length;

        block += `--- File: ${file.filename} ---\n`;
        block += content;
        block += "\n--- End of file ---\n\n";
    }

    block += "INSTRUCTIONS:\n" +
        "- If the user asks to modify, improve, or fix one of these files, output ONLY the changed file as a new ```file:filename.ext block.\n" +
        "- Keep the SAME filename. Do NOT create duplicate files with version suffixes (v2, _final, etc).\n" +
        "- Do NOT regenerate files the user didn't ask about.\n" +
        "- When generating multiple files, verify that exports, imports, function signatures, and type definitions match across all files. Cross-file references must be consistent.\n" +
        "- To DELETE a file when the user asks, output it as ```delete:filename.ext (the file will be removed from the workspace immediately).\n" +
        "- If the user says 'undo' or 'restore' a deleted file, re-output it with ```file:filename.ext as before.\n\n";

    if (multiProject) {
        block += "MULTI-PROJECT NOTICE:\n" +
            "There are files from multiple projects in this workspace. If the user's request could apply to " +
            "more than one project (e.g. 'add login' with both a recipe site and a fitness app), " +
            "STOP and ask which project they mean BEFORE proceeding. Do not assume.\n\n";
    }

    return block;
};

/**
 * Detects the editing mode based on user intent and available artifacts.
 * Returns 'generate', 'modify', 'fix', or 'explain'.
 */
const MODES = { GENERATE: 'generate', MODIFY: 'modify', FIX: 'fix', EXPLAIN: 'explain' };

const detectMode = (text, hasArtifacts) => {
    if (!text) return MODES.GENERATE;
    const lower = text.toLowerCase();

    if (/^(explain|what does|how does|why does|describe|what is|tell me about)\b/.test(lower)) {
        return MODES.EXPLAIN;
    }

    if (/\b(fix|bug|error|issue|not working|broken|doesn't work|wrong|incorrect)\b/.test(lower)) {
        return MODES.FIX;
    }

    if (hasArtifacts && /\b(add|change|update|modify|improve|edit|replace|remove|delete|insert|rewrite)\b/.test(lower)) {
        return MODES.MODIFY;
    }

    return MODES.GENERATE;
};

const buildModeBlock = (mode) => {
    switch (mode) {
        case MODES.MODIFY:
            return "MODE: Modify\n" +
                "You are editing existing files in this session.\n" +
                "- Start your response with a CHANGES: section listing exactly what you modified (bullet points).\n" +
                "- Then output the COMPLETE updated file in a ```file: block. Do NOT try to output only fragments.\n" +
                "- Keep the SAME filename. Do NOT create version suffixes (v2, _final, etc).\n" +
                "- Only regenerate files the user explicitly asked about.\n\n";

        case MODES.FIX:
            return "MODE: Fix\n" +
                "You are fixing a bug in existing code.\n" +
                "- First explain what was wrong (1-2 sentences).\n" +
                "- Then output ONLY the function or section that needs the fix.\n" +
                "- Include a context marker: --- FILE: filename.ext → function name() ---\n" +
                "- Do NOT regenerate unrelated parts.\n\n";

        case MODES.EXPLAIN:
            return "MODE: Explain\n" +
                "The user wants an explanation, not code changes.\n" +
                "- Provide a clear, beginner-friendly explanation.\n" +
                "- Do NOT generate new code unless the user explicitly asks.\n" +
                "- If code examples help, keep them minimal and focused.\n\n";

        default:
            return "";
    }
};

/**
 * Context Builder Logic:
 * 1. Takes current chats and active project (if any).
 * 2. Applies 10-message rule.
 * 3. Injects attached file content into the system prompt.
 * 4. Injects previously-generated artifact files for modify-in-place.
 * 5. Detects task mode (generate/modify/fix/explain) and injects mode-specific instructions.
 * 6. Detects if the AI should auto-generate a downloadable file.
 * 7. Optimized for Payload Size.
 */
export const ContextBuilder = {

    /**
     * Builds the context for the AI call.
     * @param {Array} chats - Current chat history.
     * @param {String} currentSummary - Existing summary from IndexedDB.
     * @param {String} currentQuestion - The fresh question being sent.
     * @param {Object} userFacts - Known user facts.
     * @param {Array} attachedFiles - Files attached to this message: [{ name, type, content, isImage, sizeKB }]
     * @param {Array} artifactFiles - Previously-generated files in the current session: [{ filename, content }]
     * @returns {Object} { messages, systemPrompt, summaryUpdateNeeded, updatedFacts }
     */
    build: async (chats, currentSummary = "", currentQuestion = "", userFacts = {}, attachedFiles = [], artifactFiles = []) => {
        // 1. FILTER: Exclude welcome/FAQ messages
        const chatHistory = chats.filter(c =>
            c.type === "ch" &&
            (c.question || c.answer) &&
            typeof c.id === "string" && !c.id.startsWith("welcome-")
        );

        const filesKey = attachedFiles.map(f => f.name).join(",") + "|" + artifactFiles.map(f => f.filename).join(",");
        const cacheKey = `${chatHistory.length}_${chatHistory.map(m => m.id).join(',')}_${currentSummary?.length || 0}_${currentQuestion?.length || 0}_${Object.keys(userFacts).sort().join(",")}_${filesKey}`;
        const cached = contextCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
            return cached.result;
        }

        let messages = [];
        let summary = truncate(currentSummary, MAX_SUMMARY_CONTENT);

        // Check if we are in "Code Mode" based on recent history
        const lastFewMessages = chatHistory.slice(-4);
        const codeMode = lastFewMessages.some(c => hasCodeHighDensity(c.question) || hasCodeHighDensity(c.answer));

        const historyForMessages = chatHistory.filter(c => !c.isEphemeral && !!c.answer);

        // 15-message rule logic
        if (historyForMessages.length <= 15) {
            messages = historyForMessages.flatMap(c => [
                { role: "user", content: truncate(c.question, MAX_MESSAGE_CONTENT, codeMode) },
                ...(c.answer ? [{ role: "assistant", content: truncate(c.answer, MAX_MESSAGE_CONTENT, codeMode) }] : [])
            ]);
        } else {
            messages = historyForMessages.slice(-10).flatMap(c => [
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

        // 3. Extract user facts — always scan full history for facts, newest wins
        let mergedFacts = extractFacts(currentQuestion, { ...userFacts });
        for (const c of chatHistory) {
            mergedFacts = extractFacts(c.question, mergedFacts);
            mergedFacts = extractFacts(c.answer, mergedFacts);
        }

        // 4. Detect task mode
        const mode = detectMode(currentQuestion, artifactFiles.length > 0);

        // 5. Auto-file detection: should the AI wrap its output in a file block?
        const autoFileName = detectAutoFileOutput(currentQuestion);

        // 6. Build System Prompt
        let systemPrompt = buildFactsBlock(mergedFacts);

        // Inject file content block (text files only — images handled in messages)
        if (fileTextBlock) {
            systemPrompt += fileTextBlock;
        }

        // Inject previously-generated artifact files (for modify-in-place)
        const artifactBlock = buildArtifactBlock(artifactFiles);
        if (artifactBlock) {
            systemPrompt += artifactBlock;
        }

        if (summary) {
            systemPrompt += `Below is a brief summary of the conversation so far for context. HOWEVER, prioritize the LATEST user request above all else.\nSummary: [${summary}]\n\n`;
        }

        // Control layer rules
        systemPrompt += "CONTROL LAYER RULES:\n" +
            "- LANGUAGE: Always respond in the same language the user is writing in. If they write in Arabic, respond in Arabic. If French, respond in French. Never switch languages unless asked.\n" +
            "- If the user asks to 'continue', provide ONLY the continuation. Do NOT repeat or restart.\n" +
            "- If requirements are ambiguous (e.g. unspecified design style, color scheme, layout, technology stack), ask 1-2 brief clarifying questions before generating. Do NOT assume defaults for vague requests.\n" +
            "- If the task is related to code, ensure tags are closed and logic is complete.\n" +
            "- Prioritize the LATEST request. If it's a new topic, ignore unrelated history.\n" +
            "- Never hallucinate or restart a generation from zero unless explicitly asked.\n" +
            "- When generating code files, be CONCISE. Code block first, then brief notes only if relevant.\n" +
            "- COMPLETENESS: When modifying existing work, output EVERY piece that needs changing. Never skip any file, component, or section.\n" +
            "- TRUTHFULNESS: Only list changes you actually included in your output. Never claim work you didn't produce.\n" +
            "- REQUIREMENTS: Explicitly satisfy every requirement the user listed. Do not silently drop features.\n" +
            "- CONSISTENCY: When modifying multiple pieces, ensure all references and dependencies between them stay consistent.\n\n";

        // Mode-specific instructions
        const modeBlock = buildModeBlock(mode);
        if (modeBlock) {
            systemPrompt += modeBlock;
        }

        // File artifact rules
        systemPrompt += "FILE ARTIFACTS:\n" +
            "- To create a downloadable file, use the markdown code block with language `file:filename.ext`.\n" +
            "- Example: ```file:script.py\nprint('hello')\n``` renders as a file card with download/copy.\n" +
            "- Supported extensions: .md, .txt, .js, .ts, .jsx, .tsx, .py, .html, .css, .json, .csv, .sql, .sh, .yaml, .env, etc.\n" +
            "- Use this for scripts, data exports, reports, and any content the user may want to download.\n" +
            "- IMPORTANT: For ALL code generation, wrap the complete code in a ```file:filename.ext block. This is MANDATORY for code responses. Without this, the user cannot download the file.\n" +
            "- When generating multiple files, verify that exports, imports, function signatures, and type definitions match across all files. Cross-file references must be consistent.\n" +
            "- To DELETE a file when the user asks, output it as ```delete:filename.ext (the file will be removed from the workspace). Do NOT output empty file blocks for deletion.\n" +
            "- If the user says 'undo' or 'restore' a deleted file, re-output it with ```file:filename.ext with the full restored content.\n\n";

        // Auto-file instruction: prompt the AI to output a file block automatically
        if (autoFileName) {
            systemPrompt += `AUTO-FILE INSTRUCTION:\n` +
                `The user's request is asking you to generate content that should be saved as a file.\n` +
                `IMPORTANT: You MUST wrap your primary output in a file block like this:\n` +
                `\`\`\`file:${autoFileName}\n[your full content here]\n\`\`\`\n` +
                `Use this INSTEAD of a plain code block for the main deliverable.\n` +
                `You may still add explanation text before or after the file block.\n\n`;
        }

        // Enforce payload size — aggressively trim if over limit
        let payloadSize = JSON.stringify({ messages, systemPrompt }).length;
        console.log(`[ContextBuilder] Payload size: ${payloadSize} bytes | Files: ${attachedFiles.length} | AutoFile: ${autoFileName || "none"}`);
        if (payloadSize > MAX_TOTAL_PAYLOAD_SIZE) {
            console.warn(`[ContextBuilder] Large payload (${payloadSize} bytes). Trimming messages...`);
            let safety = 10;
            while (payloadSize > MAX_TOTAL_PAYLOAD_SIZE && safety > 0 && messages.length > 2) {
                safety--;
                for (const msg of messages) {
                    if (typeof msg.content === 'string' && msg.content.length > 100) {
                        msg.content = msg.content.slice(0, Math.floor(msg.content.length * 0.7)) + '\n... [trimmed]';
                    }
                }
                payloadSize = JSON.stringify({ messages, systemPrompt }).length;
            }
            console.log(`[ContextBuilder] After trim: ${payloadSize} bytes`);
        }

        const result = {
            messages,
            systemPrompt,
            summaryUpdateNeeded: chatHistory.length > 10,
            updatedFacts: mergedFacts,
            autoFileName,
        };

        if (contextCache.size > 100) {
            const firstKey = contextCache.keys().next().value;
            if (firstKey) contextCache.delete(firstKey);
        }
        contextCache.set(cacheKey, { result, ts: Date.now() });

        return result;
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
    summarize: async (userId, chats, oldSummary = "", artifactFiles = [], signal) => {
        const relevantHistory = chats
            .filter(c => c.type === "ch")
            .slice(-MAX_HISTORY_FOR_SUMMARY);

        const historyText = relevantHistory
            .map(c => `User: ${truncate(c.question, 500)}\nAI: ${truncate(c.answer || "", 500)}`)
            .join("\n\n");

        const trimmedOldSummary = truncate(oldSummary, MAX_SUMMARY_CONTENT);

        const fileNames = artifactFiles.map(f => f.filename);
        const fileContext = fileNames.length ? `\n\nFiles generated in this session: ${fileNames.join(", ")}.` : "";

        const prompt = `Summarize the following conversation in EXACTLY FIVE structured sentences covering: 1) Key topics discussed, 2) Decisions made, 3) User preferences or facts learned, 4) Action items or open questions, 5) Current status or conclusion.${fileContext}\n\nExisting Summary: ${trimmedOldSummary}\n\nNew Conversation:\n${historyText}`;

        try {
            const res = await api.chat(userId, [{ role: "user", content: prompt }], "You are a concise summarizer. Output exactly 5 sentences in a single paragraph.", SUMMARIZE_MODEL, { routingMode: "groq", max_tokens: 500 }, signal);
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