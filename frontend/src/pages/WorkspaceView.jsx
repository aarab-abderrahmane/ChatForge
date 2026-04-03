/**
 * WorkspaceView.jsx
 * Full-page workspace view. Use as a "page" in your router/tab system.
 * 
 * Usage in your main layout:
 *   import { WorkspaceView } from "./WorkspaceView";
 *   {currentPage === "workspace" && <WorkspaceView onBack={() => setPage("chat")} />}
 */

import { useContext, useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    ArrowLeft, Plus, Trash2, Check, X, Pencil, ChevronDown,
    Archive, Copy, Download, Upload, Clock, Layers, Flag,
    FileText, BarChart2, ListTodo, Folder, Zap, StickyNote,
    RotateCcw, CheckSquare, Square, ArrowRight, RefreshCw,
    AlertTriangle, Play, Pause, Target, TrendingUp, Activity,
    Search, Filter, MoreHorizontal, Star, Eye, EyeOff,
    ChevronRight, ChevronUp, Hash, Cpu, GitBranch, SquareTerminal,
    StopCircle, Timer,
} from "lucide-react";
import {
    WorkspaceContext,
    TASK_STATUS_LABELS,
    TASK_STATUS_COLORS,
    TASK_PRIORITY_COLORS,
    WORKSPACE_PRESETS,
} from "../context/workspaceContext";
import { api } from "../services/api";
import { chatsContext } from "../context/chatsContext";

// ─── Agent Config ───────────────────────────────────────────────────────────────
const AGENT_CONFIG = {
    architect: { color: "#ff8c00", bg: "rgba(255,140,0,0.12)", icon: "\u{1F9E0}", label: "Architect" },
    coder: { color: "#39ff14", bg: "rgba(57,255,20,0.12)", icon: "\u2328\uFE0F", label: "Coder" },
    researcher: { color: "#00f5ff", bg: "rgba(0,245,255,0.12)", icon: "\u{1F50D}", label: "Researcher" },
    reflector: { color: "#a855f7", bg: "rgba(168,85,247,0.12)", icon: "\u{1FA9E}", label: "Reflector" },
};

const CONSOLE_TYPE_COLORS = {
    info: "rgba(200,255,192,0.35)",
    agent_start: "#00f5ff",
    action: "#39ff14",
    error: "#ff2d78",
    done: "#ffd700",
    agent_stream: "rgba(200,255,192,0.55)",
    system: "rgba(200,255,192,0.25)",
};

// ─── CSS injected once ────────────────────────────────────────────────────────
const WS_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;700;800&display=swap');

.ws-root {
  font-family: 'JetBrains Mono', monospace;
  background: #0a0c0f;
  color: rgba(200,255,192,0.85);
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.ws-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(57,255,20,0.008) 3px,
    rgba(57,255,20,0.008) 6px
  );
  pointer-events: none;
  z-index: 0;
}

.ws-root::after {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 40% at 20% 10%, rgba(57,255,20,0.035) 0%, transparent 60%),
    radial-gradient(ellipse 40% 50% at 80% 80%, rgba(0,245,255,0.025) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

.ws-panel {
  background: rgba(12,16,14,0.95);
  border: 1px solid rgba(57,255,20,0.1);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.ws-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(57,255,20,0.3), transparent);
}

.ws-btn-primary {
  background: rgba(57,255,20,0.08);
  border: 1px solid rgba(57,255,20,0.3);
  color: #39ff14;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 7px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.25s ease;
}
.ws-btn-primary:hover {
  background: rgba(57,255,20,0.15);
  box-shadow: 0 0 20px rgba(57,255,20,0.15);
  border-color: rgba(57,255,20,0.5);
}

.ws-btn-ghost {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(200,255,192,0.4);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.25s ease;
}
.ws-btn-ghost:hover {
  border-color: rgba(200,255,192,0.18);
  color: rgba(200,255,192,0.7);
  background: rgba(255,255,255,0.03);
}

.ws-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(200,255,192,0.9);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
  transition: all 0.25s ease;
}
.ws-input:focus {
  border-color: rgba(57,255,20,0.35);
  background: rgba(57,255,20,0.03);
  box-shadow: 0 0 12px rgba(57,255,20,0.06);
}
.ws-input::placeholder { color: rgba(200,255,192,0.2); }

.ws-tag {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
}

.ws-type-pill {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: rgba(255,255,255,0.03);
  color: rgba(200,255,192,0.4);
}
.ws-type-pill.active {
  background: rgba(57,255,20,0.1);
  border-color: rgba(57,255,20,0.3);
  color: #39ff14;
}
.ws-type-pill:not(.active):hover {
  background: rgba(255,255,255,0.05);
  color: rgba(200,255,192,0.6);
  border-color: rgba(255,255,255,0.08);
}

.ws-filter-pill {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}
.ws-filter-pill.active {
  background: rgba(57,255,20,0.1);
  border-color: rgba(57,255,20,0.3);
  color: #39ff14;
}
.ws-filter-pill:not(.active) {
  background: rgba(255,255,255,0.03);
  color: rgba(200,255,192,0.35);
}
.ws-filter-pill:not(.active):hover {
  background: rgba(255,255,255,0.05);
  color: rgba(200,255,192,0.55);
}

.ws-scrollbar::-webkit-scrollbar { width: 5px; }
.ws-scrollbar::-webkit-scrollbar-track { background: transparent; }
.ws-scrollbar::-webkit-scrollbar-thumb { background: rgba(57,255,20,0.12); border-radius: 3px; }
.ws-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(57,255,20,0.25); }

.ws-task-row {
  border-bottom: 1px solid rgba(255,255,255,0.025);
  transition: background 0.2s ease;
}
.ws-task-row:hover { background: rgba(57,255,20,0.025); }

.ws-stat-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.25s ease;
}
.ws-stat-card:hover { border-color: rgba(57,255,20,0.12); }

.ws-progress-bar {
  height: 3px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  overflow: hidden;
}
.ws-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #39ff14, #00f5ff);
  border-radius: 2px;
  transition: width 0.6s ease;
}

