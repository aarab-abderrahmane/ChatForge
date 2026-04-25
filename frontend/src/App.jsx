import { useEffect, useState, useRef, useContext, useCallback, useMemo } from 'react';
import './index.css';

import { Terminal } from './components/features/Terminal';
import { DocsPage } from './pages/DocsPage';
import { chatsContext, SKILLS, MODELS, THEMES } from './context/chatsContext';
import { api } from './services/api';
import { ContextBuilder } from './services/contextBuilder';

// ── Commands map (separated for clarity) ──
const COMMANDS = {
  summarize: {
    question:
      'Please summarize our entire conversation so far in clear bullet points, highlighting the key topics, decisions, and conclusions.',
    skillId: 'summarizer',
  },
  translate: {
    question:
      "I'd like to use you as a translator. Please tell me: what would you like me to translate, and into which language?",
    skillId: 'translator',
  },
  help: {
    question: `List all available ChatForge commands and keyboard shortcuts in a formatted markdown table. Include: ///>clear, ///>new, ///>summarize, ///>translate, ///>retry, ///>stats, ///>export, ///>help, ///>skill, ///>model, ///>quiz [topic], ///>flashcards [topic], and ///>mindmap [topic]. Also mention: Enter to send, Shift+Enter for newline.`,
    skillId: 'general',
  },
};

