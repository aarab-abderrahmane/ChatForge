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
    theme: 'base',
    themeVariables: {
      background: '#F9F9F7',
      primaryColor: '#F5F5F5',
      primaryTextColor: '#111111',
      primaryBorderColor: '#111111',
      lineColor: '#111111',
      secondaryColor: '#F5F5F5',
      tertiaryColor: '#F9F9F7',
      edgeLabelBackground: '#F5F5F5',
      clusterBkg: '#F5F5F5',
      titleColor: '#111111',
      nodeBorder: '#111111',
      mainBkg: '#F5F5F5',
      nodeTextColor: '#111111',
      labelBoxBkgColor: '#F5F5F5',
      labelBoxBorderColor: '#111111',
      labelTextColor: '#111111',
      loopTextColor: '#111111',
      noteBkgColor: '#F5F5F5',
      noteTextColor: '#111111',
      noteBorderColor: '#111111',
      activationBorderColor: '#111111',
      activationBkgColor: '#F5F5F5',
      sectionBkgColor: '#F5F5F5',
      altSectionBkgColor: '#F9F9F7',
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
