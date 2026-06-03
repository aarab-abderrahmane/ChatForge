import { useEffect, useState, useRef, useContext, useCallback, useMemo } from 'react';
import './index.css';

import { Terminal } from './components/features/Terminal';
import { DocsPage } from './pages/DocsPage';
import { SettingsPage } from './pages/SettingsPage';
import { chatsContext, SKILLS, MODELS } from './context/chatsContext';
import { api } from './services/api';
import { ContextBuilder } from './services/contextBuilder';
import { ArtifactProvider, useArtifacts } from './context/artifactContext';

const MAX_AUTO_CONTINUATIONS = 5;

function App() {
  const { activeSessionId } = useContext(chatsContext) || {};
  return (
    <ArtifactProvider sessionId={activeSessionId}>
      <AppInner />
    </ArtifactProvider>
  );
}

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

function AppInner() {
  const [query, setQuery] = useState('');
  const [autoContinuationProgress, setAutoContinuationProgress] = useState(null);

  const {
    chats,
    setChats,
    loading,
    setLoading,
    preferences,
    settings,
    customSkills,
    sessions,
    updateSessionSummary,
    updateSessionRoute,
    updateSessionFacts,
    activeSessionId,
    providerStatus,
    isReady,
  } = useContext(chatsContext) || {};

  const { getFiles } = useArtifacts();

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const draftControllersRef = useRef([]);
  const streamCountRef = useRef(0);
  const generationRef = useRef(0);
  const askAIRef = useRef(null);
  const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });
  const pendingContentRef = useRef(null);
  const flushRafRef = useRef(null);
  const lastFlushTimeRef = useRef(0);
  const batchCacheRef = useRef({});

  // All skills (built-in + custom)
  const allSkills = useMemo(() => [...SKILLS, ...(customSkills || [])], [customSkills]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (settings.autoScroll !== false) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, settings.autoScroll]);

  // ── Apply font-size setting ──
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--terminal-font-size',
      `${settings.fontSize || 14}px`
    );
  }, [settings.fontSize]);

  // ── Listen for stats events ──
  useEffect(() => {
    const handleStats = (e) => {
      setChats((prev) => [...prev, { type: 'ms', content: e.detail.statsMsg }]);
    };
    window.addEventListener('chatforge:stats', handleStats);
    return () => window.removeEventListener('chatforge:stats', handleStats);
  }, []);

  // ── Clean up RAF on unmount ──
  useEffect(() => {
    return () => {
      if (flushRafRef.current) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
    };
  }, []);

  // ════════════════════════════════════════════
  //  CORE AI STREAM
  // ════════════════════════════════════════════
  async function startStream(question, id, skillId, draftIndex, signal, autoContinueCount = 0, seedContent = '') {
    const myGen = generationRef.current;
    streamCountRef.current += 1;
    setLoading(true);
    if (autoContinueCount > 0) {
      setAutoContinuationProgress({ current: autoContinueCount, total: MAX_AUTO_CONTINUATIONS });
    } else {
      setAutoContinuationProgress(null);
    }

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

    const sessionFiles = getFiles(activeSessionId);
    const artifactFiles = sessionFiles.map(f => ({ filename: f.filename, content: f.content }));

    const { messages: contextMessages, systemPrompt: contextSystemPrompt, summaryUpdateNeeded, updatedFacts } =
      await ContextBuilder.build(chats, session.summary, question, session.userFacts || {}, [], artifactFiles);

    if (updatedFacts && JSON.stringify(updatedFacts) !== JSON.stringify(session.userFacts || {})) {
      updateSessionFacts(activeSessionId, updatedFacts);
    }

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
    const isComplexTask = isCodeTask && (
      /\b(debug|error|bug\b|fix|issue|explain|analyze|why\b|how\b|architecture|large\s+(codebase|project|app)|full\s+project|codebase|refactor|optimize|performance|memory\s+leak)\b/i.test(question) ||
      artifactFiles.length > 3 ||
      chats.filter(c => c.type === 'ch').length > 20
    );
    const maxTokens = isCodeTask ? (isComplexTask ? 16384 : 8192) : settings.maxTokens || 1024;

    // When Smart Router is the global setting, send 'smart' to the backend
    // so it uses the full TASK_MODELS fallback chain (not single-provider mode)
    const apiRoutingMode = settings.routingMode === 'smart' ? 'smart' : finalRoutingMode;

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
        '\n\nCRITICAL: The user wants you to CONTINUE exactly from where you stopped. Do NOT repeat anything you already wrote. Do NOT start from the beginning. Complete the current file or response without interruption. If you need more output, just keep going.';
    }

    const rawTemp = (settings.temperature ?? 7) / 10;
    const draftTemp =
      draftIndex > 0
        ? Math.min(rawTemp + draftIndex * 0.15, 1.5)
        : rawTemp;

    // ── Execute stream (with retry) ──
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1000, 3000];
    let response;

    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          response = await api.chat(
            preferences.userId,
            contextMessages,
            finalSystemPrompt,
            activeModelId,
            {
              temperature: draftTemp,
              top_p: (settings.topP ?? 10) / 10,
              frequency_penalty: (settings.frequencyPenalty ?? 0) / 10,
              presence_penalty: (settings.presencePenalty ?? 0) / 10,
              max_tokens: maxTokens,
              routingMode: apiRoutingMode,
              smartTaskType: settings.smartTaskType || "auto",
            },
            signal
          );

          if (!response.ok) throw new Error('Failed to connect to AI service.');
          break;
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          const status = error.status || error.response?.status;
          if (status && status >= 400 && status < 500 && status !== 429) throw error;
          if (attempt >= MAX_RETRIES) throw error;
          const delay = RETRY_DELAYS[attempt] || 5000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let isTruncated = false;

      if (isContinuation) {
        if (seedContent) {
          fullContent = seedContent;
        } else {
          const existing = chats.find(c => c.id === id);
          if (existing) {
            fullContent = draftIndex >= 0
              ? (existing.answers?.[draftIndex] || '')
              : (existing.answer || '');
          }
        }
      }

      let buffer = '';
      const batchKey = `${id}_${draftIndex}`;

      function flushContent() {
        const prevContent = batchCacheRef.current[batchKey];
        if (prevContent === fullContent && !isTruncated) return;
        batchCacheRef.current[batchKey] = fullContent;
        setChats((prev) =>
          prev.map((obj) => {
            if (obj.id !== id) return obj;
            if (draftIndex >= 0) {
              const newAnsws = [...(obj.answers || [])];
              newAnsws[draftIndex] = fullContent;
              let updated = { ...obj, answers: newAnsws, isMulti: true };
              if (isTruncated) updated = { ...updated, isTruncated: true };
              return updated;
            }
            let updated = { ...obj, answer: fullContent };
            if (isTruncated) updated = { ...updated, isTruncated: true };
            return updated;
          })
        );
      }

      function scheduleFlush() {
        if (flushRafRef.current) return;
        const now = Date.now();
        if (now - lastFlushTimeRef.current < 100) {
          flushRafRef.current = requestAnimationFrame(() => {
            flushRafRef.current = null;
            scheduleFlush();
          });
          return;
        }
        flushRafRef.current = requestAnimationFrame(() => {
          flushRafRef.current = null;
          lastFlushTimeRef.current = Date.now();
          flushContent();
        });
      }

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
              scheduleFlush();
            }

            if ((finishReason === 'length' || finishReason === 'MAX_TOKENS') && !isTruncated) {
              isTruncated = true;
              if (flushRafRef.current) {
                cancelAnimationFrame(flushRafRef.current);
                flushRafRef.current = null;
              }
              flushContent();
            }
          } catch {
            // Ignore parse errors from non-JSON or partial lines
          }
        }
      }

      // Final flush
      if (flushRafRef.current) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      flushContent();
      delete batchCacheRef.current[batchKey];

      // Summarize if needed
      if (summaryUpdateNeeded && !draftIndex) {
        ContextBuilder.summarize(preferences.userId, chats, session.summary, artifactFiles).then((newSummary) => {
          if (newSummary && newSummary !== session.summary) {
            updateSessionSummary(activeSessionId, newSummary);
          }
        });
      }

      // Auto-continuation: if response was truncated, automatically continue
      if (isTruncated && autoContinueCount < MAX_AUTO_CONTINUATIONS) {
        await new Promise(r => setTimeout(r, 500));
        if (generationRef.current !== myGen) return;
        return startStream(
          'Continue writing from where you left off. Do not repeat what you already wrote. Finish the code.',
          id,
          skillId,
          draftIndex,
          signal,
          autoContinueCount + 1,
          fullContent
        );
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
        setAutoContinuationProgress(null);
      }
    }
  }

  async function askAI(question, id, overrideSkillId = null, draftCount = 1) {
    generationRef.current += 1;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    draftControllersRef.current.forEach(c => c.abort());
    draftControllersRef.current = [];
    abortControllerRef.current = new AbortController();

    if (draftCount > 1) {
      setChats((prev) =>
        prev.map((obj) =>
          obj.id === id
            ? { ...obj, isMulti: true, answers: Array(draftCount).fill('') }
            : obj
        )
      );
      const controllers = Array.from({ length: draftCount }, () => new AbortController());
      draftControllersRef.current = controllers;
      await Promise.all(
        controllers.map((ctrl, i) =>
          startStream(question, id, overrideSkillId, i, ctrl.signal).catch(() => {})
        )
      );
    } else {
      startStream(question, id, overrideSkillId, -1, abortControllerRef.current.signal);
    }
  }
  askAIRef.current = askAI;

  // ── Handlers ──
  const handleStopAI = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    draftControllersRef.current.forEach(c => c.abort());
    draftControllersRef.current = [];
    setLoading(false);
    setAutoContinuationProgress(null);
    const lastMsg = [...chats].reverse().find(m => m.type === 'ch');
    if (lastMsg) {
      const hasContent = lastMsg.answer || (lastMsg.answers && lastMsg.answers.some(a => a));
      if (!hasContent) {
        // Fresh message with no content — remove it entirely
        setQuery(lastMsg.question);
        setChats(prev => prev.filter(m => m.id !== lastMsg.id));
      }
      // If message has content (partial or continued response), keep it as-is
    }
  }, [chats, setLoading, setChats, setQuery]);

  const handleRetry = useCallback(
    (question, id) => {
      const msg = chats.find((c) => c.id === id);
      if (!msg) return;
      askAIRef.current(question, id, msg.skillId, msg.isMulti ? msg.answers?.length : 1);
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

      askAIRef.current(
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
      if (cmd === '//> mindmap' || cmd === '//>mindmap' || cmd.startsWith('//> mindmap ') || cmd.startsWith('//>mindmap ')) {
        const topic = text.substring(text.indexOf('mindmap') + 7).trim() || 'general knowledge';
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
      const newId = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
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
        askAIRef.current(transformed.question, newId, transformed.skillId, draftCount);
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

      askAIRef.current(
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

  const handleEditSubmit = useCallback((newQuestion) => {
    setQuery(newQuestion);
    setTimeout(() => handleSend({ target: { value: newQuestion } }), 0);
  }, [handleSend]);

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
    const text = `Summarize the key differences and insights from these alternate drafts:\n\n${selected}`;
    const newId = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const newMsg = { id: newId, type: 'ch', question: text, isEphemeral: true, timestamp: new Date().toISOString() };
    setChats((prev) => [...prev, newMsg]);
    askAIRef.current(text, newId, null, 1);
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
  if (!isReady) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-dark text-muted-400 font-mono text-sm">
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      {preferences.currentPage === 'settings' ? (
        <SettingsPage />
      ) : preferences.currentPage === 'docs' ? (
        <div className="w-full h-full">
          <DocsPage />
        </div>
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
          onEditSubmit={handleEditSubmit}
          onStopAI={handleStopAI}
          onMergeDrafts={handleMergeDrafts}
          onSummarizeDrafts={handleSummarizeDrafts}
          onKeepDraft={handleKeepDraft}
          onContinue={handleContinue}
          autoContinuationProgress={autoContinuationProgress}
        />
      )}
    </div>
  );
}

export default App;
