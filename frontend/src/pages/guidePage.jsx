import { useState, useContext, useRef, useEffect } from "react";
import { chatsContext } from "../context/chatsContext";
import { api } from "../services/api";

import {
  ClipboardIcon,
  ArrowRightCircleIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Boot sequence messages
// ──────────────────────────────────────────────────────────────
const BOOT_MESSAGES = [
  { type: "ok", content: "Verifying ChatForge environment...", delay: 300 },
  { type: "ok", content: "Node runtime v20.x detected", delay: 600 },
  { type: "ok", content: "Loading AI modules...", delay: 900 },
  { type: "warn", content: "AI Provider key not detected", delay: 1200 },
];

// ──────────────────────────────────────────────────────────────
// KeyTest — validates API key via the backend
// ──────────────────────────────────────────────────────────────
export async function KeyTest(
  setMessages,
  key,
  userId,
  setLoading,
  setShowConfirm
) {
  try {
    const providerKey = key.startsWith("gsk_") ? "groq" : key.startsWith("AIza") ? "gemini" : key.startsWith("hf_") ? "huggingface" : key.startsWith("tgp_") ? "together" : "openrouter";
    const data = await api.validateAndSaveKey(userId, { [providerKey]: key });
    if (data.type === "error") {
      setMessages((prev) => [
        ...prev,
        { type: "error", content: data.error || "Validation failed." },
      ]);
    } else {
      const firstResult = Object.values(data.results || {})[0];
      const isWarning = firstResult?.warning;
      const message = isWarning || "API Key authenticated. Full access granted.";

      setMessages((prev) => [
        ...prev,
        { type: "key", content: key },
        { type: isWarning ? "warn" : "success", content: message },
      ]);
      setShowConfirm(true);
    }
  } catch (err) {
    setMessages((prev) => [
      ...prev,
      { type: "error", content: `Connection error: ${err.message || err}` },
    ]);
  } finally {
    setLoading(false);
  }
}

// ──────────────────────────────────────────────────────────────
// GuidePage
// ──────────────────────────────────────────────────────────────
export const GuidePage = () => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [messages, setMessages] = useState([]);
  const [bootDone, setBootDone] = useState(false);
  const [keyValue, setKeyValue] = useState("");

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const { setPreferences, preferences } = useContext(chatsContext);

  // Boot animation
  useEffect(() => {
    const timers = [];
    BOOT_MESSAGES.forEach(({ type, content, delay }) => {
      timers.push(
        setTimeout(() => {
          setMessages((prev) => [...prev, { type, content }]);
        }, delay)
      );
    });
    timers.push(setTimeout(() => setBootDone(true), 1600));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showConfirm]);

  // Focus input after boot
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 1700);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const key = keyValue.trim();
      if (!key || loading) return;
      setLoading(true);
      await KeyTest(
        setMessages,
        key,
        preferences.userId,
        setLoading,
        setShowConfirm
      );
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setKeyValue(text.trim());
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-paper dot-grid-bg">
      <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 md:py-14">
        <div className="max-w-lg mx-auto">

          {/* ── Masthead ────────────────────────────── */}
          <div className="mb-10 border-b border-ink pb-6">
            <h1 className="font-serif text-4xl font-black uppercase tracking-tight text-ink leading-none">
              ChatForge
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono text-[10px] text-muted-500 uppercase tracking-[0.15em]">
                Digital Edition
              </span>
              <span className="w-px h-3 bg-divider" />
              <span className="font-mono text-[10px] text-muted-400 uppercase tracking-[0.15em]">
                v2.0
              </span>
            </div>
          </div>

          {/* ── Status Section ──────────────────────── */}
          <div className="mb-8">
            <p className="font-mono text-[9px] text-muted-400 uppercase tracking-[0.2em] mb-4">
              System Status
            </p>
            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="flex items-center gap-2.5 opacity-30">
                  <span className="font-mono text-[10px] text-muted-400">●</span>
                  <span className="font-mono text-[11px] text-muted-400">Initializing...</span>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className={`font-mono text-[10px] shrink-0 ${
                        msg.type === "ok" ? "text-green" :
                        msg.type === "success" ? "text-green" :
                        msg.type === "warn" ? "text-muted-500" :
                        msg.type === "error" ? "text-red" :
                        "text-muted-400"
                      }`}>
                        {msg.type === "ok" ? "✓" :
                         msg.type === "success" ? "✓" :
                         msg.type === "warn" ? "!" :
                         msg.type === "error" ? "✗" : "●"}
                      </span>
                      <span className={`font-mono text-[11px] ${
                        msg.type === "ok" ? "text-ink" :
                        msg.type === "success" ? "text-green" :
                        msg.type === "warn" ? "text-muted-500" :
                        msg.type === "error" ? "text-red" :
                        msg.type === "key" ? "text-muted-400/30 line-through" :
                        "text-muted-400"
                      }`}>
                        {msg.type === "error" || msg.type === "warn" || msg.type === "success"
                          ? msg.content.replace(/^\[.\] /, "")
                          : msg.content}
                      </span>
                    </div>
                  ))}

                  {/* Pending boot lines */}
                  {!bootDone &&
                    BOOT_MESSAGES.slice(messages.filter(m => m.type !== "key").length).map((msg, i) => (
                      <div key={`p-${i}`} className="flex items-center gap-2.5 opacity-20">
                        <span className="font-mono text-[10px] text-muted-400">●</span>
                        <span className="font-mono text-[11px] text-muted-400">{msg.content}</span>
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>

          {/* ── API Key Section ─────────────────────── */}
          {!showConfirm && (
            <div className="mb-6">
              <div className="border-t border-divider pt-6">
                <p className="font-mono text-[9px] text-muted-400 uppercase tracking-[0.2em] mb-4">
                  API Authentication
                </p>

                <div className="mb-5">
                  <p className="font-mono text-[10px] text-muted-500 leading-relaxed">
                    Supports: OpenRouter (sk-or-v1...), Groq (gsk_...), Gemini (AIza...), HuggingFace (hf_...)
                  </p>
                  {bootDone && (
                    <p className="font-mono text-[10px] text-muted-500 leading-relaxed mt-1">
                      Visit{" "}
                      <a
                        href="https://openrouter.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline decoration-dashed underline-offset-4 text-muted-500 hover:text-green"
                      >
                        openrouter.ai
                        <ExternalLinkIcon size={11} />
                      </a>{" "}
                      to create your free key
                    </p>
                  )}
                </div>

                <div className="flex items-end gap-3 mb-3">
                  <div className="flex-1">
                    <label className="font-mono text-[9px] text-muted-500 uppercase tracking-[0.15em] block mb-1.5">
                      API Key
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={keyValue}
                      onChange={(e) => setKeyValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="sk-or-v1-... OR gsk_... OR AIza..."
                      disabled={loading}
                      className="w-full bg-transparent border-b-2 border-ink px-1 py-2 font-mono text-sm text-ink placeholder:text-muted-400/30 outline-none disabled:opacity-40 transition-opacity"
                    />
                  </div>
                  <button
                    onClick={handlePaste}
                    disabled={loading}
                    className="border border-ink px-3 py-[9px] text-ink hover:bg-muted-100 font-mono text-[10px] uppercase tracking-widest shrink-0 transition-colors disabled:opacity-40"
                    title="Paste from clipboard"
                  >
                    <ClipboardIcon size={12} className="inline mr-1" />
                    paste
                  </button>
                </div>

                {loading && (
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2Icon size={12} className="animate-spin text-muted-400" />
                    <span className="font-mono text-[10px] text-muted-400">Validating key</span>
                  </div>
                )}

                <p className="font-body text-[10px] text-muted-400/70 leading-relaxed">
                  Press <kbd className="border border-divider px-1.5 py-0.5 font-mono text-[10px] text-muted-500">Enter</kbd> to authenticate ·
                  Your key is encrypted and stored securely in your browser
                </p>
              </div>
            </div>
          )}

          {/* ── Success State ───────────────────────── */}
          {showConfirm && (
            <div className="border-t border-divider pt-6 mb-6">
              <div className="border border-ink bg-muted-100 p-4 flex items-start gap-3 mb-5">
                <CheckCircle2Icon size={16} className="text-ink shrink-0 mt-0.5" />
                <div>
                  <p className="font-serif text-sm font-bold text-ink mb-1">System Ready</p>
                  <p className="font-mono text-[10px] text-muted-500 leading-relaxed">
                    Full AI access granted. Launch the terminal to begin.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setPreferences((prev) => ({
                    ...prev,
                    currentPage: "chat",
                  }))
                }
                className="border border-ink bg-ink text-paper hover:bg-paper hover:text-ink font-mono text-[10px] uppercase tracking-widest px-6 py-3 transition-colors"
              >
                <ArrowRightCircleIcon size={14} className="inline mr-2" />
                Launch Chat
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};
