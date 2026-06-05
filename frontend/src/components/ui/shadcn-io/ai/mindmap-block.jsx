
import { useMemo, useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

function safeParseJSON(code) {
  if (!code) return null;
  try {
    const match = code.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : code);
  } catch {
    return null;
  }
}

// ─── App Color Tokens ────────────────────────────────────────────────────────
const COLORS = {
  accent: '#CC0000',         // --color-red
  accentLight: '#FDF2F2',    // Light red accent bg
  surface: '#FFFFFF',
  paper: '#F9F9F7',          // --color-paper
  border: '#999494',         // --color-border
  divider: '#E5E5E0',        // --color-divider
  textPrimary: '#111111',    // --color-ink
  textSecondary: '#525252',  // --color-muted-600
  textMuted: '#737373',      // --color-muted-500
};

const DEPTH_CONFIG = [
  { bg: '#FFFFFF', border: COLORS.textPrimary, text: COLORS.textPrimary, weight: 'font-semibold', size: 14, dot: COLORS.accent, shadow: 'shadow-sm' },
  { bg: COLORS.paper, border: COLORS.border, text: COLORS.textPrimary, weight: 'font-medium', size: 13, dot: COLORS.textMuted, shadow: 'shadow-xs' },
  { bg: '#F5F5F5', border: COLORS.divider, text: COLORS.textSecondary, weight: 'font-normal', size: 12, dot: '#A3A3A3', shadow: '' },
  { bg: '#F5F5F5', border: COLORS.divider, text: COLORS.textMuted, weight: 'font-normal', size: 11, dot: '#E5E5E5', shadow: '' },
];

function getCfg(depth) {
  return DEPTH_CONFIG[Math.min(depth, DEPTH_CONFIG.length - 1)];
}

const STROKE_COLORS = [COLORS.accent, COLORS.border, COLORS.divider, COLORS.divider];

function getStroke(depth) {
  return STROKE_COLORS[Math.min(depth, STROKE_COLORS.length - 1)];
}

