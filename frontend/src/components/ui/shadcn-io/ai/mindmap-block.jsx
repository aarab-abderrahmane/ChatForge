import { useMemo } from "react";
import { motion } from "motion/react";

function TreeNode({ node, depth = 0 }) {
    return (
        <div className="flex flex-col items-center">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: depth * 0.1 }}
                className="px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider uppercase mb-4"
                style={{
                    background: `rgba(0, 245, 255, ${Math.max(0.05, 0.2 - depth * 0.05)})`,
                    borderColor: `rgba(0, 245, 255, ${Math.max(0.1, 0.4 - depth * 0.1)})`,
                    color: 'var(--neon-cyan)',
                    boxShadow: depth === 0 ? '0 0 15px rgba(0, 245, 255, 0.3)' : 'none'
                }}
            >
                {node.label || node.name || node.text || "Node"}
            </motion.div>

            {node.children && node.children.length > 0 && (
                <div className="flex gap-6 relative">
                    {/* Connection line */}
                    <div className="absolute top-[-16px] left-1/2 w-px h-4 bg-[var(--neon-cyan-dim)] opacity-30" />

                    {node.children.map((child, idx) => (
                        <div key={idx} className="relative">
                            {/* Horizontal line for siblings */}
                            {node.children.length > 1 && (
                                <div
                                    className="absolute top-[-16px] h-px bg-[var(--neon-cyan-dim)] opacity-20"
                                    style={{
                                        left: idx === 0 ? '50%' : '0',
                                        right: idx === node.children.length - 1 ? '50%' : '0',
                                    }}
                                />
                            )}
                            <TreeNode node={child} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function MindmapBlock({ code }) {
    const data = useMemo(() => {
        if (!code) return null;
        try {
            const match = code.match(/\{[\s\S]*\}/);
            const toParse = match ? match[0] : code;
            return JSON.parse(toParse);
        } catch (e) {
            return null;
        }
    }, [code]);

    if (!data) {
        return (
            <div className="text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 p-4 rounded text-sm font-mono my-2 animate-pulse">
                Visualizing mindmap...
            </div>
        );
    }

    return (
        <div className="my-6 p-6 border rounded-xl overflow-x-auto glass-panel flex justify-center" style={{ borderColor: 'rgba(0, 245, 255, 0.15)' }}>
            <TreeNode node={data} />
        </div>
    );
}
