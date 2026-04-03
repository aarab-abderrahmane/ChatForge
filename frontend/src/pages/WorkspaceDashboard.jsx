/**
 * WorkspaceDashboard.jsx
 * High-level overview dashboard showing all workspaces and global stats.
 * 
 * Usage:
 *   import { WorkspaceDashboard } from "./WorkspaceDashboard";
 *   {currentPage === "dashboard" && <WorkspaceDashboard onOpenWorkspace={(id) => { setActiveWs(id); setPage("workspace"); }} />}
 */

import { useContext, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    Plus, Archive, Trash2, Copy, Download, ArrowRight,
    TrendingUp, Activity, CheckSquare, Clock, Folder,
    Zap, Target, BarChart2, AlertTriangle, Star,
    GitBranch, Cpu, Hash, RefreshCw, Eye, Rocket,
} from "lucide-react";
import {
    WorkspaceContext,
    TASK_STATUS_COLORS,
    WORKSPACE_PRESETS,
} from "../context/workspaceContext";

// ─── Inject dashboard styles ───────────────────────────────────────────────────
const DB_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@700;800&display=swap');

.db-root {
  font-family: 'JetBrains Mono', monospace;
  background: #050708;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.db-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 3px,
    rgba(57,255,20,0.008) 3px, rgba(57,255,20,0.008) 4px
  );
  pointer-events: none;
  z-index: 0;
}

.db-glow-green { box-shadow: 0 0 24px rgba(57,255,20,0.12); }
.db-glow-cyan  { box-shadow: 0 0 24px rgba(0,245,255,0.10); }

.db-card {
  background: rgba(8,12,10,0.95);
  border: 1px solid rgba(57,255,20,0.1);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.db-card:hover {
  border-color: rgba(57,255,20,0.22);
  box-shadow: 0 0 20px rgba(57,255,20,0.07);
}
.db-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(57,255,20,0.25), transparent);
}

.db-ws-card {
  background: rgba(8,12,10,0.95);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.db-ws-card:hover {
  border-color: rgba(57,255,20,0.2);
  background: rgba(57,255,20,0.025);
  transform: translateY(-1px);
  box-shadow: 0 4px 24px rgba(57,255,20,0.08);
}
.db-ws-card.active {
  border-color: rgba(57,255,20,0.35);
  background: rgba(57,255,20,0.04);
}
.db-ws-card.active::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: #39ff14;
}

.db-stat-num {
  font-family: 'Syne', 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -0.02em;
}

.db-label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(200,255,192,0.3);
}

.db-bar {
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.db-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
}

.db-sparkline {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 28px;
}
.db-sparkline-bar {
  flex: 1;
  border-radius: 1px;
  transition: height 0.4s ease;
  min-height: 3px;
}

.db-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.db-scrollbar::-webkit-scrollbar-track { background: transparent; }
.db-scrollbar::-webkit-scrollbar-thumb { background: rgba(57,255,20,0.12); border-radius: 2px; }

.db-tag {
  font-size: 8px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 2px;
}

