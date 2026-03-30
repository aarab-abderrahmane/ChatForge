import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Plus, CheckCircle, Circle, Play, FileText, Send, SquareTerminal, Briefcase } from "lucide-react";
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
        completeTaskByTitle,
        saveOutput,
        setWorkspacePhase,
    } = useContext(WorkspaceContext);

    const { preferences, setPreferences, settings, loading, setLoading } = useContext(chatsContext);

    const [query, setQuery] = useState("");
    const messagesEndRef = useRef(null);
    const scrollRef = useRef(null);
    const abortControllerRef = useRef(null);
    const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });
    const [previewFile, setPreviewFile] = useState(null);

    // If no active workspace, go back to dashboard
    useEffect(() => {
        if (!activeWorkspace) {
            setPreferences(p => ({ ...p, currentPage: "workspaces" }));
        }
    }, [activeWorkspace, setPreferences]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeWorkspace?.chats]);

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

    // Chat Submission Logic
    async function askAI(question, id, controllerSignal) {
        setLoading(true);

        const activeModelId = settings.activeModelId || "meta-llama/llama-3.3-70b-instruct:free";

        // Build the "Auto Context" System Prompt
        const immortalRules = activeWorkspace.rules.length > 0 ?
            `Immortal Rules (Never break them):\n${activeWorkspace.rules.map(r => `- ${r}`).join('\n')}` : '';

        let activeTasks = activeWorkspace.tasks.filter(t => t.status !== 'completed').map(t => `- [ ] ${t.title}`).join('\n');
        if (!activeTasks) activeTasks = "None";

        let completedTasks = activeWorkspace.tasks.filter(t => t.status === 'completed').map(t => `- [x] ${t.title}`).join('\n');
        if (!completedTasks) completedTasks = "None";

        let filesOutput = activeWorkspace.outputs.map(f => `- ${f.filename}`).join('\n');
        if (!filesOutput) filesOutput = "None";

        const systemPrompt = `You are an autonomous AI Agent assigned to the project: "${activeWorkspace.name}".
Type/Format: ${activeWorkspace.type}
Description: ${activeWorkspace.description || 'No description provided.'}
Current Phase: ${activeWorkspace.currentPhase}

${immortalRules}

==== WORKSPACE STATE ====
Current In-Progress Tasks:
${activeTasks}

Completed Tasks:
${completedTasks}

Existing Files (Outputs):
${filesOutput}
=========================

OUTPUT INSTRUCTIONS:
You are an intelligent, autonomous AI Agent managing this project workspace.
You MUST output actions to execute using XML tags, but ONLY when it directly fulfills the user's request. Do NOT aggressively recreate files or tasks that already exist unless asked to modify them.

Supported Actions:
1. Create or Update a file: <create_file name="filename.ext">...content...</create_file>
2. Add a new task: <add_task title="task title" />
3. Mark a task as completed: <complete_task title="task title" />

CRITICAL RULES:
- If a file already exists in "Existing Files", DO NOT recreate it unless you are explicitly adding new features or modifying it. If you do modify it, use <create_file> to overwrite it with the updated content.
- Only add tasks if the user asks for a plan, feature breakdown, or next steps. Do not blindly duplicate tasks.
- If the user asks a simple question, just answer normally without any XML tags.
- Any conversational text explaining your actions should be outside the tags.
`;

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

        try {
            const response = await api.chat(
                preferences.userId,
                messages,
                systemPrompt,
                activeModelId,
                {
                    temperature: settings.temperature || 0.7,
                    top_p: settings.topP || 1.0,
                    max_tokens: settings.maxTokens || 2048,
                },
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
                const addTasks = [...fullContent.matchAll(/<add_task title="(.*?)"\s*\/>/g)];
                addTasks.forEach(m => addTask(m[1], "coming_soon"));

                const completeTasks = [...fullContent.matchAll(/<complete_task title="(.*?)"\s*\/>/g)];
                completeTasks.forEach(m => completeTaskByTitle(m[1]));

                const files = [...fullContent.matchAll(/<create_file name="(.*?)">([\s\S]*?)<\/create_file>/g)];
                files.forEach(m => saveOutput(m[1], m[2]));
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
        }
    }

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
                            <span className="flex items-center gap-2"><FileText size={12} /> Outputs</span>
                        </div>

                        {activeWorkspace.outputs.length === 0 ? (
                            <div className="text-xs opacity-40 italic py-2">No files saved yet.</div>
                        ) : (
                            <ul className="space-y-2">
                                {activeWorkspace.outputs.map(out => (
                                    <li key={out.id} onClick={() => setPreviewFile(out)} className="flex items-center gap-2 text-sm p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group">
                                        <FileText size={14} className="text-pink-400 opacity-70" />
                                        <span className="flex-1 truncate">{out.filename}</span>
                                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:text-cyan-300">Open</button>
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

                        {loading && (
                            <div className="flex items-center gap-2 text-green-400 py-4 max-w-4xl mx-auto w-full">
                                <span className="loading-spin">⟳</span>
                                <span className="text-sm opacity-70">AI is analyzing project context...</span>
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

    // Parse out actions for display
    const addTasks = [...(obj.answer || "").matchAll(/<add_task title="(.*?)"\s*\/>/g)];
    const completeTasks = [...(obj.answer || "").matchAll(/<complete_task title="(.*?)"\s*\/>/g)];
    const files = [...(obj.answer || "").matchAll(/<create_file name="(.*?)">([\s\S]*?)<\/create_file>/g)];

    // Strip out XML entirely for the markdown renderer
    let cleanAnswer = obj.answer || "";
    cleanAnswer = cleanAnswer.replace(/<add_task title="(.*?)"\s*\/>/g, "");
    cleanAnswer = cleanAnswer.replace(/<complete_task title="(.*?)"\s*\/>/g, "");
    cleanAnswer = cleanAnswer.replace(/<create_file name="(.*?)">([\s\S]*?)<\/create_file>/g, "");

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
                        {/* Agent Action Logs */}
                        {(addTasks.length > 0 || completeTasks.length > 0 || files.length > 0) && (
                            <div className="flex flex-col gap-2 mb-4">
                                {addTasks.map((t, i) => (
                                    <div key={'add' + i} className="flex items-center gap-2 text-green-400 text-xs font-mono bg-green-500/10 px-3 py-2 rounded border border-green-500/20 shadow-[0_0_15px_rgba(57,255,20,0.05)]">
                                        <span>⚡</span> <span>Agent added task: <b className="text-white">{t[1]}</b></span>
                                    </div>
                                ))}
                                {completeTasks.map((t, i) => (
                                    <div key={'comp' + i} className="flex items-center gap-2 text-cyan-400 text-xs font-mono bg-cyan-500/10 px-3 py-2 rounded border border-cyan-500/20 shadow-[0_0_15px_rgba(0,245,255,0.05)]">
                                        <span>✅</span> <span>Agent completed task: <b className="text-white">{t[1]}</b></span>
                                    </div>
                                ))}
                                {files.map((f, i) => (
                                    <div key={'file' + i} className="flex flex-col gap-2 text-pink-400 bg-pink-500/10 px-3 py-2 rounded border border-pink-500/20 shadow-[0_0_15px_rgba(255,45,120,0.05)]">
                                        <div className="flex items-center gap-2 text-xs font-mono">
                                            <span>📄</span> <span>Agent created/updated file: <b className="text-white">{f[1]}</b></span>
                                        </div>
                                    </div>
                                ))}
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
