import { useState, useContext, useRef, useEffect } from "react";
import { chatsContext } from "../context/chatsContext";
import { api } from "../services/api";

import {
  ClipboardIcon,
  ArrowRightCircleIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// ASCII logo
// ──────────────────────────────────────────────────────────────
const ASCII_LOGO = `
 ██████╗██╗  ██╗ █████╗ ████████╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██╔════╝██║  ██║██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
██║     ███████║███████║   ██║   █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
██║     ██╔══██║██╔══██║   ██║   ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
╚██████╗██║  ██║██║  ██║   ██║   ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

const BOOT_MESSAGES = [
  { type: "sys", content: "root@chatforge:~# ./start_chatforge.sh", delay: 0 },
  { type: "ok", content: "[✓] Verifying ChatForge environment...", delay: 300 },
  { type: "ok", content: "[✓] Node runtime v20.x detected", delay: 600 },
  { type: "ok", content: "[✓] Loading AI modules...", delay: 900 },
  { type: "warn", content: "[!] AI Provider key not detected", delay: 1200 },
  { type: "info", content: "→  Supports: OpenRouter (sk-or-v1...), Groq (gsk_...), Gemini (AIza...), HuggingFace (hf_...)", delay: 1500 },
  { type: "info", content: "→  Paste your key below to enable full AI access", delay: 1800 },
  { type: "sys", content: "System ready. Awaiting authentication.", delay: 2100 },
];

export async function KeyTest(
  setMessages,
  key,
  userId,
  setLoading,
  setShowConfirm
) {
  try {
    const data = await api.testKey(key, userId);
    if (data.type === "error") {
      setMessages((prev) => [
        ...prev,
        { type: "error", content: `[✗] ${data.response}` },
      ]);
    } else {
      const isWarning = data.response?.startsWith("warning:");
      const message = isWarning ? data.response.split("warning:")[1] : "[✓] API Key authenticated. Full access granted.";

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
      { type: "error", content: `[✗] Connection error: ${err.message || err}` },
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
  const [logoVisible, setLogoVisible] = useState(false);
  const [keyValue, setKeyValue] = useState("");

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const { setPreferences, preferences } = useContext(chatsContext);

  // Show logo then boot messages
  useEffect(() => {
    const timers = [];

    timers.push(setTimeout(() => setLogoVisible(true), 100));
    BOOT_MESSAGES.forEach(({ type, content, delay }) => {
      timers.push(
        setTimeout(() => {
          setMessages((prev) => [...prev, { type, content }]);
        }, delay + 400)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showConfirm]);

  // Focus input after boot
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 2600);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const key = keyValue.trim();
      if (!key || loading) return;
      setLoading(true);
      await KeyTest(setMessages, key, preferences.userId, setLoading, setShowConfirm);
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

  const msgColor = (type) => {
    switch (type) {
      case "ok": return "text-ink";
      case "warn": return "text-muted-500";
      case "error": return "text-red";
      case "success": return "text-ink";
      case "info": return "text-muted-400";
      default: return "text-muted-400";
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden dot-grid-bg">
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-2xl mx-auto w-full">

        {/* ASCII Logo */}
        {logoVisible && (
          <div className="mb-8 overflow-x-auto pt-2 pb-1">
            <pre className="font-mono text-muted-400 text-[5px] leading-tight select-none whitespace-pre">
              {ASCII_LOGO}
            </pre>
            <p className="font-mono text-[10px] text-muted-400 uppercase tracking-widest mt-3">
              v2.0 — AI Terminal Interface
            </p>
          </div>
        )}

        {/* Subtle divider */}
        {logoVisible && (
          <div className="border-t border-divider mb-6" />
        )}

        {/* Boot messages */}
        <div className="space-y-2 mb-6">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.type === "key" ? (
                <pre className="font-mono text-sm blur-sm select-none text-muted-400/30">
                  [KEY] {msg.content}
                </pre>
              ) : msg.type === "info" ? (
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs leading-relaxed ${msgColor(msg.type)}`}>
                    {msg.content.startsWith("→  Visit") ? (
                      <>
                        →{" "}
                        <a
                          href="https://openrouter.ai"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline decoration-dashed underline-offset-4 text-muted-500 hover:text-green"
                        >
                          openrouter.ai
                          <ExternalLinkIcon size={11} />
                        </a>
                        {" "}to create your free key
                      </>
                    ) : (
                      msg.content
                    )}
                  </span>
                </div>
              ) : (
                <pre className={`font-mono text-xs leading-relaxed text-wrap ${msgColor(msg.type)}`}>
                  {msg.content}
                </pre>
              )}
            </div>
          ))}
        </div>

        {/* Input area or success */}
        {showConfirm ? (
          <div className="mt-2">
            <div className="border border-ink bg-muted-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 mb-5">
              <CheckCircle2Icon size={18} className="text-ink flex-shrink-0" />
              <p className="text-sm font-sans font-medium text-ink leading-relaxed">
                System ready with full AI access. Launch the terminal to begin.
              </p>
            </div>
            <button
              onClick={() =>
                setPreferences((prev) => ({
                  ...prev,
                  currentPage: "chat",
                }))
              }
              className="border border-green bg-green text-paper hover:bg-green/90 font-mono text-xs uppercase tracking-widest px-6 py-3 inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowRightCircleIcon size={16} />
              Launch Chat Terminal
            </button>
          </div>
        ) : (
          <div className="mt-2">
            {/* Loading indicator while validating */}
            {loading && (
              <div className="flex items-center gap-2 mb-3">
                <Loader2Icon size={14} className="animate-spin text-muted-400" />
                <span className="text-xs font-sans text-muted-400">
                  Validating key
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            )}

            {/* Key input row */}
            <div className="flex items-center gap-3 max-w-2xl">
              <span className="flex-shrink-0 font-mono text-sm text-muted-400">
                key&gt;
              </span>
              <input
                ref={inputRef}
                type="text"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="sk-or-v1-... OR gsk_... OR AIza..."
                disabled={loading || showConfirm}
                className="border-b border-ink bg-transparent font-mono text-sm text-ink flex-1 placeholder:text-muted-400/40 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
              />
              <button
                onClick={handlePaste}
                disabled={loading}
                className="border border-ink text-ink hover:bg-muted-100 font-mono text-[10px] flex-shrink-0 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Paste from clipboard"
              >
                <ClipboardIcon size={13} className="inline mr-1.5" />
                paste
              </button>
            </div>

            <p className="text-muted-400/50 text-[10px] font-sans mt-3 ml-[50px] leading-relaxed">
              Press <kbd className="border border-ink/10 text-muted-500 font-mono text-[10px] px-1.5 py-0.5">Enter</kbd> to
              authenticate · Your key is encrypted and stored securely
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
