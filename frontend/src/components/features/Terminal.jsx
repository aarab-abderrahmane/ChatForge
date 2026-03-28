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
} from "lucide-react";

// Context
import { chatsContext } from "../../context/chatsContext";

// ──────────────────────────────────────────────────────────────
// Animated intro spans (for welcome messages)
// ──────────────────────────────────────────────────────────────
export const AnimatedSpan = ({ children, delay = 0, className, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: -5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: delay / 1000 }}
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
  { cmd: "//>clear",  desc: "Clear current chat history",      icon: "🗑" },
  { cmd: "//>help",   desc: "Show keyboard shortcuts & tips",   icon: "❓" },
  { cmd: "//>model",  desc: "Show current AI model info",       icon: "🤖" },
  { cmd: "//>export", desc: "Export this chat as .txt file",    icon: "📤" },
  { cmd: "//>new",    desc: "Start a new chat session",         icon: "✨" },
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
}) => {
  const COMMAND_PREFIX = "//>";

  const { preferences, settings, clearCurrentChat, createNewSession } =
    useContext(chatsContext);

  const [showSettings, setShowSettings] = useState(false);
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [charCount, setCharCount] = useState(0);

  const textareaRef = useRef(null);
  const settingsRef = useRef(null);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (query.trim().length === 0 || loading) return;
      executeCommand(query) || doSend(e);
    }
    if (e.key === "Escape") {
      setShowCmdMenu(false);
    }
  };

  const doSend = (e) => {
    setQuery("");
    setCharCount(0);
    handleSend(e);
  };

  // Execute built-in commands; returns true if consumed
  const executeCommand = (val) => {
    const trimmed = val.trim();
    if (!trimmed.startsWith(COMMAND_PREFIX)) return false;

    const cmd = trimmed.toLowerCase();

    if (cmd === "//>clear") {
      clearCurrentChat();
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
    if (cmd === "//>help") {
      setQuery("");
      setShowCmdMenu(false);
      // handled as a fake AI message from UI — fall through to send
      return false;
    }
    if (cmd === "//>model") {
      setQuery("");
      setShowCmdMenu(false);
      return false;
    }
    if (cmd === "//>export") {
      exportTxt();
      setQuery("");
      setShowCmdMenu(false);
      return true;
    }
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

  // Message count
  const msgCount = chats.filter((c) => c.type === "ch").length;

  // Font class
  const fontStyle = {
    fontFamily:
      settings.font === "jetbrains"
        ? "'JetBrains Mono', monospace"
        : "'Fira Code', monospace",
  };

  return (
    <div
      className={cn(
        "z-10 flex flex-row glass-panel md:rounded-xl overflow-hidden",
        "h-screen w-screen md:max-h-[720px] xl:max-h-[860px]",
        "md:w-[90vw] md:max-w-[1200px]",
        className
      )}
      style={fontStyle}
    >
      {/* ── Sidebar ─────────────────────────────────── */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((p) => !p)} />

      {/* ── Main Terminal Column ─────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">

        {/* ── Header ──────────────────────────────────── */}
        <div
          className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b"
          style={{
            background: "var(--bg-header)",
            borderColor: "var(--border-green)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          {/* Traffic lights */}
          <div className="flex gap-2 items-center">
            <div className="traffic-dot red" title="Close" />
            <div className="traffic-dot yellow" title="Minimize" />
            <div className="traffic-dot green" title="Maximize" />
          </div>

          {/* Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TerminalIcon
              size={13}
              style={{ color: "var(--neon-cyan)", flexShrink: 0 }}
            />
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: "var(--neon-green)" }}
            >
              chatforge
            </span>
            <span
              className="text-xs hidden sm:inline"
              style={{ color: "rgba(200,255,192,0.3)" }}
            >
              — AI Terminal
            </span>
            <span className="cursor-blink hidden sm:inline-block" />
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* message count badge */}
            {preferences.currentPage === "chat" && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                style={{
                  color: "var(--neon-cyan)",
                  borderColor: "var(--neon-cyan-dim)",
                  background: "rgba(0,245,255,0.05)",
                }}
              >
                {msgCount} msg{msgCount !== 1 ? "s" : ""}
              </span>
            )}

            {/* New chat */}
            {preferences.currentPage === "chat" && (
              <button
                onClick={createNewSession}
                className="btn-ghost"
                title="New chat (Ctrl+N)"
              >
                <Plus size={14} />
              </button>
            )}

            {/* Clear chat */}
            {preferences.currentPage === "chat" && (
              <button
                onClick={clearCurrentChat}
                className="btn-ghost"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
            )}

            {/* Settings */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings((p) => !p)}
                className="btn-ghost"
                title="Settings"
              >
                <Settings
                  size={14}
                  style={{
                    color: showSettings ? "var(--neon-green)" : undefined,
                    transition: "transform 0.3s",
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
        {preferences.currentPage === "chat" ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Messages scroll area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5">
              {chats.map((obj, index) => {
                if (obj.type === "ms") {
                  return (
                    <div key={index} className="mb-4">
                      {obj.content.map((line, i) => (
                        <AnimatedSpan
                          key={i}
                          delay={i * 80}
                          className="text-sm mb-1"
                          style={{ color: "rgba(200,255,192,0.55)" }}
                        >
                          {line}
                        </AnimatedSpan>
                      ))}
                      <div
                        className="mt-3 mb-4 h-px"
                        style={{
                          background:
                            "linear-gradient(90deg, var(--neon-green-dim), transparent)",
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
                  />
                );
              })}

              {/* Loading indicator */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 py-3"
                  >
                    <span
                      className="loading-spin text-lg inline-block"
                      style={{ color: "var(--neon-green)" }}
                    >
                      ⟳
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "rgba(200,255,192,0.4)" }}
                    >
                      AI is thinking
                      <span className="loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ─────────────────────────────── */}
            <div className="input-wrapper px-4 py-3 relative">
              {/* Command palette */}
              <AnimatePresence>
                {showCmdMenu && (
                  <motion.div
                    className="cmd-menu"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="cmd-header">Available Commands</div>
                    {COMMANDS.filter((c) =>
                      c.cmd.startsWith(query.toLowerCase())
                    ).map((c) => (
                      <div
                        key={c.cmd}
                        className="cmd-item"
                        onClick={() => handleCmdSelect(c.cmd)}
                      >
                        <span className="cmd-text">
                          {c.icon} {c.cmd}
                        </span>
                        <span className="cmd-desc">{c.desc}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-2 w-full">
                <span
                  className="flex-shrink-0 mb-1 text-sm font-bold"
                  style={{ color: "var(--neon-cyan)" }}
                >
                  &gt;
                </span>

                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    className="input-terminal auto-expand"
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
                    }}
                  />
                  {charCount > 0 && (
                    <span
                      className="absolute bottom-0 right-0 text-[9px] px-1"
                      style={{ color: "rgba(200,255,192,0.2)" }}
                    >
                      {charCount}
                    </span>
                  )}
                </div>

                {/* Send button */}
                <button
                  onClick={() => {
                    if (!query.trim() || loading) return;
                    const syntheticEvent = {
                      target: { value: query },
                      key: "Enter",
                    };
                    executeCommand(query) || doSend(syntheticEvent);
                  }}
                  disabled={loading || !query.trim()}
                  className="flex-shrink-0 mb-1 p-1.5 rounded-lg transition-all"
                  style={{
                    background:
                      query.trim() && !loading
                        ? "rgba(57,255,20,0.15)"
                        : "transparent",
                    border: `1px solid ${query.trim() && !loading ? "var(--neon-green)" : "var(--border-green)"}`,
                    color:
                      query.trim() && !loading
                        ? "var(--neon-green)"
                        : "rgba(200,255,192,0.2)",
                    opacity: loading ? 0.4 : 1,
                    boxShadow:
                      query.trim() && !loading ? "var(--glow-green)" : "none",
                  }}
                  title="Send (Enter)"
                >
                  <SendHorizonal size={14} />
                </button>
              </div>

              {/* Hint bar */}
              <div
                className="flex items-center gap-3 mt-1.5 text-[9px]"
                style={{ color: "rgba(200,255,192,0.18)" }}
              >
                <span>
                  <kbd>Enter</kbd> send
                </span>
                <span>
                  <kbd>Shift+Enter</kbd> newline
                </span>
                <span>
                  <kbd>/&gt;</kbd> commands
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Guide page */
          <GuidePage />
        )}
      </div>
    </div>
  );
};