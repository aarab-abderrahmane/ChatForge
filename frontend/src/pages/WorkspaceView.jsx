import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Plus, CheckCircle, Circle, Play, FileText, Send, SquareTerminal, Briefcase, Copy, Check as CheckIcon, StopCircle } from "lucide-react";
import { WorkspaceContext } from "../context/workspaceContext";
import { chatsContext, MODELS, SKILLS } from "../context/chatsContext";
import { api } from "../services/api";
import { Response } from "../components/ui/shadcn-io/ai/response";
import { motion, AnimatePresence } from "motion/react";

export function WorkspaceView() {
    const {
        activeWorkspace,
        activeWorkspaceId,
        updateWorkspace,
        addTask,
        updateTaskStatus,
        saveOutput,
        setWorkspacePhase,
        syncAgentAction,
    } = useContext(WorkspaceContext);

    const { preferences, setPreferences, settings, loading, setLoading } = useContext(chatsContext);

    const [query, setQuery] = useState("");
    const messagesEndRef = useRef(null);
    const scrollRef = useRef(null);
    const abortControllerRef = useRef(null);
    const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });
    const [previewFile, setPreviewFile] = useState(null);
    const [isAutoExecuting, setIsAutoExecuting] = useState(false);
    const [copiedFileId, setCopiedFileId] = useState(null);
    const loadingRef = useRef(false);

    // If no active workspace, go back to dashboard
    useEffect(() => {
        if (!activeWorkspace) {
            setPreferences(p => ({ ...p, currentPage: "workspaces" }));
        }
    }, [activeWorkspace, setPreferences]);

    // Auto-scroll — triggers on new messages AND new output files
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeWorkspace?.chats, activeWorkspace?.outputs]);

    const setChats = useCallback((updater) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            chats: typeof updater === "function" ? updater(ws.chats) : updater
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    if (!activeWorkspace) return null;

    // Render tasks
    const renderTaskSection = (title, status, icon) => {
        const sectionTasks = activeWorkspace.tasks.filter(t => t.status === status);
        if (!sectionTasks.length) return null;
        return (
            <div className="mb-4">
                <h4 className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2 flex items-center gap-2">
                    {icon} {title} ({sectionTasks.length})
                </h4>
                <ul className="space-y-1">
                    {sectionTasks.map(task => (
                        <li key={task.id} className="flex items-start gap-2 text-sm group cursor-pointer"
                            onClick={() => updateTaskStatus(task.id, status === "completed" ? "in_progress" : status === "in_progress" ? "completed" : "in_progress")}>
                            <div className="mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                {status === "completed" ? <CheckCircle size={14} className="text-green-400" /> :
                                    status === "in_progress" ? <Play size={14} className="text-yellow-400" /> :
                                        <Circle size={14} />}
                            </div>
                            <span className={`flex-1 leading-tight ${status === "completed" ? "line-through opacity-50" : ""}`}>{task.title}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Keep loadingRef in sync so handleAutoContinue avoids stale closure
    useEffect(() => { loadingRef.current = loading; }, [loading]);

    // Chat Submission Logic
    async function askAI(question, id, controllerSignal) {
        setLoading(true);

        const activeModelId = settings.activeModelId || "meta-llama/llama-3.3-70b-instruct:free";

        const immortalRules = activeWorkspace.rules.length > 0 ?
            `Immortal Rules (Never break them):\n${activeWorkspace.rules.map(r => `- ${r}`).join('\n')}` : '';

        let activeTasks = activeWorkspace.tasks.filter(t => t.status !== 'completed').map(t => `- [ ] ${t.title}`).join('\n');
        if (!activeTasks) activeTasks = "None";

        let completedTasks = activeWorkspace.tasks.filter(t => t.status === 'completed').map(t => `- [x] ${t.title}`).join('\n');
        if (!completedTasks) completedTasks = "None";

        // FIX 1: Full file content injection — prevents "Context Blindness"
        let filesOutput;
        if (activeWorkspace.outputs.length > 0) {
            filesOutput = activeWorkspace.outputs.map(f =>
                `--- START FILE: ${f.filename} ---\n${f.content || ''}\n--- END FILE ---`
            ).join('\n\n');
        } else {
            filesOutput = "No files created yet.";
        }

        const workspaceState = {
            type: activeWorkspace.type,
            description: activeWorkspace.description || 'No description provided.',
            currentPhase: activeWorkspace.currentPhase,
            immortalRules,
            activeTasks,
            completedTasks,
            filesOutput
        };

        // Extract history
        const historyMessages = activeWorkspace.chats
            .filter((c) => c.type === "ch" && c.answer)
            .slice(-10)
            .flatMap((obj) => [
                { role: "user", content: obj.question },
                { role: "assistant", content: obj.answer },
            ]);

        const messages = [
            ...historyMessages,
            { role: "user", content: question },
        ];

        // ⚠️ MUST be declared before try{} so finally{} can read it
        let shouldAutoContinue = false;

        try {
            const response = await api.agentChat(
                preferences.userId,
                messages,
                "", // handled by backend
                activeModelId,
                {
                    temperature: settings.temperature || 0.7,
                    top_p: settings.topP || 1.0,
                    max_tokens: settings.maxTokens || 2048,
                },
                workspaceState,
                controllerSignal
            );

            if (!response.ok) throw new Error("Failed to connect to AI service.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;
                    const dataStr = trimmed.slice(6);
                    if (dataStr === "[DONE]") continue;

                    try {
                        const data = JSON.parse(dataStr);
                        if (data.error) throw new Error(data.error);

                        const content = data.choices?.[0]?.delta?.content || "";
                        if (content) {
                            fullContent += content;
                            setChats((prev) =>
                                prev.map((obj) => (obj.id === id ? { ...obj, answer: fullContent } : obj))
                            );
                        }
                    } catch (e) {
                        if (e.message) throw e;
                    }
                }
            }

            // Execute intercepted actions
            if (activeWorkspaceId) {
                let jsonResp;
                try {
                    const match = fullContent.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
                    const jsonStr = match ? match[1] : fullContent;
                    jsonResp = JSON.parse(jsonStr.trim());
                } catch (e) {
                    try {
                        const lastBrace = fullContent.lastIndexOf('}');
                        if (lastBrace !== -1) {
                            const trimmed = fullContent.substring(0, lastBrace + 1);
                            const match = trimmed.match(/\`\`\`(?:json)?\s*([\s\S]*)/) || [null, trimmed];
                            jsonResp = JSON.parse(match[1]);
                        }
                    } catch (e2) {
                        console.warn("Failed to parse JSON response:", e);
                    }
                }

                if (jsonResp) {
                    syncAgentAction(jsonResp);

                    // Auto Loop Logic
                    const requiresApproval = !!jsonResp.requires_approval;

                    let hasPending = false;
                    const oldPending = new Set(activeWorkspace.tasks.filter(t => t.status !== 'completed').map(t => t.title.trim().toLowerCase()));
                    (jsonResp.add_tasks || []).forEach(t => oldPending.add(t.title.trim().toLowerCase()));
                    (jsonResp.complete_tasks || []).forEach(t => oldPending.delete(t.trim().toLowerCase()));
                    if (oldPending.size > 0) hasPending = true;

                    if (!requiresApproval && hasPending) {
                        shouldAutoContinue = true;
                    }
                } else {
                    // Fallback to XML regex parsing for legacy chats during loop
                    const addTasks = [...fullContent.matchAll(/<add_task title="(.*?)"\s*\/>/g)];
                    addTasks.forEach(m => addTask(m[1], "coming_soon"));

                    const completeTasks = [...fullContent.matchAll(/<complete_task title="(.*?)"\s*\/>/g)];
                    completeTasks.forEach(m => completeTaskByTitle(m[1]));

                    const files = [...fullContent.matchAll(/<create_file name="(.*?)">([\s\S]*?)<\/create_file>/g)];
                    files.forEach(m => saveOutput(m[1], m[2]));
                }
            }

        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("AI stream error:", error);
                setChats((prev) =>
                    prev.map((obj) => (obj.id === id ? { ...obj, type: "error", answer: error.message || "Connection lost." } : obj))
                );
            }
        } finally {
            setLoading(false);
            setIsAutoExecuting(false);
            if (activeWorkspaceId && shouldAutoContinue) {
                setIsAutoExecuting(true);
                setTimeout(() => {
                    handleAutoContinue();
                }, 2000);
            }
        }
    }

    const handleAutoContinue = () => {
        // Use ref to avoid stale closure on loading state
        if (loadingRef.current) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        const newId = new Date().toISOString();
        const autoText = "[AUTO] Continuing autonomous execution...";

        setChats((prev) => [...prev, {
            id: newId,
            type: "ch",
            question: autoText,
            answer: undefined,
            timestamp: new Date().toISOString(),
            isAuto: true,
        }]);

        askAI("Please review the remaining tasks. Pick EXACTLY ONE pending task, complete it fully (write the full file content in save_outputs), mark only that task in complete_tasks, and set requires_approval: false if more tasks remain.", newId, abortControllerRef.current.signal);
    };

    const handleSend = (e) => {
        e.preventDefault();
        const text = query.trim();
        if (!text || loading) return;

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        const newId = new Date().toISOString();
        const newMsg = {
            id: newId,
            type: "ch",
            question: text,
            answer: undefined,
            timestamp: new Date().toISOString(),
        };

        setChats((prev) => [...prev, newMsg]);
        setQuery("");
        askAI(text, newId, abortControllerRef.current.signal);
    };

    const copyToClipboard = async (idMes) => {
        const targetMes = activeWorkspace.chats.find((ch) => ch.type === "ch" && ch.id === idMes);
        if (!targetMes?.answer) return;
        try {
            await navigator.clipboard.writeText(targetMes.answer);
            setIsCopied({ idMes, state: true });
            setTimeout(() => setIsCopied({ idMes, state: false }), 2000);
        } catch (error) { console.error(error); }
    };

    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-black">

            {/* ── Left Sidebar (Tasks & Outputs) ── */}
            <div className="w-64 sm:w-80 flex-shrink-0 flex flex-col border-r" style={{ background: "var(--bg-panel)", borderColor: "var(--border-green)" }}>
                {/* Sidebar Header */}
                <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(0,245,255,0.1)" }}>
                    <button
                        onClick={() => setPreferences(p => ({ ...p, currentPage: "workspaces" }))}
                        className="p-1 hover:bg-white/10 rounded mr-2"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="font-bold truncate text-sm" style={{ color: "var(--neon-green)" }}>
                        {activeWorkspace.name}
                    </div>
                </div>

                {/* Scrollable areas */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">

                    {/* Tasks Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3 text-xs uppercase tracking-widest font-bold" style={{ color: "var(--neon-cyan)" }}>
                            <span className="flex items-center gap-2"><CheckCircle size={12} /> Tasks</span>
                            <button onClick={() => {
                                const title = prompt("New Task Title:");
                                if (title) addTask(title, "coming_soon");
                            }} className="hover:text-white"><Plus size={14} /></button>
                        </div>

                        {activeWorkspace.tasks.length === 0 ? (
                            <div className="text-xs opacity-40 italic py-2">No tasks yet. Ask the AI to suggest some!</div>
                        ) : (
                            <div className="space-y-4">
                                {renderTaskSection("In Progress", "in_progress", <Play size={12} />)}
                                {renderTaskSection("Coming Soon", "coming_soon", <Circle size={12} />)}
                                {renderTaskSection("Completed", "completed", <CheckCircle size={12} />)}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/10 w-full" />

                    {/* Outputs Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3 text-xs uppercase tracking-widest font-bold text-pink-400">
                            <span className="flex items-center gap-2"><FileText size={12} /> Outputs ({activeWorkspace.outputs.length})</span>
                        </div>

                        {activeWorkspace.outputs.length === 0 ? (
                            <div className="text-xs opacity-40 italic py-2">No files saved yet.</div>
                        ) : (
                            <ul className="space-y-2">
                                {activeWorkspace.outputs.map(out => (
                                    <li key={out.id} className="flex items-center gap-2 text-sm p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group">
                                        <FileText size={14} className="text-pink-400 opacity-70 shrink-0" onClick={() => setPreviewFile(out)} />
                                        <span className="flex-1 truncate" onClick={() => setPreviewFile(out)}>{out.filename}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                title="Copy file content"
                                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(out.content || ""); setCopiedFileId(out.id); setTimeout(() => setCopiedFileId(null), 2000); }}
                                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                                style={{ color: copiedFileId === out.id ? "#39ff14" : "rgba(255,255,255,0.5)" }}
                                            >
                                                {copiedFileId === out.id ? <CheckIcon size={12} /> : <Copy size={12} />}
                                            </button>
                                            <button onClick={() => setPreviewFile(out)} className="p-1 rounded hover:bg-white/10 transition-colors text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--neon-cyan)" }}>Open</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Main Work Area ── */}
            <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--bg-primary)" }}>

                {/* Top Phase Header */}
                <div className="px-6 py-3 border-b flex items-center justify-between shadow-sm" style={{ background: "var(--bg-header)", borderColor: "var(--border-green)" }}>
                    <div className="flex items-center gap-2 text-sm">
                        <Briefcase size={16} className="text-gray-400" />
                        <span className="font-bold text-gray-300 mr-4 hidden sm:inline">{activeWorkspace.name}</span>
                        <div className="flex items-center">
                            {activeWorkspace.phases.map((phase, idx) => {
                                const isCurrent = activeWorkspace.currentPhase === phase;
                                const isPast = activeWorkspace.phases.indexOf(activeWorkspace.currentPhase) > idx;

                                return (
                                    <div key={phase} className="flex items-center" onClick={() => setWorkspacePhase(phase)}>
                                        <div className={`px-3 py-1 text-xs rounded-full font-bold cursor-pointer transition-colors whitespace-nowrap ${isCurrent ? 'bg-green-500 text-black' :
                                            isPast ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                                            }`}>
                                            {phase} {isCurrent ? "🔄" : isPast ? "✅" : "⏳"}
                                        </div>
                                        {idx < activeWorkspace.phases.length - 1 && (
                                            <ChevronLeft size={14} className="mx-1 opacity-30 rotate-180" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 border-none custom-scrollbar">
                    <div className="max-w-4xl mx-auto flex flex-col gap-6">

                        {activeWorkspace.chats.length === 0 && (
                            <div className="flex flex-col items-center justify-center mt-20 text-center opacity-80">
                                <div className="p-5 rounded-full bg-cyan-500/10 mb-5 border border-cyan-500/20 shadow-[0_0_30px_rgba(0,245,255,0.1)]">
                                    <SquareTerminal size={32} className="text-cyan-400" />
                                </div>
                                <h2 className="text-xl font-bold font-mono text-cyan-400 mb-2 uppercase tracking-widest">Workspace Agent Ready</h2>
                                <p className="text-sm opacity-60 max-w-md">
                                    I am your intelligent project agent. Give me commands below to generate code, create project plans, and manage your tasks.
                                </p>
                            </div>
                        )}

                        {activeWorkspace.chats.map((obj, index) => {
                            if (obj.type === "ms") {
                                return (
                                    <div key={index} className="flex flex-col items-center justify-center my-8 text-center opacity-60">
                                        <div className="p-4 rounded-full bg-white/5 mb-3">
                                            <SquareTerminal size={24} />
                                        </div>
                                        {obj.content.map((line, i) => (
                                            <p key={i} className="text-sm">{line}</p>
                                        ))}
                                    </div>
                                );
                            }
                            return (
                                <AgentOutputBlock
                                    key={obj.id || index}
                                    obj={obj}
                                />
                            );
                        })}

                        {/* Auto-Executing Indicator — glowing neon-cyan badge */}
                        {isAutoExecuting && !loading && (
                            <div
                                className="flex items-center gap-3 px-5 py-3 rounded-xl border max-w-4xl mx-auto w-full"
                                style={{
                                    background: "rgba(0,245,255,0.05)",
                                    borderColor: "rgba(0,245,255,0.35)",
                                    boxShadow: "0 0 20px rgba(0,245,255,0.15), inset 0 0 10px rgba(0,245,255,0.05)",
                                    animation: "pulse 1.4s ease-in-out infinite"
                                }}
                            >
                                <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{
                                        background: "#00f5ff",
                                        boxShadow: "0 0 8px 2px rgba(0,245,255,0.7)",
                                        animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite"
                                    }}
                                />
                                <span className="text-xs font-mono font-bold uppercase tracking-widest flex-1" style={{ color: "#00f5ff" }}>
                                    ⚙️ Agent is executing next task in 2s...
                                </span>
                                <button
                                    onClick={() => { setIsAutoExecuting(false); if (abortControllerRef.current) abortControllerRef.current.abort(); }}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-red-500/20"
                                    style={{ background: "rgba(255,45,120,0.08)", border: "1px solid rgba(255,45,120,0.4)", color: "#ff2d78" }}
                                    title="Stop autonomous loop"
                                >
                                    <StopCircle size={12} /> Stop
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center gap-3 text-green-400 py-4 max-w-4xl mx-auto w-full">
                                <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-mono opacity-70">AI is analyzing project context...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 sm:px-8 border-t z-10" style={{ background: "var(--bg-panel)", borderColor: "rgba(0,245,255,0.1)" }}>
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSend} className="relative flex flex-col bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl focus-within:border-cyan-500/50 transition-colors">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest font-bold text-cyan-400">
                                <SquareTerminal size={12} /> Agent Command
                            </div>
                            <div className="flex items-end px-2 py-2">
                                <span className="font-mono text-cyan-500 font-bold px-3 py-3">~❯</span>
                                <textarea
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (!loading && query.trim()) handleSend(e);
                                        }
                                    }}
                                    className="flex-1 max-h-48 min-h-[44px] w-full bg-transparent border-none resize-none px-0 py-3 font-mono text-sm outline-none custom-scrollbar text-white placeholder-white/20"
                                    placeholder={`Tell the agent what to do... e.g., "Build a login page"`}
                                    rows={1}
                                />
                                <div className="p-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !query.trim()}
                                        className="p-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 transition-colors"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        </form>
                        <div className="flex justify-between items-center mt-3 text-[10px] uppercase font-bold tracking-widest opacity-40 font-mono">
                            <span className="text-cyan-400">Context: Rules & Phase Auto-Injected</span>
                            <span className="text-green-400">Agent Ready</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* File Preview Modal */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setPreviewFile(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-[#050f08] border border-green-500/30 shadow-[0_0_30px_rgba(57,255,20,0.1)] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
                                <h3 className="font-mono text-cyan-400 font-bold tracking-widest flex items-center gap-2"><FileText size={16} /> {previewFile.filename}</h3>
                                <button onClick={() => setPreviewFile(null)} className="text-white hover:text-red-400 transition-colors uppercase tracking-widest text-[10px] font-bold">Close</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-sm">
                                <Response>{`\`\`\`\n${previewFile.content}\n\`\`\``}</Response>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Agent Output Block - The sleek, premium dashboard card for AI actions
function AgentOutputBlock({ obj }) {
    if (!obj.question && !obj.answer) return null;

    let cleanAnswer = obj.answer || "";
    let addTasks = [];
    let completeTasks = [];
    let files = [];
    let phase = null;
    let requiresApproval = false;
    let thought = "";

    // Parse JSON
    let parsedJson = null;
    try {
        const match = cleanAnswer.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
        const jsonStr = match ? match[1] : cleanAnswer;
        if (jsonStr.trim().startsWith('{')) {
            parsedJson = JSON.parse(jsonStr.trim());
        }
    } catch (e) {
        // try partial parse
        try {
            const lastBrace = cleanAnswer.lastIndexOf('}');
            if (lastBrace !== -1) {
                const trimmed = cleanAnswer.substring(0, lastBrace + 1);
                const match = trimmed.match(/\`\`\`(?:json)?\s*([\s\S]*)/) || [null, trimmed];
                parsedJson = JSON.parse(match[1]);
            }
        } catch (e2) { }
    }

    if (parsedJson) {
        // FIX 2: Type-safe answer extraction — prevents [object Object] render crash
        const rawAnswer = parsedJson.answer;
        cleanAnswer = typeof rawAnswer === 'string'
            ? rawAnswer
            : (rawAnswer != null ? JSON.stringify(rawAnswer) : "") || "Processing...";

        thought = typeof parsedJson.thought === 'string' ? parsedJson.thought : "";
        phase = parsedJson.phase;
        requiresApproval = !!parsedJson.requires_approval;

        if (parsedJson.add_tasks) addTasks = parsedJson.add_tasks.map(t => [null, t.title]);
        if (parsedJson.complete_tasks) {
            completeTasks = parsedJson.complete_tasks.map(t => [null, typeof t === 'string' ? t : t.title || JSON.stringify(t)]);
        }
        if (parsedJson.save_outputs) {
            files = parsedJson.save_outputs.map(o => [null, o.fileName, o.content || ""]);
        }
    } else {
        // Fallback for XML parsing
        addTasks = [...cleanAnswer.matchAll(/<add_task title="(.*?)"\s*\/>/g)];
        completeTasks = [...cleanAnswer.matchAll(/<complete_task title="(.*?)"\s*\/>/g)];
        files = [...cleanAnswer.matchAll(/<create_file name="(.*?)">([\s\S]*?)<\/create_file>/g)];

        cleanAnswer = cleanAnswer.replace(/<add_task title="(.*?)"\s*\/>/g, "");
        cleanAnswer = cleanAnswer.replace(/<complete_task title="(.*?)"\s*\/>/g, "");
        cleanAnswer = cleanAnswer.replace(/<create_file name="(.*?)">([\s\S]*?)<\/create_file>/g, "");
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col mb-8 w-full"
        >
            {/* User Command Log */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[rgba(0,245,255,0.03)] border border-[rgba(0,245,255,0.1)] rounded-t-xl opacity-80">
                <SquareTerminal size={14} className="text-cyan-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-500 font-bold shrink-0">Command Executed:</span>
                <span className="text-sm font-mono truncate">{obj.question}</span>
            </div>

            {/* Agent Rendered Output */}
            <div className="relative glass-panel rounded-b-xl border-x border-b border-white/5 bg-black/40 backdrop-blur-md p-6 sm:p-8 shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>

                {obj.answer ? (
                    <>
                        {/* Agent Thought / Phase / Observation */}
                        {(thought || phase || parsedJson?.observation) && (
                            <div className="flex flex-col gap-2 mb-4 bg-white/[0.04] p-3 rounded-lg border border-white/[0.06] shadow-inner">
                                {phase && (
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold" style={{ color: "#39ff14" }}>
                                        <span>🛠 Phase: {phase}</span>
                                        {requiresApproval && <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full border" style={{ borderColor: "rgba(255,45,120,0.4)", color: "#ff2d78", background: "rgba(255,45,120,0.08)" }}>⏸ Paused</span>}
                                        {!requiresApproval && <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full border" style={{ borderColor: "rgba(0,245,255,0.4)", color: "#00f5ff", background: "rgba(0,245,255,0.06)" }}>🔄 Auto-Loop</span>}
                                    </div>
                                )}
                                {parsedJson?.observation && (
                                    <div className="text-[11px] font-mono opacity-70 border-l-2 border-green-500/30 pl-2 leading-relaxed">
                                        <span className="opacity-50 uppercase text-[9px] tracking-widest">Observation: </span>
                                        {parsedJson.observation}
                                    </div>
                                )}
                                {thought && (
                                    <div className="text-[11px] font-mono opacity-60 border-l-2 border-cyan-500/30 pl-2 italic leading-relaxed">
                                        <span className="opacity-50 uppercase text-[9px] tracking-widest not-italic">Thought: </span>
                                        {thought}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Agent Action Cards — Glassmorphic */}
                        {(addTasks.length > 0 || completeTasks.length > 0 || files.length > 0) && (
                            <div className="flex flex-col gap-3 mb-5">

                                {/* Add Tasks */}
                                {addTasks.length > 0 && (
                                    <div
                                        className="rounded-xl border overflow-hidden"
                                        style={{
                                            background: "rgba(57,255,20,0.04)",
                                            borderColor: "rgba(57,255,20,0.2)",
                                            boxShadow: "0 0 18px rgba(57,255,20,0.06), inset 0 1px 0 rgba(57,255,20,0.08)",
                                            backdropFilter: "blur(12px)"
                                        }}
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "rgba(57,255,20,0.1)" }}>
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "#39ff14" }}>⚡ Tasks Planned</span>
                                            <span className="ml-auto text-[10px] font-mono opacity-40">{addTasks.length}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 p-3">
                                            {addTasks.map((t, i) => (
                                                <div key={'add' + i} className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded" style={{ color: "rgba(57,255,20,0.85)" }}>
                                                    <span className="opacity-50">+</span> <span className="text-white">{t[1]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Complete Tasks */}
                                {completeTasks.length > 0 && (
                                    <div
                                        className="rounded-xl border overflow-hidden"
                                        style={{
                                            background: "rgba(0,245,255,0.04)",
                                            borderColor: "rgba(0,245,255,0.2)",
                                            boxShadow: "0 0 18px rgba(0,245,255,0.06), inset 0 1px 0 rgba(0,245,255,0.08)",
                                            backdropFilter: "blur(12px)"
                                        }}
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "rgba(0,245,255,0.1)" }}>
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "#00f5ff" }}>✅ Tasks Completed</span>
                                            <span className="ml-auto text-[10px] font-mono opacity-40">{completeTasks.length}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 p-3">
                                            {completeTasks.map((t, i) => (
                                                <div key={'comp' + i} className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded" style={{ color: "rgba(0,245,255,0.85)" }}>
                                                    <span className="opacity-50">✓</span> <span className="text-white">{t[1]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Save Outputs (Files) */}
                                {files.length > 0 && (
                                    <div
                                        className="rounded-xl border overflow-hidden"
                                        style={{
                                            background: "rgba(255,45,120,0.04)",
                                            borderColor: "rgba(255,45,120,0.2)",
                                            boxShadow: "0 0 18px rgba(255,45,120,0.06), inset 0 1px 0 rgba(255,45,120,0.08)",
                                            backdropFilter: "blur(12px)"
                                        }}
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "rgba(255,45,120,0.1)" }}>
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "#ff2d78" }}>📄 Files Saved</span>
                                            <span className="ml-auto text-[10px] font-mono opacity-40">{files.length}</span>
                                        </div>
                                        <div className="flex flex-col gap-2 p-3">
                                            {files.map((f, i) => (
                                                <div key={'file' + i} className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "rgba(255,45,120,0.9)" }}>
                                                        <span className="opacity-50">→</span>
                                                        <span className="text-white font-bold">{f[1]}</span>
                                                        {f[2] && (
                                                            <span className="ml-auto opacity-30 text-[9px]">{f[2].length} chars</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                        {cleanAnswer.trim() ? (
                            <div className={`agent-content text-sm relative z-10 ${(addTasks.length > 0 || completeTasks.length > 0 || files.length > 0) ? 'pt-5 border-t border-white/10 mt-2' : ''}`}>
                                {obj.type === "error" ? (
                                    <div className="text-red-400 flex gap-2 items-center p-4 bg-red-500/10 rounded border border-red-500/20">
                                        <span>❌</span> <span>{cleanAnswer}</span>
                                    </div>
                                ) : (
                                    <Response>{cleanAnswer}</Response>
                                )}
                            </div>
                        ) : null}

                        {/* Human Verification Checkpoint */}
                        {requiresApproval && (
                            <div className="mt-6 pt-5 border-t border-green-500/30 flex items-center justify-between">
                                <div className="text-sm font-bold text-green-400 flex items-center gap-2">
                                    <span>🛑</span> Agent Paused: Pending your approval or new instructions.
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center gap-3 text-cyan-400 py-6 px-4 animate-pulse">
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-mono text-xs uppercase tracking-widest font-bold">Agent processing request...</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
