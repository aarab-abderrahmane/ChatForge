import { useContext, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
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
  } = useContext(chatsContext);

  const [hoveredId, setHoveredId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  const messageCount = (session) =>
    session.messages.filter((m) => m.type === "ch").length;

  return (
    <div
      className="sidebar flex flex-col h-full flex-shrink-0 relative"
      style={{ width: isOpen ? 220 : 0 }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full w-[220px] absolute inset-0"
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

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-2">
              <AnimatePresence>
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isHovered = hoveredId === session.id;
                  const willDelete = confirmDelete === session.id;
                  const count = messageCount(session);

                  return (
                    <motion.div
                      key={session.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`sidebar-session ${isActive ? "active" : ""}`}
                      onClick={() => setActiveSessionId(session.id)}
                      onMouseEnter={() => setHoveredId(session.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare
                          size={12}
                          style={{
                            color: isActive ? "var(--neon-green)" : "rgba(200,255,192,0.3)",
                            flexShrink: 0,
                            marginTop: 3,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium truncate leading-snug"
                            style={{
                              color: isActive
                                ? "var(--neon-green)"
                                : "rgba(200,255,192,0.75)",
                            }}
                          >
                            {session.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={9} style={{ color: "rgba(200,255,192,0.25)" }} />
                            <span
                              className="text-[10px]"
                              style={{ color: "rgba(200,255,192,0.25)" }}
                            >
                              {formatRelativeTime(session.createdAt)}
                            </span>
                            <span
                              className="text-[10px]"
                              style={{ color: "rgba(200,255,192,0.2)" }}
                            >
                              · {count} msg
                            </span>
                          </div>
                        </div>

                        {/* Delete button */}
                        {(isHovered || isActive) && (
                          <button
                            onClick={(e) => handleDelete(e, session.id)}
                            className="flex-shrink-0 p-0.5 rounded"
                            style={{
                              color: willDelete
                                ? "var(--neon-magenta)"
                                : "rgba(255,255,255,0.2)",
                              transition: "color 0.15s",
                            }}
                            title={willDelete ? "Click again to confirm" : "Delete"}
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>

                      {willDelete && (
                        <p
                          className="text-[9px] mt-1 pl-5"
                          style={{ color: "var(--neon-magenta)" }}
                        >
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
