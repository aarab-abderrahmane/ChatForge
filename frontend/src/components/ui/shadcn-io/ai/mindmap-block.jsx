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

// ─── Design tokens ────────────────────────────────────────────────────────────
// Each depth level gets its own distinct color + size so the hierarchy
// is immediately readable, no more "everything looks the same grey".
const DEPTH_CONFIG = [
  {
    // Root — large, bold, dark
    node: 'bg-[#0f172a] border-[#0f172a] text-white font-bold text-[13px] tracking-wide shadow-lg',
    hover: 'bg-[#1e293b]',
    dot: '#6366f1',
    fontSize: 13,
  },
  {
    // Level 1 — coloured accent border
    node: 'bg-white border-[#6366f1] text-[#0f172a] font-semibold text-[12px] shadow-md',
    hover: 'bg-[#f5f3ff]',
    dot: '#8b5cf6',
    fontSize: 12,
  },
  {
    // Level 2 — soft teal
    node: 'bg-white border-[#0ea5e9] text-[#0f172a] font-medium text-[11px] shadow-sm',
    hover: 'bg-[#f0f9ff]',
    dot: '#0ea5e9',
    fontSize: 11,
  },
  {
    // Level 3 — muted
    node: 'bg-[#f8fafc] border-[#cbd5e1] text-[#475569] font-normal text-[10px]',
    hover: 'bg-white',
    dot: '#94a3b8',
    fontSize: 10,
  },
];

// Connector stroke colours match the parent node's accent colour
const STROKE_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#94a3b8'];

function getDepthConfig(depth) {
  return DEPTH_CONFIG[Math.min(depth, DEPTH_CONFIG.length - 1)];
}
function getStrokeColor(depth) {
  return STROKE_COLORS[Math.min(depth, STROKE_COLORS.length - 1)];
}

// ─── NODE PADDING / GAP constants (unscaled pixels) ───────────────────────────
// Bigger gaps = more breathing room = clean diagram
const NODE_GAP = 14;        // vertical gap between sibling nodes
const BRANCH_INDENT = 52;   // horizontal gap from parent right edge to children

