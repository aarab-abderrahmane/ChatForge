import { useEffect, useState, useRef, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import DOMPurify from 'dompurify';

let _mermaidPromise = null;
let _initialized = false;

function getMermaid() {
  if (!_mermaidPromise) {
    _mermaidPromise = import('mermaid');
  }
  return _mermaidPromise;
}

async function initMermaid() {
  if (_initialized) return;
  _initialized = true;

  const mermaid = await getMermaid();
  const m = mermaid.default || mermaid;

  m.initialize({
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
      clusterBkg: '#F9F9F7',
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
      htmlLabels: true,
      nodeSpacing: 15,
      rankSpacing: 15,
      padding: 5,
      useMaxWidth: false,
    },
    sequence: { actorMargin: 30, boxMargin: 10, boxTextMargin: 5, noteMargin: 10, messageMargin: 35, mirrorActors: false, bottomMarginAdj: 10, useMaxWidth: false },
    gantt: { barHeight: 20, barGap: 4, topPadding: 20, leftPadding: 50, gridLineStartPadding: 35, fontSize: 10, useMaxWidth: false },
    class: { useMaxWidth: false },
    git: { useMaxWidth: false },
    pie: { useMaxWidth: false },
    requirement: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    timeline: { useMaxWidth: false },
    fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
    fontSize: 9,
    securityLevel: 'strict',
  });

  return m;
}

function cleanMermaidCode(raw) {
  return raw
    .trim()
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\w*\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function escapeMermaidLabel(label) {
  return label
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function preprocessMermaidCode(raw) {
  let code = raw;

  // Wrap node labels containing special characters in double quotes
  // e.g. B[setCount(count + 1)] -> B["setCount(count + 1)"]
  // Only targets labels NOT already quoted
  code = code.replace(
    /\[([^\]"\n]*[(){}<>;:+|=][^\]"\n]*)\]/g,
    (_, label) => `["${escapeMermaidLabel(label)}"]`
  );

  // Escape parentheses inside quoted labels
  code = code.replace(
    /\["([^"]*)"\]/g,
    (_, label) => {
      const escaped = escapeMermaidLabel(label);
      return `["${escaped}"]`;
    }
  );

  return code;
}

function tryFix(code, attempt) {
  switch (attempt) {
    case 0: return code;
    case 1: return preprocessMermaidCode(code);
    case 2: return code.replace(/\(/g, '#40;').replace(/\)/g, '#41;').replace(/\[/g, '#91;').replace(/\]/g, '#93;').replace(/\{/g, '#123;').replace(/\}/g, '#125;').replace(/</g, '#60;').replace(/>/g, '#62;');
    case 3: return `flowchart TB\n    A["Diagram Error"] --> B["Could not render this diagram"]`;
    default: return code;
  }
}

function patchSvg(svg) {
  return svg
    .replace(/width="[^"]*"/, '')
    .replace(/height="[^"]*"/, '')
    .replace(/font-size: \d+px/g, 'font-size: 9px')
    .replace(
      '<svg ',
      '<svg style="max-width:100%; width:100%; height:auto; display:block; margin:0 auto;" '
    );
}

export function MermaidBlock({ code }) {
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const uidRef = useRef(0);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  useEffect(() => {
    let cancelled = false;

    setSvgHtml('');
    setError(null);
    setLoading(true);

    const id = `mermaid-cf-${++uidRef.current}`;

    const render = async () => {
      const m = await initMermaid();
      if (cancelled) return;

      const cleanCode = cleanMermaidCode(code);
      if (!cleanCode) {
        if (!cancelled) { setLoading(false); setError('Empty diagram code'); }
        return;
      }

      for (let attempt = 0; attempt < 4; attempt++) {
        if (cancelled) return;
        const candidate = tryFix(cleanCode, attempt);
        try {
          const { svg } = await m.render(id, candidate);
          if (cancelled) return;
          setSvgHtml(patchSvg(svg));
          setLoading(false);
          return;
        } catch (err) {
          if (attempt === 3) {
            if (!cancelled) {
              setError(err?.message || String(err) || 'Render failed');
              setLoading(false);
            }
          }
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      const el = document.getElementById('d' + id);
      if (el) el.remove();
    };
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="my-4 border border-divider overflow-hidden"
      style={{
        background: '#F9F9F7',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: '1px solid #E5E5E0',
          background: '#F5F5F5',
        }}
      >
        <span
          className="text-[10px] tracking-[0.12em] uppercase font-semibold font-mono"
          style={{ color: '#737373' }}
        >
          ⬡ Mermaid Diagram
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-mono transition-colors"
          style={{ color: copied ? '#111111' : '#A3A3A3' }}
          title="Copy diagram code"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? 'copied' : 'copy'}</span>
        </button>
      </div>

      <div className="p-4 flex justify-center min-h-16 relative">
        {loading && !error && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-1"
            style={{ color: '#A3A3A3' }}
          >
            <span className="text-xs font-mono">rendering</span>
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}

        {error && (
          <div className="w-full">
            <p className="text-xs font-mono mb-2 flex items-center gap-1.5" style={{ color: '#CC0000' }}>
              ✗ Diagram error
            </p>
            <pre className="text-xs whitespace-pre-wrap mb-3 font-mono leading-relaxed" style={{ color: '#737373' }}>
              {error}
            </pre>
            <div className="text-xs font-mono" style={{ color: '#A3A3A3' }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: '#737373' }}>raw mermaid code:</span>
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed">
                {code}
              </pre>
            </div>
          </div>
        )}

        {svgHtml && (
          <div
            className="w-full flex justify-center"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svgHtml, { ADD_ATTR: ['stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill', 'fill-opacity', 'fill-rule', 'opacity', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'text-decoration', 'viewBox', 'preserveAspectRatio', 'clip-path', 'mask', 'marker-end', 'marker-start', 'marker-mid', 'refX', 'refY', 'orient', 'markerWidth', 'markerHeight', 'offset', 'stop-color', 'stop-opacity', 'spreadMethod', 'gradientUnits', 'href', 'class', 'style', 'xmlns', 'clip-rule', 'color' ]}) }}
          />
        )}
      </div>
    </div>
  );
}
