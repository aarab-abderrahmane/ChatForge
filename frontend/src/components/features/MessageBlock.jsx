import { useState, useContext, useRef } from "react";
import {
  CopyIcon, RefreshCcwIcon,
  AlertTriangleIcon, Pencil, Eye, EyeOff, X, Check,
  Wand2, AlignLeft, Layers, ChevronDown, Volume2, VolumeX, Paperclip,
} from "lucide-react";
import { Response } from "../ui/shadcn-io/ai/response";
import { BlockErrorBoundary } from "../ui/shadcn-io/ai/response";
import { QuizBlock } from "../ui/shadcn-io/ai/quiz-block";
import { FlashcardBlock } from "../ui/shadcn-io/ai/flashcard-block";
import { MindmapBlock } from "../ui/shadcn-io/ai/mindmap-block";
import { chatsContext } from "../../context/chatsContext";
import { radius } from "../../lib/design-tokens";

function formatTime(isoString) {
  if (!isoString) return "";
  try { return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

const btnGhost = "inline-flex items-center gap-1.5 px-3 py-1.5 font-body text-base text-muted-500 border-2 border-ink/0 hover:border-ink hover:text-ink hover:-rotate-1 hover:shadow-hard-sm transition-all duration-100";
const btnActiveUp = `${btnGhost} text-red border-ink rotate-1 shadow-hard-sm`;

export function MessageBlock({
  obj, index, isLast, isCopied, copyToClipboard, onRetry,
  onEditSubmit, onMergeDrafts, onSummarizeDrafts, onKeepDraft, onContinue,
  prevProvider,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const [speakingId, setSpeakingId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const editRef = useRef(null);
  const MAX_QUESTION_CHARS = 200;
  const shouldTruncate = obj.question?.length > MAX_QUESTION_CHARS;
  const displayQuestion = shouldTruncate && !expanded ? obj.question.slice(0, MAX_QUESTION_CHARS) + "..." : obj.question;

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

  const speakMessage = (id, text) => {
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, ""));
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  };

  return (
    <article id={`msg-${obj.id}`} className={`border-b-2 border-dashed border-ink/20 py-6 ${isFirst ? "first-message" : ""}`}>
      <header className="flex items-start gap-4 mb-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <textarea
                ref={editRef}
                dir="auto"
                className="input-sketch w-full resize-none min-h-[80px] text-base"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === "Escape") cancelEdit(); }}
                rows={3}
              />
              <div className="flex gap-2">
                <button onClick={commitEdit} className="btn-sketch btn-sketch-sm">
                  <Check size={14} strokeWidth={2.5} className="inline mr-1" /> Save & Re-send
                </button>
                <button onClick={cancelEdit} className="btn-sketch btn-sketch-sm btn-sketch-secondary">
                  <X size={14} strokeWidth={2.5} className="inline mr-1" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div dir="auto" className={`font-serif font-bold text-ink ${isFirst ? "drop-cap text-2xl md:text-3xl" : "text-xl md:text-2xl"}`}>
                {displayQuestion}
                {shouldTruncate && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="ml-2 font-body text-base text-muted-500 hover:text-red transition-colors align-baseline wavy-underline"
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
              {obj.files?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {obj.files.map(f => (
                    <span key={f.name} className="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-dashed border-ink/40 font-body text-sm text-muted-500 wobbly-sm">
                      <Paperclip size={10} strokeWidth={1.5} />
                      {f.name}
                      <span className="text-muted-400 ml-0.5">({f.sizeKB}KB)</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {obj.provider && (
            <span className={`font-body text-sm border-2 px-2 py-0.5 wobbly-sm ${prevProvider && prevProvider !== obj.provider ? "border-yellow bg-yellow text-ink" : "border-ink text-muted-500"}`}>
              {prevProvider && prevProvider !== obj.provider ? "⇄ " : ""}
              {obj.provider === "groq" ? "GROQ" : obj.provider === "gemini" ? "GEMINI" : obj.provider === "huggingface" ? "HF" : obj.provider === "together" ? "TOGETHER" : obj.provider === "mistral" ? "MISTRAL" : "OPENROUTER"}
            </span>
          )}
          {obj.timestamp && settings?.showTimestamps && (
            <time className="font-body text-sm text-muted-500">{formatTime(obj.timestamp)}</time>
          )}
        </div>
      </header>

      {/* Answer content */}
      {(hasAnswer || obj.isMulti) && (
        <div className="flex gap-4">
          <div
            className="shrink-0 w-10 h-10 border-2 border-ink bg-yellow flex items-center justify-center font-serif text-sm font-bold mt-0.5 -rotate-2 hover:rotate-1 transition-transform duration-100"
            style={{ borderRadius: radius.wobblySm }}
            title="AI"
          >
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
                    className={`relative shrink-0 w-[320px] snap-center border-2 border-ink p-4 flex flex-col min-h-[200px] max-h-[450px] shadow-hard-sm hover:rotate-1 transition-transform duration-100 ${
                      selectedDrafts.includes(idx) ? "bg-ink text-paper shadow-hard" : "bg-white"
                    }`}
                    style={{ borderRadius: radius.wobblyMd }}
                  >
                    <div className="flex justify-between items-center mb-3 border-b-2 border-dashed border-ink/30 pb-2 shrink-0">
                      <span className="font-serif text-base font-bold"><Layers size={14} strokeWidth={2.5} className="inline mr-1" /> Draft {idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => onKeepDraft(obj.id, idx)} className="font-body text-sm underline underline-offset-4 decoration-wavy decoration-red hover:text-red transition-colors">Keep</button>
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
                <div className="flex flex-wrap gap-2 items-center border-2 border-ink p-3 bg-muted-100 shadow-hard-sm hover:rotate-1 transition-transform duration-100" style={{ borderRadius: radius.wobblyMd }}>
                  <span className="font-body text-sm text-muted-500">{selectedDrafts.length} Selected</span>
                  <button onClick={() => onMergeDrafts(obj.id, selectedDrafts)} className="btn-sketch btn-sketch-sm">
                    <Wand2 size={14} strokeWidth={2.5} className="inline mr-1" /> Merge via AI
                  </button>
                  <button onClick={() => onSummarizeDrafts(obj.id, selectedDrafts)} className="btn-sketch btn-sketch-sm btn-sketch-secondary">
                    <AlignLeft size={14} strokeWidth={2.5} className="inline mr-1" /> Summarize
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div dir="auto" className="font-body text-base leading-relaxed [&_p]:text-justify">
              {showRaw ? (
                <pre className="font-mono text-xs whitespace-pre-wrap break-words text-muted-600">{obj.answer}</pre>
              ) : isQuiz ? <BlockErrorBoundary code={obj.answer}><QuizBlock code={obj.answer} /></BlockErrorBoundary> :
                isFlashcards ? <BlockErrorBoundary code={obj.answer}><FlashcardBlock code={obj.answer} /></BlockErrorBoundary> :
                  isMindmap ? <MindmapBlock code={obj.answer} /> :
                    <Response dir="auto">{obj.answer}</Response>}
            </div>
          )}

          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-1 mt-4 pt-3 border-t-2 border-dashed border-ink/20">
            {((hasAnswer || obj.isMulti) && !isError) && (
              isCopied.state && isCopied.idMes === obj.id ? (
                <span className={btnActiveUp}><CopyIcon size={11} strokeWidth={1.5} /> copied</span>
              ) : !obj.isMulti ? (
                <button className={btnGhost} onClick={() => copyToClipboard(obj.id)} title="Copy response"><CopyIcon size={11} strokeWidth={1.5} /> copy</button>
              ) : null
            )}
            {(hasAnswer && !isError && !obj.isMulti) && (
              <button className={speakingId === obj.id ? btnActiveUp : btnGhost} onClick={() => speakMessage(obj.id, obj.answer)} title={speakingId === obj.id ? "Stop" : "Read aloud"}>
                {speakingId === obj.id ? <VolumeX size={11} strokeWidth={1.5} /> : <Volume2 size={11} strokeWidth={1.5} />} {speakingId === obj.id ? "stop" : "read"}
              </button>
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
              <button className="font-body text-base text-red underline decoration-wavy underline-offset-4 hover:text-ink transition-colors" onClick={() => onContinue(obj.id)} title="Continue generating">
                <ChevronDown size={11} strokeWidth={1.5} className="inline" /> continue
              </button>
            )}
            {onRetry && (
              <button className={btnGhost} onClick={() => onRetry(obj.question, obj.id)} title="Retry">
                <RefreshCcwIcon size={11} strokeWidth={1.5} /> retry
              </button>
            )}
          </div>

          {/* AI-generated follow-up suggestions */}
          {hasAnswer && !isError && !obj.isMulti && isLast && obj.suggestions && obj.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {obj.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onEditSubmit(s)}
                  className="px-3 py-1 text-base font-body border-2 border-dashed border-ink/40 text-muted-500 hover:text-ink hover:border-ink hover:bg-yellow/50 hover:-rotate-1 hover:shadow-hard-sm transition-all duration-100"
                  style={{ borderRadius: radius.wobblySm }}
                >
                  {s} →
                </button>
              ))}
            </div>
          )}
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
