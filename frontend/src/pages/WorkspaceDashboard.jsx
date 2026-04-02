import { useState, useContext } from "react";
import { Plus, Briefcase, ChevronRight, Check } from "lucide-react";
import { WorkspaceContext } from "../context/workspaceContext";
import { chatsContext } from "../context/chatsContext";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function WorkspaceDashboard() {
    const { workspaces, createWorkspace, setActiveWorkspaceId, deleteWorkspace } = useContext(WorkspaceContext);
    const { setPreferences } = useContext(chatsContext);

    const [showNewModal, setShowNewModal] = useState(false);
    const [formData, setFormData] = useState({ name: "", type: "", description: "", rules: "", phases: "Design, Development, Testing" });

    const handleCreate = (e) => {
        e.preventDefault();
        const phaseList = formData.phases.split(",").map(p => p.trim()).filter(Boolean);
        const id = createWorkspace({ ...formData, phases: phaseList.length ? phaseList : ["Phase 1"] });

        // Go to workspace view
        setPreferences(prev => ({ ...prev, currentPage: "workspace_view" }));
        setShowNewModal(false);
    };

    const handleOpen = (id) => {
        setActiveWorkspaceId(id);
        setPreferences(prev => ({ ...prev, currentPage: "workspace_view" }));
    };

    return (
        <div className="flex flex-col flex-1 h-screen w-screen overflow-hidden text-white" style={{ background: "var(--bg-primary)" }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--bg-header)", borderColor: "var(--border-green)" }}>
                <button
                    onClick={() => setPreferences(prev => ({ ...prev, currentPage: prev._prevPage || "chat" }))}
                    className="btn-ghost"
                >
                    <ChevronRight size={16} className="rotate-180" />
                </button>
                <Briefcase size={18} style={{ color: "var(--neon-cyan)" }} />
                <h1 className="text-lg font-bold tracking-wider" style={{ color: "var(--neon-green)" }}>My Workspaces</h1>

                <div className="ml-auto">
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors text-sm font-semibold"
                        style={{ color: "var(--neon-green)" }}
                    >
                        <Plus size={14} /> New Workspace
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
                {workspaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-60 text-center">
                        <Briefcase size={48} className="mb-4" />
                        <h2 className="text-xl mb-2">No Workspaces Yet</h2>
                        <p className="max-w-md text-sm mb-6">Create a workspace to keep track of a project's context, tasks, and files. The AI will automatically remember your project rules.</p>
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="px-4 py-2 rounded border transition-colors flex items-center gap-2"
                            style={{ borderColor: "var(--neon-green)", color: "var(--neon-green)", background: "rgba(57,255,20,0.1)" }}
                        >
                            <Plus size={16} /> Create First Workspace
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {workspaces.map(ws => {
                            const totalTasks = ws.tasks.length;
                            const doneTasks = ws.tasks.filter(t => t.status === "completed").length;
                            const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={ws.id}
                                    className="group relative flex flex-col p-5 rounded-lg border glass-panel transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                                    style={{ borderColor: "rgba(0,245,255,0.2)" }}
                                    onClick={() => handleOpen(ws.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-white truncate pr-6">{ws.name}</h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold shrink-0" style={{ background: "rgba(0,245,255,0.1)", color: "var(--neon-cyan)" }}>
                                            {ws.type || "General"}
                                        </span>
                                    </div>

                                    <p className="text-sm opacity-70 mb-3 line-clamp-2 min-h-10">
                                        {ws.description || "No description provided."}
                                    </p>

                                    {/* Phase badge */}
                                    {ws.currentPhase && (
                                        <div className="mb-3">
                                            <span className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider" style={{ borderColor: "rgba(57,255,20,0.3)", color: "var(--neon-green)", background: "rgba(57,255,20,0.06)" }}>
                                                🔄 {ws.currentPhase}
                                            </span>
                                        </div>
                                    )}

                                    {/* Task progress bar */}
                                    {totalTasks > 0 && (
                                        <div className="mb-3">
                                            <div className="flex justify-between text-[9px] mb-1 opacity-50 font-mono">
                                                <span>{doneTasks}/{totalTasks} tasks</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${progress}%`,
                                                        background: progress === 100 ? "var(--neon-green)" : "linear-gradient(90deg, var(--neon-cyan), var(--neon-green))",
                                                        boxShadow: progress > 0 ? "0 0 6px rgba(0,245,255,0.4)" : "none"
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto flex items-center justify-between text-xs opacity-50">
                                        <span>{ws.outputs.length} files</span>
                                        <span>{ws.chats.filter(c => c.type === "ch").length} messages</span>
                                    </div>

                                    {/* Delete button (hidden by default) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-all font-bold"
                                        title="Delete Workspace"
                                    >
                                        ×
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* New Workspace Modal */}
            <AnimatePresence>
                {showNewModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowNewModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative w-full max-w-lg p-6 rounded-xl border"
                            style={{ background: "var(--bg-primary)", borderColor: "var(--border-green)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
                        >
                            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--neon-green)" }}>Create New Workspace</h2>

                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">Project Name <span className="text-red-400">*</span></label>
                                    <input required autoFocus className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-green-500/50" placeholder="e.g. Electronics Store" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">Project Type</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-green-500/50" placeholder="e.g. Website / App / Novel" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">Description</label>
                                    <textarea className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-green-500/50 h-20 resize-none" placeholder="A brief summary of what this is..." value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">Immortal Rules (One per line)</label>
                                    <textarea className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-green-500/50 h-24 resize-none font-mono text-xs" placeholder="- Use React + TypeScript&#10;- Do not use PHP&#10;- Always explain in Arabic" value={formData.rules} onChange={e => setFormData(p => ({ ...p, rules: e.target.value }))} />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">Phases (Comma separated)</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-green-500/50" value={formData.phases} onChange={e => setFormData(p => ({ ...p, phases: e.target.value }))} />
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm opacity-70 hover:opacity-100">Cancel</button>
                                    <button type="submit" className="flex items-center gap-2 px-5 py-2 rounded text-sm font-bold bg-green-500 text-black hover:bg-green-400">
                                        <Check size={16} /> Create Workspace
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
