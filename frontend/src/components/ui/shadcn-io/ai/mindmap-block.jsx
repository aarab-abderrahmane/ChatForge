import { useMemo, useState } from 'react';
import { motion } from 'motion/react';

function safeParseJSON(code) {
  if (!code) return null;
  try {
    const match = code.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : code);
  } catch {
    return null;
  }
}

// ── Depth-based color palette ──
const DEPTH_COLORS = [
  { bg: 'rgba(0, 245, 255, 0.12)', border: 'rgba(0, 245, 255, 0.4)', text: 'var(--neon-cyan)', glow: '0 0 16px rgba(0, 245, 255, 0.25)' },
  { bg: 'rgba(57, 255, 20, 0.08)', border: 'rgba(57, 255, 20, 0.25)', text: 'var(--neon-green)', glow: 'none' },
  { bg: 'rgba(255, 215, 0, 0.06)', border: 'rgba(255, 215, 0, 0.2)', text: 'var(--neon-yellow)', glow: 'none' },
  { bg: 'rgba(255, 45, 120, 0.05)', border: 'rgba(255, 45, 120, 0.15)', text: 'var(--neon-magenta)', glow: 'none' },
];

function getColorForDepth(depth) {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

function TreeNode({ node, depth = 0, totalSiblings = 1, siblingIndex = 0 }) {
  const [isHovered, setIsHovered] = useState(false);
  const color = getColorForDepth(depth);
  const label = node.label || node.name || node.text || 'Node';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="mindmap-node flex flex-col items-center">
      {/* Node label */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: depth * 0.08 + siblingIndex * 0.04,
          type: 'spring',
          stiffness: 300,
          damping: 20,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="mindmap-node-label px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider uppercase cursor-default select-none whitespace-nowrap"
        style={{
          background: isHovered ? color.bg.replace(/[\d.]+\)$/, '0.2)') : color.bg,
          borderColor: isHovered ? color.border.replace(/[\d.]+\)$/, '0.6)') : color.border,
          color: color.text,
          boxShadow: isHovered ? color.glow : (depth === 0 ? color.glow : 'none'),
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {label}
      </motion.div>

      {/* Children */}
      {hasChildren && (
        <div className="relative mt-1">
          {/* Vertical connector from parent to horizontal line */}
          <div
            className="mindmap-connector-v absolute left-1/2 -translate-x-1/2 w-px"
            style={{
              top: 0,
              height: '16px',
              background: `linear-gradient(to bottom, ${color.border}, transparent)`,
            }}
          />

          {/* Horizontal connector across siblings */}
          {node.children.length > 1 && (
            <div
              className="mindmap-connector-h absolute h-px"
              style={{
                top: '16px',
                left: node.children.length > 1 ? 'calc(50% / 1)' : '50%',
                right: node.children.length > 1 ? 'calc(50% / 1)' : '50%',
                background: color.border.replace(/[\d.]+\)$/, '0.15)'),
              }}
            />
          )}

          <div
            className="mindmap-children flex gap-4 pt-[16px]"
            style={{ marginTop: '16px' }}
          >
            {node.children.map((child, idx) => (
              <div key={idx} className="relative flex flex-col items-center">
                {/* Vertical connector from horizontal line to child */}
                {node.children.length > 1 && (
                  <div
                    className="mindmap-connector-child-v absolute left-1/2 -translate-x-1/2 w-px"
                    style={{
                      top: '-16px',
                      height: '16px',
                      background: getColorForDepth(depth + 1).border.replace(/[\d.]+\)$/, '0.15)'),
                    }}
                  />
                )}
                <TreeNode
                  node={child}
                  depth={depth + 1}
                  totalSiblings={node.children.length}
                  siblingIndex={idx}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MindmapBlock({ code }) {
  const data = useMemo(() => safeParseJSON(code), [code]);

  if (!data) {
    return (
      <div
        className="my-6 p-4 rounded-xl border text-xs font-mono"
        style={{
          borderColor: 'rgba(0, 245, 255, 0.2)',
          background: 'rgba(0, 245, 255, 0.04)',
          color: 'rgba(0, 245, 255, 0.6)',
        }}
      >
        Visualizing mindmap...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-6 p-6 rounded-xl overflow-x-auto mindmap-container"
      style={{
        border: '1px solid rgba(0, 245, 255, 0.12)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        boxShadow: 'var(--glow-panel)',
      }}
    >
      <div className="flex justify-center">
        <TreeNode node={data} />
      </div>
    </motion.div>
  );
}
