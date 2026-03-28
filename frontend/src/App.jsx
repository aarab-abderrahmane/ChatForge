import { useEffect, useState, useRef, useContext } from "react";
import "./index.css";

import { Terminal } from "./components/features/Terminal";
import { chatsContext, SKILLS } from "./context/chatsContext";
import { MultiStepLoader as Loader } from "./components/ui/multi-step-loader";
import { api } from "./services/api";

const loadingStates = [
  { text: "Initializing ChatForge AI..." },
  { text: "Warming up neural networks..." },
  { text: "Scanning your query..." },
  { text: "Generating insights..." },
  { text: "Synthesizing answers..." },
  { text: "Polishing responses..." },
  { text: "Almost ready..." },
  { text: "ChatForge AI is online!" },
];

function App() {
  const [query, setQuery] = useState("");
  const [stepLoader, setStepLoader] = useState(true);

  const {
    chats,
    setChats,
    loading,
    setLoading,
    preferences,
    settings,
  } = useContext(chatsContext);

  const messagesEndRef = useRef(null);
  const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  // Apply font setting to body
  useEffect(() => {
    document.body.style.fontFamily =
      settings.font === "jetbrains"
        ? "'JetBrains Mono', monospace"
        : "'Fira Code', monospace";
  }, [settings.font]);

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

  // Build clean history array for context
  const historyMessages = chats
    .filter((c) => c.type === "ch" && c.answer)
    .slice(-10)
    .flatMap((obj) => [
      { role: "user", content: obj.question },
      { role: "assistant", content: obj.answer },
    ]);

  // ── Core AI call ────────────────────────────────────────────
  async function askAI(question, id) {
    setLoading(true);
    
    // Find active skill and model info
    const activeSkill = SKILLS?.find(s => s.id === settings.activeSkillId) || SKILLS?.[0];
    const activeModelId = settings.activeModelId || "deepseek/deepseek-chat:free";

    const messages = [
      ...historyMessages,
      { role: "user", content: question }
    ];

    try {
      const response = await api.chat(
        preferences.userId, 
        messages, 
        activeSkill?.systemPrompt,
        activeModelId
      );

      if (!response.ok) {
        throw new Error("Failed to connect to AI service.");
      }

      setLoading(false); // Stop 'thinking' spinner once first chunk arrives

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = ""; // Persistence buffer for fragmented chunks

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Split by double newline (standard SSE separator) OR single newline
        const lines = buffer.split("\n");
        
        // Keep the last (potentially incomplete) line in the buffer
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
            // Fragmented JSON - this shouldn't happen with the line-splitting but good to be safe
            // console.warn("Failed to parse SSE data chunk", e);
          }
        }
      }
    } catch (error) {
      console.error("AI stream error:", error);
      setLoading(false);
      setChats((prev) =>
        prev.map((obj) =>
          obj.id === id
            ? {
                ...obj,
                type: "error",
                answer: `⚠️ Error: ${error.message || "Connection lost."}`,
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

  // ── Send handler ─────────────────────────────────────────────
  const handleSend = (e) => {
    const newId = new Date();
    const text = (e.target?.value ?? e.target?.innerText ?? query).trim();
    if (!text) return;

    if (text.startsWith("//>")) return; // Don't send commands to AI

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
        className={`scan-lines fixed inset-0 pointer-events-none z-[9999] ${
          settings.scanlines ? "" : "scanlines-off"
        }`}
      />

      {/* Boot loader */}
      <Loader
        loadingStates={loadingStates}
        loading={stepLoader}
        setStepLoader={setStepLoader}
        duration={900}
      />

      {/* Main app */}
      <div className="relative z-10 min-h-screen flex justify-center items-center w-screen p-2 md:p-4">
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
      </div>
    </>
  );
}

export default App;
