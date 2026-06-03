import { useState, useContext, useRef } from "react";
import {
  CopyIcon, RefreshCcwIcon,
  AlertTriangleIcon, Pencil, Eye, EyeOff, X, Check,
  Wand2, AlignLeft, Layers, ChevronDown,
} from "lucide-react";
import { Response } from "../ui/shadcn-io/ai/response";
import { QuizBlock } from "../ui/shadcn-io/ai/quiz-block";
import { FlashcardBlock } from "../ui/shadcn-io/ai/flashcard-block";
import { MindmapBlock } from "../ui/shadcn-io/ai/mindmap-block";
import { chatsContext } from "../../context/chatsContext";

function formatTime(isoString) {
  if (!isoString) return "";
  try { return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

const btnGhost = "inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-500 hover:text-green transition-colors";
const btnActiveUp = `${btnGhost} text-green`;

export function MessageBlock({
  obj, index, isLast, isCopied, copyToClipboard, onRetry,
  onEditSubmit, onMergeDrafts, onSummarizeDrafts, onKeepDraft, onContinue,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const editRef = useRef(null);

  const { settings, editMessage } = useContext(chatsContext);

  const isError = obj.type === "error";
  const hasAnswer = !!obj.answer;
  const qLower = obj.question?.trim().toLowerCase() || "";
  const isQuiz = qLower.startsWith("//> quiz") || qLower.startsWith("//>quiz");
  const isFlashcards = qLower.startsWith("//> flashcards") || qLower.startsWith("//>flashcards");
  const isMindmap = qLower.startsWith("//> mindmap") || qLower.startsWith("//>mindmap");
  const isFirst = index === 0;

  const startEdit = () => {
    setEditValue(obj.question);
    setIsEditing(true);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 50);
  };

  const commitEdit = () => {
    if (editValue.trim() && editValue !== obj.question) {
      editMessage(obj.id, editValue.trim());
      if (onEditSubmit) onEditSubmit(editValue.trim(), obj.id);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => { setIsEditing(false); setEditValue(""); };

  return (
    <article id={`msg-${obj.id}`} className={`border-b border-divider py-5 ${isFirst ? "first-message" : ""}`}>
      {/* Question — as a serif subheading */}
      <header className="flex items-start gap-4 mb-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <textarea
                ref={editRef}
                dir="auto"
                className="w-full bg-transparent border-b-2 border-ink px-2 py-2 font-mono text-sm text-ink outline-none resize-none min-h-[80px]"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === "Escape") cancelEdit(); }}
                rows={3}
              />
              <div className="flex gap-2">
                <button onClick={commitEdit} className="min-h-[44px] px-4 border border-green bg-green text-paper font-mono text-[10px] uppercase tracking-widest hover:bg-green/90 transition-colors">
                  <Check size={12} strokeWidth={1.5} className="inline mr-1" /> Save & Re-send
                </button>
                <button onClick={cancelEdit} className="min-h-[44px] px-4 border border-ink text-ink font-mono text-[10px] uppercase tracking-widest hover:bg-muted-100 transition-colors">
                  <X size={12} strokeWidth={1.5} className="inline mr-1" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div dir="auto" className={`font-serif font-bold text-ink ${isFirst ? "drop-cap" : "text-lg"}`}>
              {obj.question}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {obj.provider && (
            <span className="font-mono text-[9px] text-muted-500 uppercase tracking-widest border border-ink px-1.5 py-0.5">
              {obj.provider === "groq" ? "GROQ" : obj.provider === "gemini" ? "GEMINI" : obj.provider === "huggingface" ? "HUGGINGFACE" : obj.provider === "together" ? "TOGETHER" : obj.provider === "mistral" ? "MISTRAL" : "OPENROUTER"}
            </span>
          )}
          {obj.timestamp && settings?.showTimestamps && (
            <time className="font-mono text-[9px] text-muted-500 tabular-nums">{formatTime(obj.timestamp)}</time>
          )}
        </div>
      </header>

      {/* Answer content */}
      {(hasAnswer || obj.isMulti) && (
        <div className="flex gap-4">
          <div className="shrink-0 w-8 h-8 border border-ink flex items-center justify-center font-mono text-[10px] uppercase tracking-widest mt-0.5" title="AI">
            AI
          </div>
          <div className="flex-1 min-w-0">
          {isError ? (
            <div className="flex items-start gap-3 text-red">
              <AlertTriangleIcon size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
              <p className="font-body text-base leading-relaxed">{obj.answer}</p>
            </div>
          ) : obj.isMulti ? (
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
                {obj.answers?.map((ans, idx) => (
                  <div
                    key={idx}
                    className={`relative shrink-0 w-[320px] snap-center border border-ink p-4 flex flex-col min-h-[200px] max-h-[450px] ${
                      selectedDrafts.includes(idx) ? "bg-ink text-paper" : "bg-paper"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3 border-b border-ink pb-2 shrink-0">
                      <span className="font-mono text-[10px] uppercase tracking-widest"><Layers size={12} strokeWidth={1.5} className="inline mr-1" /> Draft {idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => onKeepDraft(obj.id, idx)} className="font-mono text-[9px] uppercase tracking-widest underline underline-offset-4 decoration-red hover:text-red transition-colors">Keep</button>
                        <input type="checkbox" className="w-4 h-4 accent-ink cursor-pointer" checked={selectedDrafts.includes(idx)} onChange={e => { if (e.target.checked) setSelectedDrafts(p => [...p, idx]); else setSelectedDrafts(p => p.filter(x => x !== idx)); }} />
                      </div>
                    </div>
                    <div dir="auto" className="font-body text-sm overflow-y-auto pr-1 leading-relaxed flex-1 [&_p]:text-justify">
                      {ans ? <Response dir="auto">{ans}</Response> : (
                        <div className="space-y-2 pt-1">
                          <div className="h-2.5 bg-muted-200 w-full" />
                          <div className="h-2.5 bg-muted-200 w-[90%]" />
                          <div className="h-2.5 bg-muted-200 w-[40%]" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedDrafts.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center border border-ink p-3 bg-muted-100">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-500">{selectedDrafts.length} Selected</span>
                  <button onClick={() => onMergeDrafts(obj.id, selectedDrafts)} className="min-h-[44px] px-4 border border-green bg-green text-paper font-mono text-[10px] uppercase tracking-widest hover:bg-green/90 transition-colors">
                    <Wand2 size={12} strokeWidth={1.5} className="inline mr-1" /> Merge via AI
                  </button>
                  <button onClick={() => onSummarizeDrafts(obj.id, selectedDrafts)} className="min-h-[44px] px-4 border border-ink text-ink font-mono text-[10px] uppercase tracking-widest hover:bg-muted-100 transition-colors">
                    <AlignLeft size={12} strokeWidth={1.5} className="inline mr-1" /> Summarize
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div dir="auto" className="font-body text-base leading-relaxed [&_p]:text-justify">
              {showRaw ? (
                <pre className="font-mono text-xs whitespace-pre-wrap break-words text-muted-600">{obj.answer}</pre>
              ) : isQuiz ? <QuizBlock code={obj.answer} /> :
                isFlashcards ? <FlashcardBlock code={obj.answer} /> :
                  isMindmap ? <MindmapBlock code={obj.answer} /> :
                    <Response dir="auto">{obj.answer}</Response>}
            </div>
          )}

          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-1 mt-4 pt-3 border-t border-divider">
            {((hasAnswer || obj.isMulti) && !isError) && (
              isCopied.state && isCopied.idMes === obj.id ? (
                <span className={btnActiveUp}><CopyIcon size={11} strokeWidth={1.5} /> copied</span>
              ) : !obj.isMulti ? (
                <button className={btnGhost} onClick={() => copyToClipboard(obj.id)} title="Copy response"><CopyIcon size={11} strokeWidth={1.5} /> copy</button>
              ) : null
            )}
            {(hasAnswer && !isError && !obj.isMulti) && (
              <button className={showRaw ? btnActiveUp : btnGhost} onClick={() => setShowRaw(p => !p)} title={showRaw ? "Show rendered" : "Show raw"}>
                {showRaw ? <EyeOff size={11} strokeWidth={1.5} /> : <Eye size={11} strokeWidth={1.5} />} {showRaw ? "rendered" : "raw"}
              </button>
            )}
            {!isEditing && (
              <button className={btnGhost} onClick={startEdit} title="Edit & re-send"><Pencil size={11} strokeWidth={1.5} /> edit</button>
            )}
            {obj.isTruncated && onContinue && (
              <button className="font-mono text-[10px] uppercase tracking-widest text-red underline underline-offset-4 hover:text-ink transition-colors" onClick={() => onContinue(obj.id)} title="Continue generating">
                <ChevronDown size={11} strokeWidth={1.5} className="inline" /> continue
              </button>
            )}
            {onRetry && (
              <button className={btnGhost} onClick={() => onRetry(obj.question, obj.id)} title="Retry">
                <RefreshCcwIcon size={11} strokeWidth={1.5} /> retry
              </button>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Streaming placeholder */}
      {(!hasAnswer && !obj.isMulti) && (
        <div className="flex items-center gap-1.5 py-2">
          <span className="w-1.5 h-1.5 bg-ink animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="w-1.5 h-1.5 bg-ink animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-1.5 h-1.5 bg-ink animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      )}
    </article>
  );
}
