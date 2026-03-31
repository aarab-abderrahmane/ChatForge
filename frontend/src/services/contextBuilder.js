import { ConversationsService } from './db';
import { api } from './api';

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
 */

export const ContextBuilder = {

    /**
     * Builds the context for the AI call.
     * @param {Array} chats - Current chat history.
     * @param {Object} project - Active project metadata.
     * @param {String} currentSummary - Existing summary from IndexedDB.
     * @returns {Object} { messages, systemPrompt, summaryUpdateNeeded }
     */
    build: async (chats, project, currentSummary = "") => {
        const chatHistory = chats.filter(c => c.type === "ch" && (c.question || c.answer));

        let messages = [];
        let summary = currentSummary;

        // 10-message rule logic
        if (chatHistory.length <= 10) {
            messages = chatHistory.flatMap(c => [
                { role: "user", content: c.question },
                ...(c.answer ? [{ role: "assistant", content: c.answer }] : [])
            ]);
        } else {
            // Last 6 messages complete
            const lastSix = chatHistory.slice(-6);
            messages = lastSix.flatMap(c => [
                { role: "user", content: c.question },
                ...(c.answer ? [{ role: "assistant", content: c.answer }] : [])
            ]);
            // The rest is summarized (handled by the summary field in system prompt)
        }

        // Build System Prompt with Project Context
        let systemPrompt = "";
        if (project) {
            systemPrompt = `You are a helper for Project [${project.name}]\n` +
                `Type: [${project.type}]\n` +
                `Current Phase: [${project.currentPhase}]\n` +
                `Rules:\n${(project.rules || []).map((r, i) => `- Rule ${i + 1}: ${r}`).join('\n')}\n\n`;
        }

        if (summary) {
            systemPrompt += `Summary of previous conversation: [${summary}]\n\n`;
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
    route: (text) => {
        const lower = text.toLowerCase();
        const CODE_KEYWORDS = ["function", "class", "const", "import", "package", "public", "private", "def ", "fn "];
        const isCode = CODE_KEYWORDS.some(k => lower.includes(k)) || text.includes("```");

        if (text.length < 150 && !isCode) return "groq"; // Short message -> Groq
        if (isCode) return "gemini"; // Code/Programming -> Gemini
        return "openrouter"; // Long text/Creative -> OpenRouter
    },

    /**
     * Summarizes the conversation if needed.
     * Sends to Groq (fastest) to generate a 2-sentence summary.
     */
    summarize: async (userId, chats, oldSummary = "") => {
        const historyText = chats
            .filter(c => c.type === "ch")
            .map(c => `User: ${c.question}\nAI: ${c.answer || ""}`)
            .join("\n\n");

        const prompt = `Summarize the following conversation in EXACTLY TWO SENTENCES. Keep the most important project details and decisions. \n\nExisting Summary: ${oldSummary}\n\nNew Conversation:\n${historyText}`;

        try {
            const res = await api.chat(userId, [{ role: "user", content: prompt }], "You are a concise summarizer.", "groq-llama-3.1-70b", { routingMode: "groq" });
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
