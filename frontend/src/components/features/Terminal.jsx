"use client";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, useContext, useCallback } from "react";

// Sub-components
import { MessageBlock } from "./MessageBlock";
import { Sidebar } from "./Sidebar";
import { SettingsPanel } from "./SettingsPanel";
import { GuidePage } from "../../pages/guidePage";

// Icons
import {
  Settings,
  Trash2,
  Plus,
  TerminalIcon,
  SendHorizonal,
  FileText,
  Bug,
  Lightbulb,
  Languages,
  Sparkles,
  Code2,
  List,
  MessageSquare,
  Briefcase,
  Network,
  PenLine,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Search,
  X as XIcon,
  Wifi,
  WifiOff,
  Keyboard,
  PieChart,
  Target,
  GitMerge,
  Zap,
  Mail,
  Menu,
  AlignLeft,
  Layers,
} from "lucide-react";

// Context
import { chatsContext, SKILLS, MODELS } from "../../context/chatsContext";

// ──────────────────────────────────────────────────────────────
// Animated intro spans (for welcome messages)
// ──────────────────────────────────────────────────────────────
export const AnimatedSpan = ({ children, delay = 0, className, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: -5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1], delay: delay / 1000 }}
    className={cn("grid text-sm text-wrap font-normal tracking-tight", className)}
    {...props}
  >
    {children}
  </motion.div>
);

// ──────────────────────────────────────────────────────────────
// Command palette data
// ──────────────────────────────────────────────────────────────
const COMMANDS = [
  { cmd: "//>clear", desc: "Clear current chat history", icon: "🗑" },
  { cmd: "//>new", desc: "Start a new chat session", icon: "✨" },
  { cmd: "//>summarize", desc: "Summarize this conversation", icon: "📋" },
  { cmd: "//>translate", desc: "Translate text", icon: "🌍" },
  { cmd: "//>quiz", desc: "Generate a quiz (e.g. //>quiz React)", icon: "🎯" },
  { cmd: "//>flashcards", desc: "Generate flashcards (e.g. //>flashcards Python)", icon: "🎴" },
  { cmd: "//>mindmap", desc: "Generate a mindmap (e.g. //>mindmap AI)", icon: "🧠" },
  { cmd: "//>retry", desc: "Retry the last message", icon: "🔄" },
  { cmd: "//>stats", desc: "Show session statistics", icon: "📊" },
  { cmd: "//>export", desc: "Export this chat as .txt file", icon: "📤" },
  { cmd: "//>help", desc: "Show keyboard shortcuts & tips", icon: "❓" },
  { cmd: "//>skill", desc: "Show current AI skill info", icon: "🤖" },
  { cmd: "//>model", desc: "Show current AI model info", icon: "🧠" },
];

