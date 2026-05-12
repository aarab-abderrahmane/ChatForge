import { useMemo, useState } from 'react';

function safeParseJSON(code) {
  if (!code) return null;
  try {
    const match = code.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : code);
  } catch {
    return null;
  }
}

// ── Depth-based palette (Newsprint) ──
const DEPTH_CLASSES = [
  { base: 'bg-paper border-ink text-ink font-bold', hover: 'bg-muted-100' },
  { base: 'bg-muted-100 border-ink text-ink', hover: 'bg-muted-200' },
  { base: 'bg-muted-100 border-divider text-muted-500', hover: 'bg-paper' },
  { base: 'bg-paper border-divider text-muted-400', hover: 'bg-muted-100' },
];

const CONNECTOR_CLASSES = ['bg-ink/30', 'bg-ink/20', 'bg-divider', 'bg-divider'];

function getStyleForDepth(depth) {
  return DEPTH_CLASSES[Math.min(depth, DEPTH_CLASSES.length - 1)];
}

function getConnectorClass(depth) {
  return CONNECTOR_CLASSES[Math.min(depth, CONNECTOR_CLASSES.length - 1)];
}

function TreeNode({ node, depth = 0, totalSiblings = 1, siblingIndex = 0 }) {
  const [isHovered, setIsHovered] = useState(false);
  const style = getStyleForDepth(depth);
  const label = node.label || node.name || node.text || 'Node';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="mindmap-node flex flex-col items-center">
      {/* Node label */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`mindmap-node-label border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider cursor-default select-none whitespace-nowrap transition-colors duration-150 ${style.base} ${isHovered ? style.hover : ''}`}
      >
        {label}
      </div>

      {/* Children */}
      {hasChildren && (
        <div className="relative mt-1">
          {/* Vertical connector from parent to horizontal line */}
          <div
            className={`mindmap-connector-v absolute left-1/2 -translate-x-1/2 w-px ${getConnectorClass(depth)}`}
            style={{ top: 0, height: '16px' }}
          />

          {/* Horizontal connector across siblings */}
          {node.children.length > 1 && (
            <div
              className={`mindmap-connector-h absolute h-px ${getConnectorClass(depth)}`}
              style={{
                top: '16px',
                left: node.children.length > 1 ? 'calc(50% / 1)' : '50%',
                right: node.children.length > 1 ? 'calc(50% / 1)' : '50%',
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
                    className={`mindmap-connector-child-v absolute left-1/2 -translate-x-1/2 w-px ${getConnectorClass(depth + 1)}`}
                    style={{ top: '-16px', height: '16px' }}
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
      <div className="my-6 p-4 border border-ink bg-paper text-muted-400 text-xs font-mono">
        Visualizing mindmap...
      </div>
    );
  }

  return (
    <div className="my-6 p-6 overflow-x-auto mindmap-container border border-ink bg-paper">
      <div className="flex justify-center">
        <TreeNode node={data} />
      </div>
    </div>
  );
}
