"use client";
import { useState, useRef, useEffect } from "react";
import {
  Menu, Wifi, WifiOff, Settings, Plus, Trash2,
  Search, Download, BookOpen, MoreVertical, FileText,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { radius } from "../../lib/design-tokens";
import { useArtifacts } from "../../context/artifactContext";

export function Header({
  sidebarOpen,
  onToggleSidebar,
  isOnline,
  activeSkill,
  allSkills,
  showSkillDropdown,
  setShowSkillDropdown,
  skillRef,
  settings,
  setSettings,
  preferences,
  setPreferences,
  createNewSession,
  onClearChat,
  onSearch,
  onExport,
  artifactPanelOpen,
  onToggleArtifactPanel,
}) {
  const { clearFiles, getFiles, sessionId } = useArtifacts();
  const sessionFiles = getFiles(sessionId);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const actionsRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNewChat = () => {
    clearFiles(sessionId);
    createNewSession();
    setShowActionsDropdown(false);
  };

  const handleClear = () => {
    clearFiles(sessionId);
    onClearChat();
    setShowActionsDropdown(false);
  };

  const handleSearchToggle = () => {
    onSearch();
    setShowActionsDropdown(false);
  };

  const handleExport = () => {
    onExport();
    setShowActionsDropdown(false);
  };

  return (
    <header className="border-b-2 border-ink bg-paper shrink-0">
      <div className="flex items-center justify-between px-1.5 sm:px-4 py-1.5 sm:py-3 gap-0.5 sm:gap-2">

        {/* ── Brand ── */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 shrink-0">
          {!sidebarOpen && (
            <button onClick={onToggleSidebar} className="btn-sketch btn-sketch-icon btn-sketch-sm !min-h-[2.25rem] !min-w-[2.25rem] sm:!min-h-[2.75rem] sm:!min-w-[2.75rem]" title="Sidebar">
              <Menu size={16} strokeWidth={2.5} className="sm:hidden" />
              <Menu size={18} strokeWidth={2.5} className="hidden sm:block" />
            </button>
          )}
          <div className="-rotate-1 min-w-0">
            <h1 className="font-serif text-lg sm:text-xl md:text-3xl font-bold text-ink leading-none truncate">
              ChatForge<span className="inline-block text-red animate-sketch-bounce ml-0.5">!</span>
            </h1>
            <p className="hidden md:block font-body text-sm md:text-base text-muted-500 rotate-1 truncate">
              your sketchbook for ideas
            </p>
          </div>
        </div>

        {/* ── Config: Connection + Skill ── */}
        <div className="flex items-center gap-0.5 sm:gap-2 md:gap-4 min-w-0">
          {/* Connection status */}
          <div className={`flex items-center gap-1 sm:gap-1.5 font-body text-sm sm:text-base ${isOnline ? "text-ink" : "text-red"}`}>
            {isOnline ? (
              <Wifi size={13} strokeWidth={2.5} className="sm:hidden" />
            ) : (
              <WifiOff size={13} strokeWidth={2.5} className="sm:hidden" />
            )}
            {isOnline ? (
              <Wifi size={14} strokeWidth={2.5} className="hidden sm:block" />
            ) : (
              <WifiOff size={14} strokeWidth={2.5} className="hidden sm:block" />
            )}
            <span className="hidden sm:inline">{isOnline ? "Connected" : "Offline"}</span>
          </div>

          {/* Skill selector */}
          <div ref={skillRef} className="relative">
            <button
              onClick={() => setShowSkillDropdown(p => !p)}
              className={cn(
                "font-body text-sm sm:text-base text-muted-500 border-l-2 border-dashed border-ink/40",
                "pl-1.5 sm:pl-4 hover:text-red transition-colors duration-100 wavy-underline",
                "flex items-center gap-1"
              )}
              title={activeSkill.name}
            >
              <span className="hidden sm:inline">{activeSkill.icon} {activeSkill.name}</span>
              <span className="sm:hidden">{activeSkill.icon}</span>
            </button>
            {showSkillDropdown && (
              <div
                className="absolute top-full left-0 sm:left-4 mt-2 min-w-[150px] sm:min-w-[180px] bg-white border-2 border-ink shadow-hard z-50"
                style={{ borderRadius: radius.wobblyMd }}
              >
                {allSkills.map(skill => (
                  <button
                    key={skill.id}
                    onClick={() => { setSettings({ ...settings, activeSkillId: skill.id }); setShowSkillDropdown(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 font-body text-sm sm:text-base flex items-center gap-2",
                      "hover:bg-yellow/50 transition-colors duration-100",
                      skill.id === settings.activeSkillId && "bg-yellow/40 font-bold"
                    )}
                  >
                    {skill.icon} {skill.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* Actions dropdown (New, Clear, Search, Export) — only on chat page */}
          {preferences.currentPage === "chat" && (
          <div ref={actionsRef} className="relative">
            <button
              onClick={() => setShowActionsDropdown(p => !p)}
              className="btn-sketch btn-sketch-icon btn-sketch-sm !min-h-[2.25rem] !min-w-[2.25rem] sm:!min-h-[2.75rem] sm:!min-w-[2.75rem]"
              title="Actions"
            >
              <MoreVertical size={15} strokeWidth={2.5} className="sm:hidden" />
              <MoreVertical size={16} strokeWidth={2.5} className="hidden sm:block" />
            </button>
            {showActionsDropdown && (
              <div
                className="absolute top-full right-0 mt-2 min-w-[160px] bg-white border-2 border-ink shadow-hard z-50"
                style={{ borderRadius: radius.wobblyMd }}
              >
                <button onClick={handleNewChat} className="w-full text-left px-3 py-2 font-body text-sm flex items-center gap-2 hover:bg-yellow/50 transition-colors">
                  <Plus size={14} strokeWidth={2.5} /> New chat
                </button>
                <button onClick={handleClear} className="w-full text-left px-3 py-2 font-body text-sm flex items-center gap-2 hover:bg-yellow/50 transition-colors">
                  <Trash2 size={14} strokeWidth={2.5} /> Clear chat
                </button>
                <button onClick={handleSearchToggle} className="w-full text-left px-3 py-2 font-body text-sm flex items-center gap-2 hover:bg-yellow/50 transition-colors">
                  <Search size={14} strokeWidth={2.5} /> Search
                </button>
                <button onClick={handleExport} className="w-full text-left px-3 py-2 font-body text-sm flex items-center gap-2 hover:bg-yellow/50 transition-colors">
                  <Download size={14} strokeWidth={2.5} /> Export
                </button>
              </div>
            )}
          </div>
          )}

          {/* Artifact counter */}
          <button
            onClick={onToggleArtifactPanel}
            className={cn(
              "btn-sketch btn-sketch-icon btn-sketch-sm relative",
              "!min-h-[2.25rem] !min-w-[2.25rem] sm:!min-h-[2.75rem] sm:!min-w-[2.75rem]",
              artifactPanelOpen && "bg-muted-200"
            )}
            style={{ borderRadius: radius.wobblySm }}
            title={`Files (${sessionFiles.length})`}
          >
            <FileText size={15} strokeWidth={1.5} className="sm:hidden" />
            <FileText size={16} strokeWidth={1.5} className="hidden sm:block" />
            {sessionFiles.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] sm:min-w-[16px] sm:h-[16px] flex items-center justify-center bg-ink text-paper font-mono text-[7px] sm:text-[8px] font-bold leading-none px-0.5 sm:px-1">
                {sessionFiles.length > 9 ? "9+" : sessionFiles.length}
              </span>
            )}
          </button>

          {/* Docs */}
          <button
            onClick={() => setPreferences(prev => ({ ...prev, currentPage: "docs" }))}
            className="btn-sketch btn-sketch-icon btn-sketch-sm !min-h-[2.25rem] !min-w-[2.25rem] sm:!min-h-[2.75rem] sm:!min-w-[2.75rem]"
            title="Documentation"
          >
            <BookOpen size={15} strokeWidth={2.5} className="sm:hidden" />
            <BookOpen size={16} strokeWidth={2.5} className="hidden sm:block" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setPreferences(prev => ({ ...prev, currentPage: "settings" }))}
            className="btn-sketch btn-sketch-icon btn-sketch-sm !min-h-[2.25rem] !min-w-[2.25rem] sm:!min-h-[2.75rem] sm:!min-w-[2.75rem]"
            title="Settings"
          >
            <Settings size={15} strokeWidth={2.5} className="sm:hidden" />
            <Settings size={16} strokeWidth={2.5} className="hidden sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
