import { createContext, useState, useEffect, useCallback, useMemo, useRef } from "react";

export const WorkspaceContext = createContext();

function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return "ws_" + "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ─── Constants ────────────────────────────────────────────────────
const STORAGE_KEY = "ChatForge_Workspaces";
const ACTIVE_KEY = "ChatForge_ActiveWorkspace";
const MAX_TIMELINE = 100; // increased from 50
const MAX_AGENT_CONSOLE = 200; // max console log entries

// ─── Task status ordering for kanban-style sorting ───────────────
export const TASK_STATUS_ORDER = {
    in_progress: 0,
    coming_soon: 1,
    completed: 2,
    blocked: 3,
};

export const TASK_STATUS_LABELS = {
    coming_soon: "To Do",
    in_progress: "In Progress",
    completed: "Done",
    blocked: "Blocked",
};

export const TASK_STATUS_COLORS = {
    coming_soon: "var(--neon-cyan)",
    in_progress: "var(--neon-green)",
    completed: "rgba(57,255,20,0.4)",
    blocked: "var(--neon-magenta, #ff2d78)",
};

// ─── Workspace type presets ───────────────────────────────────────
export const WORKSPACE_PRESETS = {
    General: { emoji: "🌐", description: "General purpose workspace" },
    Development: { emoji: "💻", description: "Build software & apps" },
    Research: { emoji: "🔬", description: "Investigate & analyze" },
    Design: { emoji: "🎨", description: "Creative & visual projects" },
    Writing: { emoji: "✍️", description: "Content & documentation" },
    Marketing: { emoji: "📣", description: "Campaigns & strategy" },
};

// ─── Priority levels for tasks ────────────────────────────────────
export const TASK_PRIORITIES = { low: 0, normal: 1, high: 2, urgent: 3 };
export const TASK_PRIORITY_COLORS = {
    low: "rgba(200,255,192,0.3)",
    normal: "var(--neon-cyan)",
    high: "#ffd700",
    urgent: "var(--neon-magenta, #ff2d78)",
};

// ─── Helpers ──────────────────────────────────────────────────────
function safeLoad(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function safeSave(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn("[WorkspaceContext] localStorage write failed:", e.message);
    }
}

