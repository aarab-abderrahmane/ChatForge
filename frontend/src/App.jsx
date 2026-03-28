import { useEffect, useState, useRef, useContext, useCallback } from "react";
import "./index.css";

import { Terminal } from "./components/features/Terminal";
import { DocsPage } from "./pages/DocsPage";
import { chatsContext, SKILLS, MODELS, THEMES } from "./context/chatsContext";
import { api } from "./services/api";



function App() {
  const [query, setQuery] = useState("");

  const {
    chats,
    setChats,
    loading,
    setLoading,
    preferences,
    settings,
    setSettings,
    customSkills,
  } = useContext(chatsContext);

  const messagesEndRef = useRef(null);
  const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });

  // All skills (built-in + custom)
  const allSkills = [...SKILLS, ...(customSkills || [])];

  // Auto-scroll to bottom on new messages (respects autoScroll setting)
  useEffect(() => {
    if (settings.autoScroll !== false) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats, settings.autoScroll]);

  // Apply font + font-size settings to body
  useEffect(() => {
    const fontMap = {
      jetbrains: "'JetBrains Mono', monospace",
      cascadia: "'Cascadia Code', 'Fira Code', monospace",
      fira: "'Fira Code', monospace",
    };
    document.body.style.fontFamily = fontMap[settings.font] || fontMap.fira;
    document.documentElement.style.setProperty(
      "--terminal-font-size",
      `${settings.fontSize || 14}px`
    );
  }, [settings.font, settings.fontSize]);

  // Sync theme colors with CSS variables
  useEffect(() => {
    const root = document.documentElement;
    let theme = THEMES.find((t) => t.id === settings.theme) || THEMES[0];

    // If custom theme, override with user-defined colors
    if (settings.theme === "custom" && settings.customTheme) {
      theme = { ...theme, ...settings.customTheme };
    }

    root.style.setProperty("--theme-primary", theme.primary);
    root.style.setProperty("--theme-secondary", theme.secondary);
    root.style.setProperty("--theme-accent", theme.accent);
  }, [settings.theme, settings.customTheme]);

  // Keyboard sounds
  useEffect(() => {
    if (!settings.sounds) return;
    const handleKey = (e) => {
      if (e.key.length === 1 || e.key === "Backspace") {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800 + Math.random() * 200;
        osc.type = "square";
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.04);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [settings.sounds]);

  // Listen for //> stats event from Terminal
  useEffect(() => {
    const handleStats = (e) => {
      setChats((prev) => [
        ...prev,
        { type: "ms", content: e.detail.statsMsg },
      ]);
    };
    window.addEventListener("chatforge:stats", handleStats);
    return () => window.removeEventListener("chatforge:stats", handleStats);
  }, [setChats]);

  // Build clean history array for context
  const historyMessages = chats
    .filter((c) => c.type === "ch" && c.answer)
    .slice(-10)
    .flatMap((obj) => [
      { role: "user", content: obj.question },
      { role: "assistant", content: obj.answer },
    ]);

  // ── Core AI call ────────────────────────────────────────────
  async function askAI(question, id, overrideSkillId = null) {
    setLoading(true);

    // Find active skill (including custom skills)
    const skillId = overrideSkillId || settings.activeSkillId;
    const activeSkill = allSkills.find((s) => s.id === skillId) || SKILLS[0];
    const activeModelId = settings.activeModelId || "meta-llama/llama-3.3-70b-instruct:free";

    // Build system prompt (skill + optional prefix)
    const basePrompt = activeSkill?.systemPrompt || "You are a helpful assistant.";
    const prefix = settings.systemPromptPrefix?.trim();
    const fullSystemPrompt = prefix ? `${basePrompt}\n\n[User context]: ${prefix}` : basePrompt;

    // Response length instruction
    const lengthInstruction =
      settings.responseLength === "short" ? " Be concise and brief in your response."
        : settings.responseLength === "detailed" ? " Provide a thorough and detailed response."
          : "";

    const messages = [
      ...historyMessages,
      { role: "user", content: question + lengthInstruction },
    ];

    try {
      const response = await api.chat(
        preferences.userId,
        messages,
        fullSystemPrompt,
        activeModelId,
        {
          temperature: settings.temperature,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          max_tokens: settings.maxTokens
        }
      );

      if (!response.ok) {
        throw new Error("Failed to connect to AI service.");
      }

      setLoading(false);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              setChats((prev) =>
                prev.map((obj) =>
                  obj.id === id ? { ...obj, answer: fullContent } : obj
                )
              );
            }
          } catch (e) {
            // Fragmented JSON - ignore
          }
        }
      }
    } catch (error) {
      console.error("AI stream error:", error);
      setLoading(false);

      let errMsg = error.message || "Connection lost.";
      if (
        errMsg.toLowerCase().includes("no endpoints") ||
        errMsg.toLowerCase().includes("at capacity") ||
        errMsg.toLowerCase().includes("all ai models")
      ) {
        errMsg =
          "⚠️ All AI models are currently rate-limited. Please wait a moment and try again, or switch models in Settings (⚙️).";
      }

      setChats((prev) =>
        prev.map((obj) =>
          obj.id === id
            ? {
              ...obj,
              type: "error",
              answer: errMsg,
            }
            : obj
        )
      );
    }
  }

  // ── Retry handler ────────────────────────────────────────────
  const handleRetry = (question, id) => {
    setChats((prev) =>
      prev.map((obj) =>
        obj.id === id ? { ...obj, type: "ch", answer: undefined } : obj
      )
    );
    askAI(question, id);
  };

  // ── Transform //> commands into AI requests ──────────────────
  const transformCommand = (text) => {
    const cmd = text.trim().toLowerCase();

    if (cmd === "//> summarize" || cmd === "//>summarize") {
      return {
        question: "Please summarize our entire conversation so far in clear bullet points, highlighting the key topics, decisions, and conclusions.",
        skillId: "summarizer",
      };
    }
    if (cmd === "//> translate" || cmd === "//>translate") {
      return {
        question: "I'd like to use you as a translator. Please tell me: what would you like me to translate, and into which language?",
        skillId: "translator",
      };
    }
    if (cmd === "//> help" || cmd === "//>help") {
      return {
        question: `List all available ChatForge commands and keyboard shortcuts in a formatted markdown table. Include: //>clear, //>new, //>summarize, //>translate, //>retry, //>stats, //>export, //>help, //>skill, //>model, and //>quiz [topic]. Also mention: Enter to send, Shift+Enter for newline.`,
        skillId: "general",
      };
    }
    if (cmd === "//> skill" || cmd === "//>skill") {
      const skillId = settings.activeSkillId;
      const skill = allSkills.find((s) => s.id === skillId) || SKILLS[0];
      return {
        question: `Tell me about your current persona: you are "${skill.name}" (${skill.icon}). Briefly describe what you specialize in and give 3 example prompts that best demonstrate your capabilities.`,
        skillId: skillId,
      };
    }
    if (cmd === "//> model" || cmd === "//>model") {
      const model = MODELS.find((m) => m.id === settings.activeModelId) || MODELS[0];
      return {
        question: `You are currently running as "${model.name}" by ${model.provider}. Briefly introduce yourself: your strengths, ideal use cases, and one fun fact about your architecture.`,
        skillId: "general",
      };
    }

    if (cmd.startsWith("//> quiz ") || cmd.startsWith("//>quiz ")) {
      const topic = text.substring(text.indexOf("quiz") + 4).trim();
      return {
        question: `Generate a multiple choice quiz about: ${topic}. Format your response exactly as JSON using THIS STRICT STRUCTURE:
\`\`\`quiz
{
  "topic": "${topic}",
  "questions": [
    {
      "q": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0 
    }
  ]
}
\`\`\`
Provide ONLY this JSON block. Do not include any other text.`,
        skillId: "general",
      };
    }

    return null;
  };

  // ── Send handler ─────────────────────────────────────────────
  const handleSend = (e) => {
    const newId = new Date();
    const text = (e.target?.value ?? e.target?.innerText ?? query).trim();
    if (!text) return;

    // Check if it's a //> command that maps to an AI call
    if (text.startsWith("//>")) {
      const transformed = transformCommand(text);
      if (transformed) {
        const displayQuestion = text; // Show the command as typed
        const newMsg = {
          id: newId,
          type: "ch",
          question: displayQuestion,
          answer: undefined,
          timestamp: new Date().toISOString(),
        };
        setChats((prev) => [...prev, newMsg]);
        askAI(transformed.question, newId, transformed.skillId);
        return;
      }
      // Unknown //>command — don't send to AI
      return;
    }

    const newMsg = {
      id: newId,
      type: "ch",
      question: text,
      answer: undefined,
      timestamp: new Date().toISOString(),
    };

    setChats((prev) => [...prev, newMsg]);
    askAI(text, newId);
  };

  // ── Copy to clipboard ────────────────────────────────────────
  const copyToClipboard = async (idMes) => {
    const targetMes = chats.find((ch) => ch.type === "ch" && ch.id === idMes);
    if (!targetMes?.answer) return;

    if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
      console.error("Clipboard API not available");
      return;
    }

    try {
      await navigator.clipboard.writeText(targetMes.answer);
      setIsCopied({ idMes, state: true });
      setTimeout(
        () => setIsCopied((prev) => ({ ...prev, state: false })),
        2000
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      {/* Background grid layer */}
      <div className="bg-grid" />

      {/* Scanlines */}
      <div
        className={`scan-lines fixed inset-0 pointer-events-none z-[9999] ${settings.scanlines ? "" : "scanlines-off"
          }`}
      />

      {/* Main app */}
      <div className="relative z-10 w-screen h-screen flex justify-center items-center">
        {preferences.currentPage === "docs" ? (
          <DocsPage />
        ) : (
          <Terminal
            copyToClipboard={copyToClipboard}
            isCopied={isCopied}
            chats={chats}
            handleSend={handleSend}
            loading={loading}
            query={query}
            setQuery={setQuery}
            messagesEndRef={messagesEndRef}
            onRetry={handleRetry}
          />
        )}
      </div>
    </>
  );
}

export default App;