function App() {
  const [query, setQuery] = useState('');

  const {
    chats,
    setChats,
    loading,
    setLoading,
    preferences,
    setPreferences,
    settings,
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

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const streamCountRef = useRef(0);
  const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });

  // All skills (built-in + custom)
  const allSkills = useMemo(() => [...SKILLS, ...(customSkills || [])], [customSkills]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (settings.autoScroll !== false) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, settings.autoScroll]);

  // ── Apply font + font-size settings ──
  useEffect(() => {
    const fontMap = {
      jetbrains: "'JetBrains Mono', monospace",
      cascadia: "'Cascadia Code', 'Fira Code', monospace",
      fira: "'Fira Code', monospace",
    };
    document.body.style.fontFamily = fontMap[settings.font] || fontMap.fira;
    document.documentElement.style.setProperty(
      '--terminal-font-size',
      `${settings.fontSize || 14}px`
    );
  }, [settings.font, settings.fontSize]);

  // ── Sync theme colors to CSS variables ──
  useEffect(() => {
    const root = document.documentElement;
    let theme = THEMES.find((t) => t.id === settings.theme) || THEMES[0];

    if (settings.theme === 'custom' && settings.customTheme) {
      theme = { ...theme, ...settings.customTheme };
    }

    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--theme-accent', theme.accent);
  }, [settings.theme, settings.customTheme]);

  // ── Keyboard sounds ──
  useEffect(() => {
    if (!settings.sounds) return;

    const handleKey = (e) => {
      if (e.key.length !== 1 && e.key !== 'Backspace') return;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800 + Math.random() * 200;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [settings.sounds]);

  // ── Listen for stats events ──
  useEffect(() => {
    const handleStats = (e) => {
      setChats((prev) => [...prev, { type: 'ms', content: e.detail.statsMsg }]);
    };
    window.addEventListener('chatforge:stats', handleStats);
    return () => window.removeEventListener('chatforge:stats', handleStats);
  }, [setChats]);

  // ════════════════════════════════════════════
  //  CORE AI STREAM
  // ════════════════════════════════════════════
  async function startStream(question, id, skillId, draftIndex, signal) {
    streamCountRef.current += 1;
    setLoading(true);

    const activeSkill = allSkills.find((s) => s.id === skillId) || SKILLS[0];
    const activeModelId = settings.activeModelId || 'meta-llama/llama-3.3-70b-instruct:free';

    const basePrompt = activeSkill?.systemPrompt || 'You are a helpful assistant.';
    const prefix = settings.systemPromptPrefix?.trim();

    const isContinuation =
      question.toLowerCase().includes('continue writing from where you left off') ||
      (question.length < 30 &&
        ['continue', 'keep going', 'استمر', 'كمل'].some((kw) =>
          question.toLowerCase().includes(kw)
        ));

    const session = sessions.find((s) => s.id === activeSessionId) || { messages: chats, summary: '' };

    const { messages: contextMessages, systemPrompt: contextSystemPrompt, summaryUpdateNeeded } =
      await ContextBuilder.build(chats, null, session.summary, question);

    // ── Model routing & locking ──
    let finalRoutingMode = settings.routingMode || 'smart';
    if (finalRoutingMode === 'smart') {
      if (session.routingMode) {
        const lockedProvider = session.routingMode;
        if (providerStatus[lockedProvider]) {
          finalRoutingMode = lockedProvider;
        } else {
          finalRoutingMode = ContextBuilder.route(question, providerStatus);
          updateSessionRoute(activeSessionId, finalRoutingMode);
        }
      } else {
        finalRoutingMode = ContextBuilder.route(question, providerStatus);
        if (providerStatus[finalRoutingMode] || finalRoutingMode === 'openrouter') {
          updateSessionRoute(activeSessionId, finalRoutingMode);
        }
      }
    }

    const isCodeTask = finalRoutingMode === 'openrouter' || finalRoutingMode === 'gemini';
    const maxTokens = isCodeTask ? 4096 : settings.maxTokens || 1024;

    // ── Build final system prompt ──
    let finalSystemPrompt =
      (prefix ? `${contextSystemPrompt}\n\n[User context]: ${prefix}` : contextSystemPrompt) ||
      basePrompt;

    if (isCodeTask) {
      const codeSkill = SKILLS.find((s) => s.id === 'code');
      finalSystemPrompt = `MODAL IDENTITY: ${codeSkill.systemPrompt}\n\n${finalSystemPrompt}`;
    }

    if (isContinuation) {
      finalSystemPrompt +=
        '\n\nCRITICAL: The user wants you to CONTINUE exactly from where you stopped. Do NOT repeat anything you already wrote. Do NOT start from the beginning. Simply provide the next part of the code or text.';
    }

    const draftTemp =
      draftIndex > 0
        ? Math.min((settings.temperature || 0.7) + draftIndex * 0.15, 1.5)
        : settings.temperature || 0.7;

    // ── Execute stream ──
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

      if (!response.ok) throw new Error('Failed to connect to AI service.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.done && data.provider) {
              setChats((prev) =>
                prev.map((obj) => (obj.id === id ? { ...obj, provider: data.provider } : obj))
              );
              continue;
            }

            if (data.error) throw new Error(data.error);

            const choice = data.choices?.[0];
            const content = choice?.delta?.content || choice?.message?.content || '';
            const finishReason = choice?.finish_reason || data.candidates?.[0]?.finishReason;

            if (content) {
              fullContent += content;
              setChats((prev) =>
                prev.map((obj) => {
                  if (obj.id !== id) return obj;
                  if (draftIndex >= 0) {
                    const newAnsws = [...(obj.answers || [])];
                    newAnsws[draftIndex] = fullContent;
                    return { ...obj, answers: newAnsws, isMulti: true };
                  }
                  return { ...obj, answer: fullContent };
                })
              );
            }

            if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
              setChats((prev) =>
                prev.map((obj) => (obj.id === id ? { ...obj, isTruncated: true } : obj))
              );
            }
          } catch {
            // Ignore parse errors from non-JSON or partial lines
          }
        }
      }

      // Summarize if needed
      if (summaryUpdateNeeded && !draftIndex) {
        ContextBuilder.summarize(preferences.userId, chats, session.summary).then((newSummary) => {
          if (newSummary && newSummary !== session.summary) {
            updateSessionSummary(id, newSummary);
          }
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') return;

      console.error('AI stream error:', error);
      let errMsg = error.message || 'Connection lost.';
      const lowerErr = errMsg.toLowerCase();

      if (lowerErr.includes('no endpoints') || lowerErr.includes('at capacity') || lowerErr.includes('429')) {
        errMsg = '⚠️ AI models are currently rate-limited. Please wait 10-20 seconds and try again, or switch models in Settings (⚙️).';
      } else if (lowerErr.includes('fetch failed') || lowerErr.includes('getaddrinfo')) {
        errMsg = '🌐 Network Error: Unable to reach OpenRouter. This is usually a temporary DNS or internet issue.';
      }

      setChats((prev) =>
        prev.map((obj) => {
          if (obj.id !== id) return obj;
          if (draftIndex >= 0) {
            const newAnsws = [...(obj.answers || [])];
            newAnsws[draftIndex] = `[Error] ${errMsg}`;
            return { ...obj, answers: newAnsws, isMulti: true, type: 'error' };
          }
          return { ...obj, type: 'error', answer: errMsg };
        })
      );
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
          obj.id === id
            ? { ...obj, isMulti: true, answers: Array(draftCount).fill('') }
            : obj
        )
      );
      for (let i = 0; i < draftCount; i++) {
        startStream(question, id, overrideSkillId, i, abortControllerRef.current.signal);
      }
    } else {
      startStream(question, id, overrideSkillId, -1, abortControllerRef.current.signal);
    }
  }

  // ── Handlers ──
  const handleStopAI = useCallback(() => {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    setLoading(false);

    setChats((prev) => {
      const lastMsg = [...prev].reverse().find((m) => m.type === 'ch');
      if (!lastMsg) return prev;
      setQuery(lastMsg.question);
      return prev.filter((m) => m.id !== lastMsg.id);
    });
  }, [setLoading, setChats, setQuery]);

  const handleRetry = useCallback(
    (question, id) => {
      const msg = chats.find((c) => c.id === id);
      if (!msg) return;
      askAI(question, id, msg.skillId, msg.isMulti ? msg.answers?.length : 1);
    },
    [chats]
  );

  const handleContinue = useCallback(
    (id) => {
      const msg = chats.find((c) => c.id === id);
      if (!msg) return;

      setChats((prev) =>
        prev.map((obj) => (obj.id === id ? { ...obj, isTruncated: false } : obj))
      );

      askAI(
        'Continue writing from where you left off. Do not repeat what you already wrote. Finish the code.',
        id,
        msg.skillId,
        msg.isMulti ? msg.answers?.length : 1
      );
    },
    [chats]
  );

  // ── Transform //> commands ──
  const transformCommand = useCallback(
    (text) => {
      const cmd = text.trim().toLowerCase();

      // Static commands
      if (cmd === '//> new' || cmd === '//>new') return { action: 'clear' };

      const cmdMap = {
        '//> summarize': COMMANDS.summarize,
        '//>summarize': COMMANDS.summarize,
        '//> translate': COMMANDS.translate,
        '//>translate': COMMANDS.translate,
        '//> help': COMMANDS.help,
        '//>help': COMMANDS.help,
      };

      if (cmdMap[cmd]) return cmdMap[cmd];

      // Dynamic skill command
      if (cmd === '//> skill' || cmd === '//>skill') {
        const skillId = settings.activeSkillId;
        const skill = allSkills.find((s) => s.id === skillId) || SKILLS[0];
        return {
          question: `Tell me about your current persona: you are "${skill.name}" (${skill.icon}). Briefly describe what you specialize in and give 3 example prompts that best demonstrate your capabilities.`,
          skillId,
        };
      }

      // Dynamic model command
      if (cmd === '//> model' || cmd === '//>model') {
        const model = MODELS.find((m) => m.id === settings.activeModelId) || MODELS[0];
        return {
          question: `You are currently running as "${model.name}" by ${model.provider}. Briefly introduce yourself: your strengths, ideal use cases, and one fun fact about your architecture.`,
          skillId: 'general',
        };
      }

      // Quiz command
      if (cmd.startsWith('//> quiz ') || cmd.startsWith('//>quiz ')) {
        const topic = text.substring(text.indexOf('quiz') + 4).trim();
        return {
          question: `Generate a multiple choice quiz about: ${topic}. Format your response exactly as JSON using THIS STRICT STRUCTURE:\n\`\`\`quiz\n{\n  "topic": "${topic}",\n  "questions": [\n    {\n      "q": "Question text?",\n      "options": ["Option A", "Option B", "Option C", "Option D"],\n      "answer": 0\n    }\n  ]\n}\n\`\`\`\nProvide ONLY this JSON block. Do not include any other text.`,
          skillId: 'general',
        };
      }

      // Flashcards command
      if (cmd.startsWith('//> flashcards ') || cmd.startsWith('//>flashcards ')) {
        const topic = text.substring(text.indexOf('flashcards') + 10).trim();
        return {
          question: `Generate a set of 5 interactive flashcards about: ${topic}. Format your response exactly as JSON using THIS STRICT STRUCTURE:\n\`\`\`flashcards\n{\n  "topic": "${topic}",\n  "cards": [\n    {\n      "front": "Term or Question",\n      "back": "Definition or Answer"\n    }\n  ]\n}\n\`\`\`\nProvide ONLY this JSON block. Do not include any other text.`,
          skillId: 'general',
        };
      }

      // Mindmap command
      if (cmd.startsWith('//> mindmap ') || cmd.startsWith('//>mindmap ')) {
        const topic = text.substring(text.indexOf('mindmap') + 7).trim();
        return {
          question: `Create a structured mindmap for the topic "${topic}".\nOutput ONLY a valid JSON object wrapped in \`\`\`mindmap code blocks.\nStructure:\n{\n  "label": "Topic Name",\n  "children": [\n    { "label": "Subtopic 1", "children": [...] },\n    { "label": "Subtopic 2", "children": [] }\n  ]\n}\nNo preamble, no extra text.`,
          skillId: 'general',
        };
      }

      return null;
    },
    [settings.activeSkillId, settings.activeModelId, allSkills]
  );

  // ── Send handler ──
  const handleSend = useCallback(
    (e, draftCount = 1) => {
      const newId = new Date();
      const text = (e.target?.value ?? e.target?.innerText ?? query).trim();
      if (!text) return;

      if (text.startsWith('//>')) {
        const transformed = transformCommand(text);
        if (!transformed) return;

        if (transformed.action === 'clear') {
          setChats([]);
          return;
        }

        const newMsg = {
          id: newId,
          type: 'ch',
          question: text,
          answer: undefined,
          answers: draftCount > 1 ? Array(draftCount).fill('') : undefined,
          isMulti: draftCount > 1,
          timestamp: new Date().toISOString(),
        };
        setChats((prev) => [...prev, newMsg]);
        askAI(transformed.question, newId, transformed.skillId, draftCount);
        return;
      }

      const newMsg = {
        id: newId,
        type: 'ch',
        question: text,
        answer: undefined,
        answers: draftCount > 1 ? Array(draftCount).fill('') : undefined,
        isMulti: draftCount > 1,
        timestamp: new Date().toISOString(),
      };

      setChats((prev) => [...prev, newMsg]);

      const lowerText = text.toLowerCase().trim();
      const isContinue =
        lowerText === 'continue' ||
        lowerText === 'استمر' ||
        lowerText === 'كمل' ||
        lowerText === 'continue code';

      askAI(
        isContinue
          ? 'Continue writing from where you left off. Do not repeat what you already wrote. Finish the code.'
          : text,
        newId,
        null,
        draftCount
      );
    },
    [query, transformCommand]
  );

  const handleMergeDrafts = useCallback((msgId, indices) => {
    const msg = chats.find((c) => c.id === msgId);
    if (!msg) return;
    const selected = indices.map((i) => msg.answers[i]).join('\n\n---\n\n');
    setQuery(
      `Merge and synthesize the following drafts into ONE cohesive and unified response. Extract the best ideas from each:\n\n${selected}`
    );
  }, [chats]);

  const handleSummarizeDrafts = useCallback((msgId, indices) => {
    const msg = chats.find((c) => c.id === msgId);
    if (!msg) return;
    const selected = indices.map((i) => msg.answers[i]).join('\n\n---\n\n');
    setQuery(
      `Summarize the key differences and insights from these alternate drafts:\n\n${selected}`
    );
  }, [chats]);

  const handleKeepDraft = useCallback((msgId, index) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== msgId || !c.isMulti) return c;
        return { ...c, isMulti: false, answer: c.answers[index], answers: undefined };
      })
    );
  }, []);

  // ── Copy to clipboard ──
  const copyToClipboard = useCallback(
    async (idMes) => {
      const targetMes = chats.find((ch) => ch.type === 'ch' && ch.id === idMes);
      if (!targetMes?.answer) return;

      if (typeof window === 'undefined' || !navigator.clipboard?.writeText) {
        console.error('Clipboard API not available');
        return;
      }

      try {
        await navigator.clipboard.writeText(targetMes.answer);
        setIsCopied({ idMes, state: true });
        setTimeout(() => setIsCopied((prev) => ({ ...prev, state: false })), 2000);
      } catch (error) {
        console.error(error);
      }
    },
    [chats]
  );

  // ── Render ──
  return (
    <>
      {/* Background grid layer */}
      <div className="bg-grid" />

      {/* Scanlines overlay */}
      <div
        className={`scan-lines fixed inset-0 pointer-events-none z-[9999] ${
          settings.scanlines ? '' : 'scanlines-off'
        }`}
      />

      {/* Main app */}
      <div className="relative z-10 w-screen h-screen">
        {preferences.currentPage === 'docs' ? (
          <div className="w-full h-full">
            <DocsPage />
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
