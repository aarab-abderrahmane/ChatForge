import { useEffect, useState, useRef, useContext, useCallback } from "react";
import "./index.css";

import { Terminal } from "./components/features/Terminal";
import { DocsPage } from "./pages/DocsPage";
import { WorkspaceDashboard } from "./pages/WorkspaceDashboard";
import { WorkspaceView } from "./pages/WorkspaceView";
import { chatsContext, SKILLS, MODELS, THEMES } from "./context/chatsContext";
import { WorkspaceContext } from "./context/workspaceContext";
import { api } from "./services/api";
import { ContextBuilder } from "./services/contextBuilder";
import { ConversationsService } from "./services/db";



function App() {
  const [query, setQuery] = useState("");

  const {
    chats,
    setChats,
    loading,
    setLoading,
    preferences,
    setPreferences,
    settings,
    setSettings,
    customSkills,
    sessions,
    updateSessionSummary,
    updateSessionRoute,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    renameSession,
    providerStatus,
  } = useContext(chatsContext) || {};

  const { activeWorkspace, updateWorkspace } = useContext(WorkspaceContext);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const streamCountRef = useRef(0);
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

  // ── Session Isolation: Sync General Session ID ──────────────────
  useEffect(() => {
    if (preferences.currentPage === "chat" && activeSessionId && activeSessionId !== preferences.lastGeneralSessionId) {
      setPreferences(prev => ({ ...prev, lastGeneralSessionId: activeSessionId }));
    }
  }, [preferences.currentPage, activeSessionId, preferences.lastGeneralSessionId, setPreferences]);

  // ── Session Isolation: Switcher ────────────────────────────────
  useEffect(() => {
    if (preferences.currentPage === "workspace_view" && activeWorkspace) {
      if (!activeWorkspace.sessionId) {
        // Create a dedicated session for this workspace
        const newSid = createNewSession();
        renameSession(newSid, `[Workspace] ${activeWorkspace.name}`);
        updateWorkspace(activeWorkspace.id, { sessionId: newSid });
      } else if (activeSessionId !== activeWorkspace.sessionId) {
        // Switch to the workspace's session
        setActiveSessionId(activeWorkspace.sessionId);
      }
    } else if (preferences.currentPage === "chat") {
      const targetId = preferences.lastGeneralSessionId;
      if (targetId && activeSessionId !== targetId) {
        // Restore the general session
        setActiveSessionId(targetId);
      }
    }
  }, [
    preferences.currentPage,
    activeWorkspace?.id,
    activeWorkspace?.sessionId,
    activeSessionId,
    createNewSession,
    renameSession,
    updateWorkspace,
    setActiveSessionId,
    preferences.lastGeneralSessionId
  ]);

  // ── Core AI call ────────────────────────────────────────────
  async function startStream(question, id, skillId, draftIndex, signal) {
    streamCountRef.current += 1;
    setLoading(true);

    const activeSkill = allSkills.find((s) => s.id === skillId) || SKILLS[0];
    const activeModelId = settings.activeModelId || "meta-llama/llama-3.3-70b-instruct:free";

    const basePrompt = activeSkill?.systemPrompt || "You are a helpful assistant.";
    const prefix = settings.systemPromptPrefix?.trim();
    const isContinuationMsg = question.toLowerCase().includes("continue writing from where you left off") ||
      (question.length < 30 && ["continue", "keep going", "استمر", "كمل"].some(kw => question.toLowerCase().includes(kw)));

    const session = sessions.find(s => s.id === activeSessionId) || { messages: chats, summary: "" };

    // Only inject workspace context if the user is actually IN the workspace view
    const projectContext = preferences.currentPage === "workspace_view" ? activeWorkspace : null;

    const { messages: contextMessages, systemPrompt: contextSystemPrompt, summaryUpdateNeeded } = await ContextBuilder.build(chats, projectContext, session.summary, question);

    // Model Consistency & Locking
    let finalRoutingMode = settings.routingMode || "smart";
    if (finalRoutingMode === "smart") {
      // If the session already has a locked route, verify the provider still has a key
      if (session.routingMode) {
        const lockedProvider = session.routingMode;
        // Only honor the lock if the provider actually has a key
        if (providerStatus[lockedProvider]) {
          finalRoutingMode = lockedProvider;
        } else {
          // The locked provider has no key — revert to smart and find one that works
          finalRoutingMode = ContextBuilder.route(question, providerStatus);
          // Re-lock to the new valid provider
          updateSessionRoute(activeSessionId, finalRoutingMode);
        }
      } else {
        // No lock yet — calculate and lock to a provider that actually has a key
        finalRoutingMode = ContextBuilder.route(question, providerStatus);
        // Only lock if we found a real provider (don't lock to unavailable ones)
        if (providerStatus[finalRoutingMode] || finalRoutingMode === "openrouter") {
          updateSessionRoute(activeSessionId, finalRoutingMode);
        }
      }
    }

    // Determine if it's a code task for max_tokens & skill isolation
    const isCodeTask = finalRoutingMode === "openrouter" || finalRoutingMode === "gemini";
    const maxTokens = isCodeTask ? 4096 : (settings.maxTokens || 1024);

    // Skill Isolation: If it's a code task, force the "Code Master" identity for stability
    let finalSystemPrompt = (prefix ? `${contextSystemPrompt}\n\n[User context]: ${prefix}` : contextSystemPrompt) || basePrompt;
    if (isCodeTask) {
      const codeSkill = SKILLS.find(s => s.id === "code");
      finalSystemPrompt = `MODAL IDENTITY: ${codeSkill.systemPrompt}\n\n${finalSystemPrompt}`;
    }

    if (isContinuationMsg) {
      finalSystemPrompt += "\n\nCRITICAL: The user wants you to CONTINUE exactly from where you stopped. Do NOT repeat anything you already wrote. Do NOT start from the beginning. Simply provide the next part of the code or text.";
    }

    // Slightly bump temperature to ensure varied alternatives if draftIndex > 0
    const draftTemp = draftIndex > 0 ? Math.min((settings.temperature || 0.7) + (draftIndex * 0.15), 1.5) : (settings.temperature || 0.7);

    try {
      const response = await api.chat(
        preferences.userId,
        contextMessages,
        finalSystemPrompt,
        activeModelId,
        {
          temperature: draftTemp,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          max_tokens: maxTokens,
          routingMode: finalRoutingMode,
        },
        signal
      );

      if (!response.ok) throw new Error("Failed to connect to AI service.");

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

            // Capture provider badge from final server event
            if (data.done && data.provider) {
              setChats((prev) =>
                prev.map((obj) =>
                  obj.id === id ? { ...obj, provider: data.provider } : obj
                )
              );
              continue;
            }

            // Error event
            if (data.error) throw new Error(data.error);

            // Handle content chunks
            const choice = data.choices?.[0];
            const content = choice?.delta?.content || choice?.message?.content || "";
            const finishReason = choice?.finish_reason || data.candidates?.[0]?.finishReason;

            if (content) {
              fullContent += content;
              setChats((prev) =>
                prev.map((obj) => {
                  if (obj.id === id) {
                    if (draftIndex >= 0) {
                      const newAnsws = [...(obj.answers || [])];
                      newAnsws[draftIndex] = fullContent;
                      return { ...obj, answers: newAnsws, isMulti: true };
                    }
                    return { ...obj, answer: fullContent };
                  }
                  return obj;
                })
              );
            }

            // Detect truncation
            if (finishReason === "length" || finishReason === "MAX_TOKENS") {
              setChats((prev) =>
                prev.map((obj) => (obj.id === id ? { ...obj, isTruncated: true } : obj))
              );
            }
          } catch {
            // Ignore parse errors from non-JSON or partial lines
          }
        }
      }

      // After successful completion, check if summary update is needed
      if (summaryUpdateNeeded && !draftIndex) {
        ContextBuilder.summarize(preferences.userId, chats, session.summary).then(newSummary => {
          if (newSummary && newSummary !== session.summary) {
            updateSessionSummary(id, newSummary);
          }
        });
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("AI stream error:", error);
        let errMsg = error.message || "Connection lost.";
        const lowerErr = errMsg.toLowerCase();

        if (lowerErr.includes("no endpoints") || lowerErr.includes("at capacity") || lowerErr.includes("429")) {
          errMsg = "⚠️ AI models are currently rate-limited. Please wait 10-20 seconds and try again, or switch models in Settings (⚙️).";
        } else if (lowerErr.includes("fetch failed") || lowerErr.includes("getaddrinfo")) {
          errMsg = "🌐 Network Error: Unable to reach OpenRouter. This is usually a temporary DNS or internet issue.";
        }

        setChats((prev) =>
          prev.map((obj) => {
            if (obj.id === id) {
              if (draftIndex >= 0) {
                const newAnsws = [...(obj.answers || [])];
                newAnsws[draftIndex] = `[Error] ${errMsg}`;
                return { ...obj, answers: newAnsws, isMulti: true, type: "error" };
              }
              return { ...obj, type: "error", answer: errMsg };
            }
            return obj;
          })
        );
      }
    } finally {
      streamCountRef.current -= 1;
      if (streamCountRef.current <= 0) {
        streamCountRef.current = 0;
        setLoading(false);
      }
    }
  }

  async function askAI(question, id, overrideSkillId = null, draftCount = 1) {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    streamCountRef.current = 0;

    if (draftCount > 1) {
      setChats((prev) =>
        prev.map((obj) =>
          obj.id === id ? { ...obj, isMulti: true, answers: Array(draftCount).fill("") } : obj
        )
      );
      for (let i = 0; i < draftCount; i++) {
        startStream(question, id, overrideSkillId, i, abortControllerRef.current.signal);
      }
    } else {
      startStream(question, id, overrideSkillId, -1, abortControllerRef.current.signal);
    }
  }

  // ── Stop AI handler ─────────────────────────────────────────
  const handleStopAI = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);

      // Find the last user message and restore it to input
      setChats((prev) => {
        const lastMsg = [...prev].reverse().find((m) => m.type === "ch");
        if (lastMsg) {
          setQuery(lastMsg.question);
          return prev.filter((m) => m.id !== lastMsg.id);
        }
        return prev;
      });
    }
  }, [setLoading, setChats, setQuery]);

  // ── Retry handler ────────────────────────────────────────────
  const handleRetry = (question, id) => {
    const msg = chats.find((c) => c.id === id);
    if (!msg) return;
    askAI(question, id, msg.skillId, msg.isMulti ? msg.answers?.length : 1);
  };

  const handleContinue = (id) => {
    const msg = chats.find((c) => c.id === id);
    if (!msg) return;

    // Remove isTruncated flag before retrying
    setChats((prev) =>
      prev.map((obj) => (obj.id === id ? { ...obj, isTruncated: false } : obj))
    );

    // Send a "continue" prompt
    askAI("Continue writing from where you left off. Do not repeat what you already wrote.", id, msg.skillId, msg.isMulti ? msg.answers?.length : 1);
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
    if (cmd === "//> new" || cmd === "//>new") {
      return { action: "clear" };
    }
    if (cmd === "//> help" || cmd === "//>help") {
      return {
        question: `List all available ChatForge commands and keyboard shortcuts in a formatted markdown table. Include: //>clear, //>new, //>summarize, //>translate, //>retry, //>stats, //>export, //>help, //>skill, //>model, //>quiz [topic], //>flashcards [topic], and //>mindmap [topic]. Also mention: Enter to send, Shift+Enter for newline.`,
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

    if (cmd.startsWith("//> flashcards ") || cmd.startsWith("//>flashcards ")) {
      const topic = text.substring(text.indexOf("flashcards") + 10).trim();
      return {
        question: `Generate a set of 5 interactive flashcards about: ${topic}. Format your response exactly as JSON using THIS STRICT STRUCTURE:
\`\`\`flashcards
{
  "topic": "${topic}",
  "cards": [
    {
      "front": "Term or Question",
      "back": "Definition or Answer"
    }
  ]
}
\`\`\`
Provide ONLY this JSON block. Do not include any other text.`,
        skillId: "general",
      };
    }

    if (cmd.startsWith("//> mindmap ") || cmd.startsWith("//>mindmap ")) {
      const topic = text.substring(text.indexOf("mindmap") + 7).trim();
      return {
        question: `Create a structured mindmap for the topic "${topic}".
Output ONLY a valid JSON object wrapped in \`\`\`mindmap code blocks.
Structure:
{
  "label": "Topic Name",
  "children": [
    { "label": "Subtopic 1", "children": [...] },
    { "label": "Subtopic 2", "children": [] }
  ]
}
No preamble, no extra text.`,
        skillId: "general",
      };
    }

    return null;
  };

  // ── Send handler ─────────────────────────────────────────────
  const handleSend = (e, draftCount = 1) => {
    const newId = new Date();
    const text = (e.target?.value ?? e.target?.innerText ?? query).trim();
    if (!text) return;

    // Check if it's a //> command that maps to an AI call
    if (text.startsWith("//>")) {
      const transformed = transformCommand(text);
      if (transformed) {
        if (transformed.action === "clear") {
          setChats([]);
          return;
        }
        const displayQuestion = text; // Show the command as typed
        const newMsg = {
          id: newId,
          type: "ch",
          question: displayQuestion,
          answer: undefined,
          answers: draftCount > 1 ? Array(draftCount).fill("") : undefined,
          isMulti: draftCount > 1,
          timestamp: new Date().toISOString(),
        };
        setChats((prev) => [...prev, newMsg]);
        askAI(transformed.question, newId, transformed.skillId, draftCount);
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
      answers: draftCount > 1 ? Array(draftCount).fill("") : undefined,
      isMulti: draftCount > 1,
      timestamp: new Date().toISOString(),
    };

    setChats((prev) => [...prev, newMsg]);

    // Intelligent continuation detection
    const lowerText = text.toLowerCase().trim();
    if (lowerText === "continue" || lowerText === "استمر" || lowerText === "كمل" || lowerText === "continue code") {
      askAI("Continue writing from where you left off. Do not repeat what you already wrote. Finish the code.", newId, null, draftCount);
    } else {
      askAI(text, newId, null, draftCount);
    }
  };

  const handleMergeDrafts = (msgId, indices) => {
    const msg = chats.find(c => c.id === msgId);
    if (!msg) return;
    const selected = indices.map(i => msg.answers[i]).join("\n\n---\n\n");
    setQuery(`Merge and synthesize the following drafts into ONE cohesive and unified response. Extract the best ideas from each:\n\n${selected}`);
  };

  const handleSummarizeDrafts = (msgId, indices) => {
    const msg = chats.find(c => c.id === msgId);
    if (!msg) return;
    const selected = indices.map(i => msg.answers[i]).join("\n\n---\n\n");
    setQuery(`Summarize the key differences and insights from these alternate drafts:\n\n${selected}`);
  };

  const handleKeepDraft = (msgId, index) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === msgId && c.isMulti) {
          return {
            ...c,
            isMulti: false,
            answer: c.answers[index],
            answers: undefined,
          };
        }
        return c;
      })
    );
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
      <div className={`relative z-10 w-screen h-screen ${preferences.currentPage === "workspaces" ? "overflow-scroll" : ""} `}>
        {preferences.currentPage === "docs" ? (
          <div className="w-full h-full"><DocsPage /></div>
        ) : preferences.currentPage === "workspaces" ? (
          <div className="w-full h-full ">
            <WorkspaceDashboard
              onOpenWorkspace={(id) => setPreferences({ ...preferences, currentPage: "workspace_view", activeWorkspaceId: id })}
            />
          </div>
        ) : preferences.currentPage === "workspace_view" ? (
          <div className="w-full h-full">
            <WorkspaceView
              onBack={() => setPreferences({ ...preferences, currentPage: "workspaces" })}
            />
          </div>
        ) : (
          <div className="w-full h-full flex justify-center items-center">
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
              onStopAI={handleStopAI}
              onMergeDrafts={handleMergeDrafts}
              onSummarizeDrafts={handleSummarizeDrafts}
              onKeepDraft={handleKeepDraft}
              onContinue={handleContinue}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default App;
