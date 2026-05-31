"use client";
import { cn } from "../../lib/utils";
import { useEffect, useRef, useState, useContext, useCallback } from "react";

import { MessageBlock } from "./MessageBlock";
import { Sidebar } from "./Sidebar";
import { GuidePage } from "../../pages/guidePage";

import {
  Settings, Trash2, Plus, SendHorizonal, FileText,
  Search, X as XIcon, Menu, Sparkles,
  Layers, ChevronLeft, ChevronRight, Lightbulb, Pencil, Wifi, WifiOff,
  Briefcase, Bug, Code, BarChart3, TrendingUp, ChevronUp, ChevronDown,
  RefreshCw, Download, Languages, Check, Paperclip, File, Image, FileCode,
  FileJson, AlertCircle,
} from "lucide-react";

import { chatsContext, SKILLS, MODELS } from "../../context/chatsContext";
import { ArtifactProvider, useArtifacts } from "../../context/artifactContext";
import { ArtifactPanel } from "./ArtifactPanel";

const COMMANDS = [
  { cmd: "/summarize", desc: "Summarize this conversation", icon: FileText, color: "#007AFF" },
  { cmd: "/translate", desc: "Translate text (e.g. /translate French: hello)", icon: Languages, color: "#5856D6" },
  { cmd: "/quiz", desc: "Generate a quiz (e.g. /quiz React)", icon: Lightbulb, color: "#FF9500" },
  { cmd: "/flashcards", desc: "Generate flashcards", icon: Layers, color: "#AF52DE" },
  { cmd: "/mindmap", desc: "Generate a mindmap", icon: Sparkles, color: "#FF2D55" },
  { cmd: "/help", desc: "Show keyboard shortcuts", icon: Search, color: "#8E8E93" },
  { cmd: "/skill", desc: "Show current AI skill info", icon: Code, color: "#AF52DE" },
  { cmd: "/model", desc: "Show current AI model info", icon: Wifi, color: "#007AFF" },
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
    <div className="flex items-center gap-1.5 px-2 py-1 border border-ink bg-paper font-mono text-[10px] group relative">
      <Icon size={11} strokeWidth={1.5} style={{ color: visuals.color }} />
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
  onKeepDraft, onContinue,
}) => {
  const COMMAND_PREFIX = "/";
  const {
    preferences, setPreferences, settings, setSettings, clearCurrentChat,
    createNewSession, customSkills, promptHistory, addToPromptHistory, aiTools,
    activeSessionId,
  } = useContext(chatsContext);

  const allSkills = [...SKILLS, ...(customSkills || [])];
  const activeSkill = allSkills.find(s => s.id === settings.activeSkillId) || SKILLS[0];
  const activeModel = MODELS.find(m => m.id === settings.activeModelId) || MODELS[0];

  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const skillRef = useRef(null);
  const modelRef = useRef(null);
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
    if (isMobile) return;
    const show = () => { setInputVisible(true); textareaRef.current?.focus(); };
    window.addEventListener('keydown', show);
    return () => window.removeEventListener('keydown', show);
  }, [isMobile]);

  useEffect(() => {
    const handleClick = (e) => {
      if (skillRef.current && !skillRef.current.contains(e.target)) setShowSkillDropdown(false);
      if (modelRef.current && !modelRef.current.contains(e.target)) setShowModelDropdown(false);
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
    handleSend(e, draftCount, attachedFiles);
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

    const send = (prompt) => {
      handleSend({ target: { value: prompt } }, draftCount);
      setQuery(''); setShowCmdMenu(false);
      return true;
    };

    const info = (lines) => {
      window.dispatchEvent(new CustomEvent('chatforge:stats', { detail: { statsMsg: lines } }));
      setQuery(''); setShowCmdMenu(false);
      return true;
    };

    const HANDLERS = {
      '/summarize': () => send('Please provide a concise summary of our conversation so far, highlighting the key points, decisions, and any action items discussed.'),
      '/translate': () => {
        const ci = args.indexOf(':');
        if (ci === -1) {
          return send(args.length > 30
            ? `Please translate the following text:\n\n${args}`
            : `Please translate this to ${args || 'English'}`);
        }
        const lang = args.slice(0, ci).trim();
        const text = args.slice(ci + 1).trim();
        return send(lang ? `Please translate the following text to ${lang}:\n\n${text}` : `Please translate this:\n\n${text}`);
      },
      '/quiz': () => send(`Generate a quiz${args ? ` about ${args}` : ''} with 5 multiple-choice questions. Format as JSON with fields: question, options (array of 4), answer (0-based index).`),
      '/flashcards': () => send(`Create a set of flashcards${args ? ` about ${args}` : ''} for studying. Format as JSON array with fields: front, back.`),
      '/mindmap': () => send(`Create a mindmap${args ? ` about ${args}` : ''} with a hierarchical structure. Format as JSON with fields: label (string), children (array of child nodes).`),
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
    <ArtifactProvider sessionId={activeSessionId}>
      <div className={cn("flex flex-row h-full w-full border-b border-ink", className)} style={fontSizeStyle}>
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />

        <div className="flex flex-col flex-1 min-w-0 h-full">

          {/* ── Masthead ─────────────────────────────── */}
          <header className="border-b border-ink bg-paper shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink">
              <div className="flex items-center gap-3">
                {!sidebarOpen && (
                  <button onClick={() => setSidebarOpen(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors">
                    <Menu size={18} className="text-ink" strokeWidth={1.5} />
                  </button>
                )}
                <div>
                  <h1 className="font-serif text-lg font-black uppercase tracking-tight leading-none">ChatForge</h1>
                  <p className="font-mono text-[10px] text-muted-500 uppercase tracking-widest">Digital Edition</p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-4">
                <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${isOnline ? "text-ink" : "text-red"}`}>
                  {isOnline ? <Wifi size={12} strokeWidth={1.5} /> : <WifiOff size={12} strokeWidth={1.5} />}
                  <span>{isOnline ? "Connected" : "Offline"}</span>
                </div>
                <div ref={skillRef} className="relative">
                  <button
                    onClick={() => { setShowSkillDropdown(p => !p); setShowModelDropdown(false); }}
                    className="font-mono text-[9px] text-muted-500 uppercase tracking-widest border-l border-ink pl-4 hover:text-ink transition-colors"
                  >
                    {activeSkill.icon} {activeSkill.name}
                  </button>
                  {showSkillDropdown && (
                    <div className="absolute top-full left-4 mt-1 min-w-[180px] bg-paper border border-ink shadow-lg z-50">
                      {allSkills.map(skill => (
                        <button
                          key={skill.id}
                          onClick={() => { setSettings({ ...settings, activeSkillId: skill.id }); setShowSkillDropdown(false); }}
                          className={`w-full text-left px-3 py-2 font-mono text-[10px] flex items-center gap-2 hover:bg-muted-100 transition-colors ${skill.id === settings.activeSkillId ? 'bg-muted-100 font-bold' : ''}`}
                        >
                          {skill.icon} {skill.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div ref={modelRef} className="relative">
                  <button
                    onClick={() => { setShowModelDropdown(p => !p); setShowSkillDropdown(false); }}
                    className="font-mono text-[9px] text-muted-500 uppercase tracking-widest border-l border-ink pl-4 hover:text-ink transition-colors"
                  >
                    {activeModel.icon} {activeModel.name.replace(" Instruct", "").replace(" instruct", "")}
                  </button>
                  {showModelDropdown && (
                    <div className="absolute top-full left-4 mt-1 min-w-[200px] bg-paper border border-ink shadow-lg z-50 max-h-[300px] overflow-y-auto">
                      {MODELS.map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setSettings({ ...settings, activeModelId: model.id }); setShowModelDropdown(false); }}
                          className={`w-full text-left px-3 py-2 font-mono text-[10px] flex items-center gap-2 hover:bg-muted-100 transition-colors ${model.id === settings.activeModelId ? 'bg-muted-100 font-bold' : ''}`}
                        >
                          {model.icon} {model.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {preferences.currentPage === "chat" && (
                  <ChatActions
                    createNewSession={createNewSession}
                    onClear={() => setShowClearConfirm(true)}
                    onSearch={() => { setShowSearch(p => !p); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
                    onExport={exportTxt}
                  />
                )}
                <ArtifactCountButton isOpen={artifactPanelOpen} onToggle={() => setArtifactPanelOpen(p => !p)} />
                <button onClick={() => setPreferences(prev => ({ ...prev, currentPage: "docs" }))} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Documentation">
                  <FileText size={16} strokeWidth={1.5} />
                </button>
                <button onClick={() => setPreferences(prev => ({ ...prev, currentPage: "settings" }))} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Settings">
                  <Settings size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </header>

          {/* ── Search Bar ──────────────────────────── */}
          {showSearch && (
            <div className="border-b border-ink bg-muted-100">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Search size={14} strokeWidth={1.5} className="text-muted-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-ink placeholder:text-muted-400"
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
              <div ref={scrollRef} onScroll={handleScroll} onClick={() => { if (!isMobile) setInputVisible(false); }} className="relative flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 dot-grid-bg">
                {showScrollDown && (
                  <button
                    onClick={scrollToBottom}
                    className="sticky bottom-2 z-10 ml-auto mr-2 w-8 h-8 border border-ink bg-paper flex items-center justify-center hover:bg-ink hover:text-paper transition-colors shadow-sm"
                    title="Scroll to bottom"
                  >
                    <ChevronDown size={14} strokeWidth={1.5} />
                  </button>
                )}
                <div className="mx-auto max-w-3xl">
                  {chats.map((obj, index) => {
                    if (obj.type === "ms") {
                      return (
                        <div key={index} className="mb-6 border-b border-divider pb-4">
                          {obj.content.map((line, i) => (
                            <p key={i} className="font-mono text-xs text-muted-500 uppercase tracking-widest mb-1">{line}</p>
                          ))}
                        </div>
                      );
                    }
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
                      />
                    );
                  })}

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
                            Generating response<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>
                          </span>
                          <p className="font-mono text-[9px] text-muted-500 uppercase tracking-widest">AI is processing your request</p>
                        </div>
                      </div>
                      <button
                        onClick={onStopAI}
                        className="min-h-[44px] px-4 border border-ink bg-ink text-paper font-mono text-[10px] uppercase tracking-widest hover:bg-paper hover:text-ink transition-colors"
                      >
                        <XIcon size={12} strokeWidth={1.5} className="inline mr-1" /> Stop
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
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
                                className="font-[-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10px] flex justify-between items-center text-ink uppercase tracking-widest px-3 py-1.5 border border-ink hover:bg-ink hover:text-paper transition-colors"
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
                    <div className="border border-ink bg-paper mb-2 max-h-64 overflow-y-auto">
                      <div className="font-mono text-[10px] text-muted-500 uppercase tracking-widest px-3 py-2 border-b border-ink bg-muted-100">
                        Available Commands
                      </div>
                      {(() => {
                        const matched = COMMANDS.filter(c => c.cmd.startsWith(query.toLowerCase()));
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
                              className="w-full flex items-center justify-between px-3 py-2 text-left font-mono text-xs hover:bg-muted-100 transition-colors border-b border-divider last:border-b-0"
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
                    <div className="flex items-center gap-2 mb-2 px-2 py-1 border border-red-300 bg-red-50 font-mono text-[10px] text-red-600">
                      <AlertCircle size={11} strokeWidth={2} />
                      {fileError}
                      <button onClick={() => setFileError("")} className="ml-auto">
                        <XIcon size={9} strokeWidth={2} />
                      </button>
                    </div>
                  )}

                  {/* ── Textarea row ── */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        dir="auto"
                        className="w-full bg-transparent border-b-2 border-ink px-2 py-2 font-mono text-sm text-ink placeholder:text-muted-400 outline-none resize-none min-h-[44px] max-h-[160px]"
                        placeholder="Ask anything… or type / for commands"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        autoFocus
                        disabled={loading}
                        rows={1}
                        onFocus={e => e.currentTarget.style.background = "#F5F5F5"}
                        onBlur={e => e.currentTarget.style.background = "transparent"}
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
                        "min-h-[44px] min-w-[44px] flex items-center justify-center border transition-all duration-150",
                        attachedFiles.length > 0
                          ? "border-ink bg-ink text-paper"
                          : "border-ink text-ink hover:bg-muted-100",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      <Paperclip size={16} strokeWidth={1.5} />
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

                    {/* Draft variants */}
                    <div ref={draftRef} className="relative">
                      <button
                        type="button"
                        title="Draft variants"
                        onClick={() => setShowDraftMenu(p => !p)}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center border transition-all duration-150 ${draftCount > 1 ? "border-ink bg-ink text-paper" : "border-ink text-ink hover:bg-muted-100"}`}
                      >
                        <Layers size={16} strokeWidth={1.5} />
                        {draftCount > 1 && <span className="ml-1 font-mono text-[10px]">{draftCount}</span>}
                      </button>

                      {showDraftMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-44 border border-ink bg-paper shadow-sm">
                          <div className="font-mono text-[9px] text-muted-500 uppercase tracking-widest px-3 py-2 border-b border-divider bg-muted-100">
                            Draft Variants
                          </div>
                          {[1, 2, 3].map(n => (
                            <button
                              key={n}
                              onClick={() => { setDraftCount(n); setShowDraftMenu(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2 font-mono text-xs text-left transition-colors border-b border-divider last:border-b-0 ${
                                draftCount === n
                                  ? "bg-ink text-paper"
                                  : "text-ink hover:bg-muted-100"
                              }`}
                            >
                              <span className={`w-5 h-5 flex items-center justify-center border text-[10px] font-bold ${
                                draftCount === n
                                  ? "border-paper text-paper"
                                  : "border-ink text-ink"
                              }`}>
                                {n}
                              </span>
                              <span className="flex-1">
                                <span className="block text-[11px] font-semibold">
                                  {n === 1 ? "Single" : n === 2 ? "Double" : "Triple"}
                                </span>
                                <span className="block text-[9px] text-muted-500 uppercase tracking-widest">
                                  {n === 1 ? "One response" : n === 2 ? "Two variants" : "Three variants"}
                                </span>
                              </span>
                              {draftCount === n && (
                                <Check size={12} strokeWidth={2} />
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
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-ink transition-colors bg-ink text-paper hover:bg-paper hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                      title={loading ? "Stop Generation" : "Send Message"}
                    >
                      {loading ? <XIcon size={18} strokeWidth={1.5} /> : <SendHorizonal size={18} strokeWidth={1.5} />}
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
            <div className="border border-ink bg-paper p-6 max-w-sm w-full mx-4">
              <p className="font-serif text-xl font-bold text-ink mb-2">Clear Chat?</p>
              <p className="font-body text-sm text-muted-600 mb-6">This will wipe the current session's history. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => { clearCurrentChat(); setShowClearConfirm(false); setQuery(""); }} className="flex-1 min-h-[44px] border border-ink bg-ink text-paper font-mono text-[10px] uppercase tracking-widest hover:bg-paper hover:text-ink transition-colors">Clear</button>
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 min-h-[44px] border border-ink text-ink font-mono text-[10px] uppercase tracking-widest hover:bg-muted-100 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ArtifactProvider>
  );
};

function ChatActions({ createNewSession, onClear, onSearch, onExport }) {
  const { clearFiles } = useArtifacts();
  return (
    <>
      <button onClick={() => { clearFiles(); createNewSession(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="New chat">
        <Plus size={16} strokeWidth={1.5} />
      </button>
      <button onClick={() => { clearFiles(); onClear(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Clear chat">
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
      <button onClick={onSearch} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Search (Ctrl+F)">
        <Search size={16} strokeWidth={1.5} />
      </button>
      <button onClick={onExport} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Export as .txt">
        <Download size={16} strokeWidth={1.5} />
      </button>
    </>
  );
}

function ArtifactCountButton({ isOpen, onToggle }) {
  const { getFiles, sessionId } = useArtifacts();
  const sessionFiles = getFiles(sessionId);
  return (
    <button
      onClick={onToggle}
      className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${isOpen ? "bg-muted-100" : "hover:bg-muted-100"}`}
      title={`Files (${sessionFiles.length})`}
    >
      <FileText size={16} strokeWidth={1.5} />
      {sessionFiles.length > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center bg-ink text-paper font-mono text-[8px] font-bold leading-none px-1">
          {sessionFiles.length > 9 ? "9+" : sessionFiles.length}
        </span>
      )}
    </button>
  );
}