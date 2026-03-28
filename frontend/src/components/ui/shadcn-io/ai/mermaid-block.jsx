import { useEffect, useRef, useState, useId } from "react";
import mermaid from "mermaid";

// Initialize mermaid once with terminal theme
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
    sequenceNumberColor: "#000",
    sectionBkgColor: "#071a10",
    altSectionBkgColor: "#050a0e",
    sectionBkgColor2: "#0a1421",
    taskBorderColor: "#39ff14",
    taskBkgColor: "#0d2b1a",
    activeTaskBorderColor: "#00f5ff",
    activeTaskBkgColor: "#071a10",
    gridColor: "rgba(57,255,20,0.1)",
    doneTaskBkgColor: "#071a28",
    doneTaskBorderColor: "#00f5ff",
    critBorderColor: "#ff2d78",
    critBkgColor: "#2b071a",
    todayLineColor: "#ffd700",
    fillType0: "#0d2b1a",
    fillType1: "#071a28",
    fillType2: "#0d2b1a",
    fillType3: "#071a28",
  },
  flowchart: { curve: "basis", htmlLabels: true },
  sequence: { actorMargin: 50 },
  fontFamily: "'Fira Code', monospace",
  fontSize: 13,
});

export function MermaidBlock({ code }) {
  const id = useId().replace(/:/g, "");
  const containerId = `mermaid-${id}`;
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!containerRef.current || !code?.trim()) return;

      try {
        setError(null);
        const { svg } = await mermaid.render(containerId, code.trim());

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;

          // Post-process: make SVG responsive + apply neon style
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
            svgEl.removeAttribute("width");
            svgEl.removeAttribute("height");
            svgEl.style.filter =
              "drop-shadow(0 0 8px rgba(57,255,20,0.2)) drop-shadow(0 0 2px rgba(0,245,255,0.15))";
          }

          setRendered(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Diagram render failed");
        }
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [code, containerId]);

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

      {/* Diagram or error */}
      {error ? (
        <div className="p-4">
          <p
            className="text-xs font-mono mb-2"
            style={{ color: "rgba(255,45,120,0.8)" }}
          >
            ✗ Diagram parse error:
          </p>
          <pre
            className="text-xs whitespace-pre-wrap"
            style={{ color: "rgba(255,45,120,0.6)" }}
          >
            {error}
          </pre>
          {/* Fallback: show raw code */}
          <pre
            className="text-xs mt-3 whitespace-pre-wrap"
            style={{ color: "rgba(200,255,192,0.35)" }}
          >
            {code}
          </pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="p-4 flex justify-center"
          style={{
            minHeight: rendered ? undefined : 80,
            position: "relative",
          }}
        >
          {!rendered && (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs"
              style={{ color: "rgba(200,255,192,0.3)", fontFamily: "'Fira Code', monospace" }}
            >
              rendering diagram
              <span style={{ marginLeft: 4 }}>
                <span className="loading-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
