"use client";
import { cn } from "../../lib/utils";
import { useEffect, useRef, useState, useContext, useCallback } from "react";

import { MessageBlock } from "./MessageBlock";
import { Sidebar } from "./Sidebar";
import { GuidePage } from "../../pages/guidePage";
import { Header } from "./Header";

import {
  Trash2, SendHorizonal, FileText,
  Search, X as XIcon, Sparkles,
  Layers, Lightbulb, Pencil, Wifi,
  Briefcase, Bug, Code, BarChart3, TrendingUp, ChevronUp, ChevronDown,
  Check, Paperclip, File, Image, FileCode,
  FileJson, AlertCircle, Mic, MicOff,
} from "lucide-react";

import { chatsContext, SKILLS, MODELS } from "../../context/chatsContext";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatNavigation } from "./ChatNavigation";
import { radius } from "../../lib/design-tokens";

const COMMANDS = [
  { cmd: "/quiz", desc: "Generate a quiz (e.g. /quiz React)", icon: Lightbulb, color: "#FF9500" },
  { cmd: "/flashcards", desc: "Generate flashcards", icon: Layers, color: "#AF52DE" },
  { cmd: "/mindmap", desc: "Generate a mindmap", icon: Sparkles, color: "#FF2D55" },
  { cmd: "/help", desc: "Show keyboard shortcuts", icon: Search, color: "#8E8E93" },
  { cmd: "/skill", desc: "Show current AI skill info", icon: Code, color: "#AF52DE" },
  { cmd: "/model", desc: "Show current AI model info", icon: Wifi, color: "#007AFF" },
];

const PLACEHOLDER_SUGGESTIONS = [
  "Ask me anything — a question, a task, an idea...",
  "Write me a birthday message for my friend...",
  "Explain quantum physics like I'm 10...",
  "Help me write a professional email...",
  "What are some dinner ideas with chicken and rice?",
  "Summarize the pros and cons of remote work...",
  "Help me plan a trip to Japan...",
  "I need to practice for a job interview...",
  "Type / to see all commands",
];

const EDITION_DATE = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

// ─── File attachment limits ────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 5;

// Accepted MIME types and their display info
const ACCEPTED_TYPES = {
  "text/plain": { label: "TXT", icon: FileText, color: "#6B7280" },
  "text/markdown": { label: "MD", icon: FileCode, color: "#6366F1" },
  "text/html": { label: "HTML", icon: FileCode, color: "#F97316" },
  "text/css": { label: "CSS", icon: FileCode, color: "#3B82F6" },
  "text/javascript": { label: "JS", icon: FileCode, color: "#EAB308" },
  "application/javascript": { label: "JS", icon: FileCode, color: "#EAB308" },
  "application/json": { label: "JSON", icon: FileJson, color: "#10B981" },
  "application/typescript": { label: "TS", icon: FileCode, color: "#3B82F6" },
  "application/pdf": { label: "PDF", icon: FileText, color: "#EF4444" },
  "image/png": { label: "PNG", icon: Image, color: "#8B5CF6" },
  "image/jpeg": { label: "JPG", icon: Image, color: "#8B5CF6" },
  "image/gif": { label: "GIF", icon: Image, color: "#8B5CF6" },
  "image/webp": { label: "WEBP", icon: Image, color: "#8B5CF6" },
};

// Also accept by extension for files browsers mis-type
const ACCEPTED_EXTENSIONS = [
  ".txt", ".md", ".markdown", ".html", ".htm", ".css",
  ".js", ".jsx", ".ts", ".tsx", ".json", ".py", ".java",
  ".c", ".cpp", ".cs", ".php", ".rb", ".rs", ".go",
  ".sql", ".xml", ".yaml", ".yml", ".env", ".sh", ".bash",
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
];

const isImageType = (type) => type?.startsWith("image/");

/**
 * Reads a File object and returns its text content (or base64 for images).
 * Returns { name, type, content, isImage, sizeKB }
 */
const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const sizeKB = Math.round(file.size / 1024);
    if (isImageType(file.type)) {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        name: file.name, type: file.type,
        content: e.target.result, // base64 data URL
        isImage: true, sizeKB,
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        name: file.name, type: file.type,
        content: e.target.result,
        isImage: false, sizeKB,
      });
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
};

/**
 * Returns a small icon + colour for a given file, regardless of MIME.
 */
