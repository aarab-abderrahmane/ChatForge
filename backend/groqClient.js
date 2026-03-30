// Groq REST API client — streaming, SSE-compatible
// Default model: llama-3.3-70b-versatile (fast, high quality)
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * Call Groq with streaming. Returns a raw fetch Response whose body
 * streams SSE chunks in the same `data: {...}` format as OpenRouter.
 *
 * @param {Array}  messages   - Array of {role, content} chat messages
 * @param {string} apiKey     - Groq API key
 * @param {Object} options    - { systemPrompt, temperature, max_tokens, top_p }
 * @returns {Response}        - Raw streaming response
 */
export async function askGroq(messages, apiKey, options = {}) {
    const {
        systemPrompt = "You are a helpful AI assistant.",
        temperature = 0.7,
        max_tokens = 2048,
        top_p = 1.0,
    } = options;

    const fullMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_DEFAULT_MODEL,
                messages: fullMessages,
                stream: true,
                temperature,
                max_tokens,
                top_p,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err?.error?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        return response; // raw SSE stream — same format as OpenRouter
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Quick validation: send a tiny message and confirm a response arrives.
 * @param {string} apiKey
 * @returns {boolean}
 */
export async function validateGroqKey(apiKey) {
    try {
        const res = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_DEFAULT_MODEL,
                messages: [{ role: "user", content: "Say hi." }],
                max_tokens: 5,
                stream: false,
            }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data?.choices?.[0]?.message?.content;
    } catch {
        return false;
    }
}
