"use client";
import { useEffect, useCallback } from "react";
import { X, Copy, Download, Check, FileText } from "lucide-react";
import { useState } from "react";

export function FilePreviewDialog({ file, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!file) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [file, handleKeyDown]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleDownload = () => {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-ink w-[85vw] max-w-3xl h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink bg-muted-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink" />
            <span className="font-mono text-sm font-semibold text-ink truncate">{file.filename}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center hover:bg-muted-200 transition-colors"
              title={copied ? "Copied!" : "Copy content"}
            >
              {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
            </button>
            <button
              onClick={handleDownload}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center hover:bg-muted-200 transition-colors"
              title="Download"
            >
              <Download size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={onClose}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center hover:bg-muted-200 transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="font-mono text-xs text-ink whitespace-pre-wrap break-all leading-relaxed">
            {file.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
