import { motion, AnimatePresence } from "motion/react";
import {
  CheckIcon,
  CopyIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  RefreshCcwIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useState } from "react";
import { Response } from "../ui/shadcn-io/ai/response";

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
}) {
  const [reaction, setReaction] = useState(null); // 'up' | 'down' | null

  const isError = obj.type === "error";
  const hasAnswer = !!obj.answer;

  return (
    <motion.div
      className="message-block msg-enter"
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
          <p className="message-question text-sm text-wrap break-words">
            {obj.question}
          </p>
        </div>
        {obj.timestamp && (
          <span className="message-timestamp flex-shrink-0 mt-0.5">
            {formatTime(obj.timestamp)}
          </span>
        )}
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
              <Response>{obj.answer}</Response>
            </div>
          )}

          {/* Action bar */}
          <div className="message-actions">
            {/* Copy */}
            {hasAnswer && !isError && (
              isCopied.state && isCopied.idMes === obj.id ? (
                <div
                  className="reaction-btn active-up"
                  style={{ pointerEvents: "none" }}
                >
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

            {/* Retry on error */}
            {isError && onRetry && (
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

      {/* Streaming placeholder — no answer yet */}
      {!hasAnswer && (
        <div className="pl-4 border-l-2" style={{ borderColor: "var(--border-green)" }}>
          <div
            className="loading-dots text-sm"
            style={{ color: "rgba(200,255,192,0.4)" }}
          >
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
