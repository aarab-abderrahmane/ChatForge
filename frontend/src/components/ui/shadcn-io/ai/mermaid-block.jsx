import { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';

// ── Mermaid initialization (once) ──
let _initialized = false;

function initMermaid() {
  if (_initialized) return;
  _initialized = true;

  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: '#050a0e',
      primaryColor: '#0d2b1a',
      primaryTextColor: '#39ff14',
      primaryBorderColor: '#39ff14',
      lineColor: '#00f5ff',
      secondaryColor: '#0a1f2e',
      tertiaryColor: '#050a0e',
      edgeLabelBackground: '#0d2b1a',
      clusterBkg: '#0d2b1a',
      titleColor: '#39ff14',
      nodeBorder: '#39ff14',
      mainBkg: '#0d2b1a',
      nodeTextColor: '#c8ffc0',
      labelBoxBkgColor: '#0d2b1a',
      labelBoxBorderColor: '#39ff14',
      labelTextColor: '#c8ffc0',
      loopTextColor: '#c8ffc0',
      noteBkgColor: '#071a10',
      noteTextColor: '#39ff14',
      noteBorderColor: '#39ff14',
      activationBorderColor: '#00f5ff',
      activationBkgColor: '#071a10',
      sectionBkgColor: '#071a10',
      altSectionBkgColor: '#050a0e',
      taskBorderColor: '#39ff14',
      taskBkgColor: '#0d2b1a',
      activeTaskBorderColor: '#00f5ff',
      activeTaskBkgColor: '#071a10',
      gridColor: 'rgba(57,255,20,0.1)',
      critBorderColor: '#ff2d78',
      critBkgColor: '#2b071a',
      todayLineColor: '#ffd700',
    },
    flowchart: {
      curve: 'basis',
      htmlLabels: false,
      nodeSpacing: 15,
      rankSpacing: 15,
      padding: 5,
      useMaxWidth: false,
    },
    sequence: { actorMargin: 30 },
    fontFamily: "'Fira Code', monospace",
    fontSize: 8,
    securityLevel: 'strict',
  });
}

// ── Stable ID counter (never resets) ──
let _uid = 0;

// ── Helper: clean mermaid code ──
function cleanMermaidCode(raw) {
  return raw
    .trim()
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\w*\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

// ── Helper: patch SVG for responsive display ──
function patchSvg(svg) {
  return svg
    .replace(/width="[^"]*"/, '')
    .replace(/height="[^"]*"/, '')
    .replace(/font-size: \d+px/g, 'font-size: 9px')
    .replace(
      '<svg ',
      '<svg style="max-width:100%; width:100%; height:auto; display:block; margin:0 auto; filter:drop-shadow(0 0 4px rgba(57,255,20,0.08))" '
    );
}

export function MermaidBlock({ code }) {
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    initMermaid();

    let cancelled = false;

    setSvgHtml('');
    setError(null);
    setLoading(true);

    const id = `mermaid-cf-${++_uid}`;
    const cleanCode = cleanMermaidCode(code);

    if (!cleanCode) {
      setLoading(false);
      setError('Empty diagram code');
      return;
    }

    const render = async () => {
      try {
        const { svg } = await mermaid.render(id, cleanCode);
        if (cancelled) return;
        setSvgHtml(patchSvg(svg));
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || String(err) || 'Render failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render();

    return () => {
      cancelled = true;
      // Clean up mermaid's rendered DOM element
      const el = document.getElementById('d' + id);
      if (el) el.remove();
    };
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="my-4 mermaid-container rounded-xl overflow-x-auto"
      style={{
        background: '#050f08',
        border: '1px solid rgba(57, 255, 20, 0.2)',
        boxShadow: '0 0 24px rgba(57, 255, 20, 0.04)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="mermaid-header flex items-center gap-2 px-4 py-2"
        style={{
          borderBottom: '1px solid rgba(57, 255, 20, 0.12)',
          background: 'rgba(57, 255, 20, 0.03)',
        }}
      >
        <span
          className="text-[10px] tracking-[0.12em] uppercase font-semibold"
          style={{ color: 'rgba(0, 245, 255, 0.55)' }}
        >
          ⬡ Mermaid Diagram
        </span>
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex justify-center min-h-16 relative">
        {/* Loading */}
        {loading && !error && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-1"
            style={{ color: 'rgba(200, 255, 192, 0.3)' }}
          >
            <span className="text-xs font-mono">rendering</span>
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full mermaid-error">
            <p className="text-xs font-mono mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255, 45, 120, 0.8)' }}>
              <span>✗</span> Diagram error
            </p>
            <pre className="text-xs whitespace-pre-wrap mb-3 font-mono" style={{ color: 'rgba(255, 45, 120, 0.55)' }}>
              {error}
            </pre>
            <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: 'rgba(200, 255, 192, 0.2)' }}>
              {code}
            </pre>
          </div>
        )}

        {/* SVG */}
        {svgHtml && (
          <div
            className="w-full flex justify-center mermaid-svg"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        )}
      </div>
    </div>
  );
}
