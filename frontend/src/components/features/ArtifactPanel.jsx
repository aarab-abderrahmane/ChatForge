"use client";
import { useArtifacts } from "../../context/artifactContext";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Download, Copy, Check, X } from "lucide-react";
import { useState } from "react";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(filename) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

const EXT_MIME = {
  md: "text/markdown", txt: "text/plain", pdf: "application/pdf",
  js: "text/javascript", ts: "text/typescript", jsx: "text/javascript", tsx: "text/typescript",
  py: "text/x-python", rb: "text/x-ruby", go: "text/x-go", rs: "text/x-rust",
  java: "text/x-java", c: "text/x-c", cpp: "text/x-c++", cs: "text/x-csharp",
  php: "text/x-php", swift: "text/x-swift", kt: "text/x-kotlin",
  sh: "text/x-shellscript", sql: "text/x-sql", html: "text/html", css: "text/css",
  json: "application/json", xml: "text/xml", yaml: "text/yaml", yml: "text/yaml",
  csv: "text/csv",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", svg: "image/svg+xml",
};

export function ArtifactPanel({ isOpen, onClose }) {
  const { files, getFiles } = useArtifacts();
  const [copiedId, setCopiedId] = useState(null);

  const handleDownload = (file) => {
    const blob = new Blob([file.content], { type: EXT_MIME[getExt(file.filename)] || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (file) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="border-l border-ink bg-paper h-full overflow-hidden shrink-0"
        >
          <div className="w-[280px] h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink bg-muted-100 shrink-0">
              <h2 className="font-serif text-sm font-bold uppercase tracking-wider">
                Files ({files.length})
              </h2>
              <button
                onClick={onClose}
                className="min-h-[28px] min-w-[28px] flex items-center justify-center hover:bg-muted-200 transition-colors"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[10px] text-muted-500 uppercase tracking-widest">
                  No files generated in this session
                </div>
              ) : (
                files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-4 py-2.5 border-b border-divider hover:bg-muted-100 transition-colors group"
                  >
                    <FileText size={14} strokeWidth={1.5} className="shrink-0 text-ink" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] font-semibold text-ink truncate">
                        {file.filename}
                      </div>
                      <div className="font-mono text-[9px] text-muted-500 uppercase tracking-widest">
                        {formatSize(file.size || 0)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(file)}
                      className="min-h-[28px] min-w-[28px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted-200 transition-all"
                      title="Copy content"
                    >
                      {copiedId === file.id ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="min-h-[28px] min-w-[28px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted-200 transition-all"
                      title="Download"
                    >
                      <Download size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