/* ── Mission Control Styles ────────────────────────────────────── */
.ws-console {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  line-height: 1.75;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
  overflow-y: auto;
}
.ws-console::-webkit-scrollbar { width: 3px; }
.ws-console::-webkit-scrollbar-thumb { background: rgba(57,255,20,0.15); border-radius: 2px; }
.ws-console-entry { padding: 3px 14px; border-bottom: 1px solid rgba(255,255,255,0.015); }
.ws-console-entry:hover { background: rgba(255,255,255,0.015); }
.ws-agent-badge {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
}
.ws-goal-input {
  background: rgba(57,255,20,0.03);
  border: 1px solid rgba(57,255,20,0.12);
  color: rgba(200,255,192,0.95);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  outline: none;
  width: 100%;
  transition: all 0.3s ease;
}
.ws-goal-input:focus {
  border-color: rgba(57,255,20,0.45);
  background: rgba(57,255,20,0.05);
  box-shadow: 0 0 24px rgba(57,255,20,0.06);
}
.ws-goal-input::placeholder { color: rgba(200,255,192,0.2); }
@keyframes ws-pulse-border {
  0%, 100% { border-color: rgba(57,255,20,0.25); }
  50% { border-color: rgba(57,255,20,0.55); }
}
.ws-running .ws-goal-input {
  animation: ws-pulse-border 2s infinite;
}
@keyframes ws-pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

function injectStyles() {
    if (document.getElementById("ws-styles")) return;
    const el = document.createElement("style");
    el.id = "ws-styles";
    el.textContent = WS_STYLES;
    document.head.appendChild(el);
}

// ─── Tiny helpers ──────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
const fmtTimeSec = (d) => d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
const isOverdue = (d) => d && new Date(d) < new Date();

function formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function Dot({ color, pulse }) {
    return (
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {pulse && (
                <span style={{
                    position: "absolute", width: 8, height: 8, borderRadius: "50%",
                    background: color, opacity: 0.3, animation: "ping 1.5s infinite",
                }} />
            )}
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "block" }} />
        </span>
    );
}

function ProgressBar({ value, color = "#39ff14" }) {
    return (
        <div className="ws-progress-bar">
            <div className="ws-progress-fill" style={{ width: `${value}%`, background: color }} />
        </div>
    );
}

function ProgressRing({ pct, size = 52, stroke = 4 }) {
    const r = (size - stroke * 2) / 2;
    const c = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#39ff14" strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
                strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 0.7s ease" }}
            />
            <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700"
                fill="#39ff14" fontFamily="JetBrains Mono, monospace">
                {pct}%
            </text>
        </svg>
    );
}

// ─── Workspace Create Form ─────────────────────────────────────────────────────
function WorkspaceForm({ initial, onSave, onCancel }) {
    const [form, setForm] = useState({
        name: initial?.name || "",
        type: initial?.type || "General",
        emoji: initial?.emoji || "\u{1F310}",
        description: initial?.description || "",
        rules: initial?.rules?.join("\n") || "",
        tags: initial?.tags?.join(", ") || "",
    });

    const isValid = form.name.trim().length > 0;

    const handleType = (type) => {
        const p = WORKSPACE_PRESETS[type];
        setForm(f => ({
            ...f, type, emoji: p?.emoji || f.emoji,
        }));
    };

    return (
        <div className="space-y-4 p-6">
            <p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--neon-cyan, #00f5ff)" }}>
                {initial ? "// EDIT WORKSPACE" : "// NEW WORKSPACE"}
            </p>

            {/* Type selector */}
            <div className="flex gap-2 flex-wrap">
                {Object.entries(WORKSPACE_PRESETS).map(([type, { emoji }]) => (
                    <button key={type} onClick={() => handleType(type)}
                        className={`ws-type-pill ${form.type === type ? "active" : ""}`}
                    >
                        {emoji} {type}
                    </button>
                ))}
            </div>

            {/* Name */}
            <div className="flex gap-3">
                <button className="text-2xl w-11 h-11 flex items-center justify-center rounded-lg border"
                    style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
                    onClick={() => {
                        const emojis = Object.values(WORKSPACE_PRESETS).map(p => p.emoji);
                        const i = emojis.indexOf(form.emoji);
                        setForm(f => ({ ...f, emoji: emojis[(i + 1) % emojis.length] }));
                    }}>
                    {form.emoji}
                </button>
                <input className="ws-input flex-1" placeholder="workspace name\u2026" maxLength={40}
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <input className="ws-input w-full" placeholder="description\u2026"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

            <textarea className="ws-input w-full resize-none" rows={3}
                placeholder="agent rules (one per line)\u2026"
                value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} />

            <div className="flex gap-3 pt-1">
                <button className="ws-btn-primary flex-1" onClick={() => isValid && onSave({
                    ...form,
                    tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
                })} style={{ opacity: isValid ? 1 : 0.3, cursor: isValid ? "pointer" : "not-allowed" }}>
                    {initial ? "save changes" : "create workspace"}
                </button>
                <button className="ws-btn-ghost" onClick={onCancel}>cancel</button>
            </div>
        </div>
    );
}

