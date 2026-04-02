// Google Gemini REST API client — converts Gemini streaming into SSE format
// compatible with the existing OpenRouter SSE pipeline in the frontend.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Call Gemini with streaming.
 * Gemini returns newline-delimited JSON; we convert it into an async generator
 * that yields OpenRouter-compatible SSE strings so the existing frontend works
 * without any changes.
 *
 * @param {Array}  messages  - Array of {role, content}
 * @param {string} apiKey    - Google AI API key
 * @param {Object} options   - { systemPrompt, temperature, maxOutputTokens, topP }
 * @returns {AsyncGenerator<string>} - Yields SSE data lines
 */
export async function* askGeminiStream(messages, apiKey, options = {}) {
    const {
        systemPrompt = "You are a helpful AI assistant.",
        temperature = 0.7,
        maxOutputTokens = 2048,
        topP = 1.0,
    } = options;

    // Convert OpenAI-style messages → Gemini format
    const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));

    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature,
                    maxOutputTokens,
                    topP,
                },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${response.status}`;
        throw new Error(msg);
    }

    // Gemini SSE stream: each event is `data: <json>\n\n`
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    // Emit in OpenRouter SSE format so frontend needs no changes
                    const openrouterChunk = {
                        choices: [{ delta: { content: text } }],
                    };
                    yield `data: ${JSON.stringify(openrouterChunk)}\n\n`;
                }
            } catch {
                // skip malformed chunks
            }
        }
    }

    yield "data: [DONE]\n\n";
}

/**
 * Call Gemini without streaming.
 * Simulates a fetch Response object matching the OpenAI/OpenRouter schema.
 */
export async function askGeminiSync(messages, apiKey, options = {}) {
    const {
        systemPrompt = "You are a helpful AI assistant.",
        temperature = 0.7,
        maxOutputTokens = 2048,
        topP = 1.0,
    } = options;

    const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));

    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature,
                    maxOutputTokens,
                    topP,
                },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${response.status}`;
        throw new Error(msg);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Return a mocked Response matching OpenRouter / OpenAI structure
    return {
        text: true, // indicates to server.js that it's a synchronous fetch body wrapper
        json: async () => ({
            choices: [{ message: { content: text } }]
        })
    };
}

/**
 * Quick validation: send a tiny message and confirm a response arrives.
 * @param {string} apiKey
 * @returns {boolean}
 */
export async function validateGeminiKey(apiKey) {
    try {
        const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Say hi." }] }],
                generationConfig: { maxOutputTokens: 5 },
            }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch {
        return false;
    }
}
