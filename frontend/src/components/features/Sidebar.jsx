import { useContext, useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pin,
  PinOff,
  Search,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { chatsContext } from "../../context/chatsContext";
import { radius } from "../../lib/design-tokens";
import { cn } from "../../lib/utils";

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString();
}

export function Sidebar({ isOpen, onToggle }) {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    renameSession,
    pinnedSessions,
    pinSession,
  } = useContext(chatsContext);

  const [hoveredId, setHoveredId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirmDelete === id) {
      deleteSession(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 2500);
    }
  };

  const handlePin = (e, id) => {
    e.stopPropagation();
    pinSession(id);
  };

  const startRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renameSession(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleRenameKey = (e) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
  };

  const messageCount = (session) =>
    session.messages.filter((m) => m.type === "ch").length;

  const filtered = sessions
    .filter((s) =>
      searchQuery.trim()
        ? s.title.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    )
    .sort((a, b) => {
      const ap = pinnedSessions.has(a.id) ? 0 : 1;
      const bp = pinnedSessions.has(b.id) ? 0 : 1;
      return ap - bp;
    });

  return (
    <div
      className={cn(
        "flex flex-col h-full flex-shrink-0 relative bg-paper transition-all duration-200 ease-out",
        isOpen ? "w-[280px] border-r-2 border-ink" : "w-0 overflow-hidden border-r-0"
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-dashed border-ink/30">
        <span className="font-serif text-lg font-bold text-ink -rotate-1">
          Sessions
        </span>
        <button
          onClick={createNewSession}
          className="btn-sketch btn-sketch-icon btn-sketch-sm shadow-hard-sm hover:rotate-2"
          style={{ borderRadius: radius.wobblySm }}
          title="New Chat"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-ink"
          style={{ borderRadius: radius.wobblyMd }}
        >
          <Search size={16} className="text-muted-500 flex-shrink-0" strokeWidth={2.5} />
          <input
            type="text"
            className="flex-1 bg-transparent text-base font-body text-ink outline-none placeholder:text-muted-400/60"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="flex items-center justify-center w-5 h-5 text-muted-400 hover:text-red transition-colors duration-100"
              title="Clear"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Session List ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 && (
          <p className="font-body text-base text-center py-8 text-muted-400 rotate-1">
            No sessions found
          </p>
        )}
        {filtered.map((session, idx) => {
          const isActive = session.id === activeSessionId;
          const isHovered = hoveredId === session.id;
          const willDelete = confirmDelete === session.id;
          const isPinned = pinnedSessions.has(session.id);
          const isEditing = editingId === session.id;
          const count = messageCount(session);
          const rotation = idx % 2 === 0 ? "-rotate-1" : "rotate-1";

          return (
            <div
              key={session.id}
              className={cn(
                "mb-2 transition-all duration-100 cursor-pointer hover:-translate-y-0.5",
                rotation,
                isHovered && "hover:rotate-0"
              )}
              onClick={() => !isEditing && setActiveSessionId(session.id)}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className={cn(
                  "px-3 py-3 bg-white border-2 border-ink shadow-hard-sm transition-all duration-100",
                  isActive && "border-[3px] shadow-hard bg-yellow/30"
                )}
                style={{ borderRadius: radius.wobblyMd }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="flex-shrink-0 flex items-center justify-center w-7 h-7 border-2 border-ink bg-paper mt-0.5"
                    style={{ borderRadius: radius.wobblySm }}
                  >
                    {isPinned ? (
                      <Pin size={14} className="text-red" strokeWidth={2.5} />
                    ) : (
                      <MessageSquare size={14} className="text-muted-400" strokeWidth={2.5} />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={editInputRef}
                          className="flex-1 min-w-0 bg-transparent text-base font-body text-ink border-b-2 border-ink pb-0.5 outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={handleRenameKey}
                          maxLength={50}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); commitRename(); }}
                          className="flex items-center justify-center w-6 h-6 flex-shrink-0 text-ink hover:text-red transition-colors duration-100"
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <p className={cn(
                        "text-base font-body truncate leading-snug",
                        isActive ? "text-ink font-bold" : "text-ink"
                      )}>
                        {session.title}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={12} className="text-muted-400" strokeWidth={2.5} />
                      <span className="font-body text-sm text-muted-400">
                        {formatRelativeTime(session.createdAt)}
                      </span>
                      <span className="font-body text-sm text-muted-400">
                        · {count} msg
                      </span>
                    </div>
                  </div>

                  {(isHovered || isActive) && !isEditing && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => startRename(e, session)}
                        className="flex items-center justify-center w-7 h-7 text-muted-400 hover:text-ink transition-colors duration-100"
                        title="Rename"
                      >
                        <Pencil size={13} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={(e) => handlePin(e, session.id)}
                        className={cn(
                          "flex items-center justify-center w-7 h-7 transition-colors duration-100",
                          isPinned ? "text-red" : "text-muted-400 hover:text-ink"
                        )}
                        title={isPinned ? "Unpin" : "Pin to top"}
                      >
                        {isPinned ? <PinOff size={13} strokeWidth={2.5} /> : <Pin size={13} strokeWidth={2.5} />}
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className={cn(
                          "flex items-center justify-center w-7 h-7 transition-colors duration-100",
                          willDelete ? "text-red" : "text-muted-400 hover:text-red"
                        )}
                        title={willDelete ? "Click again to confirm" : "Delete"}
                      >
                        <Trash2 size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </div>

                {willDelete && (
                  <p className="font-body text-sm mt-2 ml-9 text-red rotate-1">
                    Click again to confirm!
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="border-t-2 border-dashed border-ink/30 px-4 py-3">
        <p className="font-body text-sm text-muted-400">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          {pinnedSessions.size > 0 && (
            <span className="text-red"> · {pinnedSessions.size} pinned</span>
          )}
        </p>
      </div>

      {/* ── Toggle Button ── */}
      <button
        onClick={onToggle}
        className="absolute -right-[22px] top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-[22px] h-12 bg-white border-2 border-ink border-l-0 text-ink hover:bg-red hover:text-white shadow-hard-sm transition-all duration-100 hover:translate-x-0.5 wobbly-sm"
      >
        {isOpen ? <ChevronLeft size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
