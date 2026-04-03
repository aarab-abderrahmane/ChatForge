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
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full w-[290px] absolute inset-0"
            style={{ background: "#0c1520" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span
                className="text-[11px] font-semibold tracking-[0.12em] uppercase"
                style={{
                  color: "rgba(200,255,192,0.75)",
                  letterSpacing: "0.12em",
                }}
              >
                Sessions
              </span>
              <button
                onClick={createNewSession}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--neon-green)",
                  cursor: "pointer",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "transparent";
                }}
                title="New Chat"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-3 py-2.5">
              <div
                className="flex items-center gap-2.5 rounded-lg transition-all duration-200"
                style={{
                  padding: "7px 10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Search
                  size={13}
                  className="flex-shrink-0"
                  style={{ color: "rgba(200,255,192,0.4)" }}
                />
                <input
                  type="text"
                  className="flex-1 bg-transparent text-xs outline-none"
                  placeholder="Search sessions…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    color: "rgba(200,255,192,0.9)",
                    caretColor: "var(--neon-green)",
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="flex items-center justify-center w-4 h-4 rounded-md flex-shrink-0 transition-colors duration-150"
                    style={{
                      color: "rgba(200,255,192,0.5)",
                      background: "transparent",
                      cursor: "pointer",
                      border: "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "rgba(200,255,192,0.8)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "rgba(200,255,192,0.5)";
                      e.currentTarget.style.background = "transparent";
                    }}
                    title="Clear"
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto px-2.5 pb-2">
              <div className="flex flex-col gap-1">
                <AnimatePresence>
                  {filtered.length === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[11px] text-center py-8 font-light"
                      style={{
                        color: "rgba(200,255,192,0.35)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      No sessions found
                    </motion.p>
                  )}
                  {filtered.map((session) => {
                    const isActive = session.id === activeSessionId;
                    const isHovered = hoveredId === session.id;
                    const willDelete = confirmDelete === session.id;
                    const isPinned = pinnedSessions.has(session.id);
                    const isEditing = editingId === session.id;
                    const count = messageCount(session);

                    // Determine background
                    let sessionBg = "transparent";
                    let sessionBorder = "1px solid transparent";
                    let sessionBorderLeft = "2px solid transparent";

                    if (isActive) {
                      sessionBg = "rgba(255,255,255,0.06)";
                      sessionBorder = "1px solid rgba(255,255,255,0.1)";
                      sessionBorderLeft = "2px solid var(--neon-green)";
                    } else if (isHovered) {
                      sessionBg = "rgba(255,255,255,0.05)";
                    }

                    return (
                      <motion.div
                        key={session.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16, height: 0 }}
                        transition={{
                          duration: 0.2,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                        className="rounded-lg cursor-pointer transition-all duration-200"
                        style={{
                          padding: "9px 10px",
                          background: sessionBg,
                          border: sessionBorder,
                          borderLeft: sessionBorderLeft,
                        }}
                        onClick={() => !isEditing && setActiveSessionId(session.id)}
                        onMouseEnter={() => setHoveredId(session.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Icon — refined pin indicator or message */}
                          <span
                            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md mt-0.5 transition-colors duration-200"
                            style={{
                              background: isPinned
                                ? "rgba(0,255,180,0.12)"
                                : "transparent",
                              color: isActive
                                ? "var(--neon-green)"
                                : isPinned
                                  ? "rgba(0,255,180,0.7)"
                                  : "rgba(200,255,192,0.45)",
                            }}
                          >
                            {isPinned ? (
                              <Pin size={11} />
                            ) : (
                              <MessageSquare size={12} />
                            )}
                          </span>

                          <div className="flex-1 min-w-0">
                            {/* Title — editable or static */}
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  ref={editInputRef}
                                  className="rounded-md px-2 py-0.5 text-xs outline-none flex-1 min-w-0"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={handleRenameKey}
                                  maxLength={50}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    background: "rgba(255,255,255,0.1)",
                                    color: "rgba(200,255,192,0.95)",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    caretColor: "var(--neon-green)",
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    commitRename();
                                  }}
                                  className="flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0 transition-colors duration-150"
                                  style={{
                                    color: "var(--neon-green)",
                                    background: "rgba(0,255,180,0.12)",
                                    cursor: "pointer",
                                    border: "none",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(0,255,180,0.2)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(0,255,180,0.12)";
                                  }}
                                >
                                  <Check size={10} />
                                </button>
                              </div>
                            ) : (
                              <p
                                className="text-xs font-medium truncate leading-snug"
                                style={{
                                  color: isActive
                                    ? "rgba(200,255,192,1)"
                                    : "rgba(200,255,192,0.8)",
                                }}
                              >
                                {session.title}
                              </p>
                            )}

                            <div
                              className="flex items-center gap-1.5 mt-1.5"
                              style={{ opacity: isActive ? 0.85 : 0.65 }}
                            >
                              <Clock
                                size={9}
                                style={{ color: "rgba(200,255,192,0.55)" }}
                              />
                              <span
                                className="text-[10px]"
                                style={{
                                  color: "rgba(200,255,192,0.5)",
                                  fontWeight: 400,
                                }}
                              >
                                {formatRelativeTime(session.createdAt)}
                              </span>
                              <span
                                className="text-[10px]"
                                style={{
                                  color: "rgba(200,255,192,0.4)",
                                  fontWeight: 400,
                                }}
                              >
                                · {count} msg
                              </span>
                            </div>
                          </div>

                          {/* Action buttons — show on hover/active */}
                          {(isHovered || isActive) && !isEditing && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center gap-0.5 flex-shrink-0"
                            >
                              {/* Rename */}
                              <button
                                onClick={(e) => startRename(e, session)}
                                className="flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150"
                                style={{
                                  color: "rgba(200,255,192,0.55)",
                                  background: "transparent",
                                  cursor: "pointer",
                                  border: "none",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "rgba(200,255,192,0.9)";
                                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "rgba(200,255,192,0.55)";
                                  e.currentTarget.style.background = "transparent";
                                }}
                                title="Rename"
                              >
                                <Pencil size={11} />
                              </button>
                              {/* Pin */}
                              <button
                                onClick={(e) => handlePin(e, session.id)}
                                className="flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150"
                                style={{
                                  color: isPinned
                                    ? "rgba(0,255,180,0.75)"
                                    : "rgba(200,255,192,0.55)",
                                  background: isPinned
                                    ? "rgba(0,255,180,0.1)"
                                    : "transparent",
                                  cursor: "pointer",
                                  border: "none",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = isPinned
                                    ? "rgba(0,255,180,1)"
                                    : "rgba(200,255,192,0.9)";
                                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = isPinned
                                    ? "rgba(0,255,180,0.75)"
                                    : "rgba(200,255,192,0.55)";
                                  e.currentTarget.style.background = isPinned
                                    ? "rgba(0,255,180,0.1)"
                                    : "transparent";
                                }}
                                title={isPinned ? "Unpin" : "Pin to top"}
                              >
                                {isPinned ? (
                                  <PinOff size={11} />
                                ) : (
                                  <Pin size={11} />
                                )}
                              </button>
                              {/* Delete */}
                              <button
                                onClick={(e) => handleDelete(e, session.id)}
                                className="flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150"
                                style={{
                                  color: willDelete
                                    ? "rgba(255,0,128,0.9)"
                                    : "rgba(200,255,192,0.55)",
                                  background: willDelete
                                    ? "rgba(255,0,128,0.12)"
                                    : "transparent",
                                  cursor: "pointer",
                                  border: "none",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = willDelete
                                    ? "rgba(255,0,128,1)"
                                    : "rgba(255,0,128,0.75)";
                                  e.currentTarget.style.background = "rgba(255,0,128,0.12)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = willDelete
                                    ? "rgba(255,0,128,0.9)"
                                    : "rgba(200,255,192,0.55)";
                                  e.currentTarget.style.background = willDelete
                                    ? "rgba(255,0,128,0.12)"
                                    : "transparent";
                                }}
                                title={
                                  willDelete
                                    ? "Click again to confirm"
                                    : "Delete"
                                }
                              >
                                <Trash2 size={11} />
                              </button>
                            </motion.div>
                          )}
                        </div>

                        {willDelete && (
                          <motion.p
                            initial={{ opacity: 0, y: -2 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] mt-1.5 pl-[30px] font-normal"
                            style={{
                              color: "rgba(255,0,128,0.85)",
                              letterSpacing: "0.01em",
                            }}
                          >
                            Click again to confirm
                          </motion.p>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p
                className="text-[10px] tracking-wide font-normal"
                style={{
                  color: "rgba(200,255,192,0.35)",
                  letterSpacing: "0.04em",
                }}
              >
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                {pinnedSessions.size > 0 && (
                  <span style={{ color: "rgba(0,255,180,0.5)" }}>
                    {" "}
                    · {pinnedSessions.size} pinned
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle tab */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-50
          flex items-center justify-center rounded-lg transition-all duration-200"
        style={{
          width: 22,
          height: 40,
          background: "#0c1520",
          border: "1px solid rgba(255,255,255,0.12)",
          borderLeft: "none",
          color: "rgba(200,255,192,0.6)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "rgba(200,255,192,0.9)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
          e.currentTarget.style.background = "#101d2a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(200,255,192,0.6)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          e.currentTarget.style.background = "#0c1520";
        }}
      >
        {isOpen ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
      </button>
    </div>
  );
}
