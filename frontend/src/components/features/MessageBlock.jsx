import { motion, AnimatePresence } from "motion/react";
import {
  CheckIcon,
  CopyIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  RefreshCcwIcon,
  AlertTriangleIcon,
  Pencil,
  Star,
  Eye,
  EyeOff,
  X,
  Check,
} from "lucide-react";
import { useState, useContext, useRef } from "react";
import { Response } from "../ui/shadcn-io/ai/response";
import { chatsContext } from "../../context/chatsContext";

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MessageBlock({
  obj,
  index,
  isLast,
  isCopied,
  copyToClipboard,
  onRetry,
  onEditSubmit,
}) {
  const [reaction, setReaction] = useState(null); // 'up' | 'down' | null
  const [isEditing, setIsEditing]     = useState(false);
  const [editValue, setEditValue]     = useState("");
  const [showRaw, setShowRaw]         = useState(false);
  const editRef = useRef(null);

  const {
    settings,
    starredMessages,
    toggleStarMessage,
    editMessage,
  } = useContext(chatsContext);

  const isError  = obj.type === "error";
  const hasAnswer = !!obj.answer;
  const compact  = settings?.compactMode;
  const isStarred = starredMessages?.has(obj.id);

  const startEdit = () => {
    setEditValue(obj.question);
    setIsEditing(true);
    setTimeout(() => {
      editRef.current?.focus();
      editRef.current?.select();
    }, 50);
  };

  const commitEdit = () => {
    if (editValue.trim() && editValue !== obj.question) {
      editMessage(obj.id, editValue.trim());
      if (onEditSubmit) onEditSubmit(editValue.trim(), obj.id);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleEditKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") cancelEdit();
  };

  return (
    <motion.div
      className={`message-block msg-enter ${compact ? "message-compact" : ""} ${isStarred ? "starred" : ""}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
    >
      {/* Question line */}
      <div className="flex items-start gap-2 mb-3">
        <span
          className="text-xs mt-0.5 flex-shrink-0 font-bold"
          style={{ color: "var(--neon-cyan)" }}
        >
          ›
        </span>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            /* ── Inline edit mode ── */
            <div className="flex flex-col gap-2">
              <textarea
                ref={editRef}
                className="msg-edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKey}
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={commitEdit}
                  className="msg-edit-btn confirm"
                  title="Save & Re-send (Enter)"
                >
                  <Check size={10} /> Save & Re-send
                </button>
                <button
                  onClick={cancelEdit}
                  className="msg-edit-btn cancel"
                  title="Cancel (Esc)"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="message-question text-sm text-wrap break-words">
              {obj.question}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Star indicator */}
          {isStarred && (
            <span style={{ fontSize: 10, color: "#ffd700" }} title="Starred">⭐</span>
          )}
          {/* Timestamp */}
          {obj.timestamp && settings?.showTimestamps && (
            <span className="message-timestamp visible">
              {formatTime(obj.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Answer */}
      {hasAnswer && (
        <div className="pl-4 border-l-2" style={{ borderColor: "var(--border-green)" }}>
          {isError ? (
            <div className="flex items-start gap-2">
              <AlertTriangleIcon
                size={14}
                style={{ color: "var(--neon-magenta)", marginTop: 3, flexShrink: 0 }}
              />
              <p
                className="text-sm text-wrap break-words"
                style={{ color: "var(--neon-magenta)" }}
              >
                {obj.answer}
              </p>
            </div>
          ) : (
            <div className="message-answer">
              {showRaw ? (
                <pre
                  className="text-xs whitespace-pre-wrap break-words"
                  style={{ color: "rgba(200,255,192,0.7)", lineHeight: 1.7 }}
                >
                  {obj.answer}
                </pre>
              ) : (
                <Response>{obj.answer}</Response>
              )}
            </div>
          )}

          {/* Action bar */}
          <div className="message-actions">
            {/* Copy */}
            {hasAnswer && !isError && (
              isCopied.state && isCopied.idMes === obj.id ? (
                <div className="reaction-btn active-up" style={{ pointerEvents: "none" }}>
                  <CheckIcon size={11} />
                  <span>copied</span>
                </div>
              ) : (
                <button
                  className="reaction-btn"
                  onClick={() => copyToClipboard(obj.id)}
                  title="Copy response"
                >
                  <CopyIcon size={11} />
                  <span>copy</span>
                </button>
              )
            )}

            {/* Raw toggle */}
            {hasAnswer && !isError && (
              <button
                className={`reaction-btn ${showRaw ? "active-up" : ""}`}
                onClick={() => setShowRaw((p) => !p)}
                title={showRaw ? "Show rendered" : "Show raw markdown"}
              >
                {showRaw ? <EyeOff size={11} /> : <Eye size={11} />}
                <span>{showRaw ? "rendered" : "raw"}</span>
              </button>
            )}

            {/* Edit question */}
            {!isEditing && (
              <button
                className="reaction-btn"
                onClick={startEdit}
                title="Edit & re-send"
              >
                <Pencil size={11} />
                <span>edit</span>
              </button>
            )}

            {/* Star */}
            <button
              className={`reaction-btn ${isStarred ? "active-star" : ""}`}
              onClick={() => toggleStarMessage(obj.id)}
              title={isStarred ? "Unstar" : "Star this message"}
            >
              <Star size={11} />
              <span>{isStarred ? "starred" : "star"}</span>
            </button>

            {/* Thumbs up */}
            {!isError && (
              <button
                className={`reaction-btn ${reaction === "up" ? "active-up" : ""}`}
                onClick={() => setReaction(reaction === "up" ? null : "up")}
                title="Good response"
              >
                <ThumbsUpIcon size={11} />
              </button>
            )}

            {/* Thumbs down */}
            {!isError && (
              <button
                className={`reaction-btn ${reaction === "down" ? "active-down" : ""}`}
                onClick={() => setReaction(reaction === "down" ? null : "down")}
                title="Bad response"
              >
                <ThumbsDownIcon size={11} />
              </button>
            )}

            {/* Retry — shown for errors AND normal messages */}
            {onRetry && (
              <button
                className="reaction-btn"
                onClick={() => onRetry(obj.question, obj.id)}
                title="Retry"
              >
                <RefreshCcwIcon size={11} />
                <span>retry</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Streaming placeholder */}
      {!hasAnswer && (
        <div className="pl-4 border-l-2" style={{ borderColor: "var(--border-green)" }}>
          <div className="loading-dots text-sm" style={{ color: "rgba(200,255,192,0.4)" }}>
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
