import { createContext, useState, useEffect, useCallback } from "react";

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

export function WorkspaceProvider({ children }) {
    // Load all workspaces from localStorage
    const [workspaces, setWorkspaces] = useState(() => {
        try {
            const stored = localStorage.getItem("ChatForge_Workspaces");
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
        try {
            return localStorage.getItem("ChatForge_ActiveWorkspace") || null;
        } catch {
            return null;
        }
    });

    // Save to localStorage when workspaces change
    useEffect(() => {
        localStorage.setItem("ChatForge_Workspaces", JSON.stringify(workspaces));
    }, [workspaces]);

    // Save active workspace ID
    useEffect(() => {
        if (activeWorkspaceId) {
            localStorage.setItem("ChatForge_ActiveWorkspace", activeWorkspaceId);
        } else {
            localStorage.removeItem("ChatForge_ActiveWorkspace");
        }
    }, [activeWorkspaceId]);

    // Create a new workspace
    const createWorkspace = useCallback((data) => {
        const newWs = {
            id: uuid(),
            name: data.name || "Untitled Workspace",
            type: data.type || "General",
            description: data.description || "",
            rules: data.rules ? data.rules.split("\n").filter(r => r.trim()) : [],
            phases: data.phases || ["Phase 1"],
            currentPhase: data.phases ? data.phases[0] : "Phase 1",
            tasks: [],
            outputs: [],
            chats: [
                {
                    type: "ms",
                    content: [
                        `🚀 Welcome to your new workspace: ${data.name || "Untitled Workspace"}`,
                        "💡 You can manage tasks, phases, and saved outputs on the left."
                    ],
                }
            ],
            createdAt: new Date().toISOString(),
        };

        setWorkspaces((prev) => [newWs, ...prev]);
        setActiveWorkspaceId(newWs.id);
        return newWs.id;
    }, []);

    // Update a specific workspace (e.g. its chats, tasks, etc)
    const updateWorkspace = useCallback((id, updates) => {
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === id) {
                    const resolvedUpdates = typeof updates === "function" ? updates(ws) : updates;
                    return { ...ws, ...resolvedUpdates };
                }
                return ws;
            })
        );
    }, []);

    const deleteWorkspace = useCallback((id) => {
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
        if (activeWorkspaceId === id) {
            setActiveWorkspaceId(null);
        }
    }, [activeWorkspaceId]);

    // Add a task to active workspace
    const addTask = useCallback((title, status = "coming_soon") => {
        if (!activeWorkspaceId) return;
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === activeWorkspaceId) {
                    const newTask = { id: uuid(), title, status };
                    return { ...ws, tasks: [...ws.tasks, newTask] };
                }
                return ws;
            })
        );
    }, [activeWorkspaceId]);

    // Update a task status
    const updateTaskStatus = useCallback((taskId, newStatus) => {
        if (!activeWorkspaceId) return;
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === activeWorkspaceId) {
                    const updatedTasks = ws.tasks.map((t) =>
                        t.id === taskId ? { ...t, status: newStatus } : t
                    );
                    return { ...ws, tasks: updatedTasks };
                }
                return ws;
            })
        );
    }, [activeWorkspaceId]);

    const deleteTask = useCallback((taskId) => {
        if (!activeWorkspaceId) return;
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === activeWorkspaceId) {
                    return { ...ws, tasks: ws.tasks.filter((t) => t.id !== taskId) };
                }
                return ws;
            })
        );
    }, [activeWorkspaceId]);

    // Save an output file
    const saveOutput = useCallback((filename, content) => {
        if (!activeWorkspaceId) return;
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === activeWorkspaceId) {
                    const newOutput = { id: uuid(), filename, content, createdAt: new Date().toISOString() };
                    return { ...ws, outputs: [...ws.outputs, newOutput] };
                }
                return ws;
            })
        );
    }, [activeWorkspaceId]);

    const deleteOutput = useCallback((outputId) => {
        if (!activeWorkspaceId) return;
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === activeWorkspaceId) {
                    return { ...ws, outputs: ws.outputs.filter((o) => o.id !== outputId) };
                }
                return ws;
            })
        );
    }, [activeWorkspaceId]);

    const setWorkspacePhase = useCallback((phaseName) => {
        if (!activeWorkspaceId) return;
        setWorkspaces((prev) =>
            prev.map((ws) => {
                if (ws.id === activeWorkspaceId) {
                    return { ...ws, currentPhase: phaseName };
                }
                return ws;
            })
        );
    }, [activeWorkspaceId]);

    const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) || null;

    return (
        <WorkspaceContext.Provider
            value={{
                workspaces,
                activeWorkspaceId,
                activeWorkspace,
                setActiveWorkspaceId,
                createWorkspace,
                updateWorkspace,
                deleteWorkspace,
                addTask,
                updateTaskStatus,
                deleteTask,
                saveOutput,
                deleteOutput,
                setWorkspacePhase,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}
