import { useContext, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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

  // Focus rename input when it appears
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

  // Filter by search, then sort pinned to top
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
      className={`sidebar flex flex-col h-full flex-shrink-0 relative ${isOpen ? "sidebar-open" : "sidebar-closed"}`}
      style={{ width: isOpen ? 290 : 0 }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full w-[290px] absolute inset-0"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-3 border-b"
              style={{ borderColor: "var(--border-green)" }}
            >
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "var(--neon-cyan)" }}
              >
                Sessions
              </span>
              <button
                onClick={createNewSession}
                className="btn-ghost p-1"
                title="New Chat"
              >
                <Plus size={14} style={{ color: "var(--neon-green)" }} />
              </button>
            </div>

            {/* Search bar */}
            <div
              className="px-2 py-2 border-b"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              <div className="sidebar-search">
                <Search size={11} className="sidebar-search-icon" />
                <input
                  type="text"
                  className="sidebar-search-input"
                  placeholder="Search sessions…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="sidebar-search-clear"
                    title="Clear"
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-2">
              <AnimatePresence>
                {filtered.length === 0 && (
                  <p className="text-[10px] text-center py-4" style={{ color: "rgba(200,255,192,0.25)" }}>
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
                    <motion.div
                      key={session.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`sidebar-session ${isActive ? "active" : ""} ${isPinned ? "pinned" : ""}`}
                      onClick={() => !isEditing && setActiveSessionId(session.id)}
                      onMouseEnter={() => setHoveredId(session.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <div className="flex items-start gap-2">
                        {/* Icon — 📌 for pinned, 💬 for normal */}
                        <span style={{ fontSize: 11, marginTop: 2, flexShrink: 0 }}>
                          {isPinned ? "📌" : <MessageSquare size={12} style={{ color: isActive ? "var(--neon-green)" : "rgba(200,255,192,0.3)" }} />}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Title — editable or static */}
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                ref={editInputRef}
                                className="sidebar-rename-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={handleRenameKey}
                                maxLength={50}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); commitRename(); }}
                                className="flex-shrink-0"
                                style={{ color: "var(--neon-green)" }}
                              >
                                <Check size={10} />
                              </button>
                            </div>
                          ) : (
                            <p
                              className="text-xs font-medium truncate leading-snug"
                              style={{ color: isActive ? "var(--neon-green)" : "rgba(200,255,192,0.75)" }}
                            >
                              {session.title}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={9} style={{ color: "rgba(200,255,192,0.25)" }} />
                            <span className="text-[10px]" style={{ color: "rgba(200,255,192,0.25)" }}>
                              {formatRelativeTime(session.createdAt)}
                            </span>
                            <span className="text-[10px]" style={{ color: "rgba(200,255,192,0.2)" }}>
                              · {count} msg
                            </span>
                          </div>
                        </div>

                        {/* Action buttons — show on hover/active */}
                        {(isHovered || isActive) && !isEditing && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {/* Rename */}
                            <button
                              onClick={(e) => startRename(e, session)}
                              className="sidebar-action-btn"
                              title="Rename"
                            >
                              <Pencil size={9} />
                            </button>
                            {/* Pin */}
                            <button
                              onClick={(e) => handlePin(e, session.id)}
                              className="sidebar-action-btn"
                              style={{ color: isPinned ? "var(--neon-cyan)" : undefined }}
                              title={isPinned ? "Unpin" : "Pin to top"}
                            >
                              {isPinned ? <PinOff size={9} /> : <Pin size={9} />}
                            </button>
                            {/* Delete */}
                            <button
                              onClick={(e) => handleDelete(e, session.id)}
                              className="sidebar-action-btn"
                              style={{ color: willDelete ? "var(--neon-magenta)" : undefined }}
                              title={willDelete ? "Click again to confirm" : "Delete"}
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        )}
                      </div>

                      {willDelete && (
                        <p className="text-[9px] mt-1 pl-5" style={{ color: "var(--neon-magenta)" }}>
                          Click again to confirm
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div
              className="px-3 py-2 border-t text-[9px] tracking-widest uppercase"
              style={{
                borderColor: "var(--border-green)",
                color: "rgba(200,255,192,0.2)",
              }}
            >
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              {pinnedSessions.size > 0 && ` · ${pinnedSessions.size} pinned`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle tab */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-50
          flex items-center justify-center w-6 h-10 rounded-r-md"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-green)",
          borderLeft: "none",
          color: "var(--neon-green)",
          cursor: "pointer",
        }}
      >
        {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </div>
  );
}