// ─── TreeNode (Left-to-Right Branching) ──────────────────────────────────────
function TreeNode({ node, depth = 0, path = '0', expanded, onToggle }) {
  const [hovered, setHovered] = useState(false);
  const cfg = getCfg(depth);
  const label = node.label || node.name || node.text || 'Node';
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded[path] !== false;
  
  const px = depth === 0 ? 'px-4 py-2.5' : depth === 1 ? 'px-3.5 py-2' : 'px-3 py-1.5';

  return (
    <div className="flex flex-row items-center relative" data-depth={depth} data-path={path}>
      {/* Node Content box */}
      <div className="flex items-center justify-start z-10">
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`
            mindmap-node flex items-center gap-2.5
            ${px} rounded border whitespace-nowrap
            transition-all duration-150 cursor-default select-none
            ${cfg.weight} ${cfg.shadow}
          `}
          style={{
            fontSize: cfg.size,
            color: cfg.text,
            borderColor: hovered ? COLORS.accent : cfg.border,
            backgroundColor: cfg.bg,
          }}
        >
          <span
            className="shrink-0 rounded-full"
            style={{ width: depth === 0 ? 8 : 6, height: depth === 0 ? 8 : 6, backgroundColor: cfg.dot }}
          />

          <span className="leading-snug">{label}</span>

          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(path); }}
              className="
                ml-1.5 w-5 h-5 rounded border flex items-center justify-center
                text-xs font-mono transition-colors bg-white hover:bg-neutral-100 shrink-0
              "
              style={{ borderColor: COLORS.divider, color: COLORS.textSecondary }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
        </div>
      </div>

      {/* Children Column to the Right */}
      {hasChildren && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex flex-col items-start relative ml-14 gap-4"
            >
              {node.children.map((child, idx) => (
                <TreeNode
                  key={idx}
                  node={child}
                  depth={depth + 1}
                  path={`${path}-${idx}`}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── MindmapBlock Main Component ─────────────────────────────────────────────
export function MindmapBlock({ code }) {
  const data = useMemo(() => safeParseJSON(code), [code]);

  const [expanded, setExpanded] = useState({});
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 60 });
  const [fullscreen, setFullscreen] = useState(false);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const offsetAtPanStart = useRef({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const [connectors, setConnectors] = useState([]);

  const toggleNode = useCallback((path) => {
    setExpanded(prev => ({ ...prev, [path]: prev[path] === false }));
  }, []);

  // ── Draw horizontal connectors ──
  useLayoutEffect(() => {
    if (!canvasRef.current || !data) return;
    const svgEl = svgRef.current;
    const canvasEl = canvasRef.current;
    if (!svgEl) return;

    const id = requestAnimationFrame(() => {
      const allNodes = canvasEl.querySelectorAll('[data-path]');
      const svgRect = svgEl.getBoundingClientRect();
      const paths = [];

      const nodeMap = new Map();
      allNodes.forEach(el => {
        const p = el.getAttribute('data-path');
        const depth = parseInt(el.getAttribute('data-depth'), 10);
        const childEl = el.querySelector('.mindmap-node');
        if (!childEl) return;
        const rect = childEl.getBoundingClientRect();
        nodeMap.set(p, {
          depth,
          left: (rect.left - svgRect.left) / scale,
          top: (rect.top - svgRect.top) / scale,
          right: (rect.right - svgRect.left) / scale,
          bottom: (rect.bottom - svgRect.top) / scale,
          midX: ((rect.left + rect.right) / 2 - svgRect.left) / scale,
          midY: ((rect.top + rect.bottom) / 2 - svgRect.top) / scale,
        });
      });

      const traverse = (node, p) => {
        if (!node.children || expanded[p] === false) return;
        const parent = nodeMap.get(p);
        if (!parent) return;

        node.children.forEach((child, idx) => {
          const childPath = `${p}-${idx}`;
          const childInfo = nodeMap.get(childPath);
          if (childInfo) {
            const x1 = parent.right;
            const y1 = parent.midY;
            const x2 = childInfo.left;
            const y2 = childInfo.midY;
            const cpX = Math.abs(x2 - x1) * 0.5;
            
            paths.push({
              d: `M ${x1} ${y1} C ${x1 + cpX} ${y1}, ${x2 - cpX} ${y2}, ${x2} ${y2}`,
              color: getStroke(parent.depth),
              width: parent.depth === 0 ? 1.75 : 1.25,
            });
          }
          traverse(child, childPath);
        });
      };

      traverse(data, '0');
      setConnectors(paths);
    });

    return () => cancelAnimationFrame(id);
  }, [data, expanded, scale]);

  // ── Controls ──
  const expandAll = useCallback(() => setExpanded({}), []);
  const collapseAll = useCallback(() => {
    if (!data) return;
    const collapse = (node, p) => {
      const obj = { [p]: false };
      if (node.children) {
        node.children.forEach((child, i) =>
          Object.assign(obj, collapse(child, `${p}-${i}`))
        );
      }
      return obj;
    };
    setExpanded(collapse(data, '0'));
  }, [data]);

  const zoomIn = useCallback(() => setScale(prev => Math.min(4, +(prev * 1.2).toFixed(2))), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(0.2, +(prev / 1.2).toFixed(2))), []);
  const resetZoom = useCallback(() => { setScale(1); setOffset({ x: 40, y: 60 }); }, []);

  // ── Pan ──
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    offsetAtPanStart.current = { ...offset };
    e.preventDefault();
  }, [offset]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    setOffset({
      x: offsetAtPanStart.current.x + (e.clientX - panStart.current.x) / scale,
      y: offsetAtPanStart.current.y + (e.clientY - panStart.current.y) / scale,
    });
  }, [scale]);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.2, Math.min(4, +(prev * factor).toFixed(3))));
  }, []);

  // ── Escape Fullscreen ──
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  if (!data) {
    return (
      <div className="my-6 p-6 rounded border border-dashed border-neutral-300 text-neutral-400 text-sm font-mono text-center bg-[#F9F9F7]">
        ⬡ Loading mindmap...
      </div>
    );
  }

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-50 bg-white flex flex-col shadow-xl'
    : 'my-6 rounded border bg-white flex flex-col shadow-xs overflow-hidden';

  return (
    <div className={wrapperClass} style={{ borderColor: COLORS.border }}>
      {/* ── Toolbar ── */}
      <div 
        className="flex items-center justify-between px-4 py-2.5 border-b select-none shrink-0"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.divider }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: COLORS.accentLight }}>
            <span className="text-xs font-bold" style={{ color: COLORS.accent }}>◈</span>
          </div>
          <span className="text-xs font-bold font-mono tracking-wider uppercase" style={{ color: COLORS.textPrimary }}>
            Mindmap
          </span>
        </div>

        {/* Larger, cleaner control buttons */}
        <div className="flex items-center gap-1.5">
          <ToolBtn onClick={zoomOut} title="Zoom out">−</ToolBtn>
          <span className="text-xs font-mono w-12 text-center font-medium" style={{ color: COLORS.textSecondary }}>
            {Math.round(scale * 100)}%
          </span>
          <ToolBtn onClick={zoomIn} title="Zoom in">+</ToolBtn>
          <ToolBtn onClick={resetZoom} title="Reset view">⟲</ToolBtn>

          <Divider />

          <ToolBtn onClick={expandAll} title="Expand all">⊞</ToolBtn>
          <ToolBtn onClick={collapseAll} title="Collapse all">⊟</ToolBtn>

          <Divider />

          <ToolBtn onClick={() => setFullscreen(p => !p)} title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {fullscreen ? '⤺' : '⤻'}
          </ToolBtn>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        className="overflow-hidden relative"
        style={{
          flex: 1,
          minHeight: fullscreen ? 0 : 500,
          cursor: isPanning.current ? 'grabbing' : 'grab',
          backgroundColor: COLORS.paper,
          backgroundImage: `radial-gradient(${COLORS.divider} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className="absolute"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            {connectors.map((c, i) => (
              <path
                key={i}
                d={c.d}
                stroke={c.color}
                strokeWidth={c.width}
                fill="none"
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}
          </svg>

          <TreeNode
            node={data}
            depth={0}
            path="0"
            expanded={expanded}
            onToggle={toggleNode}
          />
        </div>
      </div>

      {/* ── Instructions Bar ── */}
      <div className="px-4 py-2 border-t shrink-0 bg-white" style={{ borderColor: COLORS.divider }}>
        <span className="text-[10px] font-mono tracking-wider uppercase font-medium" style={{ color: COLORS.textMuted }}>
          Scroll to Zoom · Drag canvas to Pan · Click [+/−] to Branch
        </span>
      </div>
    </div>
  );
}

// ─── Toolbar UI Helpers ──────────────────────────────────────────────────────
function ToolBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded border bg-white text-sm transition-colors hover:bg-neutral-50 active:bg-neutral-100 shadow-xs"
      style={{ color: COLORS.textSecondary, borderColor: COLORS.divider }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 mx-1" style={{ backgroundColor: COLORS.divider }} />;
}

