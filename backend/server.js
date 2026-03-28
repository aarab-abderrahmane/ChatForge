import cors from "cors";
// import dotenv from "dotenv";


// import {client,connectDB} from './db.js'
// dotenv.config();

import express from "express"
import { connectDB } from "./db.js"

const app = express();
app.use(cors());

app.use(express.json());




export async function saveUserKey(encryptedKey, userId) {

  const client = await connectDB()

  const db = client.db(process.env.APP_NAME)
  const collection = db.collection("apikeys") // like table in sql 



  await collection.updateOne(
    { userId },
    { $set: { encryptedKey } }, // update key if the user already exist
    { upsert: true } // add new key 
  )


  // fs.writeFileSync(
  //   "keys.json",
  //   JSON.stringify({ key: encryptedKey }, null, 2)
  // );
}



export function encrypt(text) {

  return Buffer.from(text).toString('base64')
}

export function decrypt(text) {
  return Buffer.from(text, "base64").toString('utf8')
}



export async function getUserKey(userId) {
  try {

    const client = await connectDB()

    const db = client.db(process.env.APP_NAME)
    const collection = db.collection('apikeys');

    const user = await collection.findOne({ userId: userId })
    const decryptedkey = decrypt(user.encryptedKey).trim()


    if (user) {

      return { exists: true, res: decryptedkey }

    } else {


      return { exists: false, res: "User not found. Please provide a valid API key ⚠️." }

    }

  } catch (err) {

    return { exists: false, res: "Unable to fetch user key due to a server error .Please try again later ❌." }

  }
  // if (!fs.existsSync("keys.json")) return "";

  // const data = JSON.parse(fs.readFileSync("keys.json"));
  // return decrypt(data.key);
}



export async function check_key_Exists(userId) {
  try {

    const client = await connectDB()

    const db = client.db(process.env.APP_NAME)
    const collection = db.collection('apikeys');

    const user = await collection.findOne({ userId: userId })


    if (user && user.encryptedKey) {

      return { exists: true, res: "key Exists" }

    } else if (user && (!user.encryptedKey || user.encryptedKey.trim().length === 0)) {

      return { exists: false, res: "User found, but API key is missing or empty." }

    } else {


      return { exists: false, res: "User not found. Please provide a valid API key ⚠️." }

    }

  } catch (err) {

    return { exists: false, res: "Unable to fetch user key due to a server error .Please try again later ❌." }

  }

}


// All reliable free models across different upstream providers
export const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",        // Venice / Together
  "mistralai/mistral-small-3.1-24b-instruct:free",  // Mistral provider
  "nousresearch/hermes-3-llama-3.1-405b:free",      // Nous / Together
  "meta-llama/llama-3.1-405b-instruct:free",        // Together AI
  "meta-llama/llama-3.2-3b-instruct:free",          // Lightweight fallback
  "stepfun/step-3.5-flash:free",                    // StepFun provider
  "arcee-ai/trinity-large-preview:free",             // Arcee provider
];

