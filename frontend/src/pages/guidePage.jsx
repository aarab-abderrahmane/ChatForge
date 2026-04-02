import { useState, useContext, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  { type: "info", content: "→  Supports: OpenRouter, Groq (gsk_...), or Gemini (AIza...)", delay: 1500 },
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
      { type: "error", content: `[✗] Connection error: ${err}` },
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
    setMessages([]); // reset on mount to avoid duplicates
    setLogoVisible(false);

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
      case "ok": return "var(--neon-green)";
      case "warn": return "var(--neon-yellow)";
      case "error": return "var(--neon-magenta)";
      case "success": return "#90ff80";
      case "info": return "var(--neon-cyan)";
      case "key": return "transparent";
      default: return "rgba(200,255,192,0.7)";
    }
  };

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ fontFamily: "'Fira Code', monospace" }}
    >
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* ASCII Logo */}
        <AnimatePresence>
          {logoVisible && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-4 overflow-x-auto"
            >
              <pre
                className="text-[5px] sm:text-[7px] md:text-[8px] leading-tight ascii-logo select-none"
                style={{ whiteSpace: "pre", letterSpacing: "-0.02em" }}
              >
                {ASCII_LOGO}
              </pre>
              <p
                className="text-[9px] tracking-[0.25em] uppercase mt-1"
                style={{ color: "rgba(0,245,255,0.5)" }}
              >
                v2.0 — AI Terminal Interface
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Boot messages */}
        <div className="space-y-1 mb-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.type === "key" ? (
                <pre
                  className="text-sm blur-sm select-none"
                  style={{ color: "rgba(200,255,192,0.4)" }}
                >
                  [KEY] {msg.content}
                </pre>
              ) : msg.type === "info" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: msgColor(msg.type) }}>
                    {msg.content.startsWith("→  Visit") ? (
                      <>
                        →{" "}
                        <a
                          href="https://openrouter.ai"
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-dashed inline-flex items-center gap-1"
                          style={{ color: "var(--neon-cyan)" }}
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
                <pre
                  className="text-sm text-wrap"
                  style={{ color: msgColor(msg.type) }}
                >
                  {msg.content}
                </pre>
              )}
            </motion.div>
          ))}
        </div>

        {/* Input area or success */}
        <AnimatePresence mode="wait">
          {showConfirm ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2Icon
                  size={18}
                  style={{ color: "var(--neon-green)" }}
                />
                <p
                  className="text-sm"
                  style={{ color: "var(--neon-green)" }}
                >
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
                className="btn-neon flex items-center gap-2"
              >
                <ArrowRightCircleIcon size={15} />
                Launch Chat Terminal
              </button>
            </motion.div>
          ) : (
            <motion.div key="input" className="mt-2">
              {/* Loading indicator while validating */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 mb-2"
                >
                  <Loader2Icon
                    size={13}
                    className="loading-spin"
                    style={{ color: "var(--neon-green)" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "rgba(200,255,192,0.5)" }}
                  >
                    Validating key
                    <span className="loading-dots">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </span>
                </motion.div>
              )}

              {/* Key input row */}
              <div className="flex items-center gap-2 max-w-2xl">
                <span
                  className="text-sm flex-shrink-0"
                  style={{ color: "var(--neon-cyan)" }}
                >
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
                  className="guide-key-input flex-1"
                />
                <button
                  onClick={handlePaste}
                  disabled={loading}
                  className="btn-ghost flex-shrink-0 text-xs"
                  title="Paste from clipboard"
                >
                  <ClipboardIcon size={12} />
                  paste
                </button>
              </div>

              <p
                className="text-[10px] mt-2 ml-10"
                style={{ color: "rgba(200,255,192,0.25)" }}
              >
                Press <kbd style={{ color: "var(--neon-cyan)" }}>Enter</kbd> to
                authenticate · Your key is encrypted and stored securely
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
