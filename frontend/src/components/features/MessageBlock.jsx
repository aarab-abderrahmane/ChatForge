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
  ChevronDown,
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
  onKeepDraft,
  onContinue,
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
          {/* Router Badge */}
          {obj.provider && (
            <span className={`router-badge provider-${obj.provider}`} title={`Served by ${obj.provider}`}>
              {obj.provider === "groq" ? "⚡ Groq" : obj.provider === "gemini" ? "🧠 Gemini" : obj.provider === "huggingface" ? "🤗 HuggingFace" : "🌐 OpenRouter"}
            </span>
          )}

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
            <div className="flex flex-col gap-4 py-2">
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory custom-scrollbar" style={{ scrollPadding: "0 20px" }}>
                {obj.answers?.map((ans, idx) => (
                  <div key={idx} className={`relative shrink-0 w-[300px] sm:w-[350px] snap-center p-4 rounded-xl border transition-all flex flex-col min-h-[200px] max-h-[450px] ${selectedDrafts.includes(idx) ? "bg-[rgba(57,255,20,0.04)] border-[var(--neon-green)] shadow-[0_0_20px_rgba(57,255,20,0.1)]" : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.12)]"}`}>
                    <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2 shrink-0">
                      <span className="text-[10px] text-[var(--neon-cyan)] font-black uppercase tracking-[0.2em] flex items-center gap-2"><Layers size={12} /> Draft {idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onKeepDraft(obj.id, idx)}
                          className="text-[9px] font-bold text-white/40 hover:text-[var(--neon-green)] transition-colors uppercase tracking-widest flex items-center gap-1"
                          title="Discard others and keep this response"
                        >
                          <Check size={12} /> Keep
                        </button>
                        <input type="checkbox" className="w-4 h-4 rounded-full border-white/20 accent-[var(--neon-green)] cursor-pointer" checked={selectedDrafts.includes(idx)} onChange={(e) => {
                          if (e.target.checked) setSelectedDrafts(p => [...p, idx]);
                          else setSelectedDrafts(p => p.filter(x => x !== idx));
                        }} title="Select draft for synthesis" />
                      </div>
                    </div>
                    <div className="message-answer text-xs overflow-y-auto pr-1 custom-scrollbar flex-1 leading-relaxed">
                      {ans ? <Response>{ans}</Response> : (
                        <div className="space-y-3 pt-1">
                          <div className="h-3 bg-white/5 rounded animate-pulse w-full"></div>
                          <div className="h-3 bg-white/5 rounded animate-pulse w-[90%]"></div>
                          <div className="h-3 bg-white/5 rounded animate-pulse w-[40%]"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {selectedDrafts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex flex-wrap gap-3 items-center bg-white/[0.03] p-2 rounded-lg border border-white/5">
                    <span className="text-[9px] uppercase tracking-widest text-white/30 px-2 font-bold">{selectedDrafts.length} Selected</span>
                    <button onClick={() => onMergeDrafts(obj.id, selectedDrafts)} className="text-[10px] bg-[rgba(57,255,20,0.1)] text-[var(--neon-green)] px-4 py-2 rounded-md border border-[var(--neon-green)] hover:bg-[rgba(57,255,20,0.2)] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(57,255,20,0.1)]">
                      <Wand2 size={13} /> Merge via AI
                    </button>
                    <button onClick={() => onSummarizeDrafts(obj.id, selectedDrafts)} className="text-[10px] bg-[rgba(0,245,255,0.1)] text-[var(--neon-cyan)] px-4 py-2 rounded-md border border-[var(--neon-cyan)] hover:bg-[rgba(0,245,255,0.2)] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                      <AlignLeft size={13} /> Summarize
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

            {/* Continue — shown only for truncated messages */}
            {obj.isTruncated && onContinue && (
              <button
                className="reaction-btn"
                onClick={() => onContinue(obj.id)}
                style={{ background: "rgba(0,245,255,0.1)", color: "var(--neon-cyan)", borderColor: "var(--neon-cyan)" }}
                title="Continue generating"
              >
                <ChevronDown size={11} />
                <span>continue</span>
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