// ─── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, onUpdate, onDelete, onSelect, selected }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(task.title);
    const cycle = { coming_soon: "in_progress", in_progress: "completed", completed: "coming_soon", blocked: "coming_soon" };

    const commit = () => {
        if (title.trim() && title !== task.title) onUpdate(task.id, { title: title.trim() });
        setEditing(false);
    };

    return (
        <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
            className="ws-task-row flex items-center gap-3 px-5 py-3 group"
            style={{ background: selected ? "rgba(57,255,20,0.035)" : undefined }}
        >
            {/* Select */}
            <button onClick={() => onSelect(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: selected ? "#39ff14" : "rgba(200,255,192,0.3)" }}>
                {selected ? <CheckSquare size={12} /> : <Square size={12} />}
            </button>

            {/* Status */}
            <button onClick={() => onUpdate(task.id, { status: cycle[task.status] })} className="flex-shrink-0"
                style={{ width: 14, height: 14 }}>
                <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: `1.5px solid ${TASK_STATUS_COLORS[task.status]}`,
                    background: task.status === "completed" ? TASK_STATUS_COLORS[task.status] : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                }}>
                    {task.status === "completed" && <Check size={8} color="#000" />}
                    {task.status === "blocked" && <X size={8} style={{ color: TASK_STATUS_COLORS.blocked }} />}
                </div>
            </button>

            {/* Title */}
            <div className="flex-1 min-w-0">
                {editing ? (
                    <input className="ws-input w-full text-xs py-0.5 px-1" value={title}
                        onChange={e => setTitle(e.target.value)}
                        onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                        autoFocus />
                ) : (
                    <span onDoubleClick={() => setEditing(true)} className="text-xs cursor-default select-none"
                        style={{
                            color: task.status === "completed" ? "rgba(200,255,192,0.25)" : "rgba(200,255,192,0.8)",
                            textDecoration: task.status === "completed" ? "line-through" : "none",
                        }}>
                        {task.title}
                    </span>
                )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {task.priority && task.priority !== "normal" && (
                    <span className="ws-tag" style={{ color: TASK_PRIORITY_COLORS[task.priority], background: `${TASK_PRIORITY_COLORS[task.priority]}18` }}>
                        {task.priority}
                    </span>
                )}
                {task.dueDate && (
                    <span className="text-[9px] flex items-center gap-1"
                        style={{ color: isOverdue(task.dueDate) ? "#ff2d78" : "rgba(200,255,192,0.3)" }}>
                        <Clock size={8} /> {fmt(task.dueDate)}
                    </span>
                )}
                <span className="ws-tag opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: TASK_STATUS_COLORS[task.status], background: `${TASK_STATUS_COLORS[task.status]}18` }}>
                    {TASK_STATUS_LABELS[task.status]}
                </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => setEditing(true)} style={{ color: "rgba(200,255,192,0.3)", padding: 3 }}><Pencil size={9} /></button>
                <button onClick={() => onDelete(task.id)} style={{ color: "rgba(255,45,120,0.4)", padding: 3 }}><Trash2 size={9} /></button>
            </div>
        </motion.div>
    );
}

