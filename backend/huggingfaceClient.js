/**
 * Validates a Hugging Face API key by making a small request to the Inference API.
 */
export async function validateHuggingFaceKey(key) {
    try {
        const response = await fetch("https://api-inference.huggingface.co/models/google/flan-t5-small", {
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

    // Detect model family and apply appropriate prompt template
    const modelLower = model.toLowerCase();
    let prompt;
    if (modelLower.includes("llama") || modelLower.includes("mistral") || modelLower.includes("qwen") || modelLower.includes("mixtral") || modelLower.includes("zephyr")) {
        // Llama/Mistral style
        prompt = `<s>[INST] ${systemPrompt}\n\n${messages
            .map((m) => (m.role === "user" ? m.content : `[/INST] ${m.content} </s><s>[INST]`))
            .join("\n")} [/INST]`;
    } else if (modelLower.includes("chatglm") || modelLower.includes("glm")) {
        // ChatGLM style
        const parts = messages.map((m, i) =>
            m.role === "user" ? `[Round ${Math.ceil((i + 1) / 2)}]\n问：${m.content}` : `答：${m.content}`
        );
        prompt = `${parts.join("\n")}${messages.length % 2 === 1 ? "\n答：" : ""}`;
    } else if (modelLower.includes("deepseek")) {
        // DeepSeek style
        const parts = messages.map((m) =>
            m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`
        );
        prompt = `${systemPrompt}\n\n${parts.join("\n")}${messages[messages.length - 1]?.role === "user" ? "\nAssistant:" : ""}`;
    } else if (modelLower.includes("t5") || modelLower.includes("flan") || modelLower.includes("mt0") || modelLower.includes("bloom") || modelLower.includes("gpt2") || modelLower.includes("codegen") || modelLower.includes("gpt-neo")) {
        // Simple prefix format for T5, BLOOM, GPT-2, etc.
        const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
        prompt = `${systemPrompt}\n\n${lastUserMsg ? lastUserMsg.content : ""}`;
    } else {
        // Generic chat format for unknown models
        prompt = messages.map((m) =>
            m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`
        ).join("\n");
    }

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
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    });

    return { body: stream };
}
