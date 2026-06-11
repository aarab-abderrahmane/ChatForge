"use client";
import { useArtifacts } from "../../context/artifactContext";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Download, Copy, Check, X, Archive } from "lucide-react";
import { useState } from "react";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { zip, strToU8 } from "fflate";
import { radius, shadows } from "../../lib/design-tokens";

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
  const { getFiles, sessionId } = useArtifacts();
  const files = getFiles(sessionId);
  const [copiedId, setCopiedId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const handleDownloadAll = () => {
    const fileMap = {};
    for (const file of files) {
      fileMap[file.filename] = strToU8(file.content);
    }
    zip(fileMap, { level: 3 }, (err, data) => {
      if (err) return;
      const blob = new Blob([data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ChatForge-files.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

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
          className="border-l-2 border-ink bg-paper h-full overflow-hidden shrink-0"
        >
          <div className="w-[280px] h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink bg-muted-100 shrink-0">
              <h2 className="font-serif text-sm font-bold text-ink">
                Files ({files.length})
              </h2>
              <div className="flex items-center gap-1">
                {files.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center justify-center w-8 h-8 border-2 border-ink text-ink hover:bg-ink hover:text-paper transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                    style={{ borderRadius: radius.wobblySm }}
                    title="Download all files"
                  >
                    <Archive size={14} strokeWidth={2.5} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 border-2 border-ink text-ink hover:bg-red hover:text-white hover:border-red transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                  style={{ borderRadius: radius.wobblySm }}
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.length === 0 ? (
                <div className="px-4 py-8 text-center font-body text-sm text-muted-500">
                  No files generated in this session
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {files.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-2.5 border-2 border-ink bg-white shadow-hard-sm hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-100 cursor-pointer group"
                      style={{ borderRadius: radius.wobblySm }}
                      onClick={() => setPreviewFile(file)}
                    >
                      <FileText size={14} strokeWidth={2.5} className="shrink-0 text-ink" />
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-sm text-ink truncate">
                          {file.filename}
                        </div>
                        <div className="font-body text-[10px] text-muted-500">
                          {formatSize(file.size || 0)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(file); }}
                        className="flex items-center justify-center w-7 h-7 border-2 border-transparent hover:border-ink text-muted-400 hover:text-ink transition-all duration-100 opacity-0 group-hover:opacity-100"
                        style={{ borderRadius: radius.wobblySm }}
                        title="Copy content"
                      >
                        {copiedId === file.id ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2.5} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                        className="flex items-center justify-center w-7 h-7 border-2 border-transparent hover:border-ink text-muted-400 hover:text-ink transition-all duration-100 opacity-0 group-hover:opacity-100"
                        style={{ borderRadius: radius.wobblySm }}
                        title="Download"
                      >
                        <Download size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
