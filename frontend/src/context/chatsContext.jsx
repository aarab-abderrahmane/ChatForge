import { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { ConversationsService, KeysService } from "../services/db";

export const chatsContext = createContext();

const check_key_exists = async (setPreferences, preferences) => {
  // Check if any provider key exists in IndexedDB (frontend-centric)
  const status = await KeysService.getStatus();
  const hasAnyKey = status.openrouter || status.groq || status.gemini || status.huggingface;
  if (hasAnyKey) {
    setPreferences((prev) => ({ ...prev, currentPage: "chat" }));
  } else {
    setPreferences((prev) => ({ ...prev, currentPage: "guide" }));
  }
};

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (HTTP)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const WELCOME_MESSAGES = [
  {
    type: "ms",
    content: [
      "👋 Welcome to ChatForge! Here's how you can get started",
      "💡 Type //> in the input to see all available AI commands",
    ],
  },
  {
    type: "ch",
    id: 1,
    question: "Who is the author of this website?",
    answer: "Abderrahmane Aarab",
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    type: "ch",
    question: "How can I generate a short summary of my chat history?",
    answer: "Simply type `//>summarize` and the AI will summarize the conversation.",
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    type: "ch",
    question: "Can I create my own custom AI skills?",
    answer: "Yes! Open Settings (⚙️) → scroll to Custom Skills → click 'New Skill' to define your own AI persona with a custom system prompt.",
    timestamp: new Date().toISOString(),
  },
];

export const SKILLS = [
  {
    id: "general",
    name: "General",
    icon: "🤖",
    description: "Balanced for general tasks and conversation.",
    systemPrompt:
      "You are ChatForge AI, a helpful and intelligent assistant. Provide clear, accurate, and helpful responses. Use Markdown for formatting when appropriate. If the user asks for a flowchart or diagram, use Mermaid syntax correctly.",
  },
  {
    id: "code",
    name: "Code Master",
    icon: "💻",
    description: "Expert in 50+ languages and debugging.",
    systemPrompt:
      "You are an expert software engineer and code mentor. Your tone is technical and precise. Always explain code logic, follow best practices, and use proper Markdown code blocks with language labels. For complex logic, provide Mermaid flowcharts when helpful.",
  },
  {
    id: "creative",
    name: "Creative",
    icon: "✍️",
    description: "Unleash imagination and storytelling.",
    systemPrompt:
      "You are a creative writing companion. Your tone is expressive, evocative, and imaginative. Help with storytelling, poetry, scripts, and creative ideas. Use rich Markdown formatting to enhance the reading experience.",
  },
  {
    id: "security",
    name: "Cyber Security",
    icon: "🛡️",
    description: "Specialized in security and audit tasks.",
    systemPrompt:
      "You are a cyber security expert. You speak in a professional, security-conscious manner. When analyzing code or requests, look for vulnerabilities (OWASP Top 10), suggest remediations, and explain security concepts clearly. Maintain a high-integrity 'white hat' persona.",
  },
  {
    id: "translator",
    name: "Translator",
    icon: "🌍",
    description: "Expert multilingual translator for any language.",
    systemPrompt:
      "You are an expert multilingual translator. When given text, detect its language and translate it as requested. If no target language is specified, translate to English. Provide the translation clearly, and optionally note cultural nuances or alternative phrasings. Be concise and accurate.",
  },
  {
    id: "summarizer",
    name: "Summarizer",
    icon: "📋",
    description: "Condenses content into clear bullet-point summaries.",
    systemPrompt:
      "You are a professional summarizer and analyst. When given text or a conversation, extract the key points, decisions, and action items into clear, concise bullet points. Structure your summary with: **Key Points**, **Details**, and **Conclusion** sections. Be brief but comprehensive.",
  },
];

// All currently-live free models on OpenRouter (verified March 2026)
export const MODELS = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    provider: "Meta",
    icon: "🦙",
    description: "Powerful open-source reasoning model. Primary recommendation.",
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small",
    provider: "Mistral",
    icon: "🌪️",
    description: "Fast and efficient European model. Great for general tasks.",
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-405b:free",
    name: "Hermes 3 405B",
    provider: "Nous",
    icon: "🏛️",
    description: "Massive 405B model. Best for complex reasoning.",
  },
  {
    id: "meta-llama/llama-3.1-405b-instruct:free",
    name: "Llama 3.1 405B",
    provider: "Meta",
    icon: "🦙",
    description: "Meta's largest open model. Excellent for hard problems.",
  },
  {
    id: "stepfun/step-3.5-flash:free",
    name: "Step 3.5 Flash",
    provider: "StepFun",
    icon: "⚡",
    description: "Ultra-fast Chinese model. Great for quick responses.",
  },
  {
    id: "arcee-ai/trinity-large-preview:free",
    name: "Trinity Large",
    provider: "Arcee",
    icon: "🔱",
    description: "Arcee's large preview model. Diverse capabilities.",
  },
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    name: "Llama 3.2 3B",
    provider: "Meta",
    icon: "🐇",
    description: "Tiny but fast. Best for simple, quick queries.",
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B v0.3",
    provider: "HuggingFace",
    icon: "🤗",
    description: "Efficient and capable model from Hugging Face.",
  },
  {
    id: "google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    provider: "HuggingFace",
    icon: "💎",
    description: "Google's lightweight, state-of-the-art model.",
  },
];