// ─── TreeNode ─────────────────────────────────────────────────────────────────
function TreeNode({ node, depth = 0, path = '0', expanded, onToggle }) {
  const [hovered, setHovered] = useState(false);
  const cfg = getDepthConfig(depth);
  const label = node.label || node.name || node.text || 'Node';
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded[path] !== false;

  // Horizontal padding scales with depth so root nodes feel bigger
  const px = depth === 0 ? 'px-5 py-2.5' : depth === 1 ? 'px-4 py-2' : 'px-3 py-1.5';

  return (
    <div className="flex flex-row items-center" data-depth={depth} data-path={path}>
      {/* ── Node pill ── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          mindmap-node relative flex items-center gap-2
          ${px} rounded-md border-2 whitespace-nowrap
          transition-all duration-150 cursor-default select-none
          ${cfg.node} ${hovered ? cfg.hover : ''}
        `}
        style={{ fontSize: cfg.fontSize }}
      >
        {/* Depth-coloured dot */}
        <span
          className="flex-shrink-0 rounded-full"
          style={{
            width: depth === 0 ? 8 : 6,
            height: depth === 0 ? 8 : 6,
            backgroundColor: cfg.dot,
            opacity: 0.85,
          }}
        />

        <span className="font-[inherit] leading-snug">{label}</span>

        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(path); }}
            className="
              ml-1 w-4 h-4 rounded-full flex items-center justify-center
              border border-current text-[8px] leading-none
              opacity-40 hover:opacity-100 transition-opacity flex-shrink-0
            "
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </div>

      {/* ── Children ── */}
      {hasChildren && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex flex-col justify-center"
              style={{ marginLeft: BRANCH_INDENT, gap: NODE_GAP }}
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

// ─── MindmapBlock ─────────────────────────────────────────────────────────────
export function MindmapBlock({ code }) {
  const data = useMemo(() => safeParseJSON(code), [code]);

  const [expanded, setExpanded] = useState({});
  // Start at scale 1 so the diagram is NOT shrunk by default
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 32, y: 32 });
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

  // ── Draw connectors ────────────────────────────────────────────────────────
  // We wait one frame after layout so getBoundingClientRect is accurate.
  useLayoutEffect(() => {
    if (!canvasRef.current || !data) return;
    const svgEl = svgRef.current;
    const canvasEl = canvasRef.current;
    if (!svgEl) return;

    // Small timeout lets React finish painting the tree
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
            // Cubic bezier — control points pulled 40% of the gap
            const cpX = Math.abs(x2 - x1) * 0.45;
            paths.push({
              d: `M ${x1} ${y1} C ${x1 + cpX} ${y1}, ${x2 - cpX} ${y2}, ${x2} ${y2}`,
              color: getStrokeColor(parent.depth),
              width: parent.depth === 0 ? 2 : 1.5,
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

  // ── Controls ────────────────────────────────────────────────────────────────
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

  const zoomIn = useCallback(() => setScale(prev => Math.min(5, +(prev * 1.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(0.15, +(prev / 1.25).toFixed(2))), []);
  const resetZoom = useCallback(() => { setScale(1); setOffset({ x: 32, y: 32 }); }, []);

  // ── Pan ────────────────────────────────────────────────────────────────────
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
    const factor = e.deltaY > 0 ? 0.88 : 1 / 0.88;
    setScale(prev => Math.max(0.15, Math.min(5, +(prev * factor).toFixed(3))));
  }, []);

  // ── Escape fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="my-6 p-5 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 text-sm font-mono text-center">
        ⬡ Preparing mindmap…
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const fullClass = fullscreen
    ? 'fixed inset-0 z-50 bg-[#f8fafc] flex flex-col shadow-2xl'
    : 'my-6 rounded-xl border border-slate-200 bg-[#f8fafc] flex flex-col shadow-md overflow-hidden';

  return (
    <div className={fullClass}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          />
          <span className="text-[11px] font-semibold font-mono tracking-widest uppercase text-slate-500">
            Mindmap
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom */}
          <ToolBtn onClick={zoomOut} title="Zoom out">−</ToolBtn>
          <span className="text-[10px] font-mono text-slate-400 w-9 text-center">
            {Math.round(scale * 100)}%
          </span>
          <ToolBtn onClick={zoomIn} title="Zoom in">+</ToolBtn>
          <ToolBtn onClick={resetZoom} title="Reset view">⟲</ToolBtn>

          <Divider />

          {/* Expand / collapse */}
          <ToolBtn onClick={expandAll} title="Expand all">⊞</ToolBtn>
          <ToolBtn onClick={collapseAll} title="Collapse all">⊟</ToolBtn>

          <Divider />

          {/* Fullscreen */}
          <ToolBtn onClick={() => setFullscreen(p => !p)} title={fullscreen ? 'Minimize' : 'Fullscreen'}>
            {fullscreen ? '⊟' : '⊠'}
          </ToolBtn>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        className="overflow-hidden relative"
        style={{
          flex: 1,
          minHeight: fullscreen ? 0 : 460,
          cursor: isPanning.current ? 'grabbing' : 'grab',
          background: 'radial-gradient(ellipse at 20% 50%, #ede9fe22 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #bae6fd22 0%, transparent 55%), #f8fafc',
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
          {/* SVG connector layer — sits behind the nodes */}
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
                opacity={0.5}
              />
            ))}
          </svg>

          {/* Tree */}
          <TreeNode
            node={data}
            depth={0}
            path="0"
            expanded={expanded}
            onToggle={toggleNode}
          />
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div className="px-4 py-1.5 bg-white border-t border-slate-100 shrink-0">
        <span className="text-[9px] font-mono text-slate-300 tracking-wider">
          SCROLL TO ZOOM · DRAG TO PAN · CLICK [+/−] TO EXPAND
        </span>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function ToolBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="
        w-6 h-6 flex items-center justify-center rounded
        text-slate-400 hover:text-slate-700 hover:bg-slate-100
        text-[11px] font-mono leading-none transition-colors
      "
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-slate-200 mx-0.5" />;
}