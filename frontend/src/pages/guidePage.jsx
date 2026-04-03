import { useState, useContext, useRef, useEffect } from "react";
import { AnimatePresence } from "motion/react";
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
// Inject guide styles
// ──────────────────────────────────────────────────────────────
const GUIDE_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Root ────────────────────────────────────────────────────── */
.guide-root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0a0c0f;
  position: relative;
  overflow: hidden;
}

.guide-root::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 30% 0%, rgba(57,255,20,0.015) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 80% 100%, rgba(0,200,255,0.012) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* ── ASCII Logo ──────────────────────────────────────────────── */
.guide-ascii-logo {
  color: rgba(57,255,20,0.35);
  filter: drop-shadow(0 0 20px rgba(57,255,20,0.04));
  transition: filter 0.6s ease;
}

/* ── Scrollbar ───────────────────────────────────────────────── */
.guide-scrollbar::-webkit-scrollbar { width: 5px; }
.guide-scrollbar::-webkit-scrollbar-track { background: transparent; }
.guide-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 4px; }
.guide-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }

/* ── Boot message ────────────────────────────────────────────── */
.guide-msg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  letter-spacing: 0.01em;
}

/* ── Input field ─────────────────────────────────────────────── */
.guide-input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 10px 16px;
  background: rgba(14,17,22,0.8);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  color: rgba(220,230,240,0.9);
  outline: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.guide-input::placeholder {
  color: rgba(180,195,210,0.2);
  font-size: 12px;
}
.guide-input:focus {
  border-color: rgba(57,255,20,0.25);
  box-shadow: 0 0 0 3px rgba(57,255,20,0.06);
  background: rgba(14,17,22,0.95);
}
.guide-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Paste button ────────────────────────────────────────────── */
.guide-paste-btn {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  color: rgba(180,195,210,0.45);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.guide-paste-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.12);
  color: rgba(200,215,230,0.7);
}
.guide-paste-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ── Launch button ───────────────────────────────────────────── */
.guide-launch-btn {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 11px 24px;
  background: rgba(57,255,20,0.08);
  border: 1px solid rgba(57,255,20,0.22);
  border-radius: 8px;
  color: rgba(57,255,20,0.85);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.01em;
}
.guide-launch-btn:hover {
  background: rgba(57,255,20,0.14);
  border-color: rgba(57,255,20,0.4);
  color: rgba(57,255,20,1);
  box-shadow: 0 4px 20px rgba(57,255,20,0.08);
  transform: translateY(-1px);
}

/* ── Loading spinner ─────────────────────────────────────────── */
.guide-loading-spin {
  animation: guide-spin 1s linear infinite;
}
@keyframes guide-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Loading dots ────────────────────────────────────────────── */
.guide-loading-dots span {
  animation: guide-dot 1.4s infinite;
  opacity: 0;
  display: inline-block;
}
.guide-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.guide-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes guide-dot {
  0%, 60%, 100% { opacity: 0; }
  30% { opacity: 0.6; }
}

/* ── Version tag ─────────────────────────────────────────────── */
.guide-version {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(0,200,255,0.3);
  transition: color 0.4s ease;
}

/* ── Kbd hint ────────────────────────────────────────────────── */
.guide-kbd {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: rgba(0,200,255,0.6);
}

/* ── Confirm card ────────────────────────────────────────────── */
.guide-confirm-card {
  background: rgba(57,255,20,0.03);
  border: 1px solid rgba(57,255,20,0.12);
  border-radius: 10px;
  padding: 20px 24px;
}

