"use client";
import { cn } from "../../lib/utils";
import { useEffect, useRef, useState, useContext, useCallback } from "react";

import { MessageBlock } from "./MessageBlock";
import { Sidebar } from "./Sidebar";
import { GuidePage } from "../../pages/guidePage";

import {
  Settings, Trash2, Plus, SendHorizonal, FileText,
  Search, X as XIcon, Wifi, WifiOff, Menu, Sparkles,
  Layers, ChevronLeft, ChevronRight,
} from "lucide-react";

import { chatsContext, SKILLS, MODELS } from "../../context/chatsContext";

const COMMANDS = [
  { cmd: "//>clear", desc: "Clear current chat history", icon: "\uD83D\uDDD1" },
  { cmd: "//>new", desc: "Start a new chat session", icon: "\u2728" },
  { cmd: "//>summarize", desc: "Summarize this conversation", icon: "\uD83D\uDCCB" },
  { cmd: "//>translate", desc: "Translate text", icon: "\uD83C\uDF0D" },
  { cmd: "//>quiz", desc: "Generate a quiz (e.g. //>quiz React)", icon: "\uD83C\uDFAF" },
  { cmd: "//>flashcards", desc: "Generate flashcards", icon: "\uD83C\uDCB4" },
  { cmd: "//>mindmap", desc: "Generate a mindmap", icon: "\uD83E\uDDE0" },
  { cmd: "//>retry", desc: "Retry the last message", icon: "\uD83D\uDD04" },
  { cmd: "//>stats", desc: "Show session statistics", icon: "\uD83D\uDCCA" },
  { cmd: "//>export", desc: "Export as .txt", icon: "\uD83D\uDCE4" },
  { cmd: "//>help", desc: "Show keyboard shortcuts", icon: "\u2753" },
  { cmd: "//>skill", desc: "Show current AI skill info", icon: "\uD83E\uDD16" },
  { cmd: "//>model", desc: "Show current AI model info", icon: "\uD83E\uDDE0" },
];

const EDITION_DATE = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

