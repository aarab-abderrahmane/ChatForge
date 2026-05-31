"use client";
import { useState, useEffect, useCallback } from "react";
import { FileText, FileCode, FileImage, Table, Copy, Download, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useArtifacts } from "../../../../context/artifactContext";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const EXT_ICON = {
  md: FileText, txt: FileText, pdf: FileText,
  js: FileCode, ts: FileCode, jsx: FileCode, tsx: FileCode, py: FileCode, rb: FileCode, go: FileCode, rs: FileCode, java: FileCode, c: FileCode, cpp: FileCode, cs: FileCode, php: FileCode, swift: FileCode, kt: FileCode, sh: FileCode, bash: FileCode, sql: FileCode, html: FileCode, css: FileCode, scss: FileCode, less: FileCode, json: FileCode, xml: FileCode, yaml: FileCode, yml: FileCode, toml: FileCode, r: FileCode,
  csv: Table, tsv: Table,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, svg: FileImage, webp: FileImage, ico: FileImage,
};

const EXT_MIME = {
  md: "text/markdown", txt: "text/plain", pdf: "application/pdf",
  js: "text/javascript", ts: "text/typescript", jsx: "text/javascript", tsx: "text/typescript",
  py: "text/x-python", rb: "text/x-ruby", go: "text/x-go", rs: "text/x-rust",
  java: "text/x-java", c: "text/x-c", cpp: "text/x-c++", cs: "text/x-csharp",
  php: "text/x-php", swift: "text/x-swift", kt: "text/x-kotlin",
  sh: "text/x-shellscript", bash: "text/x-shellscript",
  sql: "text/x-sql", html: "text/html", css: "text/css",
  json: "application/json", xml: "text/xml", yaml: "text/yaml", yml: "text/yaml",
  csv: "text/csv", tsv: "text/tab-separated-values",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", svg: "image/svg+xml",
  toml: "text/toml", r: "text/x-r-source",
};

function getExt(filename) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generatePDF(filename, content) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lines = doc.splitTextToSize(content, 180);
  let y = 20;
  doc.setFontSize(10);
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 15, y);
    y += 5;
  }
  doc.save(filename);
}

export function FileBlock({ code, filename, messageId }) {
  const { addFile } = useArtifacts();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const ext = getExt(filename);
  const Icon = EXT_ICON[ext] || FileText;
  const mime = EXT_MIME[ext] || "text/plain";
  const size = code ? new Blob([code]).size : 0;

  useEffect(() => {
    if (filename && code) {
      addFile(null, { filename, content: code, mime, size, messageId });
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (ext === "pdf") {
      generatePDF(filename, code);
      return;
    }
    const blob = new Blob([code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [code, filename, mime, ext]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  }, [code]);

  return (
    <div className="border border-ink my-3 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted-100 border-b border-divider">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} strokeWidth={1.5} className="shrink-0 text-ink" />
          <span className="font-mono text-xs font-semibold text-ink truncate">{filename}</span>
          <span className="font-mono text-[9px] text-muted-500 uppercase tracking-widest shrink-0">
            {formatSize(size)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {size < 50000 && (
            <button
              onClick={() => setShowPreview(p => !p)}
              className="min-h-[28px] min-w-[28px] flex items-center justify-center hover:bg-muted-200 transition-colors"
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="min-h-[28px] min-w-[28px] flex items-center justify-center hover:bg-muted-200 transition-colors"
            title={copied ? "Copied!" : "Copy content"}
          >
            {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
          </button>
          <button
            onClick={handleDownload}
            className="min-h-[28px] min-w-[28px] flex items-center justify-center hover:bg-muted-200 transition-colors"
            title="Download"
          >
            <Download size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {showPreview && (
        <pre className="font-mono text-xs text-ink bg-paper p-3 max-h-60 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
          {code}
        </pre>
      )}
    </div>
  );
}
