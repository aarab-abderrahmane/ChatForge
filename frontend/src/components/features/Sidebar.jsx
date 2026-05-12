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
      className={`flex flex-col h-full flex-shrink-0 relative border-r border-ink bg-paper transition-all duration-200 ease-out ${isOpen ? "w-[280px]" : "w-0 overflow-hidden border-r-0"}`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink">
        <span className="font-mono text-[10px] font-bold text-ink uppercase tracking-[0.15em]">
          Sessions
        </span>
        <button
          onClick={createNewSession}
          className="flex items-center justify-center w-7 h-7 transition-colors duration-150 hover:bg-muted-100 text-ink"
          title="New Chat"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 py-2.5 border-b border-divider">
        <div className="flex items-center gap-2 border-b border-ink pb-1.5">
          <Search size={13} className="text-muted-400 flex-shrink-0" strokeWidth={1.5} />
          <input
            type="text"
            className="flex-1 bg-transparent text-xs font-body text-ink outline-none placeholder:text-muted-400"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="flex items-center justify-center w-4 h-4 text-muted-400 hover:text-ink transition-colors duration-150"
              title="Clear"
            >
              <X size={9} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Session List ── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="font-mono text-[10px] text-center py-8 text-muted-400 tracking-wider uppercase">
            No sessions found
          </p>
        )}
        {filtered.map((session) => {
          const isActive = session.id === activeSessionId;
          const isHovered = hoveredId === session.id;
          const willDelete = confirmDelete === session.id;
          const isPinned = pinnedSessions.has(session.id);
          const isEditing = editingId === session.id;
          const count = messageCount(session);

          return (
            <div
              key={session.id}
              className={`border-b border-divider transition-all duration-150 cursor-pointer ${
                isActive
                  ? "border-l-4 border-red bg-muted-100"
                  : "border-l-4 border-transparent hover:bg-muted-100"
              }`}
              onClick={() => !isEditing && setActiveSessionId(session.id)}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5">
                    {isPinned ? (
                      <Pin size={12} className="text-red" strokeWidth={1.5} />
                    ) : (
                      <MessageSquare size={12} className="text-muted-400" strokeWidth={1.5} />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={editInputRef}
                          className="flex-1 min-w-0 bg-transparent text-sm font-body text-ink border-b border-ink pb-0.5 outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={handleRenameKey}
                          maxLength={50}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); commitRename(); }}
                          className="flex items-center justify-center w-5 h-5 flex-shrink-0 text-ink hover:text-red transition-colors duration-150"
                        >
                          <Check size={10} strokeWidth={1.5} />
                        </button>
                      </div>
                    ) : (
                      <p className={`text-sm font-body truncate leading-snug ${isActive ? "text-ink font-semibold" : "text-ink"}`}>
                        {session.title}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={9} className="text-muted-400" strokeWidth={1.5} />
                      <span className="font-mono text-[10px] text-muted-400">
                        {formatRelativeTime(session.createdAt)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-400">
                        · {count} msg
                      </span>
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  {(isHovered || isActive) && !isEditing && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 transition-opacity duration-150">
                      <button
                        onClick={(e) => startRename(e, session)}
                        className="flex items-center justify-center w-6 h-6 text-muted-400 hover:text-ink hover:bg-muted-100 transition-colors duration-150"
                        title="Rename"
                      >
                        <Pencil size={11} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={(e) => handlePin(e, session.id)}
                        className={`flex items-center justify-center w-6 h-6 transition-colors duration-150 ${
                          isPinned ? "text-red hover:bg-muted-100" : "text-muted-400 hover:text-ink hover:bg-muted-100"
                        }`}
                        title={isPinned ? "Unpin" : "Pin to top"}
                      >
                        {isPinned ? <PinOff size={11} strokeWidth={1.5} /> : <Pin size={11} strokeWidth={1.5} />}
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className={`flex items-center justify-center w-6 h-6 transition-colors duration-150 ${
                          willDelete ? "text-red" : "text-muted-400 hover:text-red hover:bg-muted-100"
                        }`}
                        title={willDelete ? "Click again to confirm" : "Delete"}
                      >
                        <Trash2 size={11} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>

                {willDelete && (
                  <p className="font-mono text-[10px] mt-1.5 ml-8 text-red">
                    Click again to confirm
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-ink px-4 py-3">
        <p className="font-mono text-[10px] text-muted-400 tracking-wider uppercase">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          {pinnedSessions.size > 0 && (
            <span className="text-red"> · {pinnedSessions.size} pinned</span>
          )}
        </p>
      </div>

      {/* ── Toggle Button ── */}
      <button
        onClick={onToggle}
        className="absolute -right-[21px] top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-[21px] h-10 bg-paper border border-ink border-l-0 text-ink hover:text-red transition-colors duration-150"
      >
        {isOpen ? <ChevronLeft size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
      </button>
    </div>
  );
}