export const Terminal = ({
  chats, copyToClipboard, handleSend, loading, isCopied,
  query, setQuery, messagesEndRef, className, onRetry,
  onEditSubmit, onStopAI, onMergeDrafts, onSummarizeDrafts,
  onKeepDraft, onContinue,
}) => {
  const COMMAND_PREFIX = "//>";
  const {
    preferences, setPreferences, settings, clearCurrentChat,
    createNewSession, customSkills, promptHistory, addToPromptHistory, aiTools,
  } = useContext(chatsContext);

  const allSkills = [...SKILLS, ...(customSkills || [])];
  const activeSkill = allSkills.find(s => s.id === settings.activeSkillId) || SKILLS[0];
  const activeModel = MODELS.find(m => m.id === settings.activeModelId) || MODELS[0];

  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [charCount, setCharCount] = useState(0);
  const [promptHistIdx, setPromptHistIdx] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator?.onLine ?? true);
  const [draftCount, setDraftCount] = useState(1);

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
    if (e.key === "/") { setTimeout(() => { if (textareaRef.current?.value.startsWith("//>")) setShowCmdMenu(true); }, 10); }
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

  const doSend = (e) => {
    const val = e?.target?.value;
    if (val?.trim()) addToPromptHistory(val.trim());
    setQuery(""); setCharCount(0); setPromptHistIdx(-1);
    handleSend(e, draftCount);
  };

  const executeCommand = (val) => {
    const trimmed = val.trim();
    if (!trimmed.startsWith(COMMAND_PREFIX)) return false;
    const cmd = trimmed.toLowerCase();

    if (cmd === "//>clear" || cmd === "//> clear") { setShowClearConfirm(true); setQuery(""); setShowCmdMenu(false); return true; }
    if (cmd === "//>new") { createNewSession(); setQuery(""); setShowCmdMenu(false); return true; }
    if (cmd === "//>export") { exportTxt(); setQuery(""); setShowCmdMenu(false); return true; }
    if (cmd === "//>retry") {
      const lastChat = [...chats].reverse().find(c => c.type === "ch" && c.question);
      if (lastChat && onRetry) onRetry(lastChat.question, lastChat.id);
      setQuery(""); setShowCmdMenu(false); return true;
    }
    if (cmd === "//>stats") {
      const msgCount = chats.filter(c => c.type === "ch").length;
      const wordCount = chats.filter(c => c.type === "ch").reduce((acc, c) => acc + ((c.question || "") + " " + (c.answer || "")).split(" ").length, 0);
      window.dispatchEvent(new CustomEvent("chatforge:stats", {
        detail: { statsMsg: [
          "\uD83D\uDCCA Session Statistics",
          `\u251C Messages : ${msgCount}`,
          `\u251C Est. tokens used : ~${Math.round(wordCount * 1.3).toLocaleString()}`,
          `\u251C Active skill : ${activeSkill.icon} ${activeSkill.name}`,
          `\u2514 Active model : ${activeModel.icon} ${activeModel.name}`,
        ]},
      }));
      setQuery(""); setShowCmdMenu(false); return true;
    }
    setQuery(""); setShowCmdMenu(false); return false;
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

  return (
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
              <span className="font-mono text-[10px] text-muted-500 uppercase tracking-widest">Vol. 1 | {EDITION_DATE}</span>
              <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${isOnline ? "text-ink" : "text-red"}`}>
                {isOnline ? <Wifi size={12} strokeWidth={1.5} /> : <WifiOff size={12} strokeWidth={1.5} />}
                <span>{isOnline ? "Connected" : "Offline"}</span>
              </div>
              <span className="font-mono text-[9px] text-muted-500 uppercase tracking-widest border-l border-ink pl-4">
                {activeSkill.icon} {activeSkill.name}
              </span>
              <span className="font-mono text-[9px] text-muted-500 uppercase tracking-widest border-l border-ink pl-4">
                {activeModel.icon} {activeModel.name.replace(" Instruct", "").replace(" instruct", "")}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {preferences.currentPage === "chat" && (
                <>
                  <button onClick={createNewSession} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="New chat">
                    <Plus size={16} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => setShowClearConfirm(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Clear chat">
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => { setShowSearch(p => !p); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Search (Ctrl+F)">
                    <Search size={16} strokeWidth={1.5} />
                  </button>
                </>
              )}
              <button onClick={() => setPreferences(prev => ({ ...prev, currentPage: "docs" }))} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Documentation">
                <FileText size={16} strokeWidth={1.5} />
              </button>
              <button onClick={() => setPreferences(prev => ({ ...prev, currentPage: "settings" }))} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted-100 transition-colors" title="Settings">
                <Settings size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* ── Marquee Ticker ──────────────────── */}
          <div className="marquee-track">
            <div className="marquee-content">
              <span className="inline-flex items-center gap-6 mx-4">
                <span className="inline-flex items-center gap-2"><span className="bg-red text-paper text-[9px] font-bold px-1 py-0.5">LIVE</span> ChatForge Digital Edition — May 2026</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1"><Wifi size={10} strokeWidth={1.5} /> System: {isOnline ? "Online" : "Offline"}</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1">Messages: {msgCount}</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1">Skill: {activeSkill.icon} {activeSkill.name}</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1">Model: {activeModel.name}</span>
              </span>
              <span className="inline-flex items-center gap-6 mx-4">
                <span className="inline-flex items-center gap-2"><span className="bg-red text-paper text-[9px] font-bold px-1 py-0.5">LIVE</span> ChatForge Digital Edition — May 2026</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1"><Wifi size={10} strokeWidth={1.5} /> System: {isOnline ? "Online" : "Offline"}</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1">Messages: {msgCount}</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1">Skill: {activeSkill.icon} {activeSkill.name}</span>
                <span className="text-muted-400">|</span>
                <span className="inline-flex items-center gap-1">Model: {activeModel.name}</span>
              </span>
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 dot-grid-bg">
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
            <div className="border-t border-ink bg-paper px-4 py-3">
              {/* AI Tools Bar */}
              {settings.showToolbar !== false && aiTools.length > 0 && (
                <div className="mb-3 border border-ink p-2">
                  <div className="flex flex-wrap gap-2">
                    {aiTools.map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool)}
                        className="font-mono text-[10px] text-ink uppercase tracking-widest px-3 py-1.5 border border-ink hover:bg-ink hover:text-paper transition-colors"
                        title={tool.prompt ? `Prompt: ${tool.prompt}` : `Command: ${tool.cmd}`}
                      >
                        <span className="mr-1">{tool.icon}</span>
                        {tool.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Command palette */}
              {showCmdMenu && (
                <div className="border border-ink bg-paper mb-2 max-h-64 overflow-y-auto">
                  <div className="font-mono text-[10px] text-muted-500 uppercase tracking-widest px-3 py-2 border-b border-ink bg-muted-100">
                    Available Commands
                  </div>
                  {COMMANDS.filter(c => c.cmd.startsWith(query.toLowerCase())).map(c => (
                    <button
                      key={c.cmd}
                      onClick={() => handleCmdSelect(c.cmd)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left font-mono text-xs hover:bg-muted-100 transition-colors border-b border-divider last:border-b-0"
                    >
                      <span className="font-semibold text-ink">{c.icon} {c.cmd}</span>
                      <span className="text-muted-500 text-[10px]">{c.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-transparent border-b-2 border-ink px-2 py-2 font-mono text-sm text-ink placeholder:text-muted-400 outline-none resize-none min-h-[44px] max-h-[160px]"
                    placeholder="Ask anything\u2026 or type //> for commands"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
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

                <button
                  type="button"
                  title={draftCount > 1 ? "Multi-Draft: 3 Variants" : "Single Draft"}
                  onClick={() => setDraftCount(d => d === 1 ? 3 : 1)}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center border transition-colors ${draftCount > 1 ? "border-ink bg-ink text-paper" : "border-ink text-ink hover:bg-muted-100"}`}
                >
                  <Layers size={16} strokeWidth={1.5} />
                  {draftCount > 1 && <span className="ml-1 font-mono text-[10px]">{draftCount}</span>}
                </button>

                <button
                  onClick={() => {
                    if (loading) { onStopAI?.(); return; }
                    if (!query.trim()) return;
                    executeCommand(query) || doSend({ target: { value: query } });
                  }}
                  disabled={!loading && !query.trim()}
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
                  <span><kbd className="border border-ink px-1">/&gt;</kbd> commands</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <GuidePage />
        )}
      </div>

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
  );
};
