/**
 * WorkspaceDashboard.jsx
 * High-level overview dashboard showing all workspaces and global stats.
 *
 * Design: "Clean Surface, Powerful Underneath"
 * - Spacious, breathing layout with refined dark palette
 * - No phase references — workspaces speak through type badges and progress
 * - Agent is powerful but hidden from the card surface
 *
 * Usage:
 *   import { WorkspaceDashboard } from "./WorkspaceDashboard";
 *   {currentPage === "dashboard" && <WorkspaceDashboard onOpenWorkspace={(id) => { setActiveWs(id); setPage("workspace"); }} />}
 */

import { useContext, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    Plus, Archive, Trash2, Copy, Download,
    TrendingUp, CheckSquare, Clock, Folder,
    BarChart2, AlertCircle, RefreshCw, LayoutGrid,
} from "lucide-react";
import {
    WorkspaceContext,
    TASK_STATUS_COLORS,
    WORKSPACE_PRESETS,
} from "../context/workspaceContext";

// ─── Inject dashboard styles ───────────────────────────────────────────────────
const DB_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@700;800&display=swap');

.db-root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0a0c0f;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.db-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(57,255,20,0.02) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 100%, rgba(0,200,255,0.015) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* ── Cards ─────────────────────────────────────────────────────── */
.db-card {
  background: rgba(14,17,22,0.95);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
}
.db-card:hover {
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.db-ws-card {
  background: rgba(14,17,22,0.95);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.db-ws-card:hover {
  border-color: rgba(255,255,255,0.12);
  background: rgba(20,24,32,0.98);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
}
.db-ws-card.active {
  border-color: rgba(57,255,20,0.3);
  background: rgba(57,255,20,0.03);
}
.db-ws-card.active::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #39ff14, #00c8ff);
  border-radius: 0 1px 1px 0;
}

/* ── Typography ────────────────────────────────────────────────── */
.db-stat-num {
  font-family: 'Syne', 'Inter', sans-serif;
  font-weight: 800;
  font-size: 32px;
  line-height: 1;
  letter-spacing: -0.03em;
}

.db-heading {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.db-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgba(180,195,210,0.5);
}

.db-label-sm {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(180,195,210,0.3);
}

/* ── Type badge ────────────────────────────────────────────────── */
.db-type-badge {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: capitalize;
  padding: 2px 8px;
  border-radius: 6px;
  color: rgba(160,185,210,0.6);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}

/* ── Bars ──────────────────────────────────────────────────────── */
.db-bar {
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
  overflow: hidden;
}
.db-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
}

/* ── Sparkline ─────────────────────────────────────────────────── */
.db-sparkline {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 36px;
}
.db-sparkline-bar {
  flex: 1;
  border-radius: 2px;
  transition: height 0.4s ease;
  min-height: 3px;
}

/* ── Scrollbar ─────────────────────────────────────────────────── */
.db-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.db-scrollbar::-webkit-scrollbar-track { background: transparent; }
.db-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
.db-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

/* ── Action buttons (card footer) ──────────────────────────────── */
.db-action-btn {
  padding: 5px 10px;
  font-size: 10px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  color: rgba(180,195,210,0.35);
  background: transparent;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s ease;
}
.db-action-btn:hover {
  color: rgba(200,215,230,0.7);
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.1);
}

/* ── Filter pill ───────────────────────────────────────────────── */
.db-filter-btn {
  padding: 5px 14px;
  font-size: 11px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  letter-spacing: 0.02em;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(180,195,210,0.4);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.db-filter-btn:hover {
  border-color: rgba(255,255,255,0.12);
  color: rgba(180,195,210,0.6);
}
.db-filter-btn.active {
  background: rgba(57,255,20,0.08);
  border-color: rgba(57,255,20,0.25);
  color: rgba(57,255,20,0.9);
}

/* ── Status dots ───────────────────────────────────────────────── */
.db-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
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
                    style={{
                        height: `${(v / max) * 100}%`,
                        background: i === data.length - 1
                            ? color
                            : `${color}40`,
                        borderRadius: 2,
                    }} />
            ))}
        </div>
    );
}

// ─── Mini Progress Ring ────────────────────────────────────────────────────────
function MiniRing({ pct, size = 38, color = "#39ff14" }) {
    const stroke = 3;
    const r = (size - stroke * 2) / 2;
    const c = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
                strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 0.7s ease" }} />
            <text x={size / 2} y={size / 2 + 3} textAnchor="middle" fontSize="9" fontWeight="600"
                fill={color} fontFamily="Inter, sans-serif">{pct}%</text>
        </svg>
    );
}

