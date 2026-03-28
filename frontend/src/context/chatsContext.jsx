import { createContext, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

export const chatsContext = createContext();

const check_key_exists = async (setPreferences, preferences) => {
  const data = await api.checkKeyExists(preferences.userId);
  if (data.exists) {
    setPreferences((prev) => ({ ...prev, currentPage: "chat" }));
  } else {
    setPreferences((prev) => ({ ...prev, currentPage: "guide" }));
  }
};

function uuid() {
  return crypto.randomUUID();
}

const WELCOME_MESSAGES = [
  {
    type: "ms",
    content: [
      "👋 Welcome to ChatForge! Here's how you can get started",
      "💡 Try asking questions like these to see the AI in action",
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
    answer: "Simply type your question and the AI will summarize the previous messages.",
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    type: "ch",
    question: "Can I ask multiple questions at once?",
    answer: "Yes, but it's best to ask one question at a time for precise answers.",
    timestamp: new Date().toISOString(),
  },
];

export const SKILLS = [
  {
    id: "general",
    name: "General",
    icon: "🤖",
    description: "Balanced for general tasks and conversation.",
    systemPrompt: "You are ChatForge AI, a helpful and intelligent assistant. Provide clear, accurate, and helpful responses. Use Markdown for formatting. If the user asks for a flowchart or diagram, use Mermaid syntax of correctly.",
  },
  {
    id: "code",
    name: "Code Master",
    icon: "💻",
    description: "Expert in 50+ languages and debugging.",
    systemPrompt: "You are an expert software engineer and code mentor. Your tone is technical and precise. Always explain code logic, follow best practices, and use proper Markdown code blocks with language labels. For complex logic, provide Mermaid flowcharts.",
  },
  {
    id: "creative",
    name: "Creative",
    icon: "✍️",
    description: "Unleash imagination and storytelling.",
    systemPrompt: "You are a creative writing companion. Your tone is expressive, evocative, and imaginative. Help with storytelling, poetry, and creative ideas. Use rich formatting to enhance the reading experience.",
  },
  {
    id: "security",
    name: "Cyber Security",
    icon: "🛡️",
    description: "Specialized in security and audit tasks.",
    systemPrompt: "You are a cyber security expert. You speak in a professional, security-conscious manner. When analyzing code or requests, look for vulnerabilities (OWASP Top 10), suggest remediations, and explain security concepts clearly. Maintain a high-integrity 'white hat' persona.",
  },
];

export const MODELS = [
  {
    id: "deepseek/deepseek-chat:free",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    icon: "🧠",
    description: "Fast, smart, and free. Excellent for general reasoning.",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    icon: "⚡",
    description: "Ultra-fast response time with high intelligence.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    provider: "Meta",
    icon: "🦙",
    description: "Powerful open-source reasoning model.",
  },
  {
    id: "qwen/qwen-2.5-72b-instruct:free",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    icon: "🐉",
    description: "Strong performance in coding and mathematics.",
  },
  {
    id: "microsoft/phi-3-medium-128k-instruct:free",
    name: "Phi-3 Medium",
    provider: "Microsoft",
    icon: "🧬",
    description: "Compact but surprisingly powerful reasoning.",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    icon: "🌟",
    description: "The most efficient and cost-effective OpenAI model.",
  },
];

const defaultSettings = {
  scanlines: true,
  font: "fira",     // 'fira' | 'jetbrains'
  sounds: false,
  activeSkillId: "general",
  activeModelId: "deepseek/deepseek-chat:free",
};

export function ChatsProvider({ children }) {
  const [loading, setLoading] = useState(false);

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
  }, [settings]);

  // ── Sessions ────────────────────────────────────────────────────────
  const makeSession = (overrides = {}) => ({
    id: uuid(),
    title: "New Chat",
    messages: WELCOME_MESSAGES,
    createdAt: new Date().toISOString(),
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
  useEffect(() => {
    if (sessions.length === 0) return;
    const valid = sessions.find((s) => s.id === activeSessionId);
    if (!valid) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    localStorage.setItem("ChatForge_Sessions", JSON.stringify(sessions));
  }, [sessions]);

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
              title: s.title === "New Chat"
                ? (() => {
                    const msgs = typeof updater === "function" ? updater(s.messages) : updater;
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

  const clearCurrentChat = useCallback(() => {
    setChats(WELCOME_MESSAGES);
  }, [setChats]);

  // ── Key check on mount ──────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      await check_key_exists(setPreferences, preferences);
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
        // sessions
        sessions,
        setSessions,
        activeSessionId,
        setActiveSessionId,
        // helpers
        createNewSession,
        deleteSession,
        clearCurrentChat,
      }}
    >
      {children}
    </chatsContext.Provider>
  );
}
