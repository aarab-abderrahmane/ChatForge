// Trigger Vite HMR Reload
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
  Wand2,
  AlignLeft,
  Layers,
} from "lucide-react";
import { useState, useContext, useRef } from "react";
import { Response } from "../ui/shadcn-io/ai/response";
import { QuizBlock } from "../ui/shadcn-io/ai/quiz-block";
import { FlashcardBlock } from "../ui/shadcn-io/ai/flashcard-block";
import { MindmapBlock } from "../ui/shadcn-io/ai/mindmap-block";
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
  onMergeDrafts,
  onSummarizeDrafts,
}) {
  const [reaction, setReaction] = useState(null); // 'up' | 'down' | null
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const editRef = useRef(null);

  const {
    settings,
    starredMessages,
    toggleStarMessage,
    editMessage,
  } = useContext(chatsContext);

  const isError = obj.type === "error";
  const hasAnswer = !!obj.answer;
  const compact = settings?.compactMode;
  const isStarred = starredMessages?.has(obj.id);
  const qLower = obj.question?.trim().toLowerCase() || "";
  const isQuiz = qLower.startsWith("//> quiz") || qLower.startsWith("//>quiz");
  const isFlashcards = qLower.startsWith("//> flashcards") || qLower.startsWith("//>flashcards");
  const isMindmap = qLower.startsWith("//> mindmap") || qLower.startsWith("//>mindmap");

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
      {(hasAnswer || obj.isMulti) && (
        <div className={`pl-4 border-l-2 ${obj.isMulti ? "border-l-[rgba(0,245,255,0.3)]" : "border-l-[var(--border-green)]"}`}>
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
          ) : obj.isMulti ? (
            <div className="flex flex-col gap-3 py-1">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full">
                {obj.answers?.map((ans, idx) => (
                  <div key={idx} className={`relative p-3 rounded-lg border transition-colors flex flex-col max-h-[400px] ${selectedDrafts.includes(idx) ? "bg-[rgba(57,255,20,0.05)] border-[var(--neon-green)] shadow-[0_0_10px_rgba(57,255,20,0.1)]" : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]"}`}>
                    <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2 shrink-0">
                      <span className="text-[10px] text-[var(--neon-cyan)] font-bold uppercase tracking-widest flex items-center gap-1"><Layers size={10} /> Draft {idx + 1}</span>
                      <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--neon-green)] cursor-pointer" checked={selectedDrafts.includes(idx)} onChange={(e) => {
                        if (e.target.checked) setSelectedDrafts(p => [...p, idx]);
                        else setSelectedDrafts(p => p.filter(x => x !== idx));
                      }} title="Select draft for synthesis" />
                    </div>
                    <div className="message-answer text-xs overflow-y-auto pr-2 custom-scrollbar flex-1">
                      {ans ? <Response>{ans}</Response> : <div className="loading-dots text-[10px] text-white/30 pt-1"><span>.</span><span>.</span><span>.</span></div>}
                    </div>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {selectedDrafts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 pt-2 items-center">
                    <button onClick={() => onMergeDrafts(obj.id, selectedDrafts)} className="text-[10px] bg-[rgba(57,255,20,0.1)] text-[var(--neon-green)] px-3 py-1.5 rounded border border-[var(--neon-green)] hover:bg-[rgba(57,255,20,0.2)] font-bold uppercase tracking-widest flex items-center gap-1 transition-all">
                      <Wand2 size={12} /> Merge Selected ({selectedDrafts.length})
                    </button>
                    <button onClick={() => onSummarizeDrafts(obj.id, selectedDrafts)} className="text-[10px] bg-[rgba(0,245,255,0.1)] text-[var(--neon-cyan)] px-3 py-1.5 rounded border border-[var(--neon-cyan)] hover:bg-[rgba(0,245,255,0.2)] font-bold uppercase tracking-widest flex items-center gap-1 transition-all">
                      <AlignLeft size={12} /> Summarize
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
                isQuiz ? <QuizBlock code={obj.answer} /> :
                  isFlashcards ? <FlashcardBlock code={obj.answer} /> :
                    isMindmap ? <MindmapBlock code={obj.answer} /> :
                      <Response>{obj.answer}</Response>
              )}
            </div>
          )}

          {/* Action bar */}
          <div className="message-actions mt-2">
            {/* Copy */}
            {((hasAnswer || obj.isMulti) && !isError) && (
              isCopied.state && isCopied.idMes === obj.id ? (
                <div className="reaction-btn active-up" style={{ pointerEvents: "none" }}>
                  <CheckIcon size={11} />
                  <span>copied</span>
                </div>
              ) : !obj.isMulti ? (
                <button
                  className="reaction-btn"
                  onClick={() => copyToClipboard(obj.id)}
                  title="Copy response"
                >
                  <CopyIcon size={11} />
                  <span>copy</span>
                </button>
              ) : null
            )}

            {/* Raw toggle */}
            {(hasAnswer && !isError && !obj.isMulti) && (
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
      {(!hasAnswer && !obj.isMulti) && (
        <div className="pl-4 border-l-2" style={{ borderColor: "var(--border-green)" }}>
          <div className="loading-dots text-sm" style={{ color: "rgba(200,255,192,0.4)" }}>
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