// ─── Output Card ───────────────────────────────────────────────────────────────
function OutputCard({ output, onDelete, onRename }) {
    const [open, setOpen] = useState(false);
    const [renaming, setRen] = useState(false);
    const [name, setName] = useState(output.filename);

    const TYPE_ICON = { code: "\u2328", style: "\u{1F3A8}", markup: "\u3008/\u3009", markdown: "Md", data: "\u2211", image: "\u25A1", document: "\u25FB", text: "T" };
    const commit = () => { if (name.trim() && name !== output.filename) onRename(output.id, name.trim()); setRen(false); };

    return (
        <div className="ws-panel overflow-hidden mb-3">
            <div className="flex items-center gap-3 px-5 py-3 group cursor-pointer" onClick={() => setOpen(p => !p)}>
                <span style={{ fontSize: 11, width: 16, textAlign: "center", color: "var(--neon-cyan, #00f5ff)", fontFamily: "monospace" }}>
                    {TYPE_ICON[output.type] || "T"}
                </span>
                {renaming ? (
                    <input className="ws-input flex-1 py-0.5 text-xs" value={name}
                        onChange={e => setName(e.target.value)} onBlur={commit}
                        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setRen(false); }}
                        autoFocus onClick={e => e.stopPropagation()} />
                ) : (
                    <span className="flex-1 text-xs font-mono truncate" style={{ color: "rgba(200,255,192,0.75)" }}>
                        {output.filename}
                    </span>
                )}
                <span className="text-[9px]" style={{ color: "rgba(200,255,192,0.2)" }}>{fmt(output.updatedAt || output.createdAt)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigator.clipboard?.writeText(output.content)} style={{ color: "rgba(200,255,192,0.3)", padding: 3 }}><Copy size={9} /></button>
                    <button onClick={() => setRen(true)} style={{ color: "rgba(200,255,192,0.3)", padding: 3 }}><Pencil size={9} /></button>
                    <button onClick={() => onDelete(output.id)} style={{ color: "rgba(255,45,120,0.4)", padding: 3 }}><Trash2 size={9} /></button>
                </div>
                <span style={{ color: "rgba(200,255,192,0.2)" }}>{open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</span>
            </div>
            <AnimatePresence>
                {open && output.content && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <pre className="text-[9px] px-5 pb-4 whitespace-pre-wrap break-words max-h-[160px] overflow-y-auto ws-scrollbar"
                            style={{ color: "rgba(200,255,192,0.4)", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                            {output.content.slice(0, 800)}{output.content.length > 800 ? "\n\u2026" : ""}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Mission Control Panel ─────────────────────────────────────────────────────
function MissionControlPanel({ agentRun, goal, setGoal, onRun, onStop, elapsed }) {
    const consoleEndRef = useRef(null);
    const consoleContainerRef = useRef(null);

    useEffect(() => {
        if (consoleEndRef.current && consoleContainerRef.current) {
            const container = consoleContainerRef.current;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
            if (isNearBottom) {
                consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [agentRun.console]);

    const { isRunning, currentAgent, currentTask, iteration, totalIterations, console: consoleLogs, summary } = agentRun;
    const agentConf = AGENT_CONFIG[currentAgent] || null;

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }} className={isRunning ? "ws-running" : ""}>

            {/* ── Goal Input Bar ──────────────────────────────────────── */}
            <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(57,255,20,0.015)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                        <input
                            className="ws-goal-input"
                            placeholder="Describe your goal... e.g., 'Build a landing page for a SaaS product'"
                            value={goal}
                            onChange={e => setGoal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !isRunning && goal.trim()) onRun(); }}
                            disabled={isRunning}
                            style={{ paddingRight: 12 }}
                        />
                    </div>
                    {isRunning ? (
                        <button
                            onClick={onStop}
                            style={{
                                background: "rgba(255,45,120,0.1)",
                                border: "1px solid rgba(255,45,120,0.4)",
                                color: "#ff2d78",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                padding: "12px 22px",
                                borderRadius: 8,
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                            <StopCircle size={12} /> stop
                        </button>
                    ) : (
                        <button
                            onClick={onRun}
                            disabled={!goal.trim()}
                            style={{
                                background: goal.trim() ? "rgba(57,255,20,0.1)" : "rgba(57,255,20,0.03)",
                                border: goal.trim() ? "1px solid rgba(57,255,20,0.4)" : "1px solid rgba(57,255,20,0.12)",
                                color: goal.trim() ? "#39ff14" : "rgba(57,255,20,0.25)",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                padding: "12px 22px",
                                borderRadius: 8,
                                cursor: goal.trim() ? "pointer" : "not-allowed",
                                transition: "all 0.25s ease",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                            <Play size={12} /> run agent
                        </button>
                    )}
                </div>
            </div>

            {/* ── Agent Status Bar ────────────────────────────────────── */}
            {isRunning && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                        padding: "12px 24px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        background: "rgba(0,0,0,0.2)",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                    }}>
                    {/* Agent badge */}
                    {agentConf && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="ws-agent-badge" style={{
                                background: agentConf.bg,
                                color: agentConf.color,
                                border: `1px solid ${agentConf.color}30`,
                            }}>
                                {agentConf.icon} {agentConf.label}
                            </span>
                            <Dot color={agentConf.color} pulse />
                        </div>
                    )}

                    <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)" }} />

                    {/* Iteration progress */}
                    {totalIterations > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "rgba(200,255,192,0.4)", letterSpacing: "0.08em" }}>TASK</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#00f5ff" }}>{iteration}</span>
                            <span style={{ fontSize: 10, color: "rgba(200,255,192,0.2)" }}>/</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(200,255,192,0.45)" }}>{totalIterations}</span>
                        </div>
                    )}

                    {/* Current task */}
                    {currentTask && (
                        <>
                            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)" }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Target size={9} style={{ color: "rgba(200,255,192,0.3)" }} />
                                <span style={{ fontSize: 10, color: "rgba(200,255,192,0.6)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {currentTask}
                                </span>
                            </div>
                        </>
                    )}

                    <div style={{ flex: 1 }} />

                    {/* Elapsed time */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Timer size={9} style={{ color: "rgba(200,255,192,0.3)" }} />
                        <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: "rgba(200,255,192,0.55)",
                            letterSpacing: "0.05em",
                        }}>
                            {formatElapsed(elapsed)}
                        </span>
                    </div>
                </motion.div>
            )}

            {/* ── Summary Panel ───────────────────────────────────────── */}
            {!isRunning && summary && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        margin: "20px 24px 0",
                        padding: "20px",
                        background: "rgba(57,255,20,0.03)",
                        border: "1px solid rgba(57,255,20,0.18)",
                        borderRadius: "8px",
                        position: "relative",
                    }}>
                    <div style={{
                        position: "absolute", top: 0, left: 0, right: 0, height: 1,
                        background: "linear-gradient(90deg, transparent, rgba(57,255,20,0.4), transparent)",
                    }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Check size={12} style={{ color: "#39ff14" }} />
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#39ff14" }}>
                            mission complete
                        </span>
                    </div>
                    <p style={{
                        fontSize: 11,
                        lineHeight: 1.75,
                        color: "rgba(200,255,192,0.7)",
                        whiteSpace: "pre-wrap",
                    }}>
                        {summary}
                    </p>
                </motion.div>
            )}

            {/* ── Live Console ────────────────────────────────────────── */}
            <div style={{ flex: 1, padding: "20px 24px 24px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                {/* Console header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SquareTerminal size={11} style={{ color: "rgba(200,255,192,0.3)" }} />
                        <span style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(200,255,192,0.3)" }}>
                            agent console
                        </span>
                    </div>
                    <span style={{ fontSize: 8, color: "rgba(200,255,192,0.12)" }}>
                        {consoleLogs.length} entries
                    </span>
                </div>

                {/* Console output */}
                <div
                    ref={consoleContainerRef}
                    className="ws-console ws-scrollbar"
                    style={{ flex: 1, minHeight: 200, maxHeight: "calc(100vh - 340px)" }}>
                    {consoleLogs.length === 0 ? (
                        <div style={{
                            padding: "40px 20px",
                            textAlign: "center",
                        }}>
                            <p style={{ fontSize: 10, color: "rgba(200,255,192,0.12)", letterSpacing: "0.12em" }}>
                                {isRunning ? "waiting for agent output\u2026" : "enter a goal and press run agent to begin"}
                            </p>
                        </div>
                    ) : (
                        consoleLogs.map((entry, i) => {
                            const entryColor = CONSOLE_TYPE_COLORS[entry.type] || "rgba(200,255,192,0.35)";
                            const agentConfEntry = AGENT_CONFIG[entry.agent];
                            const isStream = entry.type === "agent_stream";
                            return (
                                <div
                                    key={i}
                                    className="ws-console-entry"
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 8,
                                        opacity: isStream ? 0.7 : 1,
                                    }}>
                                    {/* Timestamp */}
                                    <span style={{
                                        fontSize: 9,
                                        color: "rgba(200,255,192,0.15)",
                                        fontFamily: "'JetBrains Mono', monospace",
                                        flexShrink: 0,
                                        paddingTop: 1,
                                        minWidth: 68,
                                    }}>
                                        {entry.timestamp || fmtTimeSec(Date.now())}
                                    </span>

                                    {/* Agent badge */}
                                    {agentConfEntry && (
                                        <span className="ws-agent-badge" style={{
                                            background: agentConfEntry.bg,
                                            color: agentConfEntry.color,
                                            border: `1px solid ${agentConfEntry.color}20`,
                                            flexShrink: 0,
                                        }}>
                                            {agentConfEntry.icon}
                                        </span>
                                    )}

                                    {/* Message */}
                                    <span style={{
                                        fontSize: isStream ? 9 : 10,
                                        color: entryColor,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        lineHeight: 1.75,
                                        wordBreak: "break-word",
                                        whiteSpace: isStream ? "pre-wrap" : "normal",
                                    }}>
                                        {entry.message}
                                    </span>
                                </div>
                            );
                        })
                    )}
                    <div ref={consoleEndRef} />
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function WorkspaceView({ onBack }) {
    useEffect(() => { injectStyles(); }, []);

    const ctx = useContext(WorkspaceContext);
    const { preferences } = useContext(chatsContext) || {};

    // Default view is now "mission"
    const [view, setView] = useState("mission");
    const [showForm, setShowForm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showWsList, setWsList] = useState(false);
    const [taskFilter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(new Set());
    const [newTask, setNewTask] = useState("");
    const [newPriority, setNewPri] = useState("normal");
    const [confirmDel, setConfDel] = useState(null);
    const importRef = useRef(null);

    // ── Agent run state ──────────────────────────────────────────────
    const [goal, setGoal] = useState("");
    const abortRef = useRef(null);
    const [elapsed, setElapsed] = useState(0);
    const elapsedTimerRef = useRef(null);

    if (!ctx) return null;

    const {
        workspaces, activeWorkspaceId, activeWorkspace, workspaceStats,
        setActiveWorkspaceId, createWorkspace, updateWorkspace, duplicateWorkspace,
        deleteWorkspace, archiveWorkspace, exportWorkspace, importWorkspace,
        addTask, updateTask, deleteTask, bulkUpdateTasks, bulkDeleteTasks,
        deleteOutput, renameOutput,
        updateNotes, addTimelineEvent, clearTimeline,
        // Agent properties
        agentRun, startAgentRun, stopAgentRun,
        updateAgentRun, addAgentLog, clearAgentConsole, processAgentEvent,
    } = ctx;

    const ws = activeWorkspace;
    const tasks = ws?.tasks || [];
    const outputs = ws?.outputs || [];
    const timeline = ws?.timeline || [];

    // Filtered + searched tasks
    const displayTasks = tasks
        .filter(t => taskFilter === "all" || t.status === taskFilter)
        .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()));

    const handleAddTask = () => {
        if (!newTask.trim()) return;
        addTask(newTask.trim(), "coming_soon", { priority: newPriority });
        addTimelineEvent(`Task added: "${newTask.trim()}"`, "task");
        setNewTask("");
    };

    const toggleSel = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const clearSel = () => setSelected(new Set());

    const activeList = workspaces.filter(w => !w.isArchived);
    const stats = workspaceStats;

    const tlColors = { info: "rgba(200,255,192,0.4)", task: "#00f5ff", output: "#39ff14", agent: "rgba(255,165,0,0.9)", error: "#ff2d78" };
    const tlIcons = { info: "\u203A", task: "\u2713", output: "\u25C8", agent: "\u26A1", error: "\u26A0" };

    // ── Elapsed timer ────────────────────────────────────────────────
    useEffect(() => {
        if (agentRun?.isRunning && agentRun?.startedAt) {
            const start = new Date(agentRun.startedAt).getTime();
            setElapsed(Date.now() - start);
            elapsedTimerRef.current = setInterval(() => {
                setElapsed(Date.now() - start);
            }, 1000);
        } else {
            if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = null;
            }
        }
        return () => {
            if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = null;
            }
        };
    }, [agentRun?.isRunning, agentRun?.startedAt]);

    // ── Run Agent ────────────────────────────────────────────────────
    const handleRunAgent = useCallback(async () => {
        if (!goal.trim() || !ws) return;

        // Clear previous console
        clearAgentConsole();

        // Start the agent run state
        startAgentRun(goal);

        // Create abort controller
        abortRef.current = new AbortController();

        addAgentLog("system", null, `Starting mission: "${goal}"`);

        try {
            // Build workspace state for the server
            const workspaceState = {
                name: ws.name,
                type: ws.type,
                description: ws.description,
                rules: ws.rules,
                conversationSummary: ws.conversationSummary,
                activeTasks: (ws.tasks || []).filter(t => t.status !== "completed").map(t => ({
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                })),
                completedTasks: (ws.tasks || []).filter(t => t.status === "completed").map(t => t.title),
                filesOutput: (ws.outputs || []).map(o => o.filename),
                rawOutputs: (ws.outputs || []),
                notes: ws.notes,
            };

            const response = await api.agentRun(
                preferences?.userId,
                goal,
                workspaceState,
                {}, // clientKeys - passed via api internally
                null, // model - default
                {}, // parameters
                abortRef.current.signal,
            );

            if (!response.ok) {
                const errText = await response.text().catch(() => "Unknown error");
                addAgentLog("error", null, `API error (${response.status}): ${errText}`);
                updateAgentRun({ isRunning: false });
                return;
            }

            // Parse SSE events
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const event = JSON.parse(line.slice(6));
                            processAgentEvent(event);
                        } catch (e) {
                            // Ignore malformed JSON lines
                        }
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.startsWith("data: ")) {
                try {
                    const event = JSON.parse(buffer.slice(6));
                    processAgentEvent(event);
                } catch (e) {
                    // Ignore
                }
            }

            addAgentLog("system", null, "Stream completed");
            updateAgentRun({ isRunning: false });

        } catch (err) {
            if (err.name === "AbortError") {
                addAgentLog("system", null, "Mission stopped by user");
            } else {
                addAgentLog("error", null, `Error: ${err.message}`);
            }
            updateAgentRun({ isRunning: false });
        }

        abortRef.current = null;
    }, [goal, ws, startAgentRun, stopAgentRun, updateAgentRun, addAgentLog, clearAgentConsole, processAgentEvent]);

    // ── Stop Agent ───────────────────────────────────────────────────
    const handleStopAgent = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        stopAgentRun();
    }, [stopAgentRun]);

    return (
        <div className="ws-root flex flex-col" style={{ position: "relative", zIndex: 1 }}>
            {/* ── TOPBAR ────────────────────────────────────────────────── */}
            <div style={{
                borderBottom: "1px solid rgba(57,255,20,0.08)",
                background: "rgba(10,12,15,0.95)",
                padding: "0 24px",
                height: 52,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexShrink: 0,
                position: "relative",
                zIndex: 10,
            }}>
                {onBack && (
                    <button onClick={onBack} className="ws-btn-ghost flex items-center gap-1.5" style={{ padding: "5px 10px" }}>
                        <ArrowLeft size={10} /> back
                    </button>
                )}

                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.05)" }} />

                {/* Workspace selector */}
                <button onClick={() => setWsList(p => !p)} className="flex items-center gap-2" style={{ background: "none", border: "none", cursor: "pointer" }}>
                    <span style={{ fontSize: 16 }}>{ws?.emoji || "\u{1F310}"}</span>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: ws ? "#39ff14" : "rgba(200,255,192,0.3)", letterSpacing: "0.05em" }}>
                            {ws?.name || "select workspace"}
                        </p>
                        {ws && <p style={{ fontSize: 9, color: "rgba(200,255,192,0.25)", letterSpacing: "0.1em" }}>{ws.type}</p>}
                    </div>
                    <ChevronDown size={10} style={{ color: "rgba(200,255,192,0.3)", transform: showWsList ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>

                {/* Running indicator in topbar */}
                {agentRun?.isRunning && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(57,255,20,0.05)",
                        border: "1px solid rgba(57,255,20,0.18)",
                        borderRadius: 6, padding: "4px 12px",
                    }}>
                        <span style={{
                            width: 6, height: 6, borderRadius: "50%", background: "#39ff14",
                            animation: "ws-pulse-dot 1s infinite",
                        }} />
                        <span style={{ fontSize: 9, color: "#39ff14", letterSpacing: "0.1em", fontWeight: 700 }}>LIVE</span>
                    </div>
                )}

                <div style={{ flex: 1 }} />

                {/* Actions */}
                {ws && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setEditMode(true); setShowForm(true); }} className="ws-btn-ghost flex items-center gap-1"><Pencil size={9} /> edit</button>
                        <button onClick={() => duplicateWorkspace(ws.id)} className="ws-btn-ghost flex items-center gap-1"><Copy size={9} /> clone</button>
                        <button onClick={() => exportWorkspace(ws.id)} className="ws-btn-ghost flex items-center gap-1"><Download size={9} /> export</button>
                    </div>
                )}
                <button onClick={() => { setEditMode(false); setShowForm(true); }} className="ws-btn-primary flex items-center gap-1.5">
                    <Plus size={10} /> new workspace
                </button>
                <button onClick={() => importRef.current?.click()} className="ws-btn-ghost" style={{ padding: "6px 8px" }} title="Import">
                    <Upload size={10} />
                </button>
                <input ref={importRef} type="file" accept=".json" className="hidden"
                    onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const r = new FileReader(); r.onload = ev => importWorkspace(ev.target.result); r.readAsText(f);
                        e.target.value = "";
                    }} />
            </div>

            {/* ── WORKSPACE LIST DROPDOWN ───────────────────────────────── */}
            <AnimatePresence>
                {showWsList && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        style={{
                            position: "absolute", top: 52, left: 0, right: 0, zIndex: 50,
                            background: "rgba(10,12,15,0.98)", borderBottom: "1px solid rgba(57,255,20,0.08)",
                            maxHeight: 260, overflowY: "auto",
                        }}
                        className="ws-scrollbar">
                        {activeList.length === 0 && (
                            <p className="text-center py-8 text-xs" style={{ color: "rgba(200,255,192,0.15)" }}>no workspaces yet</p>
                        )}
                        {activeList.map(w => (
                            <div key={w.id} onClick={() => { setActiveWorkspaceId(w.id); setWsList(false); }}
                                role="button" aria-label={`Open ${w.name}`} tabIndex={0}
                                className="w-full flex items-center gap-3 px-6 py-3.5 group cursor-pointer"
                                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setActiveWorkspaceId(w.id); setWsList(false); } }}
                                style={{
                                    background: w.id === activeWorkspaceId ? "rgba(57,255,20,0.03)" : "transparent",
                                    borderBottom: "1px solid rgba(255,255,255,0.025)",
                                    transition: "background 0.2s ease",
                                }}>
                                <span style={{ fontSize: 15 }}>{w.emoji || "\u{1F310}"}</span>
                                <div className="flex-1 text-left min-w-0">
                                    <p style={{ fontSize: 11, color: w.id === activeWorkspaceId ? "#39ff14" : "rgba(200,255,192,0.7)", fontWeight: 700 }}>{w.name}</p>
                                    <p style={{ fontSize: 9, color: "rgba(200,255,192,0.25)" }}>{w.type} &middot; {w.tasks?.filter(t => t.status !== "completed").length || 0} open tasks</p>
                                </div>
                                {w.id === activeWorkspaceId && <Check size={10} style={{ color: "#39ff14" }} />}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => archiveWorkspace(w.id)} style={{ color: "rgba(200,255,192,0.3)", padding: 4 }} title="Archive"><Archive size={9} /></button>
                                    <button onClick={() => {
                                        if (confirmDel === w.id) { deleteWorkspace(w.id); setConfDel(null); }
                                        else { setConfDel(w.id); setTimeout(() => setConfDel(null), 2500); }
                                    }} style={{ color: confirmDel === w.id ? "#ff2d78" : "rgba(200,255,192,0.3)", padding: 4 }}>
                                        <Trash2 size={9} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── FORM MODAL ────────────────────────────────────────────── */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => { setShowForm(false); setEditMode(false); }}>
                        <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                            className="ws-panel" style={{ width: 480, maxHeight: "85vh", overflowY: "auto" }}
                            onClick={e => e.stopPropagation()}>
                            <WorkspaceForm
                                initial={editMode ? ws : null}
                                onSave={data => {
                                    if (editMode && ws) updateWorkspace(ws.id, data);
                                    else createWorkspace(data);
                                    setShowForm(false); setEditMode(false); setWsList(false);
                                }}
                                onCancel={() => { setShowForm(false); setEditMode(false); }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── NO WORKSPACE ──────────────────────────────────────────── */}
            {!ws && !showForm && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6" style={{ paddingTop: 80 }}>
                    <div style={{ border: "1px solid rgba(57,255,20,0.06)", borderRadius: 12, padding: "40px 48px", textAlign: "center", background: "rgba(57,255,20,0.015)" }}>
                        <p style={{ fontSize: 11, color: "rgba(200,255,192,0.25)", letterSpacing: "0.15em", marginBottom: 24 }}>NO WORKSPACE ACTIVE</p>
                        <button className="ws-btn-primary" onClick={() => setShowForm(true)}>+ create workspace</button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT
       ═══════════════════════════════════════════════════════════ */}
            {ws && (
                <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", position: "relative", zIndex: 1 }}>

                    {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
                    <div style={{
                        width: 240, flexShrink: 0, borderRight: "1px solid rgba(57,255,20,0.06)",
                        background: "rgba(8,10,13,0.6)", display: "flex", flexDirection: "column",
                        overflowY: "auto", padding: "20px 0",
                    }} className="ws-scrollbar">

                        {/* Stats */}
                        {stats && (
                            <div style={{ padding: "0 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                <div className="flex items-center justify-between mb-4">
                                    <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(200,255,192,0.25)", textTransform: "uppercase" }}>progress</span>
                                    <ProgressRing pct={stats.progress} size={44} />
                                </div>
                                <ProgressBar value={stats.progress} />
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    {[
                                        { l: "to do", v: stats.toDo, c: TASK_STATUS_COLORS.coming_soon },
                                        { l: "doing", v: stats.inProgress, c: TASK_STATUS_COLORS.in_progress },
                                        { l: "done", v: stats.done, c: "#39ff14" },
                                        { l: "blocked", v: stats.blocked, c: "#ff2d78" },
                                    ].map(s => (
                                        <div key={s.l} style={{ background: "rgba(255,255,255,0.015)", borderRadius: 6, padding: "8px 10px" }}>
                                            <p style={{ fontSize: 14, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</p>
                                            <p style={{ fontSize: 8, color: "rgba(200,255,192,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>{s.l}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nav */}
                        <div style={{ padding: "16px 0" }}>
                            {[
                                { id: "mission", icon: Cpu, label: "Mission" },
                                { id: "tasks", icon: ListTodo, label: "Tasks", count: tasks.filter(t => t.status !== "completed").length },
                                { id: "outputs", icon: FileText, label: "Outputs", count: outputs.length },
                                { id: "timeline", icon: Activity, label: "Activity" },
                                { id: "notes", icon: StickyNote, label: "Notes" },
                            ].map((item) => {
                                const { id, icon: Icon, label, count } = item;
                                const isActive = view === id;
                                return (
                                    <button key={id} onClick={() => setView(id)}
                                        className="w-full flex items-center gap-3 px-5 py-3 transition-all"
                                        style={{
                                            background: isActive ? "rgba(57,255,20,0.05)" : "transparent",
                                            borderLeft: `2px solid ${isActive ? "#39ff14" : "transparent"}`,
                                            color: isActive ? "#39ff14" : "rgba(200,255,192,0.4)",
                                        }}>
                                        <Icon size={13} />
                                        <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, flex: 1, textAlign: "left" }}>{label}</span>
                                        {count !== undefined && count > 0 && (
                                            <span style={{ fontSize: 8, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "1px 7px", color: "rgba(200,255,192,0.35)" }}>{count}</span>
                                        )}
                                        {/* Mission running indicator */}
                                        {id === "mission" && agentRun?.isRunning && (
                                            <span style={{
                                                width: 6, height: 6, borderRadius: "50%", background: "#39ff14",
                                                animation: "ws-pulse-dot 1s infinite",
                                            }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Rules */}
                        {ws.rules?.length > 0 && (
                            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.03)", marginTop: "auto" }}>
                                <p style={{ fontSize: 8, letterSpacing: "0.2em", color: "rgba(200,255,192,0.18)", textTransform: "uppercase", marginBottom: 8 }}>agent rules</p>
                                {ws.rules.map((r, i) => (
                                    <p key={i} style={{ fontSize: 9, color: "rgba(200,255,192,0.3)", lineHeight: 1.7, paddingLeft: 8 }}>
                                        <span style={{ color: "rgba(200,255,192,0.18)", marginRight: 4 }}>{i + 1}.</span>{r}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── MAIN AREA ─────────────────────────────────────────── */}
                    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column" }} className="ws-scrollbar">

                        {/* ═══ MISSION CONTROL VIEW ═════════════════════════ */}
                        {view === "mission" && (
                            <MissionControlPanel
                                agentRun={agentRun || { isRunning: false, goal: "", currentAgent: null, currentTask: null, iteration: 0, totalIterations: 0, console: [], summary: null, startedAt: null }}
                                goal={goal}
                                setGoal={setGoal}
                                onRun={handleRunAgent}
                                onStop={handleStopAgent}
                                elapsed={elapsed}
                            />
                        )}

                        {/* ═══ TASKS VIEW ══════════════════════════════════════ */}
                        {view === "tasks" && (
                            <div style={{ flex: 1 }}>
                                {/* Toolbar */}
                                <div style={{
                                    padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                                    background: "rgba(0,0,0,0.15)",
                                }}>
                                    {/* Search */}
                                    <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
                                        <Search size={10} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(200,255,192,0.18)" }} />
                                        <input className="ws-input w-full" style={{ paddingLeft: 28, fontSize: 10 }}
                                            placeholder="search tasks\u2026" value={search} onChange={e => setSearch(e.target.value)} />
                                    </div>

                                    {/* Status filters */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {["all", "coming_soon", "in_progress", "completed", "blocked"].map(f => (
                                            <button key={f} onClick={() => setFilter(f)}
                                                className={`ws-filter-pill ${taskFilter === f ? "active" : ""}`}
                                                style={{
                                                    padding: "4px 11px",
                                                }}>
                                                {f === "all" ? `all (${tasks.length})` : `${TASK_STATUS_LABELS[f]} (${tasks.filter(t => t.status === f).length})`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick add */}
                                <div style={{
                                    padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                                    display: "flex", alignItems: "center", gap: 10, background: "rgba(57,255,20,0.015)",
                                }}>
                                    <span style={{ color: "#39ff14", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>&rsaquo;</span>
                                    <input className="ws-input flex-1" style={{ border: "none", background: "transparent", padding: "4px 0", fontSize: 11 }}
                                        placeholder="add task and press enter\u2026" value={newTask}
                                        onChange={e => setNewTask(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleAddTask()} />
                                    <div className="flex items-center gap-1.5">
                                        {["low", "normal", "high", "urgent"].map(p => (
                                            <button key={p} title={p} onClick={() => setNewPri(p)}
                                                style={{
                                                    width: 10, height: 10, borderRadius: "50%",
                                                    background: newPriority === p ? TASK_PRIORITY_COLORS[p] : "transparent",
                                                    border: `1.5px solid ${TASK_PRIORITY_COLORS[p]}`,
                                                    transition: "all 0.2s ease", cursor: "pointer",
                                                }} />
                                        ))}
                                    </div>
                                    <button className="ws-btn-primary" style={{ padding: "5px 14px" }} onClick={handleAddTask}>add</button>
                                </div>

                                {/* Bulk bar */}
                                <AnimatePresence>
                                    {selected.size > 0 && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            style={{ padding: "10px 24px", borderBottom: "1px solid rgba(57,255,20,0.08)", background: "rgba(57,255,20,0.03)", display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontSize: 10, color: "#39ff14", fontWeight: 700 }}>{selected.size} selected</span>
                                            <button className="ws-btn-ghost flex items-center gap-1.5" onClick={() => { bulkUpdateTasks([...selected], { status: "completed", completedAt: new Date().toISOString() }); clearSel(); }}>
                                                <CheckSquare size={9} /> complete all
                                            </button>
                                            <button className="ws-btn-ghost flex items-center gap-1.5" style={{ color: "#ff2d78", borderColor: "rgba(255,45,120,0.2)" }}
                                                onClick={() => { bulkDeleteTasks([...selected]); clearSel(); }}>
                                                <Trash2 size={9} /> delete all
                                            </button>
                                            <button onClick={clearSel} style={{ marginLeft: "auto", color: "rgba(200,255,192,0.3)", background: "none", border: "none", cursor: "pointer" }}>
                                                <X size={10} />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Task list */}
                                <div>
                                    <AnimatePresence>
                                        {displayTasks.length === 0 ? (
                                            <div style={{ padding: "60px 24px", textAlign: "center" }}>
                                                <p style={{ fontSize: 10, color: "rgba(200,255,192,0.15)", letterSpacing: "0.15em" }}>
                                                    {search ? "no tasks match your search" : "no tasks yet \u2014 add one above"}
                                                </p>
                                            </div>
                                        ) : displayTasks.map(task => (
                                            <TaskRow key={task.id} task={task}
                                                onUpdate={updateTask} onDelete={deleteTask}
                                                onSelect={toggleSel} selected={selected.has(task.id)} />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {/* ═══ OUTPUTS VIEW ════════════════════════════════════ */}
                        {view === "outputs" && (
                            <div style={{ padding: 24 }}>
                                {outputs.length === 0 ? (
                                    <div style={{ padding: "60px 0", textAlign: "center" }}>
                                        <p style={{ fontSize: 10, color: "rgba(200,255,192,0.15)", letterSpacing: "0.15em" }}>no outputs yet \u2014 the agent will save files here</p>
                                    </div>
                                ) : (
                                    <AnimatePresence>
                                        {outputs.map(o => (
                                            <OutputCard key={o.id} output={o} onDelete={deleteOutput} onRename={renameOutput} />
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        )}

                        {/* ═══ TIMELINE VIEW ═══════════════════════════════════ */}
                        {view === "timeline" && (
                            <div style={{ flex: 1 }}>
                                <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 9, color: "rgba(200,255,192,0.25)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{timeline.length} events</span>
                                    {timeline.length > 0 && (
                                        <button className="ws-btn-ghost flex items-center gap-1.5" style={{ color: "rgba(255,45,120,0.5)", borderColor: "rgba(255,45,120,0.12)" }}
                                            onClick={clearTimeline}>
                                            <RotateCcw size={9} /> clear log
                                        </button>
                                    )}
                                </div>
                                <div style={{ padding: "12px 24px" }}>
                                    {timeline.length === 0 ? (
                                        <p style={{ fontSize: 10, color: "rgba(200,255,192,0.15)", textAlign: "center", padding: "60px 0", letterSpacing: "0.15em" }}>no activity yet</p>
                                    ) : timeline.map((ev, i) => (
                                        <div key={ev.id} style={{ display: "flex", gap: 14, paddingBottom: 16, position: "relative" }}>
                                            {i < timeline.length - 1 && (
                                                <div style={{ position: "absolute", left: 6, top: 18, bottom: 0, width: 1, background: "rgba(255,255,255,0.03)" }} />
                                            )}
                                            <span style={{ fontSize: 12, color: tlColors[ev.type] || "rgba(200,255,192,0.3)", flexShrink: 0, lineHeight: 1, marginTop: 2 }}>
                                                {tlIcons[ev.type] || "\u203A"}
                                            </span>
                                            <div>
                                                <p style={{ fontSize: 11, color: "rgba(200,255,192,0.6)", lineHeight: 1.6 }}>{ev.text}</p>
                                                <p style={{ fontSize: 9, color: "rgba(200,255,192,0.18)", marginTop: 3 }}>
                                                    {fmt(ev.timestamp)} &middot; {fmtTime(ev.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ═══ NOTES VIEW ══════════════════════════════════════ */}
                        {view === "notes" && (
                            <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
                                <p style={{ fontSize: 9, color: "rgba(200,255,192,0.2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>// WORKSPACE NOTES</p>
                                <textarea className="ws-input ws-scrollbar" style={{
                                    flex: 1, minHeight: 300, resize: "none", lineHeight: 1.8,
                                    fontSize: 11, padding: 16, fontFamily: "JetBrains Mono, monospace",
                                }}
                                    placeholder="free-form notes, ideas, context\u2026"
                                    value={ws.notes || ""}
                                    onChange={e => updateNotes(e.target.value)} />
                                <p style={{ fontSize: 9, color: "rgba(200,255,192,0.12)", marginTop: 8 }}>auto-saved &middot; {ws.notes?.length || 0} chars</p>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
