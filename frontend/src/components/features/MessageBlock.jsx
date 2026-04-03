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

/* ─── Shared action button base styles ─── */
const btnBase = "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-transparent transition-all duration-200 select-none";

const btnDefault = `${btnBase} text-white/55 hover:text-white/80 hover:bg-white/[0.08] hover:border-white/[0.10]`;

const btnActiveUp = `${btnBase} text-emerald-400/90 bg-emerald-400/[0.08] border-emerald-400/[0.12]`;

const btnActiveDown = `${btnBase} text-rose-400/90 bg-rose-400/[0.08] border-rose-400/[0.12]`;

const btnActiveStar = `${btnBase} text-amber-400/90 bg-amber-400/[0.08] border-amber-400/[0.12]`;

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
      className={` ${compact ? "py-2.5 px-3" : "py-4 px-5"} ${isStarred ? "bg-amber-400/[0.03]" : "bg-[#0d1520]/80"}`}
      style={isStarred ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.08), 0 0 24px -8px rgba(251,191,36,0.10)" } : {}}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay: index * 0.02 }}
    >
      {/* Question line */}
      <div className="flex items-start gap-3 mb-4">
        <span
          className="text-xs mt-px flex-shrink-0 font-bold"
          style={{ color: "rgba(0,245,255,0.7)" }}
        >
          ›
        </span>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            /* ── Inline edit mode ── */
            <div className="flex flex-col gap-3">
              <textarea
                ref={editRef}
                className="w-full bg-white/[0.06] border border-white/[0.15] rounded-lg px-3.5 py-2.5 text-sm text-white/90 placeholder-white/20 resize-none outline-none transition-all duration-200 focus:border-cyan-400/30 focus:bg-white/[0.08]"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKey}
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={commitEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-400/[0.15] text-emerald-400 border border-emerald-400/[0.25] hover:bg-emerald-400/[0.18] transition-all duration-200"
                  title="Save & Re-send (Enter)"
                >
                  <Check size={11} /> Save & Re-send
                </button>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium rounded-lg bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60 transition-all duration-200"
                  title="Cancel (Esc)"
                >
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-wrap break-words text-white/95 leading-relaxed font-normal">
              {obj.question}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pt-px">
          {/* Router Badge */}
          {obj.provider && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-md tracking-wide"
              style={{
                background: obj.provider === "groq"
                  ? "rgba(249,115,22,0.12)"
                  : obj.provider === "gemini"
                    ? "rgba(99,102,241,0.12)"
                    : obj.provider === "huggingface"
                      ? "rgba(234,179,8,0.12)"
                      : "rgba(0,245,255,0.12)",
                color: obj.provider === "groq"
                  ? "rgba(249,115,22,0.9)"
                  : obj.provider === "gemini"
                    ? "rgba(99,102,241,0.9)"
                    : obj.provider === "huggingface"
                      ? "rgba(234,179,8,0.9)"
                      : "rgba(0,245,255,0.9)",
                border: obj.provider === "groq"
                  ? "1px solid rgba(249,115,22,0.2)"
                  : obj.provider === "gemini"
                    ? "1px solid rgba(99,102,241,0.2)"
                    : obj.provider === "huggingface"
                      ? "1px solid rgba(234,179,8,0.2)"
                      : "1px solid rgba(0,245,255,0.2)",
              }}
              title={`Served by ${obj.provider}`}
            >
              {obj.provider === "groq" ? "⚡ Groq" : obj.provider === "gemini" ? "🧠 Gemini" : obj.provider === "huggingface" ? "🤗 HuggingFace" : "🌐 OpenRouter"}
            </span>
          )}

          {/* Star indicator */}
          {isStarred && (
            <span style={{ fontSize: 11, color: "rgba(251,191,36,0.7)" }} title="Starred">⭐</span>
          )}
          {/* Timestamp */}
          {obj.timestamp && settings?.showTimestamps && (
            <span className="text-[10px] text-white/40 font-normal tabular-nums">
              {formatTime(obj.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Answer */}
      {(hasAnswer || obj.isMulti) && (
        <div className={`pl-5 border-l-[1.5px] ${obj.isMulti ? "border-l-cyan-400/25" : "border-l-emerald-400/25"}`}>
          {isError ? (
            <div className="flex items-start gap-2.5">
              <AlertTriangleIcon
                size={14}
                style={{ color: "rgba(244,63,94,0.7)", marginTop: 3, flexShrink: 0 }}
              />
              <p
                className="text-[13px] text-wrap break-words leading-relaxed"
                style={{ color: "rgba(248,80,100,1)" }}
              >
                {obj.answer}
              </p>
            </div>
          ) : obj.isMulti ? (
            <div className="flex flex-col gap-4 py-1">
              <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollPadding: "0 20px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
                {obj.answers?.map((ans, idx) => (
                  <div
                    key={idx}
                    className={`relative shrink-0 w-[300px] sm:w-[350px] snap-center p-4 rounded-xl border transition-all duration-300 flex flex-col min-h-[200px] max-h-[450px] ${
                      selectedDrafts.includes(idx)
                        ? "bg-emerald-400/[0.08] border-emerald-400/[0.3] shadow-[0_0_30px_-10px_rgba(52,211,153,0.15)]"
                        : "bg-white/[0.03] border-white/[0.1] hover:border-white/[0.15] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3 border-b border-white/[0.04] pb-2.5 shrink-0">
                      <span className="text-[10px] text-cyan-400/80 font-semibold uppercase tracking-[0.15em] flex items-center gap-2"><Layers size={12} /> Draft {idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onKeepDraft(obj.id, idx)}
                          className="text-[9px] font-semibold text-white/50 hover:text-emerald-300 transition-colors duration-200 uppercase tracking-widest flex items-center gap-1"
                          title="Discard others and keep this response"
                        >
                          <Check size={12} /> Keep
                        </button>
                        <input type="checkbox" className="w-3.5 h-3.5 rounded-full border-white/15 accent-emerald-400 cursor-pointer transition-all duration-200" checked={selectedDrafts.includes(idx)} onChange={(e) => {
                          if (e.target.checked) setSelectedDrafts(p => [...p, idx]);
                          else setSelectedDrafts(p => p.filter(x => x !== idx));
                        }} title="Select draft for synthesis" />
                      </div>
                    </div>
                    <div className="text-[12px] overflow-y-auto pr-1 leading-[1.75] text-white/85 flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
                      {ans ? <Response>{ans}</Response> : (
                        <div className="space-y-3 pt-1">
                          <div className="h-2.5 bg-white/[0.04] rounded-md animate-pulse w-full"></div>
                          <div className="h-2.5 bg-white/[0.04] rounded-md animate-pulse w-[90%]"></div>
                          <div className="h-2.5 bg-white/[0.04] rounded-md animate-pulse w-[40%]"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {selectedDrafts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }} className="flex flex-wrap gap-2.5 items-center bg-white/[0.04] px-3 py-2.5 rounded-lg border border-white/[0.1]">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-white/50 px-1 font-semibold">{selectedDrafts.length} Selected</span>
                    <button onClick={() => onMergeDrafts(obj.id, selectedDrafts)} className="text-[10px] bg-emerald-400/[0.12] text-emerald-400/90 px-4 py-2 rounded-lg border border-emerald-400/[0.2] hover:bg-emerald-400/[0.15] font-semibold uppercase tracking-widest flex items-center gap-2 transition-all duration-200">
                      <Wand2 size={13} /> Merge via AI
                    </button>
                    <button onClick={() => onSummarizeDrafts(obj.id, selectedDrafts)} className="text-[10px] bg-cyan-400/[0.12] text-cyan-400/90 px-4 py-2 rounded-lg border border-cyan-400/[0.2] hover:bg-cyan-400/[0.15] font-semibold uppercase tracking-widest flex items-center gap-2 transition-all duration-200">
                      <AlignLeft size={13} /> Summarize
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="leading-[1.8] text-white/90 text-[14px]">
              {showRaw ? (
                <pre
                  className="text-xs whitespace-pre-wrap break-words"
                  style={{ color: "rgba(200,255,192,0.6)", lineHeight: 1.8 }}
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
          <div className="flex flex-wrap items-center gap-1 mt-3">
            {/* Copy */}
            {((hasAnswer || obj.isMulti) && !isError) && (
              isCopied.state && isCopied.idMes === obj.id ? (
                <div className={btnActiveUp} style={{ pointerEvents: "none" }}>
                  <CheckIcon size={11} />
                  <span>copied</span>
                </div>
              ) : !obj.isMulti ? (
                <button
                  className={btnDefault}
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
                className={showRaw ? btnActiveUp : btnDefault}
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
                className={btnDefault}
                onClick={startEdit}
                title="Edit & re-send"
              >
                <Pencil size={11} />
                <span>edit</span>
              </button>
            )}

            {/* Star */}
            <button
              className={isStarred ? btnActiveStar : btnDefault}
              onClick={() => toggleStarMessage(obj.id)}
              title={isStarred ? "Unstar" : "Star this message"}
            >
              <Star size={11} />
              <span>{isStarred ? "starred" : "star"}</span>
            </button>

            {/* Thumbs up */}
            {!isError && (
              <button
                className={reaction === "up" ? btnActiveUp : btnDefault}
                onClick={() => setReaction(reaction === "up" ? null : "up")}
                title="Good response"
              >
                <ThumbsUpIcon size={11} />
              </button>
            )}

            {/* Thumbs down */}
            {!isError && (
              <button
                className={reaction === "down" ? btnActiveDown : btnDefault}
                onClick={() => setReaction(reaction === "down" ? null : "down")}
                title="Bad response"
              >
                <ThumbsDownIcon size={11} />
              </button>
            )}

            {/* Continue — shown only for truncated messages */}
            {obj.isTruncated && onContinue && (
              <button
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-cyan-400/[0.25] bg-cyan-400/[0.1] text-cyan-400/80 hover:bg-cyan-400/[0.12] transition-all duration-200"
                onClick={() => onContinue(obj.id)}
                title="Continue generating"
              >
                <ChevronDown size={11} />
                <span>continue</span>
              </button>
            )}

            {/* Retry — shown for errors AND normal messages */}
            {onRetry && (
              <button
                className={btnDefault}
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
        <div className="pl-5 border-l-[1.5px] border-l-emerald-400/10">
          <div className="flex items-center gap-1.5 py-1" style={{ color: "rgba(200,255,192,0.4)" }}>
            <span className="w-1 h-1 rounded-full bg-current animate-[pulse_1.4s_ease-in-out_infinite]" />
            <span className="w-1 h-1 rounded-full bg-current animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="w-1 h-1 rounded-full bg-current animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
