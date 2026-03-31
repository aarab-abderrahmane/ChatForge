import fetch from "node-fetch";

/**
 * Validates a Hugging Face API key by making a small request to the Inference API.
 */
export async function validateHuggingFaceKey(key) {
    try {
        const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: "Hi", parameters: { max_new_tokens: 1 } }),
        });
        return response.ok;
    } catch (error) {
        console.error("[HuggingFace] Key validation error:", error);
        return false;
    }
}

/**
 * Simple Hugging Face Inference API call (non-streaming for now, but we can wrap it).
 * HF Inference API support for streaming exists but requires handles different formats.
 * For this implementation, we'll mimic the others and return a Response or similar.
 */
export async function askHuggingFace(messages, key, options = {}) {
    const {
        model = "mistralai/Mistral-7B-Instruct-v0.3",
        systemPrompt = "You are a helpful AI assistant.",
        temperature = 0.7,
        max_tokens = 1024,
    } = options;

    // Format messages for typical HF instruct models (Mistral/Llama style)
    const prompt = `<s>[INST] ${systemPrompt}\n\n${messages
        .map((m) => (m.role === "user" ? m.content : `[/INST] ${m.content} </s><s>[INST]`))
        .join("\n")} [/INST]`;

    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: max_tokens,
                temperature: temperature,
                return_full_text: false,
            },
        }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data[0]?.generated_text || "";

    // To maintain SSE compatibility with the server.js loop, we'll create a fake stream or just return the text
    // The server.js expects a ReadableStream for non-generators.

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            // Send the content in one SSE-formatted chunk to match OpenRouter/Groq format
            const chunk = {
                choices: [
                    {
                        delta: { content: text },
                    },
                ],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            controller.close();
        },
    });

    return { body: stream };
}
