import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { ConversationsService, KeysService, PersonalInfoService } from "../services/db";

export const chatsContext = createContext();

const check_key_exists = async (setPreferences) => {
  try {
    const status = await KeysService.getStatus();
    const hasAnyKey = status.openrouter || status.groq || status.gemini || status.huggingface || status.together || status.mistral;
    setPreferences((prev) => ({ ...prev, currentPage: hasAnyKey ? "chat" : "guide" }));
  } catch {
    setPreferences((prev) => ({ ...prev, currentPage: "guide" }));
  }
};

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}



const WELCOME_MESSAGES = [
  {
    type: "ms",
    content: ["👋 Welcome to ChatForge. How can I help you today?"],
  },
];

const makeSession = (overrides = {}) => ({
  id: uuid(),
  title: overrides.title || "New Chat",
  messages: overrides.messages || WELCOME_MESSAGES,
  createdAt: new Date().toISOString(),
  summary: overrides.summary || "",
  userFacts: overrides.userFacts || {},
  routingMode: overrides.routingMode || null,
  ...overrides,
});

export const SKILLS = [
  {
    id: "general",
    name: "General",
    icon: "🤖",
    description: "Balanced for general tasks and conversation.",
    systemPrompt: `You are ChatForge AI, a knowledgeable and friendly assistant for everyone.

You help with any topic: writing, learning, cooking, travel, health questions, business, creative projects, homework, research, personal advice, and much more.

RESPONSE STYLE RULES:
- Match your tone to the user's tone. Casual question = casual answer. Formal question = formal answer.
- Use bullet points or headers ONLY when the content truly needs structure (lists, steps, comparisons). For conversational questions, reply in natural prose.
- Keep responses appropriately sized. A simple question deserves a short answer. A deep question deserves a thorough one.
- Use Markdown sparingly. Bold only truly important terms. Avoid unnecessary headers for short answers.
- Never start with "Certainly!", "Of course!", "Great question!" or similar filler phrases.
- If you are unsure, say so clearly rather than guessing.
- For sensitive topics (health, legal, financial), give helpful information but note that a professional should be consulted.
- LANGUAGE: Always respond in the same language the user is writing in. If they write in Arabic, respond in Arabic. If French, respond in French. Never switch languages unless asked.
- OPTIONAL: At the very end of your response, you may suggest 2-4 follow-up questions wrapped in <followups> tags like:
  <followups>
  - Question 1?
  - Question 2?
  </followups>
  Only include these when follow-up questions are genuinely useful.`,
  },
  {
    id: "code",
    name: "Code Master",
    icon: "💻",
    description: "Expert in 50+ languages and debugging.",
    systemPrompt:
      "You are an expert software engineer and code mentor. " +
      "IMPORTANT BEHAVIOR: " +
      "1) CRITICAL: When requirements are ambiguous (design style, color scheme, layout, tech stack), ask 1-2 short clarifying questions before generating — do NOT guess defaults. " +
      "2) Be CONCISE when generating code — output the code first, then brief notes only if necessary. " +
      "3) When asked to MODIFY a previously generated file, output ONLY the changed file block with the SAME filename. Do NOT regenerate unrelated files. " +
      "4) Always wrap complete files in ```file:filename.ext blocks for download. " +
      "Tone: technical and precise. Use proper Markdown code blocks with language labels. For complex logic, provide Mermaid flowcharts when helpful. For mindmaps or hierarchical concept maps, output a JSON object wrapped in ```mindmap code blocks.",
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
  {
    id: "tutor",
    name: "Tutor",
    icon: "🎓",
    description: "Patient teacher for any subject, any age.",
    systemPrompt: `You are a patient, encouraging tutor for all ages and subjects.

Adapt your explanations to the user's apparent level. Use simple language for beginners, deeper explanations for advanced learners. Use analogies and real-world examples. When someone is struggling, try a different approach rather than repeating the same explanation. Celebrate progress and never make the user feel bad for not understanding.`,
  },
  {
    id: "writer",
    name: "Writer",
    icon: "✍️",
    description: "Helps with any writing: essays, emails, stories, posts.",
    systemPrompt: `You are an expert writing assistant for all types of content.

You help with: essays, emails, cover letters, social media posts, blog articles, stories, speeches, reports, and any other writing. Match the formality the user needs. When improving someone's writing, preserve their voice — only fix what's broken or unclear. For creative writing, be inventive and engaging. Always show the improved/written text directly, not a description of what you'd write.`,
  },
  {
    id: "advisor",
    name: "Life Advisor",
    icon: "🧭",
    description: "Thoughtful guidance for decisions, plans, and life questions.",
    systemPrompt: `You are a thoughtful, balanced life advisor.

You help people think through decisions, plans, relationships, careers, and general life questions. You are NOT a therapist or doctor, but you provide calm, practical perspective. You ask good questions to understand context before giving advice. You present multiple perspectives rather than pushing one answer. You are warm but direct. Never be preachy or repeat the same moral point more than once.`,
  },
  {
    id: "researcher",
    name: "Researcher",
    icon: "🔍",
    description: "Deep-dives into any topic with structured analysis.",
    systemPrompt: `You are a thorough researcher and analyst.

When asked about any topic, you provide well-structured, factual information. Organize information clearly with relevant categories. Cite limitations in your knowledge honestly. For complex topics, start with a clear summary then go deeper. Present multiple viewpoints on contested topics. Be precise with numbers, dates, and facts — never guess or round carelessly.`,
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

// ── Single Light Theme (Newsprint) ─────────────────────────────
// Permanent light mode — no dark mode, no theme switching.

const DEFAULT_MODEL_ID = "meta-llama/llama-3.3-70b-instruct:free";

const SETTINGS_VERSION = 2;

const defaultSettings = {
  font: "jetbrains",
  fontSize: 16,
  sounds: false,
  compactMode: false,
  showTimestamps: false,
  autoScroll: true,
  streamingIndicator: true,
  animations: true,
  showToolbar: true,
  showHintBar: true,
  activeSkillId: "general",
  activeModelId: DEFAULT_MODEL_ID,
  responseLength: "balanced",
  temperature: 7,
  topP: 10,
  frequencyPenalty: 0,
  presencePenalty: 0,
  systemPromptPrefix: "",
  routingMode: "smart",
  smartTaskType: "auto",
  hiddenTools: [],
  _settingsVersion: SETTINGS_VERSION,
};

export function ChatsProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ── Provider status (which AI providers are configured) ─────────────
  const [providerStatus, setProviderStatus] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false, together: false, mistral: false });

  // ── Preferences (userId, currentPage) ──────────────────────────────
  const defaultPreferences = {
    userId: uuid(),
    currentPage: "guide",
  };

  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem("Preferences");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Guard: if localStorage has a stale/removed page, reset to guide
        const validPages = ["chat", "guide", "docs"];
        if (!validPages.includes(parsed.currentPage)) {
          parsed.currentPage = "guide";
        }
        return parsed;
      }
      return defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  useEffect(() => {
    localStorage.setItem("Preferences", JSON.stringify(preferences));
  }, [preferences]);

  const persistAllState = useCallback((snapshot) => {
    try {
      localStorage.setItem("ChatForge_State", JSON.stringify(snapshot));
    } catch { /* localStorage full — ignore */ }
  }, []);

  // ── Settings ────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_Settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed._settingsVersion !== SETTINGS_VERSION) {
          if (typeof parsed.temperature === 'number' && parsed.temperature < 2) parsed.temperature = Math.round(parsed.temperature * 10);
          if (typeof parsed.topP === 'number' && parsed.topP < 2) parsed.topP = Math.round(parsed.topP * 10);
          if (typeof parsed.frequencyPenalty === 'number' && Math.abs(parsed.frequencyPenalty) < 5) parsed.frequencyPenalty = Math.round(parsed.frequencyPenalty * 10);
          if (typeof parsed.presencePenalty === 'number' && Math.abs(parsed.presencePenalty) < 5) parsed.presencePenalty = Math.round(parsed.presencePenalty * 10);
          parsed._settingsVersion = SETTINGS_VERSION;
        }
        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ChatForge_Settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed._settingsVersion !== SETTINGS_VERSION) {
          if (typeof parsed.temperature === 'number' && parsed.temperature < 2) parsed.temperature = Math.round(parsed.temperature * 10);
          if (typeof parsed.topP === 'number' && parsed.topP < 2) parsed.topP = Math.round(parsed.topP * 10);
          if (typeof parsed.frequencyPenalty === 'number' && Math.abs(parsed.frequencyPenalty) < 5) parsed.frequencyPenalty = Math.round(parsed.frequencyPenalty * 10);
          if (typeof parsed.presencePenalty === 'number' && Math.abs(parsed.presencePenalty) < 5) parsed.presencePenalty = Math.round(parsed.presencePenalty * 10);
          parsed._settingsVersion = SETTINGS_VERSION;
          localStorage.setItem("ChatForge_Settings", JSON.stringify({ ...defaultSettings, ...parsed }));
          setSettings((prev) => ({ ...defaultSettings, ...parsed }));
        }

        // Auto-migrate any defunct model IDs to the default (reads from stored, not state)
        const liveModelIds = MODELS.map((m) => m.id);
        const storedModelId = parsed.activeModelId || defaultSettings.activeModelId;
        if (!liveModelIds.includes(storedModelId)) {
          setSettings((prev) => ({ ...prev, activeModelId: DEFAULT_MODEL_ID }));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Custom Skills ────────────────────────────────────────────────────
  const [customSkills, setCustomSkills] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_CustomSkills");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

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

  const toggleStarMessage = useCallback((msgId) => {
    setStarredMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  // ── Prompt History ───────────────────────────────────────────────────
  const [promptHistory, setPromptHistory] = useState(() => {
    try {
      const stored = localStorage.getItem("ChatForge_PromptHistory");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });

  const addToPromptHistory = useCallback((text) => {
    if (!text?.trim()) return;
    setPromptHistory((prev) => {
      const filtered = prev.filter((p) => p !== text);
      const next = [text, ...filtered].slice(0, 50);
      try { localStorage.setItem("ChatForge_PromptHistory", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Sessions ────────────────────────────────────────────────────────
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

  // ── Global Personal Info (cross-session: name, profession, hobbies, etc.) ──
  const [personalInfo, setPersonalInfo] = useState(() => {
    // Synchronous fallback from localStorage for instant first paint
    try {
      const stored = localStorage.getItem("ChatForge_PersonalInfo");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return {};
  });

  useEffect(() => {
    // Load from encrypted IndexedDB on mount, supersedes localStorage fallback
    PersonalInfoService.get().then((data) => {
      if (data && Object.keys(data).length > 0) {
        setPersonalInfo(data);
        localStorage.setItem("ChatForge_PersonalInfo", JSON.stringify(data));
      }
    });
  }, []);

  useEffect(() => {
    PersonalInfoService.save(personalInfo);
    localStorage.setItem("ChatForge_PersonalInfo", JSON.stringify(personalInfo));
  }, [personalInfo]);

  const updatePersonalInfo = useCallback((info) => {
    setPersonalInfo(info);
    // Merge into current session's userFacts so changes apply immediately
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, userFacts: { ...s.userFacts, ...info } }
          : s
      )
    );
  }, [activeSessionId]);

  const sessionsHashRef = useRef("");
  const sessionsTimerRef = useRef(null);

  function getSessionsHash(s) {
    let hash = 0;
    for (const session of s) {
      for (const c of (session.id + (session.messages?.length || 0))) {
        hash = ((hash << 5) - hash) + c.charCodeAt(0);
        hash |= 0;
      }
    }
    return String(hash);
  }

  function persistSessions(s) {
    const hash = getSessionsHash(s);
    if (hash === sessionsHashRef.current) return;
    sessionsHashRef.current = hash;

    // IndexedDB: queue each session via batch queue (flushed every 30s)
    for (const session of s) {
      ConversationsService.saveConversation(session);
    }
  }

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

  // Sync sessions (debounced) — only writes if content actually changed
  useEffect(() => {
    if (sessionsTimerRef.current) {
      clearTimeout(sessionsTimerRef.current);
    }
    sessionsTimerRef.current = setTimeout(() => {
      persistSessions(sessions);
    }, 5000);
    return () => {
      if (sessionsTimerRef.current) clearTimeout(sessionsTimerRef.current);
    };
  }, [sessions]);

  // Save on tab close — flush batch queue immediately
  useEffect(() => {
    async function handleBeforeUnload() {
      persistSessions(sessions);
      await ConversationsService.flushBatch?.();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessions]);

  // Sync activeSessionId to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("ChatForge_ActiveSession", activeSessionId);
    }
  }, [activeSessionId]);

  // ── Consolidated state persistence (debounced) ──────────────────────
  // Merges settings, customSkills, aiTools, pinned, starred into ChatForge_State
  const statePersistTimerRef = useRef(null);

  useEffect(() => {
    if (statePersistTimerRef.current) {
      clearTimeout(statePersistTimerRef.current);
    }
    statePersistTimerRef.current = setTimeout(() => {
      persistAllState({
        settings,
        customSkills,
        aiTools,
        pinned: [...pinnedSessions],
        starred: [...starredMessages],
      });
    }, 2000);
    return () => {
      if (statePersistTimerRef.current) clearTimeout(statePersistTimerRef.current);
    };
  }, [settings, customSkills, aiTools, pinnedSessions, starredMessages, persistAllState]);

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
  const createNewSession = useCallback(async () => {
    const emptySession = sessions.find(
      s => s.messages.filter(m => m.type === "ch").length === 0
    );
    if (emptySession) {
      setActiveSessionId(emptySession.id);
      return emptySession.id;
    }
    const info = await PersonalInfoService.get().catch(() => ({}));
    const facts = info && Object.keys(info).length > 0 ? info : personalInfo;
    const s = makeSession({ userFacts: { ...facts } });
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    return s.id;
  }, [sessions, personalInfo]);

  const deleteSession = useCallback((id) => {
    ConversationsService.deleteConversation(id);
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

  const updateSessionFacts = useCallback((id, userFacts) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, userFacts } : s)));
  }, []);

  const clearCurrentChat = useCallback(() => {
    // Clear only the active session's messages, preserving other sessions
    setSessions((prev) =>
      prev.map((s) =>
        s.id === (activeSession?.id)
          ? { ...s, messages: WELCOME_MESSAGES, title: "New Chat", summary: "", userFacts: {}, routingMode: null }
          : s
      )
    );
  }, [activeSession?.id]);

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

  // ── Key check + provider status on mount ────────────────────────
  useEffect(() => {
    const run = async () => {
      await KeysService.migrateLegacyKeys();
      await check_key_exists(setPreferences);
      const status = await KeysService.getStatus();
      setProviderStatus(status);
    };
    run().finally(() => setIsReady(true));
  }, []);

  // Re-sync providerStatus any time the user navigates to the chat page
  // (handles the case where they saved a key on the guide page)
  useEffect(() => {
    if (preferences.currentPage === "chat") {
      KeysService.getStatus().then(setProviderStatus);
    }
  }, [preferences.currentPage]);

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
        // personal info
        personalInfo,
        updatePersonalInfo,
        // helpers
        createNewSession,
        deleteSession,
        renameSession,
        updateSessionSummary,
        updateSessionRoute,
        updateSessionFacts,
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
        // ready state
        isReady,
      }}
    >
      {children}
    </chatsContext.Provider>
  );
}
