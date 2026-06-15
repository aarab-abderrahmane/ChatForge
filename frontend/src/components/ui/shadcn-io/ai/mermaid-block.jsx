import { useEffect, useState, useRef, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import DOMPurify from 'dompurify';
import { radius } from '../../../../lib/design-tokens';

// We use one promise to make sure Mermaid only loads exactly once
let mermaidInitPromise = null;

function initMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import('mermaid').then((mermaidModule) => {
      const m = mermaidModule.default || mermaidModule;
      
      m.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: {
          background: '#F9F9F7',         
          primaryColor: '#FFFFFF',       
          primaryTextColor: '#111111',   
          primaryBorderColor: '#999494', 
          lineColor: '#999494',          
          secondaryColor: '#F5F5F5',     
          tertiaryColor: '#F9F9F7',      
          clusterBkg: '#F5F5F5',         
          clusterBorder: '#E5E5E0',      
          titleColor: '#111111',
          nodeBorder: '#999494',
          mainBkg: '#FFFFFF',
          nodeTextColor: '#111111',
          fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
        },
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
      nodeSpacing: 10,
      rankSpacing: 10,
      padding: 3,
      useMaxWidth: false,
    },
        fontSize: 8, 
        securityLevel: 'strict',
      });
      
      return m;
    });
  }
  return mermaidInitPromise;
}

function cleanMermaidCode(raw) {
  return raw
    .trim()
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\w*\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function patchSvg(svg) {
  return svg
    .replace(/width="[^"]*"/, '')
    .replace(/height="[^"]*"/, '')
    .replace(/font-size: \d+px/g, 'font-size: 8px')
    .replace(
      '<svg ',
      '<svg style="max-width:100%; max-height:400px; width:auto; height:auto; display:block; margin:0 auto;" '
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

    const id = `mermaid-chart-${++uidRef.current}`;

    const render = async () => {
      try {
        const m = await initMermaid();
        if (cancelled) return;

        const cleanCode = cleanMermaidCode(code);
        if (!cleanCode) {
          setLoading(false);
          setError('Empty diagram code');
          return;
        }

        const { svg } = await m.render(id, cleanCode);
        if (cancelled) return;
        
        setSvgHtml(patchSvg(svg));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || String(err) || 'Render failed');
          setLoading(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="my-6 border-2 border-ink bg-paper overflow-hidden shadow-hard-sm wobbly-md"
    >
      {/* ── Toolbar ── */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-muted-100 border-b border-divider"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-ink flex items-center justify-center bg-white shadow-hard-sm" style={{ borderRadius: radius.wobblySm }}>
            <span className="text-xs font-bold text-ink">⬡</span>
          </div>
          <span
            className="text-xs font-bold font-mono tracking-wider uppercase"
            style={{ color: '#111111' }} 
          >
            Diagram
          </span>
        </div>
        
        <button
          onClick={handleCopy}
          className="btn-sketch-sm font-mono text-xs"
          style={{ color: copied ? '#1A7A3A' : undefined }}
          title="Copy diagram code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'copied' : 'copy'}</span>
        </button>
      </div>

      {/* ── Canvas ── */}
      <div className="p-6 flex justify-center items-center min-h-[200px] max-h-[420px] overflow-y-auto relative">
        {loading && !error && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-2"
            style={{ color: '#737373' }}
          >
            <span className="text-sm font-mono">Loading Diagram...</span>
          </div>
        )}

        {error && (
          <div className="w-full bg-paper p-4 border-2 border-red wobbly-sm shadow-hard-sm">
            <p className="text-sm font-mono mb-2 flex items-center gap-1.5 font-bold text-red">
              ✗ Diagram Error
            </p>
            <pre className="text-sm whitespace-pre-wrap mb-4 font-mono leading-relaxed bg-muted-100 p-3 border-2 border-ink/20 wobbly-sm text-muted-500">
              {error}
            </pre>
          </div>
        )}

        {svgHtml && !error && (
          <div
            className="w-full flex justify-center"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(svgHtml, { 
                // FIX: Added allowed HTML tags so text doesn't disappear
                ADD_TAGS: ['foreignObject', 'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i'],
                ADD_ATTR: ['xmlns', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill', 'fill-opacity', 'fill-rule', 'opacity', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'text-decoration', 'viewBox', 'preserveAspectRatio', 'clip-path', 'mask', 'marker-end', 'marker-start', 'marker-mid', 'refX', 'refY', 'orient', 'markerWidth', 'markerHeight', 'offset', 'stop-color', 'stop-opacity', 'spreadMethod', 'gradientUnits', 'href', 'class', 'style', 'clip-rule', 'color' ]
              }) 
            }}
          />
        )}
      </div>
    </div>
  );
}