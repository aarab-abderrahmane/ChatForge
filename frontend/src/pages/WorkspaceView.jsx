import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Plus, CheckCircle, Circle, Play, FileText, Send, SquareTerminal, Briefcase } from "lucide-react";
import { WorkspaceContext } from "../context/workspaceContext";
import { chatsContext, MODELS, SKILLS } from "../context/chatsContext";
import { MessageBlock } from "../components/features/MessageBlock";
import { api } from "../services/api";

export function WorkspaceView() {
    const {
        activeWorkspace,
        activeWorkspaceId,
        updateWorkspace,
        addTask,
        updateTaskStatus,
        setWorkspacePhase,
    } = useContext(WorkspaceContext);

    const { preferences, setPreferences, settings, loading, setLoading } = useContext(chatsContext);

    const [query, setQuery] = useState("");
    const messagesEndRef = useRef(null);
    const scrollRef = useRef(null);
    const abortControllerRef = useRef(null);
    const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });

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

        let activeTasks = activeWorkspace.tasks.filter(t => t.status === 'in_progress').map(t => `- ${t.title}`).join('\n');
        if (!activeTasks) activeTasks = "None";

        const systemPrompt = `You are an expert AI assistant assigned to the project: "${activeWorkspace.name}".
Type/Format: ${activeWorkspace.type}
Description: ${activeWorkspace.description || 'No description provided.'}
Current Phase: ${activeWorkspace.currentPhase}

${immortalRules}

Current In-Progress Tasks:
${activeTasks}

OUTPUT INSTRUCTIONS:
Always try to use beautiful markdown formatting. 
- If providing code, use standard markdown code blocks (\`\`\`language ... \`\`\`).
- If suggesting tasks, format them directly as an unordered list of checkboxes (e.g. - [ ] Task name).
- If suggesting a multi-phase project plan, use a markdown table with columns like Phase, Area, Duration.
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
                                    <li key={out.id} className="flex items-center gap-2 text-sm p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group">
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
                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 custom-scrollbar">
                    <div className="max-w-4xl mx-auto flex flex-col gap-6">
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
                                <WorkspaceMessageBlock
                                    key={obj.id || index}
                                    obj={obj}
                                    isCopied={isCopied}
                                    copyToClipboard={copyToClipboard}
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
                <div className="p-4 sm:px-8 border-t" style={{ background: "var(--bg-panel)", borderColor: "rgba(0,245,255,0.1)" }}>
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-black/50 border rounded-xl overflow-hidden focus-within:border-green-500 transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                            <textarea
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (!loading && query.trim()) handleSend(e);
                                    }
                                }}
                                className="flex-1 max-h-48 min-h-[52px] w-full bg-transparent border-none resize-none px-4 py-3.5 text-sm outline-none custom-scrollbar"
                                placeholder={`Message ${activeWorkspace.name}...`}
                                rows={1}
                            />
                            <div className="p-2">
                                <button
                                    type="submit"
                                    disabled={loading || !query.trim()}
                                    className="p-2 rounded-lg bg-green-500 text-black hover:bg-green-400 disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                        <div className="text-center mt-2 text-[10px] opacity-40 font-mono text-cyan-400">
                            System Prompt includes project rules & current phase automatically.
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Wrapping MessageBlock slightly to inject Workspace-specific actions
// We will modify MessageBlock to accept an `isWorkspace` flag and injected handlers.
function WorkspaceMessageBlock({ obj, isCopied, copyToClipboard }) {
    const { saveOutput, addTask } = useContext(WorkspaceContext);

    return (
        <MessageBlock
            obj={obj}
            isCopied={isCopied}
            copyToClipboard={copyToClipboard}
            isWorkspace={true}
            onSaveOutput={(filename, content) => saveOutput(filename, content)}
            onAddTask={(title) => addTask(title, "coming_soon")}
        />
    );
}
