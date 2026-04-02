import { ConversationsService } from './db';
import { api } from './api';

/**
 * Limits to prevent Payload Too Large (413) errors
 */
const MAX_MESSAGE_CONTENT = 1000;
const MAX_SUMMARY_CONTENT = 1000;
const MAX_HISTORY_FOR_SUMMARY = 10;
const MAX_SYSTEM_PROMPT_PROJECT_PART = 1500;
const MAX_TOTAL_PAYLOAD_SIZE = 150000; // ~150KB threshold for warning

const truncate = (text, max = MAX_MESSAGE_CONTENT, isCode = false) => {
    if (!text) return "";
    // If it's code, we allow much more context (up to 5x)
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

/**
 * Context Builder Logic:
 * 1. Takes current chats and active project (if any).
 * 2. Applies 10-message rule:
 *    - If <= 10 messages: Send everything.
 *    - If > 10 messages: 
 *        - Summarize older messages into 2 sentences (if not already summarized).
 *        - Send Last 6 messages complete.
 * 3. Injects Project Context:
 *    - Name, Type, Phase, Rules.
 * 4. Determines the Provider (Smart Router).
 * 5. Optimized for Payload Size.
 */

export const ContextBuilder = {

    /**
     * Builds the context for the AI call.
     * @param {Array} chats - Current chat history.
     * @param {Object} project - Active project metadata.
     * @param {String} currentSummary - Existing summary from IndexedDB.
     * @param {String} currentQuestion - The fresh question being sent (to avoid stale state).
     * @returns {Object} { messages, systemPrompt, summaryUpdateNeeded }
     */
    build: async (chats, project, currentSummary = "", currentQuestion = "") => {
        // 1. FILTER: Exclude the default FAQ/Welcome messages from AI context to prevent pollution
        // These have fixed IDs 1, 2, 3 in chatsContext.jsx
        const chatHistory = chats.filter(c =>
            c.type === "ch" &&
            (c.question || c.answer) &&
            ![1, 2, 3].includes(c.id)
        );

        let messages = [];
        let summary = truncate(currentSummary, MAX_SUMMARY_CONTENT);

        // Check if we are in "Code Mode" based on recent history
        const lastFewMessages = chatHistory.slice(-4);
        const codeMode = lastFewMessages.some(c => hasCodeHighDensity(c.question) || hasCodeHighDensity(c.answer));

        // 10-message rule logic
        if (chatHistory.length <= 10) {
            messages = chatHistory.flatMap(c => [
                { role: "user", content: truncate(c.question, MAX_MESSAGE_CONTENT, codeMode) },
                ...(c.answer ? [{ role: "assistant", content: truncate(c.answer, MAX_MESSAGE_CONTENT, codeMode) }] : [])
            ]);
        } else {
            messages = chatHistory.slice(-6).flatMap(c => [
                { role: "user", content: truncate(c.question, MAX_MESSAGE_CONTENT, codeMode) },
                ...(c.answer ? [{ role: "assistant", content: truncate(c.answer, MAX_MESSAGE_CONTENT, codeMode) }] : [])
            ]);
        }

        // 2. LAST OUTPUT INJECTION: Find the last assistant response and ensure it's weighted correctly
        const lastAnswer = [...chatHistory].reverse().find(c => c.answer)?.answer;
        if (lastAnswer && lastAnswer.length > 50) {
            messages.push({
                role: "system",
                content: "CRITICAL CONTEXT (Last Generated Output):\n" + truncate(lastAnswer, 5000, true)
            });
        }

        // 3. FIX STALE MESSAGE: Explicitly append the current question if it's not already the last message
        if (currentQuestion && (!messages.length || messages[messages.length - 1].content !== currentQuestion)) {
            messages.push({ role: "user", content: currentQuestion });
        }

        // 2. TOPIC SHIFT: If the user is asking something very short and the history is long,
        // or if keywords suggest a new task, we might want to warn or isolate.
        // For now, we'll just sharpen the System Prompt to focus on the CURRENT question.

        // Build System Prompt with Project Context
        let systemPrompt = "";
        if (project) {
            const rulesText = (project.rules || [])
                .map((r, i) => `- Rule ${i + 1}: ${r}`)
                .join('\n');

            systemPrompt = `You are a helper for Project [${project.name}]\n` +
                `Type: [${project.type}]\n` +
                `Current Phase: [${project.currentPhase}]\n` +
                `Rules:\n${rulesText}\n\n`;

            // Truncate project part if it's too huge
            if (systemPrompt.length > MAX_SYSTEM_PROMPT_PROJECT_PART) {
                systemPrompt = systemPrompt.slice(0, MAX_SYSTEM_PROMPT_PROJECT_PART) + "\n...[Rules Truncated]\n\n";
            }
        }

        if (summary) {
            systemPrompt += `Below is a brief summary of the conversation so far for context. HOWEVER, prioritize the LATEST user request above all else.\nSummary: [${summary}]\n\n`;
        }

        // Add strict instructions to avoid answering based on unrelated previous context
        systemPrompt += "CONTROL LAYER RULES:\n" +
            "- If the user asks to 'continue', provide ONLY the continuation. Do NOT repeat or restart.\n" +
            "- If the task is related to code, ensure tags are closed and logic is complete.\n" +
            "- Prioritize the LATEST request. If it's a new topic, ignore unrelated history.\n" +
            "- Never hallucinate or restart a generation from zero unless explicitly asked.\n\n";

        // Diagnostic: Check payload size
        const payloadSize = JSON.stringify({ messages, systemPrompt }).length;
        console.log(`[ContextBuilder] Payload size: ${payloadSize} bytes`);
        if (payloadSize > MAX_TOTAL_PAYLOAD_SIZE) {
            console.warn(`[ContextBuilder] Large payload detected (${payloadSize} bytes). Consider further truncation.`);
        }

        return {
            messages,
            systemPrompt,
            summaryUpdateNeeded: chatHistory.length > 10 // Flag to trigger background summarization
        };
    },

    /**
     * Smart Router logic (Client-side decision)
     * @param {String} text - Current user message.
     * @returns {String} routingMode ('groq', 'gemini', 'openrouter')
     */
    /**
     * Smart Router logic (Client-side decision)
     * @param {String} text - Current user message.
     * @param {Object} providerStatus - Which providers have active keys.
     * @returns {String} routingMode ('groq', 'gemini', 'openrouter')
     */
    route(text, providerStatus = { openrouter: true, gemini: true, groq: true }) {
        const lower = text.toLowerCase();

        // Helper to check if a provider is actually available
        const isAvailable = (p) => providerStatus[p] === true;

        // Ideal choice based on task type
        let ideal = "openrouter";

        // Priority 1: Continuation keywords
        if (isContinuation(text)) ideal = "openrouter";
        else {
            // Heavy lifting / Long generation keywords
            const isLongTask = [
                "write a full", "build a", "create a", "develop", "implement", "complete code",
                "full project", "entire", "landing page", "dashboard", "application", "script for",
                "complete the", "continue the"
            ].some(kw => lower.includes(kw));

            if (isLongTask) ideal = "openrouter";
            else {
                // Programming / Logic keywords
                const isCodeTask = [
                    "function", "class", "react", "component", "debug", "error", "fix", "refactor",
                    "sql", "api", "json", "algorithm", "how to", "why does", "explain", "```"
                ].some(kw => lower.includes(kw)) || hasCodeHighDensity(text);

                if (isCodeTask) ideal = "openrouter";
                else if (text.trim().split(/\s+/).length < 15) ideal = "groq";
                else ideal = "openrouter";
            }
        }

        // FALLBACK LOGIC: If ideal is not available, try others in order of capability
        if (isAvailable(ideal)) return ideal;

        const fallbacks = ["openrouter", "gemini", "huggingface", "groq"];
        for (const f of fallbacks) {
            if (isAvailable(f)) return f;
        }

        return ideal; // Fallback to original recommendation if absolutely everything is missing (backend will handle)
    },

    /**
     * Summarizes the conversation if needed.
     * Sends to Groq (fastest) to generate a 2-sentence summary.
     */
    summarize: async (userId, chats, oldSummary = "") => {
        // Only use the last N messages for summary to avoid 413 during summarization itself
        const relevantHistory = chats
            .filter(c => c.type === "ch")
            .slice(-MAX_HISTORY_FOR_SUMMARY);

        const historyText = relevantHistory
            .map(c => `User: ${truncate(c.question, 500)}\nAI: ${truncate(c.answer || "", 500)}`)
            .join("\n\n");

        const trimmedOldSummary = truncate(oldSummary, MAX_SUMMARY_CONTENT);

        const prompt = `Summarize the following conversation in EXACTLY TWO SENTENCES. Keep the most important project details and decisions. \n\nExisting Summary: ${trimmedOldSummary}\n\nNew Conversation:\n${historyText}`;

        try {
            const res = await api.chat(userId, [{ role: "user", content: prompt }], "You are a concise summarizer.", "groq-llama-3.1-70b", { routingMode: "groq", max_tokens: 150 });
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
                        } catch { }
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