// ──────────────────────────────────────────────────────────────
// Main Terminal component
// ──────────────────────────────────────────────────────────────
export const Terminal = ({
  chats,
  copyToClipboard,
  handleSend,
  loading,
  isCopied,
  query,
  setQuery,
  messagesEndRef,
  className,
  onRetry,
  onEditSubmit,
  onStopAI,
  onMergeDrafts,
  onSummarizeDrafts,
  onKeepDraft,
  onContinue,
}) => {
  const COMMAND_PREFIX = "//>";

  const {
    preferences,
    setPreferences,
    settings,
    clearCurrentChat,
    createNewSession,
    customSkills,
    promptHistory,
    addToPromptHistory,
    aiTools,
  } = useContext(chatsContext);

  const allSkills = [...SKILLS, ...(customSkills || [])];
  const activeSkill = allSkills.find(s => s.id === settings.activeSkillId) || SKILLS[0];
  const activeModel = MODELS.find(m => m.id === settings.activeModelId) || MODELS[0];

  const [showSettings, setShowSettings] = useState(false);
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [charCount, setCharCount] = useState(0);
  const [promptHistIdx, setPromptHistIdx] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator?.onLine ?? true);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
  const [draftCount, setDraftCount] = useState(1);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const textareaRef = useRef(null);
  const settingsRef = useRef(null);
  const toolbarScrollRef = useRef(null);
  const searchInputRef = useRef(null);

  const scrollToolbar = (dir) => {
    const el = toolbarScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 120, behavior: "smooth" });
  };

  // Online/offline detection
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Close settings on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [query, resizeTextarea]);

  // Keyboard shortcut handler
  const handleKeyDown = (e) => {
    // Ctrl+F → open in-chat search
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      setShowSearch((p) => !p);
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

    // ↑ cycle back through prompt history
    if (e.key === "ArrowUp" && !query && promptHistory.length > 0) {
      e.preventDefault();
      const nextIdx = Math.min(promptHistIdx + 1, promptHistory.length - 1);
      setPromptHistIdx(nextIdx);
      setQuery(promptHistory[nextIdx]);
      setCharCount(promptHistory[nextIdx].length);
      return;
    }

    // ↓ cycle forward
    if (e.key === "ArrowDown" && promptHistIdx >= 0) {
      e.preventDefault();
      const nextIdx = promptHistIdx - 1;
      if (nextIdx < 0) {
        setPromptHistIdx(-1);
        setQuery("");
        setCharCount(0);
      } else {
        setPromptHistIdx(nextIdx);
        setQuery(promptHistory[nextIdx]);
        setCharCount(promptHistory[nextIdx].length);
      }
      return;
    }

    if (e.key === "Escape") {
      setShowCmdMenu(false);
      setShowSearch(false);
    }
    if (e.key === "/") {
      setTimeout(() => {
        if (textareaRef.current?.value.startsWith("//>")) setShowCmdMenu(true);
      }, 10);
    }
  };

  const handleToolClick = (tool) => {
    if (tool.cmd) {
      // Direct command execution
      executeCommand(tool.cmd) || handleSend({ target: { value: tool.cmd } }, draftCount);
      setQuery("");
      setCharCount(0);
    } else if (tool.prompt) {
      // Power action: If user has typed something, submit immediately
      if (query.trim().length > 0) {
        const fullPrompt = `${tool.prompt}\n\n${query.trim()}`;
        handleSend({ target: { value: fullPrompt } }, draftCount);
        setQuery("");
        setCharCount(0);
      } else {
        // If empty, grab the last AI message as context
        const lastChat = [...chats].reverse().find((c) => c.type === "ch" && c.answer);
        if (lastChat && lastChat.answer) {
          const contextText = lastChat.answer.length > 800 ? lastChat.answer.substring(0, 800) + "\n...[truncated]" : lastChat.answer;
          const combined = `${tool.prompt}\n\n"${contextText}"`;
          setQuery(combined);
          setCharCount(combined.length);
          setTimeout(() => {
            textareaRef.current?.focus();
            resizeTextarea();
          }, 0);
        } else {
          // Fallback if no context available
          const newVal = tool.prompt;
          setQuery(newVal);
          setCharCount(newVal.length);
          setTimeout(() => {
            textareaRef.current?.focus();
            resizeTextarea();
          }, 0);
        }
      }
    }
  };

  const doSend = (e) => {
    const val = e?.target?.value;
    if (val?.trim()) addToPromptHistory(val.trim());
    setQuery("");
    setCharCount(0);
    setPromptHistIdx(-1);
    handleSend(e, draftCount);
  };

  // Execute built-in commands; returns true if consumed (no AI call needed)
  // Returns false to let the caller send query to AI
  const executeCommand = (val) => {
    const trimmed = val.trim();
    if (!trimmed.startsWith(COMMAND_PREFIX)) return false;

    const cmd = trimmed.toLowerCase();

    if (cmd === "//>clear" || cmd === "//> clear") {
      setShowClearConfirm(true);
      setQuery("");
      setShowCmdMenu(false);
      return true;
    }
    if (cmd === "//>new") {
      createNewSession();
      setQuery("");
      setShowCmdMenu(false);
      return true;
    }
    if (cmd === "//>export") {
      exportTxt();
      setQuery("");
      setShowCmdMenu(false);
      return true;
    }
    if (cmd === "//>retry") {
      // Find the last chat message and retry it
      const lastChat = [...chats].reverse().find((c) => c.type === "ch" && c.question);
      if (lastChat && onRetry) {
        onRetry(lastChat.question, lastChat.id);
      }
      setQuery("");
      setShowCmdMenu(false);
      return true;
    }
    if (cmd === "//>stats") {
      // Stats are shown as a system message inserted into the chat
      const msgCount = chats.filter((c) => c.type === "ch").length;
      const wordCount = chats
        .filter((c) => c.type === "ch")
        .reduce((acc, c) => acc + ((c.question || "") + " " + (c.answer || "")).split(" ").length, 0);
      const estTokens = Math.round(wordCount * 1.3);
      const statsMsg = [
        `📊 Session Statistics`,
        `├ Messages : ${msgCount}`,
        `├ Est. tokens used : ~${estTokens.toLocaleString()}`,
        `├ Active skill : ${activeSkill.icon} ${activeSkill.name}`,
        `└ Active model : ${activeModel.icon} ${activeModel.name}`,
      ];
      // We inject this directly without sending to AI
      // Fall through to send so App.jsx can handle it as a //> command
      // Actually we handle via a synthetic event — just set query for display
      setQuery("");
      setShowCmdMenu(false);
      // Dispatch a custom event that App.jsx can listen for
      window.dispatchEvent(new CustomEvent("chatforge:stats", { detail: { statsMsg } }));
      return true;
    }
    // //>summarize, //>translate, //>help, //>skill, //>model — fall through to AI
    setQuery("");
    setShowCmdMenu(false);
    return false;
  };

  const exportTxt = () => {
    const lines = chats
      .filter((m) => m.type === "ch")
      .flatMap((m) => [`> ${m.question}`, m.answer || "", ""]);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chatforge_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setCharCount(val.length);
    setShowCmdMenu(val.startsWith(COMMAND_PREFIX));
  };

  const handleCmdSelect = (cmd) => {
    setQuery(cmd);
    setShowCmdMenu(false);
    textareaRef.current?.focus();
  };

  // Message count + estimated tokens in current input
  const msgCount = chats.filter((c) => c.type === "ch").length;
  const estTokens = Math.round(charCount / 4);

  // Filtered messages for in-chat search
  const searchMatches = searchQuery.trim()
    ? chats.filter(
      (c) =>
        c.type === "ch" &&
        ((c.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.answer || "").toLowerCase().includes(searchQuery.toLowerCase()))
    ).length
    : 0;

  // Font style (reads fontSize from settings)
  const fontStyle = {
    fontFamily:
      settings.font === "jetbrains"
        ? "'JetBrains Mono', monospace"
        : settings.font === "cascadia"
          ? "'Cascadia Code', 'Fira Code', monospace"
          : "'Fira Code', monospace",
    fontSize: `${settings.fontSize || 14}px`,
  };

  return (
    <div
      className={cn(
        "z-10 flex flex-row glass-panel overflow-hidden",
        "h-screen w-screen",
        className
      )}
      style={fontStyle}
    >
      {/* ── Sidebar ─────────────────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((p) => !p)} />

      {/* ── Main Terminal Column ─────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">

        {/* ── Header ──────────────────────────────────── */}
        <div
          className="sticky top-0 z-30 flex items-center gap-3 md:gap-4 px-5 py-3 md:py-3 border-b"
          style={{
            background: "linear-gradient(180deg, #111c2a 0%, #0c1520 100%)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 1px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02)",
            paddingTop: isMobile ? "calc(0.75rem + env(safe-area-inset-top))" : "0.75rem",
          }}
        >
          {/* Traffic lights */}
          <div className="flex gap-2 items-center">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 mr-1 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
                title="Show Sidebar"
              >
                <Menu size={15} style={{ color: "rgba(200,255,192,0.6)" }} />
              </button>
            )}
            <div className="traffic-dot red" title="Close" />
            <div className="traffic-dot yellow" title="Minimize" />
            <div className="traffic-dot green" title="Maximize" />
          </div>

          {/* Title */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <TerminalIcon
              size={13}
              style={{ color: "rgba(0,245,255,0.7)", flexShrink: 0 }}
            />
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: "rgba(57,255,20,0.8)" }}
            >
              chatforge
            </span>
            <span
              className="text-[11px] hidden md:inline font-light"
              style={{ color: "rgba(200,255,192,0.35)" }}
            >
              — AI Terminal
            </span>

            {/* Online Status */}
            <div
              className={`flex items-center gap-1.5 ml-1 text-[9px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-md transition-colors duration-300 ${isOnline ? "" : "opacity-50"
                }`}
              style={{
                color: isOnline ? "rgba(57,255,20,0.75)" : "rgba(255,45,120,0.75)",
                background: isOnline ? "rgba(57,255,20,0.1)" : "rgba(255,45,120,0.1)",
              }}
              title={isOnline ? "Connected" : "Offline / Reconnecting..."}
            >
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
            </div>

            {/* Active Skill Badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-medium transition-all duration-200"
              style={{
                color: "rgba(0,245,255,0.7)",
                background: "rgba(0,245,255,0.06)",
                border: "1px solid rgba(0,245,255,0.12)",
              }}
              title={activeSkill.description}
            >
              <span style={{ opacity: 0.5 }}>Skill:</span>
              <span>{activeSkill.icon} {activeSkill.name}</span>
            </div>

            {/* Active Model Badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-medium transition-all duration-200"
              style={{
                color: "rgba(0,245,255,0.7)",
                background: "rgba(0,245,255,0.06)",
                border: "1px solid rgba(0,245,255,0.12)",
              }}
              title={activeModel.description}
            >
              <span style={{ opacity: 0.5 }}>Model:</span>
              <span>{activeModel.icon} {activeModel.name.replace(" Instruct", "").replace(" instruct", "")}</span>
            </div>

            <span className="cursor-blink hidden sm:inline-block" />
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* message count badge */}
            {preferences.currentPage === "chat" && (
              <span
                className="hidden xl:inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                style={{
                  color: "rgba(0,245,255,0.6)",
                  background: "rgba(0,245,255,0.06)",
                  border: "1px solid rgba(0,245,255,0.12)",
                }}
              >
                {msgCount} msg{msgCount !== 1 ? "s" : ""}
              </span>
            )}

            {/* New chat */}
            {preferences.currentPage === "chat" && (
              <button
                onClick={createNewSession}
                className="p-1.5 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
                title="New chat (Ctrl+N)"
              >
                <Plus size={14} style={{ color: "rgba(200,255,192,0.6)" }} />
              </button>
            )}

            {/* Clear chat */}
            {preferences.currentPage === "chat" && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
                title="Clear chat"
              >
                <Trash2 size={14} style={{ color: "rgba(200,255,192,0.6)" }} />
              </button>
            )}

            {/* Search */}
            {preferences.currentPage === "chat" && (
              <button
                onClick={() => {
                  setShowSearch((p) => !p);
                  if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className={`p-1.5 rounded-lg transition-all duration-200 ease-out active:scale-95 ${showSearch ? "bg-cyan-400/[0.06]" : "hover:bg-white/[0.04]"}`}
                title="Search chat (Ctrl+F)"
              >
                <Search size={14} style={{ color: showSearch ? "rgba(0,245,255,0.7)" : "rgba(200,255,192,0.6)" }} />
              </button>
            )}

            {/* Workspaces Link */}
            <button
              onClick={() => {
                setPreferences((prev) => ({
                  ...prev,
                  _prevPage: prev.currentPage,
                  currentPage: "workspaces",
                }));
              }}
              className="p-1.5 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
              title="Workspaces"
            >
              <Briefcase size={14} style={{ color: "rgba(200,255,192,0.6)" }} />
            </button>

            {/* Docs Page Link */}
            <button
              onClick={() => {
                setPreferences((prev) => ({
                  ...prev,
                  _prevPage: prev.currentPage,
                  currentPage: "docs",
                }));
              }}
              className="p-1.5 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
              title="Documentation"
            >
              <FileText size={14} style={{ color: "rgba(200,255,192,0.6)" }} />
            </button>

            {/* Settings */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings((p) => !p)}
                className="p-1.5 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
                title="Settings"
              >
                <Settings
                  size={14}
                  style={{
                    color: showSettings ? "rgba(57,255,20,0.8)" : "rgba(200,255,192,0.6)",
                    transition: "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), color 0.2s ease",
                    transform: showSettings ? "rotate(60deg)" : "rotate(0)",
                  }}
                />
              </button>

              <AnimatePresence>
                {showSettings && (
                  <SettingsPanel onClose={() => setShowSettings(false)} />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────── */}
        {/* Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="sticky top-[53px] z-30 border-b overflow-hidden"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                background: "linear-gradient(180deg, rgba(0,245,255,0.02) 0%, rgba(0,0,0,0) 100%)",
              }}
            >
              <div className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1">
                  <Search size={13} style={{ color: "rgba(0,245,255,0.6)" }} />
                  <input
                    ref={searchInputRef}
                    className="flex-1 bg-transparent border-none text-xs outline-none"
                    style={{ color: "rgba(0,245,255,0.85)" }}
                    placeholder="Search in this chat..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setShowSearch(false);
                    }}
                  />
                </div>
                {searchQuery && (
                  <div
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md transition-all duration-200"
                    style={{ color: "rgba(0,245,255,0.65)", background: "rgba(0,245,255,0.08)" }}
                  >
                    {searchMatches} match{searchMatches !== 1 ? "es" : ""}
                  </div>
                )}
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                  className="p-1.5 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-95"
                  style={{ color: "rgba(0,245,255,0.6)" }}
                >
                  <XIcon size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {preferences.currentPage === "chat" ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Messages scroll area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5  ">
              {chats.map((obj, index) => {
                if (obj.type === "ms") {
                  return (
                    <div key={index} className="mb-4">
                      {obj.content.map((line, i) => (
                        <AnimatedSpan
                          key={i}
                          delay={i * 80}
                          className="text-sm mb-1"
                          style={{ color: "rgba(200,255,192,0.5)" }}
                        >
                          {line}
                        </AnimatedSpan>
                      ))}
                      <div
                        className="mt-3 mb-4 h-px"
                        style={{
                          background:
                            "linear-gradient(90deg, rgba(57,255,20,0.25), transparent)",
                        }}
                      />
                    </div>
                  );
                }
                return (
                  <MessageBlock
                    key={obj.id || index}
                    obj={obj}
                    index={index}
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

              {/* Loading indicator */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex justify-between items-center py-4 px-1"
                  >
                    <div className="flex items-center gap-3">
                      {/* Animated activity bars */}
                      <div className="flex items-end gap-[3px] h-4">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-[3px] rounded-full"
                            style={{
                              background: "rgba(57,255,20,0.8)",
                              height: `${[6, 14, 10, 16][i]}px`,
                              animation: `pulse ${0.8 + i * 0.15}s ease-in-out ${i * 0.1}s infinite alternate`,
                              opacity: 0.5,
                              boxShadow: "0 0 4px rgba(57,255,20,0.08)",
                            }}
                          />
                        ))}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "rgba(57,255,20,0.8)" }}
                        >
                          Generating response
                          <span className="loading-dots">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </span>
                        </span>
                        <span className="text-[9px] uppercase tracking-widest font-light" style={{ color: "rgba(200,255,192,0.3)" }}>
                          AI is processing your request
                        </span>
                      </div>

                      {/* Show last used provider badge */}
                      {(() => {
                        const lastMsg = [...chats].reverse().find(c => c.type === "ch" && c.provider);
                        if (!lastMsg) return null;
                        const p = lastMsg.provider;
                        const label = p === "groq" ? "⚡ Groq" : p === "gemini" ? "🧠 Gemini" : p === "huggingface" ? "🤗 HuggingFace" : "🌐 OpenRouter";
                        return (
                          <span
                            className="text-[9px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                            style={{
                              color: "rgba(0,245,255,0.65)",
                              background: "rgba(0,245,255,0.08)",
                              border: "1px solid rgba(0,245,255,0.12)",
                            }}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </div>

                    <button
                      onClick={onStopAI}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ease-out hover:bg-[rgba(255,45,120,0.12)] active:scale-95"
                      style={{
                        background: "rgba(255,45,120,0.1)",
                        border: "1px solid rgba(255,45,120,0.25)",
                        color: "rgba(255,45,120,0.8)",
                        boxShadow: "0 0 8px rgba(255,45,120,0.06)",
                      }}
                      title="Stop generating"
                    >
                      <XIcon size={11} /> Stop
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ─────────────────────────────── */}
            <div className="input-wrapper px-4 py-3 relative">

              {/* AI Tools Bar */}
              {settings.showToolbar !== false && (
                <div className={` ${isToolbarExpanded ? "ai-toolbar-wrapper" : ""} mb-2`}>
                  <div className="flex items-center mb-1">
                    <button
                      onClick={() => setIsToolbarExpanded((p) => !p)}
                      className="flex items-center gap-1.5 text-[10px] sm:text-xs px-2.5 py-1 rounded-lg transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-[0.97]"
                      title="Toggle AI Tools"
                    >
                      <Sparkles size={12} style={{ color: "rgba(57,255,20,0.65)" }} />
                      <span className="font-medium" style={{ color: "rgba(200,255,192,0.65)" }}>{isToolbarExpanded ? "Hide AI Tools" : "Show AI Tools"}</span>
                    </button>
                  </div>

                  <AnimatePresence>
                    {isToolbarExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="ai-tool-bar" ref={toolbarScrollRef}>
                          <div className="ai-tool-group">
                            {aiTools.map((tool) => (
                              <button
                                key={tool.id}
                                onClick={() => handleToolClick(tool)}
                                className="ai-tool-btn group"
                                title={tool.prompt ? `Prompt: ${tool.prompt}` : `Command: ${tool.cmd}`}
                              >
                                <span className="text-[11px] transition-transform duration-200 ease-out group-hover:scale-110 flex items-center">{tool.icon}</span>
                                <span>{tool.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Command palette */}
              <AnimatePresence>
                {showCmdMenu && (
                  <motion.div
                    className="cmd-menu rounded-lg"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                      background: "#0e1117",
                      border: "1px solid rgba(255,255,255,0.06)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      className="cmd-header"
                      style={{ color: "rgba(200,255,192,0.3)" }}
                    >
                      Available Commands
                    </div>
                    {COMMANDS.filter((c) =>
                      c.cmd.startsWith(query.toLowerCase())
                    ).map((c) => (
                      <div
                        key={c.cmd}
                        className="cmd-item"
                        onClick={() => handleCmdSelect(c.cmd)}
                      >
                        <span className="cmd-text" style={{ color: "rgba(0,245,255,0.6)" }}>
                          {c.icon} {c.cmd}
                        </span>
                        <span className="cmd-desc" style={{ color: "rgba(200,255,192,0.3)" }}>{c.desc}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-2.5 w-full">
                <span
                  className="flex-shrink-0 mb-1.5 text-sm font-bold"
                  style={{ color: "rgba(0,245,255,0.6)" }}
                >
                  &gt;
                </span>

                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    className="input-terminal auto-expand rounded-lg"
                    placeholder="Ask anything… or type //> for commands"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    disabled={loading}
                    rows={1}
                    style={{
                      minHeight: 36,
                      maxHeight: 160,
                      overflow: "auto",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,245,255,0.06)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  {charCount > 0 && (
                    <span
                      className="absolute bottom-1 right-2 flex items-center gap-2 text-[9px] pointer-events-none"
                      style={{
                        color: "rgba(200,255,192,0.35)",
                        background: "rgba(10,12,15,0.8)",
                        paddingInline: 5,
                        borderRadius: 4,
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <span title="Estimated tokens">~{estTokens} tokens</span>
                      <span>{charCount} chars</span>
                    </span>
                  )}
                </div>

                {/* Draft Toggle */}
                <button
                  type="button"
                  title={draftCount > 1 ? "Multi-Draft: 3 Variants" : "Single Draft"}
                  onClick={(e) => { e.preventDefault(); setDraftCount(d => d === 1 ? 3 : 1); }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ease-out flex-shrink-0 mb-0.5 ${draftCount > 1
                      ? "bg-[rgba(57,255,20,0.12)] text-[rgba(57,255,20,0.75)] active:scale-95"
                      : "text-[rgba(200,255,192,0.25)] hover:bg-white/[0.04] hover:text-[rgba(200,255,192,0.55)] active:scale-95"
                    }`}
                  style={{
                    border: `1px solid ${draftCount > 1 ? "rgba(57,255,20,0.2)" : "rgba(255,255,255,0.05)"}`,
                    boxShadow: draftCount > 1 ? "0 0 8px rgba(57,255,20,0.06)" : "none",
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <Layers size={15} />
                    {draftCount > 1 && <span className="absolute -top-1.5 -right-2.5 text-[7px] font-bold bg-[rgba(57,255,20,0.2)] text-[rgba(57,255,20,0.9)] px-[3px] rounded-sm leading-none py-[1px]">{draftCount}</span>}
                  </div>
                </button>

                {/* Dynamic Action Button (Send / Stop) */}
                <button
                  onClick={() => {
                    if (loading) {
                      onStopAI?.();
                      return;
                    }
                    if (!query.trim()) return;
                    const syntheticEvent = {
                      target: { value: query },
                      key: "Enter",
                    };
                    executeCommand(query) || doSend(syntheticEvent);
                  }}
                  disabled={!loading && !query.trim()}
                  className="flex-shrink-0 mb-0.5 p-2 rounded-lg transition-all duration-200 ease-out active:scale-90"
                  style={{
                    background: loading
                      ? "rgba(255,45,120,0.12)"
                      : query.trim()
                        ? "rgba(57,255,20,0.12)"
                        : "transparent",
                    border: `1px solid ${loading ? "rgba(255,45,120,0.25)" : query.trim() ? "rgba(57,255,20,0.25)" : "rgba(255,255,255,0.05)"}`,
                    color: loading ? "rgba(255,45,120,0.8)" : query.trim() ? "rgba(57,255,20,0.8)" : "rgba(200,255,192,0.2)",
                    boxShadow: (loading || query.trim()) ? `0 0 8px ${loading ? "rgba(255,45,120,0.06)" : "rgba(57,255,20,0.06)"}` : "none",
                  }}
                  title={loading ? "Stop Generation" : "Send Message"}
                >
                  {loading ? (
                    <div className="flex items-center gap-1 px-1">
                      <XIcon size={16} />
                      <span className="text-[10px] font-semibold uppercase tracking-tighter">Stop</span>
                    </div>
                  ) : (
                    <SendHorizonal size={16} />
                  )}
                </button>
              </div>

              {/* Hint bar */}
              {settings.showHintBar !== false && (
                <div
                  className="flex items-center gap-3 mt-2 text-[9px] px-1"
                  style={{ color: "rgba(200,255,192,0.12)" }}
                >
                  <span><kbd className="px-1 py-0.5 rounded text-[8px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>Enter</kbd> send</span>
                  <span><kbd className="px-1 py-0.5 rounded text-[8px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>Shift+Enter</kbd> newline</span>
                  <span><kbd className="px-1 py-0.5 rounded text-[8px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>/&gt;</kbd> commands</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Guide page */
          <GuidePage />
        )}
      </div>
      {/* ── Confirm Clear Overlay ─────────────────────── */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            className="confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              position: "absolute",
              zIndex: 100,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="confirm-card max-w-[300px] text-center rounded-xl p-6"
              style={{
                background: "linear-gradient(180deg, #0e1117 0%, #0a0c0f 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)",
              }}
            >
              <div className="text-xl mb-3">🧹</div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: "rgba(255,45,120,0.7)" }}>
                Clear Chat?
              </div>
              <div className="text-[11px] mb-5 leading-relaxed font-light" style={{ color: "rgba(200,255,192,0.4)" }}>
                This will wipe the current session's history. This action cannot be undone.
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => { clearCurrentChat(); setShowClearConfirm(false); setQuery(""); }}
                  className="flex-1 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ease-out hover:bg-[rgba(255,45,120,0.15)] active:scale-[0.97]"
                  style={{ background: "rgba(255,45,120,0.06)", border: "1px solid rgba(255,45,120,0.15)", color: "rgba(255,45,120,0.65)" }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-[10px] transition-all duration-200 ease-out hover:bg-white/[0.04] active:scale-[0.97] uppercase tracking-wider font-medium"
                  style={{ border: "1px solid rgba(255,255,255,0.06)", color: "rgba(200,255,192,0.4)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