// ─────────────────────────────────────────────────────────────────
export function WorkspaceProvider({ children }) {

    const [workspaces, setWorkspaces] = useState(() => safeLoad(STORAGE_KEY, []));
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => safeLoad(ACTIVE_KEY, null));

    // ── Agent Run State ────────────────────────────────────────────
    const [agentRun, setAgentRun] = useState({
        isRunning: false,
        goal: "",
        currentAgent: null,    // "architect" | "coder" | "researcher" | "reflector" | null
        currentTask: null,     // current task title being executed
        iteration: 0,
        totalIterations: 0,
        console: [],           // array of { timestamp, type: "info"|"agent"|"action"|"error"|"done", agent, message }
        summary: null,         // final summary when done
        startedAt: null,
    });
    const abortRef = useRef(null);  // AbortController for cancelling runs

    // ── Persist workspaces ──────────────────────────────────────────
    useEffect(() => { safeSave(STORAGE_KEY, workspaces); }, [workspaces]);
    useEffect(() => {
        if (activeWorkspaceId) safeSave(ACTIVE_KEY, activeWorkspaceId);
        else localStorage.removeItem(ACTIVE_KEY);
    }, [activeWorkspaceId]);

    // ── Derived: active workspace object ────────────────────────────
    const activeWorkspace = useMemo(
        () => workspaces.find((ws) => ws.id === activeWorkspaceId) || null,
        [workspaces, activeWorkspaceId]
    );

    // ── Workspace stats (derived, memoised) ─────────────────────────
    const workspaceStats = useMemo(() => {
        if (!activeWorkspace) return null;
        const tasks = activeWorkspace.tasks || [];
        return {
            total: tasks.length,
            done: tasks.filter(t => t.status === "completed").length,
            inProgress: tasks.filter(t => t.status === "in_progress").length,
            blocked: tasks.filter(t => t.status === "blocked").length,
            toDo: tasks.filter(t => t.status === "coming_soon").length,
            progress: tasks.length > 0
                ? Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100)
                : 0,
        };
    }, [activeWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  WORKSPACE CRUD
    // ═══════════════════════════════════════════════════════════════

    const createWorkspace = useCallback((data) => {
        const preset = WORKSPACE_PRESETS[data.type] || WORKSPACE_PRESETS.General;

        const newWs = {
            id: uuid(),
            name: data.name || "Untitled Workspace",
            type: data.type || "General",
            emoji: data.emoji || preset.emoji,
            description: data.description || "",
            color: data.color || null, // accent color override
            rules: data.rules
                ? data.rules.split("\n").filter(r => r.trim())
                : [],
            tasks: [],
            outputs: [],
            notes: "",            // NEW: free-form workspace notes
            conversationSummary: "",
            timeline: [],
            tags: data.tags || [],  // NEW: workspace tags
            isArchived: false,         // NEW: archive support
            chats: [
                {
                    type: "ms",
                    content: [
                        `${data.emoji || preset.emoji} Welcome to **${data.name || "Untitled Workspace"}**`,
                        "💡 Add tasks and run the agent to start building.",
                    ],
                },
            ],
            sessionId: data.sessionId || null, // Dedicated chat session ID from chatsContext
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setWorkspaces((prev) => [newWs, ...prev]);
        setActiveWorkspaceId(newWs.id);
        return newWs.id;
    }, []);

    const updateWorkspace = useCallback((id, updates) => {
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id !== id) return ws;
                const resolved = typeof updates === "function" ? updates(ws) : updates;
                return { ...ws, ...resolved, updatedAt: new Date().toISOString() };
            })
        );
    }, []);

    const duplicateWorkspace = useCallback((id) => {
        setWorkspaces((prev) => {
            const source = prev.find(ws => ws.id === id);
            if (!source) return prev;
            const copy = {
                ...source,
                id: uuid(),
                name: `${source.name} (copy)`,
                tasks: source.tasks.map(t => ({ ...t, id: uuid() })),
                outputs: source.outputs.map(o => ({ ...o, id: uuid() })),
                timeline: [],
                sessionId: null, // Don't copy the session, let it be recreated
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            return [copy, ...prev];
        });
    }, []);

    const deleteWorkspace = useCallback((id) => {
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
        if (activeWorkspaceId === id) setActiveWorkspaceId(null);
    }, [activeWorkspaceId]);

    const archiveWorkspace = useCallback((id) => {
        updateWorkspace(id, (ws) => ({ isArchived: !ws.isArchived }));
        if (activeWorkspaceId === id) setActiveWorkspaceId(null);
    }, [activeWorkspaceId, updateWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  TASK MANAGEMENT  (improved)
    // ═══════════════════════════════════════════════════════════════

    const addTask = useCallback((title, status = "coming_soon", extra = {}) => {
        if (!activeWorkspaceId) return;
        const newTask = {
            id: uuid(),
            title,
            status,
            priority: extra.priority || "normal",
            dueDate: extra.dueDate || null,   // NEW
            description: extra.description || "",     // NEW
            tags: extra.tags || [],     // NEW
            createdAt: new Date().toISOString(),
            completedAt: null,
        };
        updateWorkspace(activeWorkspaceId, (ws) => ({
            tasks: [...(ws.tasks || []), newTask],
        }));
        return newTask.id;
    }, [activeWorkspaceId, updateWorkspace]);

    const updateTask = useCallback((taskId, updates) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            tasks: (ws.tasks || []).map(t => {
                if (t.id !== taskId) return t;
                const merged = { ...t, ...updates };
                // Auto-set completedAt timestamp
                if (updates.status === "completed" && !t.completedAt) {
                    merged.completedAt = new Date().toISOString();
                }
                if (updates.status && updates.status !== "completed") {
                    merged.completedAt = null;
                }
                return merged;
            }),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    const updateTaskStatus = useCallback((taskId, newStatus) => {
        updateTask(taskId, { status: newStatus });
    }, [updateTask]);

    const completeTaskByTitle = useCallback((title) => {
        if (!activeWorkspaceId) return;
        const norm = title.trim().toLowerCase();
        updateWorkspace(activeWorkspaceId, (ws) => ({
            tasks: (ws.tasks || []).map(t =>
                t.title.trim().toLowerCase() === norm
                    ? { ...t, status: "completed", completedAt: t.completedAt || new Date().toISOString() }
                    : t
            ),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    const deleteTask = useCallback((taskId) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            tasks: (ws.tasks || []).filter(t => t.id !== taskId),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    // NEW: reorder tasks (drag & drop support)
    const reorderTasks = useCallback((newOrder) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, { tasks: newOrder });
    }, [activeWorkspaceId, updateWorkspace]);

    // NEW: bulk task operations
    const bulkUpdateTasks = useCallback((taskIds, updates) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            tasks: (ws.tasks || []).map(t =>
                taskIds.includes(t.id) ? { ...t, ...updates } : t
            ),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    const bulkDeleteTasks = useCallback((taskIds) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            tasks: (ws.tasks || []).filter(t => !taskIds.includes(t.id)),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  OUTPUT MANAGEMENT  (improved)
    // ═══════════════════════════════════════════════════════════════

    const saveOutput = useCallback((filename, content, meta = {}) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => {
            const existing = (ws.outputs || []).findIndex(o => o.filename === filename);
            if (existing >= 0) {
                const updated = [...ws.outputs];
                updated[existing] = {
                    ...updated[existing],
                    content,
                    updatedAt: new Date().toISOString(),
                    ...meta,
                };
                return { outputs: updated };
            }
            return {
                outputs: [
                    ...(ws.outputs || []),
                    {
                        id: uuid(),
                        filename,
                        content,
                        type: meta.type || detectOutputType(filename), // NEW: auto-detect type
                        tags: meta.tags || [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                ],
            };
        });
    }, [activeWorkspaceId, updateWorkspace]);

    const deleteOutput = useCallback((outputId) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            outputs: (ws.outputs || []).filter(o => o.id !== outputId),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    // NEW: rename output file
    const renameOutput = useCallback((outputId, newFilename) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => ({
            outputs: (ws.outputs || []).map(o =>
                o.id === outputId ? { ...o, filename: newFilename, updatedAt: new Date().toISOString() } : o
            ),
        }));
    }, [activeWorkspaceId, updateWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  NOTES  (NEW)
    // ═══════════════════════════════════════════════════════════════

    const updateNotes = useCallback((notes) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, { notes });
    }, [activeWorkspaceId, updateWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  TIMELINE  (improved)
    // ═══════════════════════════════════════════════════════════════

    const addTimelineEvent = useCallback((text, type = "info") => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, (ws) => {
            const event = {
                id: uuid(),
                text,
                type,   // "info" | "task" | "output" | "agent" | "error"
                timestamp: new Date().toISOString(),
            };
            return { timeline: [event, ...(ws.timeline || [])].slice(0, MAX_TIMELINE) };
        });
    }, [activeWorkspaceId, updateWorkspace]);

    const clearTimeline = useCallback(() => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, { timeline: [] });
    }, [activeWorkspaceId, updateWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  CONVERSATION SUMMARY
    // ═══════════════════════════════════════════════════════════════

    const updateConversationSummary = useCallback((summary) => {
        if (!activeWorkspaceId) return;
        updateWorkspace(activeWorkspaceId, { conversationSummary: summary });
    }, [activeWorkspaceId, updateWorkspace]);

    // ═══════════════════════════════════════════════════════════════
    //  AGENT ACTION SYNC  (improved & more robust)
    // ═══════════════════════════════════════════════════════════════

    const syncAgentAction = useCallback((jsonPayload) => {
        if (!activeWorkspaceId) return { ok: false, error: "No active workspace" };

        let action;
        try {
            action = typeof jsonPayload === "string" ? JSON.parse(jsonPayload) : jsonPayload;
        } catch (err) {
            console.error("[WorkspaceAgent] Failed to parse action JSON", err);
            return { ok: false, error: "Invalid JSON payload" };
        }

        const applied = [];

        // ── Add tasks ────────────────────────────────────────────────
        if (Array.isArray(action.add_tasks)) {
            action.add_tasks.forEach(t => {
                addTask(t.title, t.status || "coming_soon", {
                    priority: t.priority,
                    dueDate: t.due_date,
                    description: t.description,
                    tags: t.tags,
                });
                applied.push(`task added: "${t.title}"`);
            });
            if (action.add_tasks.length > 0)
                addTimelineEvent(`${action.add_tasks.length} task(s) added by agent`, "agent");
        }

        // ── Update tasks (NEW) ───────────────────────────────────────
        if (Array.isArray(action.update_tasks)) {
            action.update_tasks.forEach(t => {
                if (!t.id) return;
                updateTask(t.id, {
                    ...(t.status !== undefined && { status: t.status }),
                    ...(t.priority !== undefined && { priority: t.priority }),
                    ...(t.title !== undefined && { title: t.title }),
                    ...(t.dueDate !== undefined && { dueDate: t.dueDate }),
                });
                applied.push(`task updated: "${t.id}"`);
            });
        }

        // ── Complete tasks by title ──────────────────────────────────
        if (Array.isArray(action.complete_tasks)) {
            action.complete_tasks.forEach(title => {
                completeTaskByTitle(title);
                applied.push(`task completed: "${title}"`);
            });
            if (action.complete_tasks.length > 0)
                addTimelineEvent(`${action.complete_tasks.length} task(s) completed by agent`, "agent");
        }

        // ── Save outputs ─────────────────────────────────────────────
        if (Array.isArray(action.save_outputs)) {
            action.save_outputs.forEach(o => {
                if (!o.fileName) return;
                saveOutput(o.fileName, o.content || "", {
                    type: o.type,
                    tags: o.tags,
                });
                applied.push(`output saved: "${o.fileName}"`);
            });
            if (action.save_outputs.length > 0)
                addTimelineEvent(`${action.save_outputs.length} output(s) saved by agent`, "output");
        }

        // ── Update notes (NEW) ───────────────────────────────────────
        if (action.notes !== undefined) {
            updateNotes(action.notes);
            applied.push("notes updated");
        }

        // ── Conversation summary update (NEW) ────────────────────────
        if (action.conversation_summary) {
            updateConversationSummary(action.conversation_summary);
            applied.push("summary updated");
        }

        // ── Custom timeline event ────────────────────────────────────
        if (action.timeline_event) {
            addTimelineEvent(action.timeline_event, action.timeline_type || "agent");
        }

        console.log("[WorkspaceAgent] Applied:", applied);
        return { ok: true, applied };
    }, [
        activeWorkspaceId,
        addTask,
        updateTask,
        completeTaskByTitle,
        saveOutput,
        updateNotes,
        updateConversationSummary,
        addTimelineEvent,
    ]);

    // ═══════════════════════════════════════════════════════════════
    //  AGENT RUN STATE MANAGEMENT  (NEW)
    // ═══════════════════════════════════════════════════════════════

    // ── startAgentRun(goal) ────────────────────────────────────────
    // Initialises a new agent run. Does NOT make API calls itself;
    // the UI component is responsible for calling the API and feeding
    // SSE events back through processAgentEvent().
    const startAgentRun = useCallback((goal) => {
        const controller = new AbortController();
        abortRef.current = controller;

        setAgentRun({
            isRunning: true,
            goal,
            currentAgent: null,
            currentTask: null,
            iteration: 0,
            totalIterations: 0,
            console: [],
            summary: null,
            startedAt: new Date().toISOString(),
        });

        return { controller, abortRef };
    }, []);

    // ── stopAgentRun() ─────────────────────────────────────────────
    const stopAgentRun = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setAgentRun(prev => ({ ...prev, isRunning: false }));
    }, []);

    // ── updateAgentRun(partial) ────────────────────────────────────
    // Merges a partial state update into agentRun.
    const updateAgentRun = useCallback((partial) => {
        setAgentRun(prev => ({ ...prev, ...partial }));
    }, []);

    // ── addAgentLog(type, agent, message) ──────────────────────────
    // Appends a log entry to the console array (max 200 entries).
    const addAgentLog = useCallback((type, agent, message) => {
        setAgentRun(prev => {
            const entry = {
                timestamp: new Date().toISOString(),
                type,       // "info" | "agent_start" | "agent_stream" | "action" | "error" | "done" | "iteration"
                agent: agent || null,
                message,
            };
            const console_ = [...(prev.console || []), entry].slice(-MAX_AGENT_CONSOLE);
            return { ...prev, console: console_ };
        });
    }, []);

    // ── clearAgentConsole() ────────────────────────────────────────
    const clearAgentConsole = useCallback(() => {
        setAgentRun(prev => ({ ...prev, console: [] }));
    }, []);

    // ── processAgentEvent(event) ───────────────────────────────────
    // Central handler for incoming SSE events from /api/agent/run.
    // Switches on event.type and updates agent run state accordingly.
    const processAgentEvent = useCallback((event) => {
        switch (event.type) {
            case "init":
                addAgentLog("info", null, `Run started: ${event.goal}`);
                break;

            case "agent_start":
                updateAgentRun({ currentAgent: event.agent });
                addAgentLog("agent_start", event.agent, `${event.agent} agent started`);
                break;

            case "agent_stream":
                addAgentLog("agent_stream", event.agent || null, event.content);
                break;

            case "action":
                syncAgentAction(event.payload);
                addAgentLog("action", null, JSON.stringify(event.payload).slice(0, 200));
                break;

            case "iteration":
                updateAgentRun({
                    iteration: event.number,
                    totalIterations: event.total,
                    currentTask: event.task,
                });
                addAgentLog("iteration", null, `Iteration ${event.number}/${event.total} — ${event.task || ""}`);
                break;

            case "agent_done":
                addAgentLog("done", event.agent, event.summary || `${event.agent} finished`);
                break;

            case "done":
                updateAgentRun({
                    isRunning: false,
                    currentAgent: null,
                    summary: event.summary,
                });
                addAgentLog("done", null, event.summary || "Agent run completed");
                break;

            case "error":
                updateAgentRun({ isRunning: false });
                addAgentLog("error", null, event.error || "Unknown error");
                break;

            case "tool_call":
                addAgentLog("info", null, `Tool: ${event.tool} → ${event.query}`);
                break;

            case "tool_result":
                addAgentLog("info", null, `Tool result received`);
                break;

            default:
                // Forward any unknown event types as info
                addAgentLog("info", null, `Event: ${event.type}`);
                break;
        }
    }, [addAgentLog, updateAgentRun, syncAgentAction]);

    // ═══════════════════════════════════════════════════════════════
    //  EXPORT / IMPORT WORKSPACE  (NEW)
    // ═══════════════════════════════════════════════════════════════

    const exportWorkspace = useCallback((id) => {
        const ws = workspaces.find(w => w.id === id);
        if (!ws) return null;
        const blob = new Blob([JSON.stringify(ws, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `workspace_${ws.name.replace(/\s+/g, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [workspaces]);

    const importWorkspace = useCallback((jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            const imported = {
                ...data,
                id: uuid(), // always get a fresh ID
                name: `${data.name} (imported)`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            setWorkspaces(prev => [imported, ...prev]);
            setActiveWorkspaceId(imported.id);
            return { ok: true, id: imported.id };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }, []);

    // ─── Context value ────────────────────────────────────────────────
    const value = useMemo(() => ({
        // State
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        workspaceStats,

        // Workspace CRUD
        setActiveWorkspaceId,
        createWorkspace,
        updateWorkspace,
        duplicateWorkspace,
        deleteWorkspace,
        archiveWorkspace,
        exportWorkspace,
        importWorkspace,

        // Tasks
        addTask,
        updateTask,
        updateTaskStatus,
        completeTaskByTitle,
        deleteTask,
        reorderTasks,
        bulkUpdateTasks,
        bulkDeleteTasks,

        // Outputs
        saveOutput,
        deleteOutput,
        renameOutput,

        // Notes
        updateNotes,

        // Timeline
        addTimelineEvent,
        clearTimeline,

        // Summary
        updateConversationSummary,

        // Agent
        syncAgentAction,

        // Agent Run
        agentRun,
        startAgentRun,
        stopAgentRun,
        updateAgentRun,
        addAgentLog,
        clearAgentConsole,
        processAgentEvent,

        // Constants (exported for UI use)
        TASK_STATUS_LABELS,
        TASK_STATUS_COLORS,
        TASK_STATUS_ORDER,
        TASK_PRIORITIES,
        TASK_PRIORITY_COLORS,
        WORKSPACE_PRESETS,
    }), [
        workspaces, activeWorkspaceId, activeWorkspace, workspaceStats,
        createWorkspace, updateWorkspace, duplicateWorkspace, deleteWorkspace,
        archiveWorkspace, exportWorkspace, importWorkspace,
        addTask, updateTask, updateTaskStatus, completeTaskByTitle, deleteTask,
        reorderTasks, bulkUpdateTasks, bulkDeleteTasks,
        saveOutput, deleteOutput, renameOutput,
        updateNotes, addTimelineEvent, clearTimeline,
        updateConversationSummary, syncAgentAction,
        agentRun, startAgentRun, stopAgentRun, updateAgentRun,
        addAgentLog, clearAgentConsole, processAgentEvent,
    ]);

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

// ─── Utility: auto-detect output file type ────────────────────────
function detectOutputType(filename) {
    if (!filename) return "text";
    const ext = filename.split(".").pop()?.toLowerCase();
    const map = {
        js: "code", jsx: "code", ts: "code", tsx: "code",
        py: "code", java: "code", cpp: "code", c: "code",
        css: "style", scss: "style", less: "style",
        html: "markup", xml: "markup", svg: "markup",
        md: "markdown", mdx: "markdown",
        json: "data", csv: "data", yaml: "data", yml: "data",
        png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
        pdf: "document", docx: "document",
    };
    return map[ext] || "text";
}