/* ── Divider ─────────────────────────────────────────────────── */
.guide-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
}
`;

function injectGuideStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById("guide-styles")) return;
  const el = document.createElement("style");
  el.id = "guide-styles";
  el.textContent = GUIDE_STYLES;
  document.head.appendChild(el);
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

  // Inject styles on mount
  useEffect(() => {
    injectGuideStyles();
  }, []);

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
      case "ok": return "rgba(57,255,20,0.65)";
      case "warn": return "rgba(255,200,60,0.7)";
      case "error": return "rgba(255,80,120,0.8)";
      case "success": return "rgba(100,255,120,0.8)";
      case "info": return "rgba(0,200,255,0.55)";
      case "key": return "transparent";
      default: return "rgba(200,255,192,0.5)";
    }
  };

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-hidden guide-root guide-scrollbar"
    >
      <div className="flex-1 overflow-y-auto px-6 py-8" style={{ position: "relative", zIndex: 1, maxWidth: 780, width: "100%", margin: "0 auto" }}>

        {/* ASCII Logo */}
        <AnimatePresence>
          {logoVisible && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mb-8 overflow-x-auto"
              style={{ paddingTop: 8, paddingBottom: 4 }}
            >
              <pre
                className="text-[5px] sm:text-[7px] md:text-[8px] leading-tight ascii-logo select-none guide-ascii-logo"
                style={{ whiteSpace: "pre", letterSpacing: "-0.02em" }}
              >
                {ASCII_LOGO}
              </pre>
              <p className="guide-version mt-3">
                v2.0 — AI Terminal Interface
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle divider */}
        {logoVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="guide-divider mb-6"
          />
        )}

        {/* Boot messages */}
        <div className="space-y-2 mb-6">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {msg.type === "key" ? (
                <pre
                  className="text-sm blur-sm select-none"
                  style={{ color: "rgba(200,255,192,0.3)" }}
                >
                  [KEY] {msg.content}
                </pre>
              ) : msg.type === "info" ? (
                <div className="flex items-center gap-2">
                  <span className="guide-msg" style={{ color: msgColor(msg.type) }}>
                    {msg.content.startsWith("→  Visit") ? (
                      <>
                        →{" "}
                        <a
                          href="https://openrouter.ai"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1"
                          style={{
                            color: "rgba(0,200,255,0.65)",
                            textDecoration: "none",
                            borderBottom: "1px dashed rgba(0,200,255,0.3)",
                            paddingBottom: 1,
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "rgba(0,200,255,0.9)";
                            e.currentTarget.style.borderColor = "rgba(0,200,255,0.5)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "rgba(0,200,255,0.65)";
                            e.currentTarget.style.borderColor = "rgba(0,200,255,0.3)";
                          }}
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
                  className="guide-msg text-wrap"
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
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mt-2"
            >
              <div className="guide-confirm-card flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 mb-5">
                <CheckCircle2Icon
                  size={18}
                  style={{ color: "rgba(57,255,20,0.7)", flexShrink: 0 }}
                />
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(57,255,20,0.7)",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    lineHeight: 1.6,
                  }}
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
                className="guide-launch-btn"
              >
                <ArrowRightCircleIcon size={16} />
                Launch Chat Terminal
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2"
            >
              {/* Loading indicator while validating */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 mb-3"
                >
                  <Loader2Icon
                    size={14}
                    className="guide-loading-spin"
                    style={{ color: "rgba(57,255,20,0.6)" }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(180,195,210,0.4)",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Validating key
                    <span className="guide-loading-dots">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </span>
                </motion.div>
              )}

              {/* Key input row */}
              <div className="flex items-center gap-3 max-w-2xl">
                <span
                  className="flex-shrink-0"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 13,
                    color: "rgba(0,200,255,0.55)",
                  }}
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
                  className="guide-input flex-1"
                />
                <button
                  onClick={handlePaste}
                  disabled={loading}
                  className="guide-paste-btn flex-shrink-0"
                  title="Paste from clipboard"
                >
                  <ClipboardIcon size={13} />
                  paste
                </button>
              </div>

              <p
                style={{
                  fontSize: 10.5,
                  marginTop: 12,
                  marginLeft: 50,
                  fontFamily: "'Inter', sans-serif",
                  color: "rgba(180,195,210,0.2)",
                  lineHeight: 1.5,
                }}
              >
                Press <kbd className="guide-kbd">Enter</kbd> to
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