// ── Default AI Tools ────────────────────────────────────────────
export const DEFAULT_AI_TOOLS = [
  { id: "improve", label: "Improve", icon: "✨", prompt: "Improve and polish this text: " },
  { id: "explain", label: "Explain", icon: "💡", prompt: "Explain this concept in simple terms: " },
  { id: "grammar", label: "Fix Grammar", icon: "📝", prompt: "Fix the grammar and spelling: " },
  { id: "proTone", label: "Pro Tone", icon: "💼", prompt: "Rewrite in a professional tone: " },
  { id: "debug", label: "Debug", icon: "🐛", prompt: "Help me debug this code: " },
  { id: "writecode", label: "Write Code", icon: "💻", prompt: "Write code for: " },
  { id: "analyze", label: "Analyze", icon: "📊", prompt: "Analyze this data and provide insights: " },
  { id: "clear", label: "Clear Context", icon: "🗑️", cmd: "//>clear" },
  { id: "stats", label: "Session Stats", icon: "📈", cmd: "//>stats" },
];

// ── Themes ──────────────────────────────────────────────────────
export const THEMES = [
  {
    id: "green",
    name: "Matrix Green",
    icon: "🟢",
    primary: "#39ff14",
    secondary: "#00f5ff",
    accent: "#ff2d78",
  },
  {
    id: "cyan",
    name: "Cyber Cyan",
    icon: "🔵",
    primary: "#00f5ff",
    secondary: "#7b2fff",
    accent: "#ff6b35",
  },
  {
    id: "amber",
    name: "Solar Amber",
    icon: "🟡",
    primary: "#ffd700",
    secondary: "#ff8c00",
    accent: "#ff2d78",
  },
  {
    id: "purple",
    name: "Void Purple",
    icon: "🟣",
    primary: "#b44fff",
    secondary: "#00f5ff",
    accent: "#ff2d78",
  },
  {
    id: "red",
    name: "Crimson Edge",
    icon: "🔴",
    primary: "#ff3b5c",
    secondary: "#ff8c00",
    accent: "#00f5ff",
  },
  {
    id: "custom",
    name: "Custom",
    icon: "🎨",
    primary: "#39ff14",
    secondary: "#00f5ff",
    accent: "#ff2d78",
  },
];

const DEFAULT_MODEL_ID = "meta-llama/llama-3.3-70b-instruct:free";

const defaultSettings = {
  scanlines: true,
  font: "fira",              // 'fira' | 'jetbrains' | 'cascadia'
  fontSize: 14,              // 12–18
  sounds: false,
  compactMode: false,
  showTimestamps: false,
  autoScroll: true,
  streamingIndicator: true,
  animations: true,
  showToolbar: true,
  showAvatars: false,
  showHintBar: true,
  theme: "green",            // theme id from THEMES
  customTheme: { primary: "#39ff14", secondary: "#00f5ff", accent: "#ff2d78" },
  activeSkillId: "general",
  activeModelId: DEFAULT_MODEL_ID,
  responseLength: "balanced", // 'short' | 'balanced' | 'detailed'
  temperature: 0.7,           // 0.0–1.5
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  systemPromptPrefix: "",     // appended to every skill system prompt
  routingMode: "smart",       // 'smart' | 'groq' | 'gemini' | 'openrouter'
};