export async function askAI(messages, key, options = {}) {
  const {
    models = FREE_MODELS,
    systemPrompt = "You are a helpful AI assistant.",
    temperature = 0.7,
    stream = false,
    top_p,
    frequency_penalty,
    presence_penalty,
    max_tokens
  } = options;

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages
  ];

  const triedErrors = [];

  // Sequential fallback: try each model one by one on our server
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5000",
          "X-OpenRouter-Title": "ChatForge"
        },
        body: JSON.stringify({
          model: model,   // single model per request — we handle fallback ourselves
          messages: fullMessages,
          stream: stream,
          temperature: temperature,
          top_p: top_p,
          frequency_penalty: frequency_penalty,
          presence_penalty: presence_penalty,
          max_tokens: max_tokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        const code = errorData?.error?.code || response.status;
        const msg = errorData?.error?.message || `HTTP ${response.status}`;
        console.warn(`[ChatForge] Model "${model}" failed (${code}): ${msg}`);
        triedErrors.push(`${model}: ${msg}`);

        // Retryable / skip-to-next errors
        if ([400, 404, 429, 500, 503].includes(Number(code)) ||
          msg.includes("rate-limit") || msg.includes("Provider returned error") ||
          msg.includes("No endpoints")) {
          continue; // try the next model
        }

        // Non-retryable (e.g. auth error 401) — throw immediately
        throw new Error(msg);
      }

      console.log(`[ChatForge] ✓ Serving response via: ${model}`);
      return response;

    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        console.warn(`[ChatForge] Model "${model}" timed out, trying next...`);
        triedErrors.push(`${model}: timed out`);
        continue;
      }
      // If it's our own throw from non-retryable, re-throw
      if (!triedErrors.find(e => e.startsWith(model))) throw err;
      // Otherwise continue to next model
    }
  }

  // All models exhausted
  const summary = triedErrors.join(' | ');
  console.error(`[ChatForge] All models failed: ${summary}`);
  throw new Error(`All AI models are currently unavailable. Please try again later.`);
}



app.post("/api/chat", async (req, res) => {
  const { userId, messages, skillPrompt, model, parameters } = req.body;
  const keyStatus = await getUserKey(userId);

  if (!keyStatus.exists) {
    return res.status(401).json({ response: `API key not found!`, type: "error" });
  }

  // Set headers for SSE (Streaming)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Build the Model Fallback List
    // We prioritize the user's choice, then add highly stable free models as backups
    // Start with user-chosen model, then fall back through all free models
    const finalModels = model
      ? [model, ...FREE_MODELS.filter(m => m !== model)]
      : FREE_MODELS;

    const options = {
      models: finalModels,
      systemPrompt: skillPrompt || "You are ChatForge AI.",
      stream: true,
      ...(parameters || {})
    };

    const aiRes = await askAI(messages, keyStatus.res, options);

    // Read the stream from OpenRouter...
    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();

  } catch (error) {
    console.error("Chat API error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});


app.post('/api/test', async (req, res) => {

  const { APIkey, userId } = req.body
  const cleanKey = APIkey?.trim()
  if (!cleanKey) {
    return res.status(400).json({ type: "error", response: "API Key is required." });
  }


  try {
    // Test using full fallback chain — succeeds as long as any model is available
    const aiRes = await askAI([{ role: "user", content: "Say hello in one sentence." }], cleanKey, {
      models: FREE_MODELS,
      systemPrompt: "You are a helpful assistant. Answer concisely."
    })

    // We must parse the JSON for the test verification
    const answer = await aiRes.json();

    if (answer.error || !answer.choices?.[0]?.message?.content) {
      console.log("API key test failed, check your terminal for the Full OpenRouter Error Response!");
      return res.json({
        response: `⚠️ AI Service Error: ${answer.error?.message || "Provider rejected the request."}`,
        type: "error"
      });
    } else {



      const encryptedKey = encrypt(cleanKey)
      await saveUserKey(encryptedKey, userId)


      res.json({
        response: "ok",
        type: "success"
      });

    }




  } catch (error) {
    console.error("Error during API key test:", error);
    res.status(500).json({
      response: "⚠️ Internal server error while trying to validate key.",
      type: "error"
    });
  }

})


app.get('/', (_, res) => {
  res.json({ message: "Welcome to chatForge " })
})


// check if the user have key in database 

app.post("/api/key-exists", async (request, res) => {

  const { userId } = request.body

  const keystatus = await check_key_Exists(userId)

  // if(keystatus.exists && keystatus.res.length>0){
  //   res.json(keystatus)
  // }else{
  //   res.json(keystatus)
  // }

  res.json(keystatus)

})




export default app;





async function startServer() {
  try {
    await connectDB();
    app.listen(5000, () => console.log("Server running on port 5000"));
  } catch (err) {
    console.error("Failed to start server due to DB connection error:", err);
    // Exit process if DB not connected
    process.exit(1);
  }
}

startServer();