// ─── Workspace Card ───────────────────────────────────────────────────────────
function WsCard({ ws, isActive, onClick, onDuplicate, onArchive, onDelete, onExport, confirmDel, setConfirmDel }) {
    const tasks = ws.tasks || [];
    const done = tasks.filter(t => t.status === "completed").length;
    const inProg = tasks.filter(t => t.status === "in_progress").length;
    const blocked = tasks.filter(t => t.status === "blocked").length;
    const toDo = tasks.filter(t => t.status === "coming_soon").length;
    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    const outputs = ws.outputs?.length || 0;

    const statusBreakdown = [
        { label: "to do", val: toDo, color: TASK_STATUS_COLORS.coming_soon },
        { label: "active", val: inProg, color: TASK_STATUS_COLORS.in_progress },
        { label: "done", val: done, color: "#39ff14" },
        { label: "blocked", val: blocked, color: "#ff2d78" },
    ].filter(s => s.val > 0);

    const ringColor = pct === 100 ? "#39ff14" : pct > 60 ? "#00c8ff" : "rgba(180,195,210,0.35)";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={`db-ws-card ${isActive ? "active" : ""}`}
            onClick={onClick}
        >
            {/* Header */}
            <div style={{ padding: "18px 20px 14px" }}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{ws.emoji || "🌐"}</span>
                        <div className="min-w-0">
                            <p className="db-heading truncate"
                                style={{
                                    fontSize: 14,
                                    color: isActive ? "#39ff14" : "rgba(220,230,240,0.9)",
                                    lineHeight: 1.3,
                                }}>
                                {ws.name}
                            </p>
                            <span className="db-type-badge" style={{ marginTop: 6, display: "inline-block" }}>
                                {ws.type}
                            </span>
                        </div>
                    </div>
                    <MiniRing pct={pct} size={38} color={ringColor} />
                </div>

                {ws.description && (
                    <p style={{
                        fontSize: 11,
                        color: "rgba(180,195,210,0.35)",
                        marginTop: 10,
                        lineHeight: 1.6,
                    }} className="line-clamp-2">
                        {ws.description}
                    </p>
                )}
            </div>

            {/* Status breakdown dots */}
            {statusBreakdown.length > 0 && (
                <div style={{
                    padding: "0 20px 12px",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                }}>
                    {statusBreakdown.map(s => (
                        <div key={s.label} className="flex items-center gap-1.5">
                            <span className="db-status-dot" style={{ background: s.color }} />
                            <span style={{ fontSize: 10, color: s.color, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                                {s.val}
                            </span>
                            <span style={{ fontSize: 9, color: "rgba(180,195,210,0.25)", fontFamily: "'Inter', sans-serif" }}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                    {outputs > 0 && (
                        <span style={{
                            fontSize: 10,
                            color: "rgba(180,195,210,0.25)",
                            marginLeft: "auto",
                            fontFamily: "'Inter', sans-serif",
                        }}>
                            📄 {outputs}
                        </span>
                    )}
                </div>
            )}

            {/* Progress bar */}
            <div style={{ padding: "0 20px 14px" }}>
                <div className="db-bar">
                    <div className="db-bar-fill"
                        style={{
                            width: `${pct}%`,
                            background: pct === 100
                                ? "#39ff14"
                                : "linear-gradient(90deg, rgba(57,255,20,0.6), rgba(0,200,255,0.6))",
                        }} />
                </div>
            </div>

            {/* Date */}
            <div style={{
                padding: "0 20px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                <span style={{
                    fontSize: 10,
                    color: "rgba(180,195,210,0.2)",
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {new Date(ws.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {tasks.length > 0 && (
                    <span style={{ fontSize: 10, color: "rgba(180,195,210,0.2)" }}>
                        {done}/{tasks.length} tasks
                    </span>
                )}
            </div>

            {/* Action strip */}
            <div style={{
                borderTop: "1px solid rgba(255,255,255,0.04)",
                padding: "8px 14px",
                display: "flex",
                gap: 6,
                background: "rgba(0,0,0,0.15)",
            }} onClick={e => e.stopPropagation()}>
                <button className="db-action-btn" onClick={() => onDuplicate(ws.id)} title="Clone">
                    <Copy size={10} /> Clone
                </button>
                <button className="db-action-btn" onClick={() => onExport(ws.id)} title="Export">
                    <Download size={10} /> Export
                </button>
                <button className="db-action-btn" onClick={() => onArchive(ws.id)} title="Archive">
                    <Archive size={10} /> Archive
                </button>
                <button
                    className="db-action-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                        if (confirmDel === ws.id) { onDelete(ws.id); setConfirmDel(null); }
                        else { setConfirmDel(ws.id); setTimeout(() => setConfirmDel(null), 2500); }
                    }}
                >
                    <Trash2 size={10} style={{ color: confirmDel === ws.id ? "#ff2d78" : undefined }} />
                    <span style={{ color: confirmDel === ws.id ? "#ff2d78" : undefined }}>
                        {confirmDel === ws.id ? "Confirm" : "Delete"}
                    </span>
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
    const [filter, setFilter] = useState("all");

    const {
        workspaces = [],
        activeWorkspaceId,
        setActiveWorkspaceId,
        createWorkspace,
        duplicateWorkspace,
        deleteWorkspace,
        archiveWorkspace,
        exportWorkspace,
    } = ctx || {};

    const active = workspaces.filter(w => !w.isArchived);
    const archived = workspaces.filter(w => w.isArchived);

    // ── Global stats ──────────────────────────────────────────────
    const globalStats = useMemo(() => {
        const allTasks = active.flatMap(w => w.tasks || []);
        const done = allTasks.filter(t => t.status === "completed").length;
        const inProg = allTasks.filter(t => t.status === "in_progress").length;
        return {
            workspaces: active.length,
            tasks: allTasks.length,
            done,
            inProg,
            progress: allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0,
        };
    }, [active]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const now = useMemo(() => Date.now(), []);

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
        if (filter === "complete") {
            const t = w.tasks || [];
            return t.length > 0 && t.every(tk => tk.status === "completed");
        }
        return true;
    });

    const openWorkspace = (id) => {
        setActiveWorkspaceId(id);
        if (onOpenWorkspace) onOpenWorkspace(id);
    };

    return (
        <div className="db-root db-scrollbar  " style={{ position: "relative", zIndex: 1, overflowY: "auto", minHeight: "100vh" }}>

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <div style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(10,12,15,0.92)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                padding: "0 32px",
                height: 60,
                display: "flex",
                alignItems: "center",
                gap: 24,
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}>
                <div className="flex items-center gap-3">
                    <LayoutGrid size={16} style={{ color: "rgba(57,255,20,0.6)" }} />
                    <span style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "rgba(220,230,240,0.9)",
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: "-0.02em",
                    }}>
                        Dashboard
                    </span>
                </div>

                <div style={{ flex: 1 }} />

                {/* Filters */}
                <div className="flex items-center gap-2">
                    {["all", "active", "complete"].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`db-filter-btn ${filter === f ? "active" : ""}`}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <button onClick={() => setShowCreate(p => !p)}
                    style={{
                        padding: "7px 18px",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                        background: "rgba(57,255,20,0.1)",
                        border: "1px solid rgba(57,255,20,0.3)",
                        color: "#39ff14",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        transition: "all 0.2s ease",
                    }}>
                    <Plus size={14} />
                    New Workspace
                </button>
            </div>

            <div style={{ padding: "28px 32px", width: "100%", maxWidth: 1400, margin: "0 auto" }}>

                {/* ── GLOBAL STAT CARDS (4) ────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 16,
                        marginBottom: 28,
                    }}
                >
                    {/* Workspaces */}
                    <motion.div
                        className="db-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        style={{ padding: "20px 22px" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <Folder size={16} style={{ color: "rgba(0,200,255,0.5)" }} />
                            <span className="db-label-sm">{archived.length} archived</span>
                        </div>
                        <p className="db-stat-num" style={{ color: "rgba(0,200,255,0.85)" }}>
                            {globalStats.workspaces}
                        </p>
                        <p className="db-label" style={{ marginTop: 6 }}>Workspaces</p>
                    </motion.div>

                    {/* Tasks */}
                    <motion.div
                        className="db-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{ padding: "20px 22px" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <CheckSquare size={16} style={{ color: "rgba(57,255,20,0.5)" }} />
                            <span className="db-label-sm">{globalStats.done} done</span>
                        </div>
                        <p className="db-stat-num" style={{ color: "rgba(57,255,20,0.85)" }}>
                            {globalStats.tasks}
                        </p>
                        <p className="db-label" style={{ marginTop: 6 }}>Tasks</p>
                    </motion.div>

                    {/* In Progress */}
                    <motion.div
                        className="db-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        style={{ padding: "20px 22px" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <Clock size={16} style={{ color: "rgba(255,215,0,0.5)" }} />
                            {globalStats.inProg > 0 && (
                                <span className="db-pulse" style={{
                                    width: 7, height: 7, borderRadius: "50%",
                                    background: "#ffd700", display: "block",
                                }} />
                            )}
                        </div>
                        <p className="db-stat-num" style={{ color: "rgba(255,215,0,0.85)" }}>
                            {globalStats.inProg}
                        </p>
                        <p className="db-label" style={{ marginTop: 6 }}>In Progress</p>
                    </motion.div>

                    {/* Completion */}
                    <motion.div
                        className="db-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{ padding: "20px 22px" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <TrendingUp size={16} style={{ color: "rgba(57,255,20,0.5)" }} />
                            <span className="db-label-sm">overall</span>
                        </div>
                        <p className="db-stat-num" style={{ color: "rgba(220,230,240,0.85)" }}>
                            {globalStats.progress}<span style={{ fontSize: 18, color: "rgba(180,195,210,0.3)" }}>%</span>
                        </p>
                        <p className="db-label" style={{ marginTop: 6 }}>Completion</p>
                        <div className="db-bar" style={{ marginTop: 10 }}>
                            <div className="db-bar-fill"
                                style={{
                                    width: `${globalStats.progress}%`,
                                    background: "linear-gradient(90deg, rgba(57,255,20,0.7), rgba(0,200,255,0.7))",
                                }} />
                        </div>
                    </motion.div>
                </motion.div>

                {/* ── ACTIVITY ROW ─────────────────────────────────────── */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 28,
                }}>
                    {/* Sparkline */}
                    <div className="db-card" style={{ padding: "20px 22px" }}>
                        <div className="flex items-center justify-between mb-4">
                            <p className="db-label" style={{ fontSize: 12, color: "rgba(180,195,210,0.5)" }}>
                                Completed — last 7 days
                            </p>
                            <TrendingUp size={13} style={{ color: "rgba(180,195,210,0.2)" }} />
                        </div>
                        <Sparkline data={sparkData} color="#39ff14" />
                        <div className="flex justify-between mt-3">
                            {["7d ago", "", "5d", "", "3d", "", "today"].map((d, i) => (
                                <span key={i} style={{
                                    fontSize: 9,
                                    color: "rgba(180,195,210,0.15)",
                                    fontFamily: "'Inter', sans-serif",
                                }}>
                                    {d}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Task breakdown */}
                    <div className="db-card" style={{ padding: "20px 22px" }}>
                        <p className="db-label" style={{ fontSize: 12, color: "rgba(180,195,210,0.5)", marginBottom: 16 }}>
                            Task Breakdown
                        </p>
                        {[
                            { l: "To Do", v: globalStats.tasks - globalStats.done - globalStats.inProg, c: TASK_STATUS_COLORS.coming_soon, total: globalStats.tasks },
                            { l: "In Progress", v: globalStats.inProg, c: TASK_STATUS_COLORS.in_progress, total: globalStats.tasks },
                            { l: "Done", v: globalStats.done, c: "#39ff14", total: globalStats.tasks },
                        ].map(s => (
                            <div key={s.l} style={{ marginBottom: 10 }}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span style={{ fontSize: 11, color: "rgba(220,230,240,0.5)", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                                        {s.l}
                                    </span>
                                    <span style={{ fontSize: 11, color: "rgba(180,195,210,0.3)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                                        {s.v}{s.total > 0 ? ` / ${s.total}` : ""}
                                    </span>
                                </div>
                                <div className="db-bar">
                                    <div className="db-bar-fill"
                                        style={{
                                            width: s.total > 0 ? `${(s.v / s.total) * 100}%` : "0%",
                                            background: s.c,
                                        }} />
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
                            style={{ marginBottom: 24 }}
                        >
                            <div className="db-card" style={{ padding: 24 }}>
                                <p style={{
                                    fontSize: 11,
                                    color: "rgba(57,255,20,0.6)",
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontWeight: 600,
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                    marginBottom: 16,
                                }}>
                                    // New Workspace
                                </p>
                                <NewWorkspaceInlineForm
                                    onSave={data => { createWorkspace(data); setShowCreate(false); }}
                                    onCancel={() => setShowCreate(false)}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── WORKSPACE GRID ───────────────────────────────────── */}
                <div style={{
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <p style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "rgba(220,230,240,0.4)",
                        fontFamily: "'Inter', sans-serif",
                    }}>
                        {filteredWs.length} workspace{filteredWs.length !== 1 ? "s" : ""}
                    </p>
                    {active.length > 0 && (
                        <p style={{
                            fontSize: 11,
                            color: "rgba(180,195,210,0.2)",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            {globalStats.progress}% complete
                        </p>
                    )}
                </div>

                <AnimatePresence>
                    {filteredWs.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ padding: "80px 0", textAlign: "center" }}>
                            <p style={{
                                fontSize: 13,
                                color: "rgba(180,195,210,0.2)",
                                fontFamily: "'Inter', sans-serif",
                                letterSpacing: "0.01em",
                            }}>
                                {filter !== "all"
                                    ? `No ${filter} workspaces`
                                    : "No workspaces yet"}
                            </p>
                            {filter === "all" && (
                                <button onClick={() => setShowCreate(true)}
                                    style={{
                                        marginTop: 20,
                                        padding: "10px 22px",
                                        fontSize: 12,
                                        fontWeight: 500,
                                        fontFamily: "'Inter', sans-serif",
                                        background: "rgba(57,255,20,0.08)",
                                        border: "1px solid rgba(57,255,20,0.25)",
                                        color: "#39ff14",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                    }}>
                                    + Create your first workspace
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div layout style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                            gap: 16,
                        }}>
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
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── ARCHIVED ─────────────────────────────────────────── */}
                {archived.length > 0 && (
                    <div style={{ marginTop: 40 }}>
                        <button onClick={() => setShowArch(p => !p)}
                            className="flex items-center gap-2"
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "6px 0",
                                marginBottom: 14,
                            }}>
                            <Archive size={12} style={{ color: "rgba(180,195,210,0.25)" }} />
                            <span className="db-label">Archived ({archived.length})</span>
                            <span style={{
                                fontSize: 10,
                                color: "rgba(180,195,210,0.2)",
                                marginLeft: 4,
                            }}>
                                {showArchived ? "▲" : "▼"}
                            </span>
                        </button>
                        <AnimatePresence>
                            {showArchived && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                        gap: 14,
                                    }}>
                                    {archived.map(w => (
                                        <div key={w.id} className="db-ws-card" style={{ opacity: 0.4 }}>
                                            <div style={{
                                                padding: "16px 20px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                            }}>
                                                <span style={{ fontSize: 18 }}>{w.emoji || "🌐"}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p style={{
                                                        fontSize: 13,
                                                        color: "rgba(180,195,210,0.5)",
                                                        fontWeight: 600,
                                                        fontFamily: "'Inter', sans-serif",
                                                    }} className="truncate">
                                                        {w.name}
                                                    </p>
                                                    <span className="db-type-badge" style={{ marginTop: 4, display: "inline-block" }}>
                                                        {w.type}
                                                    </span>
                                                </div>
                                                <button onClick={() => archiveWorkspace(w.id)}
                                                    className="db-action-btn">
                                                    <RefreshCw size={10} /> Restore
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                <div style={{ height: 60 }} />
            </div>
        </div>
    );
}

// ─── Inline create form ──────────────────────────────────────────────────────
function NewWorkspaceInlineForm({ onSave, onCancel }) {
    const [name, setName] = useState("");
    const [type, setType] = useState("General");
    const [emoji, setEmoji] = useState("🌐");

    const isValid = name.trim().length > 0;

    const handleSave = () => {
        if (!isValid) return;
        onSave({ name: name.trim(), type, emoji });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Type presets */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(WORKSPACE_PRESETS).map(([t, { emoji: e }]) => (
                    <button key={t} onClick={() => { setType(t); setEmoji(e); }}
                        style={{
                            padding: "5px 14px",
                            fontSize: 11,
                            fontWeight: 500,
                            fontFamily: "'Inter', sans-serif",
                            background: type === t ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${type === t ? "rgba(57,255,20,0.3)" : "rgba(255,255,255,0.06)"}`,
                            color: type === t ? "rgba(57,255,20,0.9)" : "rgba(180,195,210,0.4)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                        }}>
                        {e} {t}
                    </button>
                ))}
            </div>
            {/* Name input + actions */}
            <div style={{ display: "flex", gap: 10 }}>
                <input
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(220,230,240,0.9)",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        padding: "10px 14px",
                        borderRadius: "8px",
                        outline: "none",
                        flex: 1,
                        transition: "border-color 0.2s ease",
                    }}
                    placeholder="Workspace name..."
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                    onFocus={e => e.target.style.borderColor = "rgba(57,255,20,0.4)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                <button onClick={handleSave}
                    disabled={!isValid}
                    style={{
                        padding: "10px 20px",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                        background: isValid ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isValid ? "rgba(57,255,20,0.35)" : "rgba(255,255,255,0.06)"}`,
                        color: isValid ? "#39ff14" : "rgba(180,195,210,0.2)",
                        borderRadius: "8px",
                        cursor: isValid ? "pointer" : "not-allowed",
                        transition: "all 0.2s ease",
                    }}>
                    Create
                </button>
                <button onClick={onCancel}
                    style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: "'Inter', sans-serif",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "rgba(180,195,210,0.4)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                    }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