export function ChatsProvider({ children }) {
  const [loading, setLoading] = useState(false);

  // ── Provider status (which AI providers are configured) ─────────────
  const [providerStatus, setProviderStatus] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false });

  // ── Preferences (userId, currentPage) ──────────────────────────────
  const defaultPreferences = {
    userId: uuid(),
    currentPage: "guide",
  };

  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem("Preferences");
      return stored ? JSON.parse(stored) : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  useEffect(() => {
    localStorage.setItem("Preferences", JSON.stringify(preferences));
  }, [preferences]);

  // ── Settings ────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_Settings");
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem("ChatForge_Settings", JSON.stringify(settings));

    // Auto-migrate any defunct model IDs to the default
    const liveModelIds = MODELS.map((m) => m.id);
    if (!liveModelIds.includes(settings.activeModelId)) {
      setSettings((prev) => ({ ...prev, activeModelId: DEFAULT_MODEL_ID }));
    }
  }, [settings]);

  // ── Custom Skills ────────────────────────────────────────────────────
  const [customSkills, setCustomSkills] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_CustomSkills");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("ChatForge_CustomSkills", JSON.stringify(customSkills));
  }, [customSkills]);

  const addCustomSkill = useCallback((skill) => {
    const newSkill = {
      id: `custom_${uuid()}`,
      name: skill.name || "My Skill",
      icon: skill.icon || "⭐",
      description: skill.description || "A custom AI skill.",
      systemPrompt: skill.systemPrompt || "You are a helpful assistant.",
      isCustom: true,
    };
    setCustomSkills((prev) => [...prev, newSkill]);
    return newSkill.id;
  }, []);

  const deleteCustomSkill = useCallback((id) => {
    setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    setSettings((prev) =>
      prev.activeSkillId === id ? { ...prev, activeSkillId: "general" } : prev
    );
  }, []);

  // ── AI Tools ─────────────────────────────────────────────────────────
  const [aiTools, setAiTools] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_AITools");
      return stored ? JSON.parse(stored) : DEFAULT_AI_TOOLS;
    } catch { return DEFAULT_AI_TOOLS; }
  });

  useEffect(() => {
    localStorage.setItem("ChatForge_AITools", JSON.stringify(aiTools));
  }, [aiTools]);

  const addAITool = useCallback((tool) => {
    const newTool = {
      id: `tool_${uuid()}`,
      label: tool.label || "Custom Tool",
      icon: tool.icon || "🔧",
      prompt: tool.prompt || "",
      cmd: tool.cmd || "",
      isCustom: true,
    };
    setAiTools((prev) => [...prev, newTool]);
    return newTool.id;
  }, []);

  const updateAITool = useCallback((id, updates) => {
    setAiTools((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteAITool = useCallback((id) => {
    setAiTools((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Pinned Sessions ─────────────────────────────────────────────────
  const [pinnedSessions, setPinnedSessions] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_Pinned");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem("ChatForge_Pinned", JSON.stringify([...pinnedSessions]));
  }, [pinnedSessions]);

  const pinSession = useCallback((id) => {
    setPinnedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Starred Messages ────────────────────────────────────────────────
  const [starredMessages, setStarredMessages] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_Starred");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem("ChatForge_Starred", JSON.stringify([...starredMessages]));
  }, [starredMessages]);

  const toggleStarMessage = useCallback((msgId) => {
    setStarredMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  // ── Prompt History ───────────────────────────────────────────────────
  const [promptHistory, setPromptHistory] = useState([]);

  const addToPromptHistory = useCallback((text) => {
    if (!text?.trim()) return;
    setPromptHistory((prev) => {
      const filtered = prev.filter((p) => p !== text);
      return [text, ...filtered].slice(0, 50);
    });
  }, []);

  // ── Sessions ────────────────────────────────────────────────────────
  const makeSession = (overrides = {}) => ({
    id: uuid(),
    title: overrides.title || "New Chat",
    messages: overrides.messages || WELCOME_MESSAGES,
    createdAt: new Date().toISOString(),
    summary: overrides.summary || "",
    routingMode: overrides.routingMode || null, // Locked routing mode for this session
    ...overrides,
  });

  const [sessions, setSessions] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_Sessions");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.length > 0 ? parsed : [makeSession()];
      }
    } catch { /* ignore */ }
    return [makeSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_ActiveSession");
      return stored || null;
    } catch {
      return null;
    }
  });

  // Ensure activeSessionId always points to a valid session
  // Load sessions from IndexedDB on mount
  useEffect(() => {
    ConversationsService.getAllConversations().then(saved => {
      if (saved && saved.length > 0) {
        setSessions(saved);
        const storedActiveId = localStorage.getItem("ChatForge_ActiveSession");
        if (storedActiveId && saved.find(s => s.id === storedActiveId)) {
          setActiveSessionId(storedActiveId);
        } else {
          setActiveSessionId(saved[0].id);
        }
      }
    });
  }, []);

  // Sync sessions to IndexedDB
  useEffect(() => {
    if (sessions.length > 0) {
      sessions.forEach(s => ConversationsService.saveConversation(s));
    }
    localStorage.setItem("ChatForge_Sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Sync activeSessionId to localStorage (still useful for UI state across tabs/reloads)
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("ChatForge_ActiveSession", activeSessionId);
    }
  }, [activeSessionId]);

  // ── Current session's chats ─────────────────────────────────────────
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const chats = activeSession?.messages || WELCOME_MESSAGES;

  const setChats = useCallback((updater) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === (activeSession?.id)
          ? {
            ...s,
            messages: typeof updater === "function" ? updater(s.messages) : updater,
            // Auto-title from first user message
            title:
              s.title === "New Chat"
                ? (() => {
                  const msgs =
                    typeof updater === "function" ? updater(s.messages) : updater;
                  const first = msgs.find((m) => m.type === "ch" && m.question);
                  return first ? first.question.slice(0, 40) : "New Chat";
                })()
                : s.title,
          }
          : s
      )
    );
  }, [activeSession?.id]);

  // ── Session helpers ─────────────────────────────────────────────────
  const createNewSession = useCallback(() => {
    const s = makeSession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    return s.id;
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = makeSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(next[0].id);
      }
      return next;
    });
  }, [activeSessionId]);

  const renameSession = useCallback((id, newTitle) => {
    if (!newTitle?.trim()) return;
    setSessions((prev) =>
      prev.map((s) => s.id === id ? { ...s, title: newTitle.trim() } : s)
    );
  }, []);

  const updateSessionSummary = useCallback((id, summary) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, summary } : s)));
  }, []);

  const updateSessionRoute = useCallback((id, routingMode) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, routingMode } : s)));
  }, []);

  const clearCurrentChat = useCallback(() => {
    const fresh = makeSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, []);

  const clearAllSessions = useCallback(() => {
    const fresh = makeSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, []);

  const importSessions = useCallback((incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return false;
    setSessions((prev) => {
      const merged = [...incoming, ...prev];
      const seen = new Set();
      return merged.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    });
    setActiveSessionId(incoming[0].id);
    return true;
  }, []);

  const editMessage = useCallback((msgId, newQuestion) => {
    if (!newQuestion?.trim()) return;
    setChats((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, question: newQuestion.trim(), answer: undefined, type: "ch" } : m)
    );
  }, [setChats]);

  // ── Key check + provider status on mount ────────────────────────────
  useEffect(() => {
    const run = async () => {
      await check_key_exists(setPreferences, preferences);
      const status = await api.getKeysStatus(preferences.userId);
      setProviderStatus(status);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <chatsContext.Provider
      value={{
        // chat state
        chats,
        setChats,
        loading,
        setLoading,
        // preferences
        preferences,
        setPreferences,
        // settings
        settings,
        setSettings,
        // custom skills
        customSkills,
        setCustomSkills,
        addCustomSkill,
        deleteCustomSkill,
        // sessions
        sessions,
        setSessions,
        activeSessionId,
        setActiveSessionId,
        // helpers
        createNewSession,
        deleteSession,
        updateSessionSummary,
        updateSessionRoute,
        clearCurrentChat,
        clearAllSessions,
        importSessions,
        editMessage,
        // ai tools
        aiTools,
        setAiTools,
        addAITool,
        updateAITool,
        deleteAITool,
        // pinned sessions
        pinnedSessions,
        pinSession,
        // starred messages
        starredMessages,
        toggleStarMessage,
        // prompt history
        promptHistory,
        addToPromptHistory,
        // provider status
        providerStatus,
        setProviderStatus,
        // summary helper
        updateSessionSummary,
      }}
    >
      {children}
    </chatsContext.Provider>
  );
}
