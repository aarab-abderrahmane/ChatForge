const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_DEFAULT_MODEL = "mistral-small-latest";

export async function askMistral(messages, apiKey, options = {}) {
    const {
        systemPrompt = "You are a helpful AI assistant.",
        temperature = 0.7,
        max_tokens = 4096,
        top_p = 1.0,
        frequency_penalty,
        presence_penalty,
        model,
    } = options;

    const fullMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(MISTRAL_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model || MISTRAL_DEFAULT_MODEL,
                messages: fullMessages,
                stream: options.stream !== undefined ? options.stream : true,
                temperature,
                max_tokens,
                top_p,
                frequency_penalty,
                presence_penalty,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err?.error?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        return response;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

export async function validateMistralKey(apiKey) {
    try {
        const res = await fetch(MISTRAL_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MISTRAL_DEFAULT_MODEL,
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