const getFileVisuals = (file) => {
  if (isImageType(file.type)) return { label: file.type.split("/")[1].toUpperCase(), icon: Image, color: "#8B5CF6" };
  const known = ACCEPTED_TYPES[file.type];
  if (known) return known;
  // Fallback by extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (["js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "c", "cpp", "cs", "php", "java", "sh"].includes(ext))
    return { label: ext.toUpperCase(), icon: FileCode, color: "#EAB308" };
  if (["json", "yaml", "yml", "xml"].includes(ext))
    return { label: ext.toUpperCase(), icon: FileJson, color: "#10B981" };
  return { label: ext?.toUpperCase() || "FILE", icon: File, color: "#6B7280" };
};

// ─── AttachedFileChip ─────────────────────────────────────────────────────────
function AttachedFileChip({ file, onRemove }) {
  const visuals = getFileVisuals(file);
  const Icon = visuals.icon;
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-ink bg-white font-body text-sm group relative shadow-hard-sm hover:-rotate-1 transition-transform duration-100"
      style={{ borderRadius: radius.wobblySm }}
    >
      <Icon size={13} strokeWidth={2.5} style={{ color: visuals.color }} />
      <span className="text-ink max-w-[120px] truncate" title={file.name}>{file.name}</span>
      <span className="text-muted-400">{file.sizeKB}KB</span>
      <button
        onClick={() => onRemove(file.name)}
        className="ml-0.5 text-muted-400 hover:text-ink transition-colors"
        title="Remove file"
      >
        <XIcon size={9} strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Main Terminal ────────────────────────────────────────────────────────────
export const Terminal = ({
  chats, copyToClipboard, handleSend, loading, isCopied,
  query, setQuery, messagesEndRef, className, onRetry,
  onEditSubmit, onStopAI, onMergeDrafts, onSummarizeDrafts,
  onKeepDraft, onContinue, autoContinuationProgress, searchStage,
}) => {
  const COMMAND_PREFIX = "/";
  const {
    preferences, setPreferences, settings, setSettings, clearCurrentChat,
    createNewSession, customSkills, promptHistory, addToPromptHistory, aiTools,
    activeSessionId,
  } = useContext(chatsContext);

  const allSkills = [...SKILLS, ...(customSkills || [])];
  const activeSkill = allSkills.find(s => s.id === settings.activeSkillId) || SKILLS[0];
  const activeModel = settings.isCustomModel
    ? { id: settings.activeModelId, name: settings.customModelId || "Custom", icon: "⭐", provider: "OpenRouter", description: "Custom model" }
    : (MODELS.find(m => m.id === settings.activeModelId) || MODELS[0]);

  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const skillRef = useRef(null);
  const scrollRef = useRef(null);
  const draftRef = useRef(null);

  // ── File attachment state ──────────────────────────────────────────────────
  const [attachedFiles, setAttachedFiles] = useState([]); // [{ name, type, content, isImage, sizeKB }]
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(dist > 120);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (draftRef.current && !draftRef.current.contains(e.target)) {
        setShowDraftMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [charCount, setCharCount] = useState(0);
  const [promptHistIdx, setPromptHistIdx] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator?.onLine ?? true);
  const [draftCount, setDraftCount] = useState(1);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [inputVisible, setInputVisible] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const recognitionRef = useRef(null);

  const textareaRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => { resizeTextarea(); }, [query, resizeTextarea]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const show = () => { setInputVisible(true); textareaRef.current?.focus(); };
    window.addEventListener('keydown', show);
    return () => window.removeEventListener('keydown', show);
  }, [isMobile]);

  useEffect(() => {
    const handleClick = (e) => {
      if (skillRef.current && !skillRef.current.contains(e.target)) setShowSkillDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (inputVisible) textareaRef.current?.focus();
  }, [inputVisible]);

  // ── File attachment handlers ──────────────────────────────────────────────
  const handleFileSelect = useCallback(async (fileList) => {
    setFileError("");
    const files = Array.from(fileList);

    if (attachedFiles.length + files.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} files per message.`);
      return;
    }

    const results = [];
    for (const file of files) {
      // Check size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`"${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`);
        continue;
      }
      // Check extension
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const mimeOk = !!ACCEPTED_TYPES[file.type];
      const extOk = ACCEPTED_EXTENSIONS.includes(ext);
      if (!mimeOk && !extOk) {
        setFileError(`"${file.name}" is not a supported file type.`);
        continue;
      }
      // Avoid duplicates
      if (attachedFiles.some(f => f.name === file.name)) continue;

      try {
        const parsed = await readFileContent(file);
        results.push(parsed);
      } catch {
        setFileError(`Failed to read "${file.name}".`);
      }
    }
    if (results.length) setAttachedFiles(prev => [...prev, ...results]);
  }, [attachedFiles]);

  const removeFile = useCallback((name) => {
    setAttachedFiles(prev => prev.filter(f => f.name !== name));
    setFileError("");
  }, []);

  // Paste handler: catch pasted images
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(i => i.kind === "file" && i.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map(i => i.getAsFile()).filter(Boolean);
    handleFileSelect(files);
  }, [handleFileSelect]);

  // ── Voice input ──────────────────────────────────────────────────────
  const toggleVoiceInput = useCallback(() => {
    const REC = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!REC) return;

    if (voiceListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setVoiceListening(false);
      return;
    }

    const recognition = new REC();
    recognition.lang = settings?.language === "ar" ? "ar" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
      setCharCount(transcript.length);
      setVoiceListening(false);
    };

    recognition.onerror = (e) => {
      setVoiceListening(false);
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
      } else if (e.error === 'no-speech') {
        setQuery('No speech detected — try again.');
        setCharCount(0);
      } else {
        setQuery(`Voice error: ${e.error}`);
        setCharCount(0);
      }
    };
    recognition.onend = () => setVoiceListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setVoiceListening(true);
  }, [voiceListening, settings]);

  // Drag-and-drop on the whole input area
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) handleFileSelect(e.dataTransfer.files);
  };

  // ── Sending with files ─────────────────────────────────────────────────────
  const doSend = (e) => {
    const val = e?.target?.value;
    if (val?.trim()) addToPromptHistory(val.trim());
    setQuery(""); setCharCount(0); setPromptHistIdx(-1);
    // Pass attached files alongside the message
    handleSend(e, draftCount, attachedFiles, searchEnabled);
    if (searchEnabled) setSearchEnabled(false);
    setAttachedFiles([]);
    setFileError("");
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      setShowSearch(p => !p);
      if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (query.trim().length === 0 || loading) return;
      executeCommand(query) || doSend({ target: { value: query } });
      setPromptHistIdx(-1);
      return;
    }
    if (e.key === "ArrowUp" && !query && promptHistory.length > 0) {
      e.preventDefault();
      const nextIdx = Math.min(promptHistIdx + 1, promptHistory.length - 1);
      setPromptHistIdx(nextIdx);
      setQuery(promptHistory[nextIdx]);
      setCharCount(promptHistory[nextIdx].length);
      return;
    }
    if (e.key === "ArrowDown" && promptHistIdx >= 0) {
      e.preventDefault();
      const nextIdx = promptHistIdx - 1;
      if (nextIdx < 0) { setPromptHistIdx(-1); setQuery(""); setCharCount(0); }
      else { setPromptHistIdx(nextIdx); setQuery(promptHistory[nextIdx]); setCharCount(promptHistory[nextIdx].length); }
      return;
    }
    if (e.key === "Escape") { setShowCmdMenu(false); setShowSearch(false); }
    if (e.key === "/") { setTimeout(() => { if (textareaRef.current?.value.startsWith("/")) setShowCmdMenu(true); }, 10); }
  };

  const handleToolClick = (tool) => {
    if (tool.cmd) {
      executeCommand(tool.cmd) || handleSend({ target: { value: tool.cmd } }, draftCount);
      setQuery(""); setCharCount(0);
    } else if (tool.prompt) {
      if (query.trim().length > 0) {
        handleSend({ target: { value: `${tool.prompt}\n\n${query.trim()}` } }, draftCount);
        setQuery(""); setCharCount(0);
      } else {
        const lastChat = [...chats].reverse().find(c => c.type === "ch" && c.answer);
        if (lastChat?.answer) {
          const ctx = lastChat.answer.length > 800 ? lastChat.answer.substring(0, 800) + "\n...[truncated]" : lastChat.answer;
          setQuery(`${tool.prompt}\n\n"${ctx}"`);
        } else {
          setQuery(tool.prompt);
        }
        setCharCount(query.length);
        setTimeout(() => { textareaRef.current?.focus(); resizeTextarea(); }, 0);
      }
    }
  };

  const executeCommand = (val) => {
    const trimmed = val.trim();
    if (!trimmed.startsWith(COMMAND_PREFIX)) return false;

    const normalized = trimmed.replace(/^\/\/>\s*/, '/');
    const rest = normalized.replace(/^\//, '').trim();
    const spaceIdx = rest.indexOf(' ');
    const cmd = spaceIdx === -1 ? rest.toLowerCase() : rest.slice(0, spaceIdx).toLowerCase();
    const args = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();

    const send = () => {
      handleSend({ target: { value: `//> ${cmd} ${args}`.trim() } }, 1);
      setQuery(''); setShowCmdMenu(false);
      return true;
    };

    const info = (lines) => {
      window.dispatchEvent(new CustomEvent('chatforge:stats', { detail: { statsMsg: lines } }));
      setQuery(''); setShowCmdMenu(false);
      return true;
    };

    const HANDLERS = {
      '/quiz': () => send(),
      '/flashcards': () => send(),
      '/mindmap': () => send(),
      '/help': () => info([
        '⌨  Keyboard Shortcuts',
        '├ Enter       : Send message',
        '├ Shift+Enter : New line',
        '├ ↑ / ↓       : Prompt history',
        '├ Ctrl+F      : Search chat',
        '├ Esc         : Close menus',
        '└ /command    : Run a command (/help for this list)',
      ]),
      '/skill': () => info([
        '🎯 Active Skill',
        `├ Name  : ${activeSkill.name}`,
        `├ Icon  : ${activeSkill.icon}`,
        `├ ID    : ${activeSkill.id}`,
        `└ Model : ${activeModel.icon} ${activeModel.name}`,
      ]),
      '/model': () => info([
        '🤖 Active Model',
        `├ Name    : ${activeModel.name}`,
        `├ Icon    : ${activeModel.icon}`,
        `├ ID      : ${activeModel.id}`,
        `└ Provider: ${activeModel.provider || 'N/A'}`,
      ]),
    };

    const key = `/${cmd}`;
    const handler = HANDLERS[key];
    if (handler) return handler();

    setQuery(''); setShowCmdMenu(false);
    window.dispatchEvent(new CustomEvent('chatforge:stats', {
      detail: { statsMsg: [
        '⚠ Unknown Command',
        `└ "/${cmd}" is not recognized. Type /help for available commands.`,
      ]},
    }));
    return true;
  };

  const exportTxt = () => {
    const lines = chats.filter(m => m.type === "ch").flatMap(m => [`> ${m.question}`, m.answer || "", ""]);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `chatforge_${new Date().toISOString().split("T")[0]}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val); setCharCount(val.length);
    setShowCmdMenu(val.startsWith(COMMAND_PREFIX));
  };

  const handleCmdSelect = (cmd) => { setQuery(cmd); setShowCmdMenu(false); textareaRef.current?.focus(); };

  const msgCount = chats.filter(c => c.type === "ch").length;
  const estTokens = Math.round(charCount / 4);

  const searchMatches = searchQuery.trim()
    ? chats.filter(c => c.type === "ch" && ((c.question || "").toLowerCase().includes(searchQuery.toLowerCase()) || (c.answer || "").toLowerCase().includes(searchQuery.toLowerCase()))).length
    : 0;

  const fontSizeStyle = { fontSize: `${settings.fontSize || 14}px` };

  const iosIcons = {
    improve: Sparkles,
    explain: Lightbulb,
    grammar: Pencil,
    proTone: Briefcase,
    debug: Bug,
    writecode: Code,
    analyze: BarChart3,
    clear: Trash2,
    stats: TrendingUp,
  };

  const toolColors = {
    improve: "#D97706",
    explain: "#CA8A04",
    grammar: "#2563EB",
    proTone: "#4F46E5",
    debug: "#CC0000",
    writecode: "#059669",
    analyze: "#0D9488",
    clear: "#737373",
    stats: "#EA580C",
  };

  const ToolIcon = ({ tool }) => {
    const Icon = iosIcons[tool.id];
    const color = toolColors[tool.id];
    return Icon ? <Icon size={12} strokeWidth={2} className="mr-1" style={{ color }} /> : <span className="mr-1">{tool.icon}</span>;
  };

  return (
      <div className={cn("flex flex-row h-full w-full border-b border-ink", className)} style={fontSizeStyle}>
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />

        <div className="flex flex-col flex-1 min-w-0 h-full">

          <Header
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(p => !p)}
            isOnline={isOnline}
            activeSkill={activeSkill}
            allSkills={allSkills}
            showSkillDropdown={showSkillDropdown}
            setShowSkillDropdown={setShowSkillDropdown}
            skillRef={skillRef}
            settings={settings}
            setSettings={setSettings}
            preferences={preferences}
            setPreferences={setPreferences}
            createNewSession={createNewSession}
            onClearChat={() => setShowClearConfirm(true)}
            onSearch={() => { setShowSearch(p => !p); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
            onExport={exportTxt}
            artifactPanelOpen={artifactPanelOpen}
            onToggleArtifactPanel={() => setArtifactPanelOpen(p => !p)}
          />

          {/* ── Search Bar ──────────────────────────── */}
          {showSearch && (
            <div className="border-b-2 border-dashed border-ink/30 bg-yellow/20">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Search size={16} strokeWidth={2.5} className="text-muted-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  className="flex-1 bg-white border-2 border-ink font-body text-base text-ink placeholder:text-muted-400/60 input-sketch"
                  style={{ borderRadius: radius.wobblySm }}
                  placeholder="Search in this chat..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") setShowSearch(false); }}
                />
                {searchQuery && (
                  <span className="font-mono text-[10px] text-muted-500">{searchMatches} match{searchMatches !== 1 ? "es" : ""}</span>
                )}
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors">
                  <XIcon size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {preferences.currentPage === "chat" ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* ── Messages ─────────────────────────── */}
              <div className="flex flex-1 min-h-0">
              <div ref={scrollRef} onScroll={handleScroll} onClick={() => { if (!isMobile) setInputVisible(false); }} className={`relative flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 dot-grid-bg ${settings.compactMode ? 'compact-mode' : ''}`}>
                {showScrollDown && (
                  <button
                    onClick={scrollToBottom}
                    className="sticky bottom-2 z-10 ml-auto mr-2 w-10 h-10 border-2 border-ink bg-white flex items-center justify-center hover:bg-red hover:text-white transition-all duration-100 shadow-hard hover:translate-x-0.5 hover:translate-y-0.5"
                    style={{ borderRadius: radius.wobblySm }}
                    title="Scroll to bottom"
                  >
                    <ChevronDown size={14} strokeWidth={1.5} />
                  </button>
                )}
                <div className="mx-auto max-w-3xl">
                  {chats.filter(c => c.type === "ch").length === 0 ? (
                    <ConversationStarters onSelect={(s) => {
                      setQuery(s);
                      setCharCount(s.length);
                      setTimeout(() => {
                        handleSend({ target: { value: s } }, draftCount, []);
                        setQuery("");
                        setCharCount(0);
                      }, 0);
                    }} />
                  ) : (
                    chats.map((obj, index) => {
                      if (obj.type === "ms") {
                        return (
                          <div key={index} className="mb-6 border-b border-divider pb-4">
                            {obj.content.map((line, i) => (
                              <p key={i} className="font-mono text-xs text-muted-500 uppercase tracking-widest mb-1">{line}</p>
                            ))}
                          </div>
                        );
                      }
                      const prevChat = index > 0 ? [...chats].slice(0, index).reverse().find(c => c.type === "ch" && c.provider) : null;
                      return (
                        <MessageBlock
                          key={obj.id || index}
                          obj={obj} index={index}
                          isLast={index === chats.length - 1}
                          isCopied={isCopied}
                          copyToClipboard={copyToClipboard}
                          onRetry={onRetry}
                          onEditSubmit={onEditSubmit || ((newQ) => handleSend({ target: { value: newQ } }, draftCount))}
                          onMergeDrafts={onMergeDrafts}
                          onSummarizeDrafts={onSummarizeDrafts}
                          onKeepDraft={onKeepDraft}
                          onContinue={onContinue}
                          prevProvider={prevChat?.provider}
                        />
                      );
                    })
                  )}

                  {/* ── Loading Indicator ────────────────── */}
                  {loading && (
                    <div className="flex items-center justify-between py-4 border-t border-divider mt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-[3px] h-4">
                          {[6, 14, 10, 16].map((h, i) => (
                            <div key={i} className="w-[3px] bg-ink" style={{ height: `${h}px`, animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite alternate` }} />
                          ))}
                        </div>
                        <div>
                          <span className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">
                            {autoContinuationProgress
                              ? `Auto-continuing (${autoContinuationProgress.current}/${autoContinuationProgress.total})`
                              : searchStage === "searching"
                                ? `Searching the web`
                                : searchStage === "thinking"
                                  ? `Thinking`
                                  : `Generating response`}
                            <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>
                          </span>
                          <p className="font-mono text-[9px] text-muted-500 uppercase tracking-widest">
                            {autoContinuationProgress
                              ? `AI is extending the response — continuing automatically`
                              : searchStage === "searching"
                                ? `Looking up current information`
                                : searchStage === "thinking"
                                  ? `AI is analyzing your request`
                                  : `AI is processing your request`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={onStopAI}
                        className="btn-sketch btn-sketch-sm bg-red text-white border-red"
                      >
                        <XIcon size={14} strokeWidth={2.5} className="inline mr-1" /> Stop
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
              <ChatNavigation chats={chats} scrollRef={scrollRef} />
              </div>

              {/* ── Input Area ──────────────────────────── */}
              {inputVisible && (
              <div onDragOver={handleDragOver} onDrop={handleDrop}>
                <div className="mx-auto max-w-3xl border-t border-black px-4 py-3">
                  {/* AI Tools Bar */}
                  {settings.showToolbar !== false && aiTools.length > 0 && (
                    <div className="mb-3 border border-ink">
                      <button
                        onClick={() => setToolbarOpen(p => !p)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted-100 font-mono text-[10px] uppercase tracking-widest text-ink hover:bg-muted-200 transition-colors"
                      >
                        <span>AI Tools</span>
                        {toolbarOpen ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
                      </button>
                      {toolbarOpen && (
                        <div className="p-2">
                          <div className="flex flex-wrap gap-2">
                            {aiTools.filter(t => !(settings.hiddenTools || []).includes(t.id)).map(tool => (
                              <button
                                key={tool.id}
                                onClick={() => handleToolClick(tool)}
                                className="font-body text-[10px] flex justify-between items-center text-ink uppercase tracking-widest px-3 py-1.5 border-2 border-ink hover:bg-ink hover:text-paper transition-all duration-100 hover:-rotate-1"
                                style={{ borderRadius: radius.wobblySm }}
                                title={tool.prompt ? `Prompt: ${tool.prompt}` : `Command: ${tool.cmd}`}
                              >
                                <ToolIcon tool={tool} />
                                {tool.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Command palette */}
                  {showCmdMenu && (
                    <div className="border-2 border-ink bg-paper mb-2 max-h-64 overflow-y-auto shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
                      <div className="font-mono text-[10px] text-muted-500 uppercase tracking-widest px-3 py-2 border-b-2 border-ink bg-muted-100">
                        Available Commands
                      </div>
                      {(() => {
                        const firstWord = query.toLowerCase().split(' ')[0];
                        const matched = COMMANDS.filter(c => c.cmd.startsWith(firstWord));
                        if (matched.length === 0) {
                          return (
                            <div className="px-3 py-4 text-center font-mono text-[10px] text-muted-500">
                              {query === '/'
                                ? 'Type a command name e.g. /help'
                                : `No command matches "${query}"`}
                            </div>
                          );
                        }
                        return matched.map(c => {
                          const Icon = c.icon;
                          return (
                            <button
                              key={c.cmd}
                              onClick={() => handleCmdSelect(c.cmd)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left font-body text-sm hover:bg-yellow/30 transition-all duration-100 border-b-2 border-dashed border-ink/20 last:border-b-0 hover:-translate-x-0.5"
                            >
                              <span className="font-semibold text-ink flex items-center gap-2">
                                <Icon size={14} strokeWidth={1.5} style={{ color: c.color }} />
                                {c.cmd}
                              </span>
                              <span className="text-muted-500 text-[10px]">{c.desc}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* ── Attached files chips ── */}
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {attachedFiles.map(f => (
                        <AttachedFileChip key={f.name} file={f} onRemove={removeFile} />
                      ))}
                    </div>
                  )}

                  {/* ── File error ── */}
                  {fileError && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-1.5 border-2 border-red bg-red/5 font-body text-sm text-red shadow-hard-sm" style={{ borderRadius: radius.wobblySm }}>
                      <AlertCircle size={13} strokeWidth={2.5} />
                      {fileError}
                      <button onClick={() => setFileError("")} className="ml-auto hover:text-ink transition-colors">
                        <XIcon size={10} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}

                  {/* ── Textarea row ── */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        dir="auto"
                        className="input-sketch w-full resize-none min-h-[48px] max-h-[160px] text-base md:text-lg"
                        placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIdx]}
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        autoFocus
                        disabled={loading}
                        rows={1}
                      />
                      {charCount > 0 && (
                        <span className="absolute bottom-1 right-2 font-mono text-[9px] text-muted-500 bg-paper px-1">
                          ~{estTokens} tokens | {charCount} chars
                        </span>
                      )}
                    </div>

                    {/* ── Attach file button ── */}
                    <button
                      type="button"
                      title={`Attach file (max ${MAX_FILES}, ${MAX_FILE_SIZE_MB}MB each)`}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || attachedFiles.length >= MAX_FILES}
                      className={cn(
                        "min-h-[44px] min-w-[44px] flex items-center justify-center border-2 transition-all duration-100",
                        attachedFiles.length > 0
                          ? "border-ink bg-ink text-paper shadow-hard"
                          : "border-ink text-ink hover:bg-muted-100 shadow-hard-sm hover:-rotate-1 hover:translate-x-0.5 hover:translate-y-0.5",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                      style={{ borderRadius: radius.wobblySm }}
                    >
                      <Paperclip size={16} strokeWidth={2.5} />
                      {attachedFiles.length > 0 && (
                        <span className="ml-1 font-mono text-[10px]">{attachedFiles.length}</span>
                      )}
                    </button>

                    {/* Hidden native file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_EXTENSIONS.join(",")}
                      className="hidden"
                      onChange={e => { handleFileSelect(e.target.files); e.target.value = ""; }}
                    />

                    {/* Voice input */}
                    {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                      <button
                        type="button"
                        title={voiceListening ? "Stop recording" : "Voice input"}
                        onClick={toggleVoiceInput}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center border-2 transition-all duration-100 ${
                          voiceListening
                            ? "border-red bg-red text-white animate-pulse shadow-hard"
                            : "border-ink text-ink hover:bg-muted-100 shadow-hard-sm hover:-rotate-1 hover:translate-x-0.5 hover:translate-y-0.5"
                        }`}
                        style={{ borderRadius: radius.wobblySm }}
                      >
                        {voiceListening ? <MicOff size={16} strokeWidth={2.5} /> : <Mic size={16} strokeWidth={2.5} />}
                      </button>
                    )}

                    {/* Web search toggle */}
                    <button
                      type="button"
                      title={searchEnabled ? "Web search on — click to disable" : "Web search off — click to enable"}
                      onClick={() => setSearchEnabled(p => !p)}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center border-2 transition-all duration-100 ${
                        searchEnabled
                          ? "border-ink bg-ink text-paper shadow-hard"
                          : "border-ink text-ink hover:bg-muted-100 shadow-hard-sm hover:-rotate-1 hover:translate-x-0.5 hover:translate-y-0.5"
                      }`}
                      style={{ borderRadius: radius.wobblySm }}
                    >
                      <span className="text-base">{searchEnabled ? "🌐" : "🌍"}</span>
                    </button>

                    {/* Draft variants */}
                    <div ref={draftRef} className="relative">
                      <button
                        type="button"
                        title="Draft variants"
                        onClick={() => setShowDraftMenu(p => !p)}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center border-2 transition-all duration-100 ${
                          draftCount > 1
                            ? "border-ink bg-ink text-paper shadow-hard"
                            : "border-ink text-ink hover:bg-muted-100 shadow-hard-sm hover:-rotate-1 hover:translate-x-0.5 hover:translate-y-0.5"
                        }`}
                        style={{ borderRadius: radius.wobblySm }}
                      >
                        <Layers size={16} strokeWidth={2.5} />
                        {draftCount > 1 && <span className="ml-1 font-mono text-[10px]">{draftCount}</span>}
                      </button>

                      {showDraftMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-44 border-2 border-ink bg-paper shadow-hard" style={{ borderRadius: radius.wobblyMd }}>
                          <div className="font-body text-[9px] text-muted-500 uppercase tracking-widest px-3 py-2 border-b-2 border-dashed border-ink/30 bg-muted-100">
                            Draft Variants
                          </div>
                          {[1, 2, 3].map(n => (
                            <button
                              key={n}
                              onClick={() => { setDraftCount(n); setShowDraftMenu(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2 font-body text-sm text-left transition-all duration-100 border-b-2 border-dashed border-ink/20 last:border-b-0 ${
                                draftCount === n
                                  ? "bg-ink text-paper"
                                  : "text-ink hover:bg-yellow/30 hover:-translate-x-0.5"
                              }`}
                            >
                              <span className={`w-6 h-6 flex items-center justify-center border-2 text-[10px] font-bold ${
                                draftCount === n
                                  ? "border-paper text-paper"
                                  : "border-ink text-ink"
                              }`} style={{ borderRadius: radius.wobblySm }}>
                                {n}
                              </span>
                              <span className="flex-1">
                                <span className="block text-sm font-semibold">
                                  {n === 1 ? "Single" : n === 2 ? "Double" : "Triple"}
                                </span>
                                <span className="block text-[9px] text-muted-500 uppercase tracking-widest">
                                  {n === 1 ? "One response" : n === 2 ? "Two variants" : "Three variants"}
                                </span>
                              </span>
                              {draftCount === n && (
                                <Check size={13} strokeWidth={2.5} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Send / Stop */}
                    <button
                      onClick={() => {
                        if (loading) { onStopAI?.(); return; }
                        if (!query.trim() && attachedFiles.length === 0) return;
                        executeCommand(query) || doSend({ target: { value: query } });
                      }}
                      disabled={!loading && !query.trim() && attachedFiles.length === 0}
                      className={cn(
                        "btn-sketch btn-sketch-icon",
                        loading && "bg-red text-white border-red"
                      )}
                      style={{ borderRadius: radius.wobblyMd }}
                      title={loading ? "Stop Generation" : "Send Message"}
                    >
                      {loading ? <XIcon size={20} strokeWidth={2.5} /> : <SendHorizonal size={20} strokeWidth={2.5} />}
                    </button>
                  </div>

                  {settings.showHintBar !== false && (
                    <div className="flex items-center gap-4 mt-2 font-mono text-[9px] text-muted-500 uppercase tracking-widest">
                      <span><kbd className="border border-ink px-1">Enter</kbd> send</span>
                      <span><kbd className="border border-ink px-1">Shift+Enter</kbd> newline</span>
                      <span><kbd className="border border-ink px-1">/</kbd> commands</span>
                      <span><kbd className="border border-ink px-1">📎</kbd> attach file</span>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          ) : (
            <GuidePage />
          )}
        </div>

        <ArtifactPanel isOpen={artifactPanelOpen} onClose={() => setArtifactPanelOpen(false)} />

        {/* ── Clear Confirm Dialog ─────────────────── */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
            <div
              className="card-sketch card-sketch-tape p-6 max-w-sm w-full mx-4 bg-white shadow-hard"
              style={{ borderRadius: radius.wobblyMd }}
            >
              <p className="font-serif text-2xl font-bold text-ink mb-2 -rotate-1">Clear Chat?</p>
              <p className="font-body text-lg text-muted-600 mb-6">This will wipe the current session&apos;s history. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => { clearCurrentChat(); setShowClearConfirm(false); setQuery(""); }} className="btn-sketch btn-sketch-sm flex-1">Clear</button>
                <button onClick={() => setShowClearConfirm(false)} className="btn-sketch btn-sketch-sm btn-sketch-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

function ConversationStarters({ onSelect }) {
  const categories = [
    {
      title: "✍️ Writing",
      items: ["Write a professional email", "Help me with my essay", "Create a social media post"],
    },
    {
      title: "🎓 Learning",
      items: ["Explain a concept simply", "Quiz me on a topic", "What should I know about..."],
    },
    {
      title: "💡 Ideas",
      items: ["Brainstorm ideas for...", "What are the pros and cons of...", "Help me plan..."],
    },
    {
      title: "💻 Tech",
      items: ["Debug my code", "Explain this error", "Help me build..."],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl py-8 relative">
      <div className="hidden md:block absolute -right-8 top-16 text-red font-serif text-4xl rotate-12 animate-sketch-bounce">→</div>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-center mb-2 -rotate-1" style={{ animation: "fadeInUp 0.4s ease-out forwards" }}>
        Hi, I&apos;m ChatForge!
      </h2>
      <p className="font-body text-lg md:text-xl text-center text-muted-500 mb-8 rotate-1" style={{ animation: "fadeInUp 0.4s ease-out 0.15s forwards", opacity: 0 }}>
        Your AI assistant — scribble anything below.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {categories.map((cat, ci) => (
          <div
            key={cat.title}
            className={`card-sketch p-4 md:p-5 ${ci % 2 === 0 ? '-rotate-1' : 'rotate-1'} hover:rotate-0 hover:shadow-hard transition-all duration-100 ${ci === 0 ? 'card-sketch-tape' : ci === 2 ? 'card-sketch-postit' : ''}`}
            style={{ animation: `fadeInUp 0.4s ease-out ${0.3 + ci * 0.12}s forwards`, opacity: 0, borderRadius: radius.wobblyMd }}
          >
            <h3 className="font-serif text-lg font-bold mb-3 text-ink">
              {cat.title}
            </h3>
            {cat.items.map((item, ii) => (
              <button
                key={item}
                onClick={() => onSelect(item)}
                className="w-full text-left text-base md:text-lg font-body text-ink py-1.5 hover:text-red hover:translate-x-1 transition-all duration-100 block"
                style={{ animation: `fadeInUp 0.35s ease-out ${0.5 + ci * 0.12 + ii * 0.1}s forwards`, opacity: 0 }}
              >
                {item} →
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

