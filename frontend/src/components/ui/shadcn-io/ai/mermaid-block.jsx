import { useEffect, useState } from "react";
import mermaid from "mermaid";

// ── Mermaid init (once, lazily) ─────────────────────────────────
let _initialized = false;
function ensureInit() {
  if (_initialized) return;
  _initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#050a0e",
      primaryColor: "#0d2b1a",
      primaryTextColor: "#39ff14",
      primaryBorderColor: "#39ff14",
      lineColor: "#00f5ff",
      secondaryColor: "#0a1f2e",
      tertiaryColor: "#050a0e",
      edgeLabelBackground: "#0d2b1a",
      clusterBkg: "#0d2b1a",
      titleColor: "#39ff14",
      nodeBorder: "#39ff14",
      mainBkg: "#0d2b1a",
      nodeTextColor: "#c8ffc0",
      labelBoxBkgColor: "#0d2b1a",
      labelBoxBorderColor: "#39ff14",
      labelTextColor: "#c8ffc0",
      loopTextColor: "#c8ffc0",
      noteBkgColor: "#071a10",
      noteTextColor: "#39ff14",
      noteBorderColor: "#39ff14",
      activationBorderColor: "#00f5ff",
      activationBkgColor: "#071a10",
      sectionBkgColor: "#071a10",
      altSectionBkgColor: "#050a0e",
      taskBorderColor: "#39ff14",
      taskBkgColor: "#0d2b1a",
      activeTaskBorderColor: "#00f5ff",
      activeTaskBkgColor: "#071a10",
      gridColor: "rgba(57,255,20,0.1)",
      critBorderColor: "#ff2d78",
      critBkgColor: "#2b071a",
      todayLineColor: "#ffd700",
    },
    flowchart: { 
      curve: "basis", 
      htmlLabels: false,
      nodeSpacing: 15,
      rankSpacing: 15,
      padding: 5,
      useMaxWidth: false
    },
    sequence: { actorMargin: 30 },
    fontFamily: "'Fira Code', monospace",
    fontSize: 8,
    securityLevel: "strict",
  });
}

// ── Stable ID counter (module-level, never resets) ──────────────
let _uid = 0;

// ── Component ───────────────────────────────────────────────────
export function MermaidBlock({ code }) {
  const [svgHtml, setSvgHtml] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Force re-init to ensure my dev changes take effect
    _initialized = false; 
    ensureInit();
    
    let cancelled = false;

    setSvgHtml("");
    setError(null);
    setLoading(true);

    const id = `mermaid-cf-${++_uid}`;

    const run = async () => {
      try {
        const { svg } = await mermaid.render(id, code.trim());
        if (cancelled) return;

        // Extreme scale reduction:
        // 1. Cap to 400px width (typical chat bubble size)
        // 2. Force text to 9px
        const patched = svg
          .replace(/width="[^"]*"/, "")
          .replace(/height="[^"]*"/, "")
          .replace(/font-size: \d+px/g, "font-size: 9px") 
          .replace(
            "<svg ",
            '<svg style="max-width:400px; width:100%; height:auto; display:block; margin:0 auto; filter:drop-shadow(0 0 4px rgba(57,255,20,0.1))" '
          );

        setSvgHtml(patched);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || String(err) || "Render failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      className="my-4 rounded-lg overflow-x-auto"
      style={{
        background: "#050f08",
        border: "1px solid rgba(57,255,20,0.25)",
        boxShadow: "0 0 20px rgba(57,255,20,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-1.5"
        style={{
          borderBottom: "1px solid rgba(57,255,20,0.15)",
          background: "rgba(57,255,20,0.04)",
        }}
      >
        <span
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "rgba(0,245,255,0.6)", fontFamily: "'Fira Code', monospace" }}
        >
          ⬡ mermaid diagram
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex justify-center min-h-16 relative">
        {loading && !error && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: "rgba(200,255,192,0.3)", fontFamily: "'Fira Code', monospace" }}
          >
            rendering diagram
            <span className="loading-dots ml-1">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        )}

        {error && (
          <div className="w-full">
            <p className="text-xs font-mono mb-2" style={{ color: "rgba(255,45,120,0.8)" }}>
              ✗ Diagram error:
            </p>
            <pre className="text-xs whitespace-pre-wrap mb-3" style={{ color: "rgba(255,45,120,0.6)" }}>
              {error}
            </pre>
            <pre className="text-xs whitespace-pre-wrap" style={{ color: "rgba(200,255,192,0.25)" }}>
              {code}
            </pre>
          </div>
        )}

        {/* ✅ dangerouslySetInnerHTML: React owns this node and reconciles
            it as a single opaque string — no individual child node tracking
            that can conflict with mermaid's internal DOM manipulation. */}
        {svgHtml && (
          <div
            className="w-full flex justify-center"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        )}
      </div>
    </div>
  );
}