@keyframes db-pulse {
  0%,100% { opacity: 1; } 50% { opacity: 0.4; }
}
.db-pulse { animation: db-pulse 2s infinite; }
`;

function injectDBStyles() {
    if (document.getElementById("db-styles")) return;
    const el = document.createElement("style");
    el.id = "db-styles";
    el.textContent = DB_STYLES;
    document.head.appendChild(el);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#39ff14" }) {
    const max = Math.max(...data, 1);
    return (
        <div className="db-sparkline">
            {data.map((v, i) => (
                <div key={i} className="db-sparkline-bar"
                    style={{ height: `${(v / max) * 100}%`, background: i === data.length - 1 ? color : `${color}55` }} />
            ))}
        </div>
    );
}

// ─── Mini Progress Ring ────────────────────────────────────────────────────────
function MiniRing({ pct, size = 36, color = "#39ff14" }) {
    const stroke = 3;
    const r = (size - stroke * 2) / 2;
    const c = 2 * Math.PI * r;
    return (
        <svg width={size} height={size}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
                strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 0.7s ease" }} />
            <text x={size / 2} y={size / 2 + 3} textAnchor="middle" fontSize="8" fontWeight="700"
                fill={color} fontFamily="JetBrains Mono, monospace">{pct}%</text>
        </svg>
    );
}

// ─── Workspace Card ───────────────────────────────────────────────────────────
function WsCard({ ws, isActive, onClick, onDuplicate, onArchive, onDelete, onExport, confirmDel, setConfirmDel, agentRun }) {
    const tasks = ws.tasks || [];
    const done = tasks.filter(t => t.status === "completed").length;
    const inProg = tasks.filter(t => t.status === "in_progress").length;
    const blocked = tasks.filter(t => t.status === "blocked").length;
    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    const outputs = ws.outputs?.length || 0;
    const hasActiveTasks = tasks.some(t => t.status === "in_progress" || t.status === "coming_soon");

    const isAgentRunning = agentRun?.isRunning && agentRun?.workspaceId === ws.id;

    const statusBreakdown = [
        { label: "todo", val: tasks.filter(t => t.status === "coming_soon").length, color: TASK_STATUS_COLORS.coming_soon },
        { label: "doing", val: inProg, color: TASK_STATUS_COLORS.in_progress },
        { label: "done", val: done, color: "#39ff14" },
        { label: "blocked", val: blocked, color: "#ff2d78" },
    ];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={`db-ws-card ${isActive ? "active" : ""}`}
            onClick={onClick}
        >
            {/* Header */}
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{ws.emoji || "🌐"}</span>
                        <div className="min-w-0">
                            <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? "#39ff14" : "rgba(200,255,192,0.85)", letterSpacing: "0.03em", lineHeight: 1.2 }} className="truncate">
                                {ws.name}
                            </p>
                            <p className="db-label" style={{ marginTop: 3 }}>{ws.type}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Agent running indicator */}
                        {isAgentRunning && (
                            <span
                                className="flex items-center gap-1 db-pulse"
                                style={{
                                    fontSize: 8,
                                    fontWeight: 700,
                                    color: "#ff8c00",
                                    background: "rgba(255,140,0,0.1)",
                                    border: "1px solid rgba(255,140,0,0.3)",
                                    padding: "2px 6px",
                                    borderRadius: 2,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                }}
                            >
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff8c00", display: "block" }} />
                                Running
                            </span>
                        )}
                        <MiniRing pct={pct} size={36} color={pct === 100 ? "#39ff14" : pct > 60 ? "#00f5ff" : "rgba(200,255,192,0.4)"} />
                    </div>
                </div>

                {ws.description && (
                    <p style={{ fontSize: 9, color: "rgba(200,255,192,0.3)", marginTop: 6, lineHeight: 1.5, letterSpacing: "0.03em" }} className="line-clamp-2">
                        {ws.description}
                    </p>
                )}
            </div>

            {/* Stats row */}
            <div style={{ padding: "8px 16px", display: "flex", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                {statusBreakdown.map(s => s.val > 0 && (
                    <div key={s.label} className="flex items-center gap-1">
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "block", flexShrink: 0 }} />
                        <span style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>{s.val}</span>
                        <span className="db-label" style={{ fontSize: 7 }}>{s.label}</span>
                    </div>
                ))}
                {outputs > 0 && (
                    <div className="flex items-center gap-1 ml-auto">
                        <span style={{ fontSize: 9, color: "rgba(200,255,192,0.3)" }}>📄 {outputs}</span>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            <div style={{ padding: "6px 16px 8px" }}>
                <div className="db-bar">
                    <div className="db-bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? "#39ff14" : "linear-gradient(90deg, #39ff14, #00f5ff)" }} />
                </div>
            </div>

            {/* Phase + date + agent action */}
            <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="db-tag transition-all hover:bg-cyan-500/20 active:scale-95"
                    style={{ color: "rgba(0,245,255,0.7)", background: "rgba(0,245,255,0.08)", cursor: "pointer" }}>
                    ▶ {ws.currentPhase}
                </span>
                <div className="flex items-center gap-2">
                    {/* Run Agent quick action */}
                    {hasActiveTasks && !isAgentRunning && (
                        <button
                            onClick={e => { e.stopPropagation(); }}
                            style={{
                                padding: "3px 8px",
                                fontSize: 8,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                background: "rgba(255,140,0,0.08)",
                                border: "1px solid rgba(255,140,0,0.2)",
                                color: "#ff8c00",
                                borderRadius: 2,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                transition: "all 0.15s",
                            }}
                            title="Run agent on this workspace"
                        >
                            🚀 Run Agent
                        </button>
                    )}
                    <span style={{ fontSize: 9, color: "rgba(200,255,192,0.2)" }}>
                        {new Date(ws.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                </div>
            </div>

            {/* Action strip — on hover */}
            <div style={{
                borderTop: "1px solid rgba(255,255,255,0.04)",
                padding: "6px 10px",
                display: "flex", gap: 4,
                background: "rgba(0,0,0,0.3)",
            }} onClick={e => e.stopPropagation()}>
                <button onClick={() => onDuplicate(ws.id)} title="Clone"
                    style={{ padding: "4px 8px", fontSize: 9, color: "rgba(200,255,192,0.35)", background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                    <Copy size={8} /> clone
                </button>
                <button onClick={() => onExport(ws.id)} title="Export"
                    style={{ padding: "4px 8px", fontSize: 9, color: "rgba(200,255,192,0.35)", background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                    <Download size={8} /> export
                </button>
                <button onClick={() => onArchive(ws.id)} title="Archive"
                    style={{ padding: "4px 8px", fontSize: 9, color: "rgba(200,255,192,0.35)", background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                    <Archive size={8} /> archive
                </button>
                <button
                    onClick={() => {
                        if (confirmDel === ws.id) { onDelete(ws.id); setConfirmDel(null); }
                        else { setConfirmDel(ws.id); setTimeout(() => setConfirmDel(null), 2500); }
                    }}
                    style={{
                        marginLeft: "auto", padding: "4px 8px", fontSize: 9,
                        color: confirmDel === ws.id ? "#ff2d78" : "rgba(200,255,192,0.25)",
                        background: "none",
                        border: `1px solid ${confirmDel === ws.id ? "rgba(255,45,120,0.3)" : "rgba(255,255,255,0.04)"}`,
                        borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
                    }}>
                    <Trash2 size={8} /> {confirmDel === ws.id ? "confirm" : "delete"}
                </button>
            </div>
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export function WorkspaceDashboard({ onOpenWorkspace }) {
    useEffect(() => { injectDBStyles(); }, []);

    const ctx = useContext(WorkspaceContext);

    const [showCreate, setShowCreate] = useState(false);
    const [confirmDel, setConfirmDel] = useState(null);
    const [showArchived, setShowArch] = useState(false);
    const [filter, setFilter] = useState("all"); // all | active | complete

    const {
        workspaces = [], activeWorkspaceId,
        setActiveWorkspaceId, createWorkspace,
        duplicateWorkspace, deleteWorkspace, archiveWorkspace,
        exportWorkspace,
        agentRun,
    } = ctx || {};

    const active = workspaces.filter(w => !w.isArchived);
    const archived = workspaces.filter(w => w.isArchived);

    // ── Global stats ──────────────────────────────────────────────
    const globalStats = useMemo(() => {
        const allTasks = active.flatMap(w => w.tasks || []);
        const allOutputs = active.flatMap(w => w.outputs || []);
        const done = allTasks.filter(t => t.status === "completed").length;
        const inProg = allTasks.filter(t => t.status === "in_progress").length;
        const blocked = allTasks.filter(t => t.status === "blocked").length;
        const toDo = allTasks.filter(t => t.status === "coming_soon").length;
        return {
            workspaces: active.length,
            tasks: allTasks.length,
            done, inProg, blocked, toDo,
            outputs: allOutputs.length,
            progress: allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0,
            rules: active.reduce((a, w) => a + (w.rules?.length || 0), 0),
        };
    }, [active]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const now = useMemo(() => Date.now(), []);

    // Fake sparkline data (last 7 days completed tasks approximation)
    const sparkData = useMemo(() => {
        const counts = Array(7).fill(0);
        active.flatMap(w => w.tasks || []).forEach(t => {
            if (!t.completedAt) return;
            const daysAgo = Math.floor((now - new Date(t.completedAt)) / 86400000);
            if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
        });
        return counts;
    }, [active, now]);

    if (!ctx) return null;

    const filteredWs = active.filter(w => {
        if (filter === "active") return (w.tasks || []).some(t => t.status === "in_progress");
        if (filter === "complete") return (w.tasks || []).length > 0 && (w.tasks || []).every(t => t.status === "completed");
        return true;
    });

    const openWorkspace = (id) => {
        setActiveWorkspaceId(id);
        if (onOpenWorkspace) onOpenWorkspace(id);
    };

    return (
        <div className="db-root db-scrollbar" style={{ position: "relative", zIndex: 1, overflowY: "auto", minHeight: "100vh" }}>

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <div style={{
                borderBottom: "1px solid rgba(57,255,20,0.1)",
                background: "rgba(5,7,8,0.98)",
                padding: "0 28px",
                height: 52,
                display: "flex", alignItems: "center", gap: 20,
                position: "sticky", top: 0, zIndex: 10,
            }}>
                <div className="flex items-center gap-2">
                    <BarChart2 size={14} style={{ color: "#00f5ff" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#00f5ff", letterSpacing: "0.18em", textTransform: "uppercase" }}>
                        Dashboard
                    </span>
                </div>

                <div style={{ flex: 1 }} />

                {/* Filters */}
                <div className="flex items-center gap-1.5">
                    {["all", "active", "complete"].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            style={{
                                padding: "4px 12px", fontSize: 9, fontWeight: 700,
                                letterSpacing: "0.12em", textTransform: "uppercase",
                                background: filter === f ? "rgba(57,255,20,0.1)" : "transparent",
                                border: `1px solid ${filter === f ? "rgba(57,255,20,0.35)" : "rgba(255,255,255,0.07)"}`,
                                color: filter === f ? "#39ff14" : "rgba(200,255,192,0.4)",
                                borderRadius: 3, cursor: "pointer", transition: "all 0.15s",
                            }}>
                            {f}
                        </button>
                    ))}
                </div>

                <button onClick={() => setShowCreate(p => !p)}
                    style={{
                        padding: "6px 14px", fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.4)",
                        color: "#39ff14", borderRadius: 3, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                    }}>
                    <Plus size={10} /> new workspace
                </button>
            </div>

            <div style={{ padding: "24px 28px", width: "100%" }}>

                {/* ── GLOBAL STAT CARDS ────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}
                >
                    {[
                        { icon: Folder, label: "Workspaces", val: globalStats.workspaces, color: "#00f5ff", sub: `${archived.length} archived` },
                        { icon: CheckSquare, label: "Total Tasks", val: globalStats.tasks, color: "#39ff14", sub: `${globalStats.done} done` },
                        { icon: Activity, label: "In Progress", val: globalStats.inProg, color: "#ffd700", sub: `${globalStats.toDo} to do` },
                        { icon: AlertTriangle, label: "Blocked", val: globalStats.blocked, color: "#ff2d78", sub: "need attention" },
                        { icon: BarChart2, label: "Completion", val: `${globalStats.progress}%`, color: "#39ff14", sub: "all workspaces", isPercent: true },
                        { icon: Zap, label: "Outputs", val: globalStats.outputs, color: "#00f5ff", sub: "saved files" },
                        { icon: Cpu, label: "Agent Runs", val: 0, color: "#ff8c00", sub: "total orchestrated" },
                    ].map((s, i) => (
                        <motion.div key={s.label} className="db-card"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            style={{ padding: "14px 16px" }}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <s.icon size={13} style={{ color: s.color, opacity: 0.7 }} />
                                {s.label === "In Progress" && globalStats.inProg > 0 && (
                                    <span className="db-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffd700", display: "block" }} />
                                )}
                                {s.label === "Agent Runs" && agentRun?.isRunning && (
                                    <span className="db-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff8c00", display: "block" }} />
                                )}
                            </div>
                            <p className="db-stat-num" style={{ color: s.color }}>{s.val}</p>
                            <p className="db-label" style={{ marginTop: 4 }}>{s.label}</p>
                            {s.sub && <p style={{ fontSize: 8, color: "rgba(200,255,192,0.2)", marginTop: 2 }}>{s.sub}</p>}
                            {s.label === "Completion" && (
                                <div className="db-bar" style={{ marginTop: 8 }}>
                                    <div className="db-bar-fill" style={{ width: `${globalStats.progress}%`, background: "linear-gradient(90deg, #39ff14, #00f5ff)" }} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── ACTIVITY ROW ─────────────────────────────────────── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginBottom: 24 }}>
                    {/* Sparkline */}
                    <div className="db-card" style={{ padding: "16px 18px" }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="db-label">tasks completed — last 7 days</p>
                            <TrendingUp size={11} style={{ color: "rgba(200,255,192,0.3)" }} />
                        </div>
                        <Sparkline data={sparkData} color="#39ff14" />
                        <div className="flex justify-between mt-2">
                            {["7d ago", "6d", "5d", "4d", "3d", "2d", "today"].map(d => (
                                <span key={d} style={{ fontSize: 7, color: "rgba(200,255,192,0.15)" }}>{d}</span>
                            ))}
                        </div>
                    </div>

                    {/* Task breakdown */}
                    <div className="db-card" style={{ padding: "16px 18px" }}>
                        <p className="db-label" style={{ marginBottom: 12 }}>global task breakdown</p>
                        {[
                            { l: "To Do", v: globalStats.toDo, c: TASK_STATUS_COLORS.coming_soon, total: globalStats.tasks },
                            { l: "In Progress", v: globalStats.inProg, c: TASK_STATUS_COLORS.in_progress, total: globalStats.tasks },
                            { l: "Done", v: globalStats.done, c: "#39ff14", total: globalStats.tasks },
                            { l: "Blocked", v: globalStats.blocked, c: "#ff2d78", total: globalStats.tasks },
                        ].map(s => (
                            <div key={s.l} style={{ marginBottom: 7 }}>
                                <div className="flex items-center justify-between mb-1">
                                    <span style={{ fontSize: 9, color: s.c }}>{s.l}</span>
                                    <span style={{ fontSize: 9, color: "rgba(200,255,192,0.4)" }}>{s.v} / {s.total}</span>
                                </div>
                                <div className="db-bar">
                                    <div className="db-bar-fill" style={{ width: s.total > 0 ? `${(s.v / s.total) * 100}%` : "0%", background: s.c }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CREATE FORM ───────────────────────────────────────── */}
                <AnimatePresence>
                    {showCreate && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                            style={{ marginBottom: 20 }}
                        >
                            <div className="db-card" style={{ padding: 20 }}>
                                <p style={{ fontSize: 9, color: "#00f5ff", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>// NEW WORKSPACE</p>
                                <NewWorkspaceInlineForm
                                    onSave={data => { createWorkspace(data); setShowCreate(false); }}
                                    onCancel={() => setShowCreate(false)}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── WORKSPACE GRID ───────────────────────────────────── */}
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p className="db-label">{filteredWs.length} workspace{filteredWs.length !== 1 ? "s" : ""}</p>
                    {active.length > 0 && (
                        <p style={{ fontSize: 9, color: "rgba(200,255,192,0.2)" }}>
                            {globalStats.progress}% overall complete · {globalStats.rules} agent rules
                        </p>
                    )}
                </div>

                <AnimatePresence>
                    {filteredWs.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ padding: "60px 0", textAlign: "center" }}>
                            <p style={{ fontSize: 11, color: "rgba(200,255,192,0.2)", letterSpacing: "0.15em" }}>
                                {filter !== "all" ? `no ${filter} workspaces` : "no workspaces yet"}
                            </p>
                            {filter === "all" && (
                                <button onClick={() => setShowCreate(true)}
                                    style={{
                                        marginTop: 16, padding: "8px 18px", fontSize: 10,
                                        background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.3)",
                                        color: "#39ff14", borderRadius: 3, cursor: "pointer", letterSpacing: "0.12em",
                                    }}>
                                    + create first workspace
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div layout style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                            {filteredWs.map(w => (
                                <WsCard
                                    key={w.id}
                                    ws={w}
                                    isActive={w.id === activeWorkspaceId}
                                    onClick={() => openWorkspace(w.id)}
                                    onDuplicate={duplicateWorkspace}
                                    onArchive={archiveWorkspace}
                                    onDelete={deleteWorkspace}
                                    onExport={exportWorkspace}
                                    confirmDel={confirmDel}
                                    setConfirmDel={setConfirmDel}
                                    agentRun={agentRun}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── ARCHIVED ─────────────────────────────────────────── */}
                {archived.length > 0 && (
                    <div style={{ marginTop: 32 }}>
                        <button onClick={() => setShowArch(p => !p)}
                            className="flex items-center gap-2"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 12 }}>
                            <Archive size={10} style={{ color: "rgba(200,255,192,0.25)" }} />
                            <span className="db-label">archived ({archived.length})</span>
                            <span style={{ fontSize: 9, color: "rgba(200,255,192,0.2)", marginLeft: 4 }}>{showArchived ? "▲" : "▼"}</span>
                        </button>
                        <AnimatePresence>
                            {showArchived && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                                    {archived.map(w => (
                                        <div key={w.id} className="db-ws-card" style={{ opacity: 0.45 }}>
                                            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ fontSize: 15 }}>{w.emoji || "🌐"}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p style={{ fontSize: 11, color: "rgba(200,255,192,0.6)", fontWeight: 700 }} className="truncate">{w.name}</p>
                                                    <p className="db-label" style={{ marginTop: 2 }}>{w.type}</p>
                                                </div>
                                                <button onClick={() => archiveWorkspace(w.id)}
                                                    style={{ padding: "4px 8px", fontSize: 9, color: "#00f5ff", background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 3, cursor: "pointer" }}>
                                                    <RefreshCw size={9} /> unarchive
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                <div style={{ height: 40 }} />
            </div>
        </div>
    );
}

// ─── Inline create form (inside dashboard) ────────────────────────────────────
function NewWorkspaceInlineForm({ onSave, onCancel }) {
    const [name, setName] = useState("");
    const [type, setType] = useState("General");
    const [emoji, setEmoji] = useState("🌐");

    const preset = WORKSPACE_PRESETS[type] || WORKSPACE_PRESETS.General;
    const isValid = name.trim().length > 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(WORKSPACE_PRESETS).map(([t, { emoji: e }]) => (
                    <button key={t} onClick={() => { setType(t); setEmoji(e); }}
                        style={{
                            padding: "4px 10px", fontSize: 9, fontWeight: 700,
                            background: type === t ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${type === t ? "rgba(57,255,20,0.35)" : "rgba(255,255,255,0.07)"}`,
                            color: type === t ? "#39ff14" : "rgba(200,255,192,0.4)",
                            borderRadius: 3, cursor: "pointer", transition: "all 0.15s",
                            letterSpacing: "0.1em", textTransform: "uppercase",
                        }}>
                        {e} {t}
                    </button>
                ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <input
                    style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(200,255,192,0.9)", fontFamily: "JetBrains Mono, monospace",
                        fontSize: 11, padding: "8px 12px", borderRadius: 3, outline: "none", flex: 1,
                        transition: "border-color 0.15s",
                    }}
                    placeholder="workspace name…"
                    value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && isValid && onSave({ name, type, emoji, phases: preset.defaultPhases })}
                    onFocus={e => e.target.style.borderColor = "rgba(57,255,20,0.4)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                <button onClick={() => isValid && onSave({ name, type, emoji, phases: preset.defaultPhases })}
                    disabled={!isValid}
                    style={{
                        padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
                        textTransform: "uppercase", background: isValid ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isValid ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.06)"}`,
                        color: isValid ? "#39ff14" : "rgba(200,255,192,0.2)", borderRadius: 3,
                        cursor: isValid ? "pointer" : "not-allowed", transition: "all 0.15s",
                    }}>
                    create
                </button>
                <button onClick={onCancel}
                    style={{
                        padding: "8px 12px", fontSize: 10, background: "transparent",
                        border: "1px solid rgba(255,255,255,0.07)", color: "rgba(200,255,192,0.4)",
                        borderRadius: 3, cursor: "pointer",
                    }}>
                    cancel
                </button>
            </div>
        </div>
    );
}