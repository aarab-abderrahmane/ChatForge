/**
 * WorkspacePanel.jsx
 *
 * Full workspace agent UI panel — clean surface, powerful underneath.
 * Drop this inside SettingsPanel (or any modal) where workspace section was.
 *
 * Usage:
 *   import { WorkspacePanel } from "./WorkspacePanel";
 *   <WorkspacePanel />
 */

import { useContext, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Trash2, Check, X, Pencil, ChevronDown, ChevronRight,
  Archive, Copy, Download, Upload, Clock, Flag,
  FileText, Tag, BarChart2, ListTodo, Folder, Zap,
  AlertTriangle, StickyNote, RotateCcw, CheckSquare, Square,
  RefreshCw, Play, Square as StopIcon,
} from "lucide-react";
import { api } from "../../services/api";
import { WorkspaceContext, TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, WORKSPACE_PRESETS } from "../../context/workspaceContext";

// ─── Small helpers ─────────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span
      className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest"
      style={{ color: color || "rgba(200,255,192,0.6)", background: bg || "rgba(255,255,255,0.06)" }}
    >
      {label}
    </span>
  );
}

function SectionHeader({ icon: Icon, label, count, action, actionLabel }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2">
      <div className="flex items-center gap-2">
        <Icon size={12} style={{ color: "var(--neon-cyan)" }} />
        <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(200,255,192,0.5)" }}>
          {label}
        </span>
        {count !== undefined && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(200,255,192,0.4)" }}>
            {count}
          </span>
        )}
      </div>
      {action && (
        <button onClick={action} className="flex items-center gap-1 text-[9px] hover:opacity-80 transition-opacity" style={{ color: "var(--neon-green)" }}>
          <Plus size={9} /> {actionLabel || "Add"}
        </button>
      )}
    </div>
  );
}

// ─── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ percent, size = 42, stroke = 3 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--neon-green)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      <text x={size / 2} y={size / 2 + 3} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--neon-green)">
        {percent}%
      </text>
    </svg>
  );
}

// ─── Task Item ─────────────────────────────────────────────────────────────────
function TaskItem({ task, onUpdate, onDelete, onSelect, isSelected }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef(null);

  const commit = () => {
    if (title.trim() && title !== task.title) onUpdate(task.id, { title: title.trim() });
    setEditing(false);
  };

  const statusCycle = {
    coming_soon: "in_progress",
    in_progress: "completed",
    completed: "coming_soon",
    blocked: "coming_soon",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 6, height: 0 }}
      className="group flex items-start gap-2.5 px-3 py-2.5 rounded-lg mx-2 mb-1 transition-all duration-200"
      style={{
        background: isSelected ? "rgba(57,255,20,0.05)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${isSelected ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.04)"}`,
        borderRadius: 8,
      }}
    >
      {/* Checkbox for bulk select */}
      <button
        onClick={() => onSelect(task.id)}
        className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: isSelected ? "var(--neon-green)" : "rgba(200,255,192,0.3)" }}
      >
        {isSelected ? <CheckSquare size={11} /> : <Square size={11} />}
      </button>

      {/* Status toggle */}
      <button
        onClick={() => onUpdate(task.id, { status: statusCycle[task.status] })}
        className="mt-0.5 flex-shrink-0 rounded-full w-3.5 h-3.5 border flex items-center justify-center transition-all duration-200 hover:scale-110"
        style={{
          borderColor: TASK_STATUS_COLORS[task.status],
          background: task.status === "completed" ? TASK_STATUS_COLORS[task.status] : "transparent",
        }}
        title={`Status: ${TASK_STATUS_LABELS[task.status]} — click to cycle`}
      >
        {task.status === "completed" && <Check size={8} color="#000" />}
        {task.status === "blocked" && <X size={8} style={{ color: TASK_STATUS_COLORS.blocked }} />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-transparent text-xs outline-none border-b"
            style={{ borderColor: "var(--neon-cyan)", color: "rgba(200,255,192,0.9)" }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
        ) : (
          <p
            className="text-xs leading-relaxed cursor-pointer transition-colors duration-200"
            style={{
              color: task.status === "completed" ? "rgba(200,255,192,0.3)" : "rgba(200,255,192,0.8)",
              textDecoration: task.status === "completed" ? "line-through" : "none",
            }}
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
          >
            {task.title}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge
            label={TASK_STATUS_LABELS[task.status]}
            color={TASK_STATUS_COLORS[task.status]}
          />
          {task.priority && task.priority !== "normal" && (
            <Badge
              label={task.priority}
              color={TASK_PRIORITY_COLORS[task.priority]}
            />
          )}
          {task.dueDate && (
            <span className="text-[8px] flex items-center gap-0.5" style={{ color: new Date(task.dueDate) < new Date() ? "var(--neon-magenta, #ff2d78)" : "rgba(200,255,192,0.3)" }}>
              <Clock size={7} /> {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-white/5" style={{ color: "rgba(200,255,192,0.4)" }} title="Edit">
          <Pencil size={9} />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMenu(p => !p)}
            className="p-1 rounded-md hover:bg-white/5"
            style={{ color: "rgba(200,255,192,0.4)" }}
            title="Priority"
          >
            <Flag size={9} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-6 z-50 rounded-lg border p-1 min-w-[90px]"
                style={{ background: "var(--bg-panel, #0d1117)", borderColor: "var(--border-green, rgba(57,255,20,0.2))" }}
              >
                {["low", "normal", "high", "urgent"].map(p => (
                  <button
                    key={p}
                    onClick={() => { onUpdate(task.id, { priority: p }); setShowMenu(false); }}
                    className="w-full text-left px-2 py-1 text-[9px] rounded-md hover:bg-white/5 flex items-center gap-1.5 transition-colors duration-150"
                    style={{ color: TASK_PRIORITY_COLORS[p] }}
                  >
                    <span>{p}</span>
                    {task.priority === p && <Check size={8} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => onDelete(task.id)} className="p-1 rounded-md hover:bg-white/5" style={{ color: "rgba(255,45,120,0.5)" }} title="Delete">
          <Trash2 size={9} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Output Item ───────────────────────────────────────────────────────────────
function OutputItem({ output, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(output.filename);
  const [expanded, setExpanded] = useState(false);

  const TYPE_ICONS = {
    code: "⌨️", style: "🎨", markup: "📄", markdown: "📝",
    data: "📊", image: "🖼️", document: "📎", text: "📄",
  };

  const commitRename = () => {
    if (newName.trim() && newName !== output.filename) onRename(output.id, newName.trim());
    setRenaming(false);
  };

  return (
    <div
      className="mx-2 mb-1.5 rounded-lg border overflow-hidden transition-all duration-200"
      style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)", borderRadius: 8 }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 group">
        <span style={{ fontSize: 11 }}>{TYPE_ICONS[output.type] || "📄"}</span>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              className="w-full bg-transparent text-[10px] outline-none border-b"
              style={{ borderColor: "var(--neon-cyan)", color: "rgba(200,255,192,0.9)" }}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              autoFocus
            />
          ) : (
            <p className="text-[10px] truncate font-mono" style={{ color: "rgba(200,255,192,0.75)" }}>
              {output.filename}
            </p>
          )}
          <span className="text-[8px] mt-0.5 block" style={{ color: "rgba(200,255,192,0.2)" }}>
            {new Date(output.updatedAt || output.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => setExpanded(p => !p)} className="p-1 rounded-md hover:bg-white/5" style={{ color: "rgba(200,255,192,0.4)" }}>
            {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
          </button>
          <button onClick={() => setRenaming(true)} className="p-1 rounded-md hover:bg-white/5" style={{ color: "rgba(200,255,192,0.4)" }}>
            <Pencil size={9} />
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(output.content); }}
            className="p-1 rounded-md hover:bg-white/5"
            style={{ color: "rgba(200,255,192,0.4)" }}
            title="Copy content"
          >
            <Copy size={9} />
          </button>
          <button onClick={() => onDelete(output.id)} className="p-1 rounded-md hover:bg-white/5" style={{ color: "rgba(255,45,120,0.5)" }}>
            <Trash2 size={9} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && output.content && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre
              className="text-[9px] px-3 pb-3 whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto custom-scrollbar"
              style={{ color: "rgba(200,255,192,0.45)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              {output.content.slice(0, 600)}{output.content.length > 600 ? "\n…" : ""}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Workspace Create/Edit Form ───────────────────────────────────────────────
function WorkspaceForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    type: initial?.type || "General",
    emoji: initial?.emoji || "🌐",
    description: initial?.description || "",
    rules: initial?.rules?.join("\n") || "",
    tags: initial?.tags?.join(", ") || "",
  });

  const isValid = form.name.trim().length > 0;

  const handleTypeChange = (type) => {
    const p = WORKSPACE_PRESETS[type];
    setForm(f => ({
      ...f, type,
      emoji: p?.emoji || f.emoji,
    }));
  };

  const inputStyle = {
    borderColor: "rgba(255,255,255,0.08)",
    color: "rgba(200,255,192,0.8)",
    borderRadius: 8,
  };

  return (
    <div className="p-4 space-y-3">
      {/* Type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(WORKSPACE_PRESETS).map(([type, { emoji }]) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-bold transition-all duration-200"
            style={{
              background: form.type === type ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${form.type === type ? "var(--neon-green)" : "rgba(255,255,255,0.06)"}`,
              color: form.type === type ? "var(--neon-green)" : "rgba(200,255,192,0.5)",
              borderRadius: 8,
            }}
          >
            <span>{emoji}</span> {type}
          </button>
        ))}
      </div>

      {/* Name + emoji */}
      <div className="flex gap-2">
        <button
          className="w-9 h-9 text-xl border flex items-center justify-center transition-all duration-200 hover:bg-white/5"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}
          onClick={() => {
            const emojis = Object.values(WORKSPACE_PRESETS).map(p => p.emoji);
            const idx = emojis.indexOf(form.emoji);
            setForm(f => ({ ...f, emoji: emojis[(idx + 1) % emojis.length] }));
          }}
          title="Click to cycle emoji"
        >
          {form.emoji}
        </button>
        <input
          type="text" maxLength={40} placeholder="Workspace name…"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="flex-1 bg-transparent border px-3 text-xs outline-none transition-colors duration-200 focus:border-[rgba(57,255,20,0.3)]"
          style={{ ...inputStyle, height: 38 }}
        />
      </div>

      <input
        type="text" placeholder="Description (optional)…"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        className="w-full bg-transparent border px-3 text-xs outline-none transition-colors duration-200 focus:border-[rgba(57,255,20,0.3)]"
        style={{ ...inputStyle, height: 34 }}
      />

      <textarea
        placeholder="Rules for the AI agent (one per line)…"
        value={form.rules}
        onChange={e => setForm(f => ({ ...f, rules: e.target.value }))}
        rows={3}
        className="w-full bg-transparent border px-3 py-2 text-xs outline-none resize-none transition-colors duration-200 focus:border-[rgba(57,255,20,0.3)]"
        style={{ ...inputStyle, lineHeight: 1.6 }}
      />

      <input
        type="text" placeholder="Tags (comma separated)…"
        value={form.tags}
        onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
        className="w-full bg-transparent border px-3 text-xs outline-none transition-colors duration-200 focus:border-[rgba(57,255,20,0.3)]"
        style={{ ...inputStyle, height: 34 }}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => isValid && onSave({
            ...form,
            tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
          })}
          disabled={!isValid}
          className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-200"
          style={{
            background: isValid ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.03)",
            color: isValid ? "var(--neon-green)" : "rgba(200,255,192,0.2)",
            border: `1px solid ${isValid ? "var(--neon-green)" : "rgba(255,255,255,0.05)"}`,
            cursor: isValid ? "pointer" : "not-allowed",
            borderRadius: 8,
          }}
        >
          {initial ? "✓ Save Changes" : "✓ Create Workspace"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-[10px] hover:bg-white/5 transition-all duration-200"
          style={{ color: "rgba(200,255,192,0.4)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function WorkspacePanel() {
  const ctx = useContext(WorkspaceContext);

  // ── Local UI state ─────────────────────────────────────────────
  const [tab, setTab] = useState("tasks");      // tasks | outputs | timeline | notes
  const [showCreateForm, setShowCreate] = useState(false);
  const [showEditForm, setShowEdit] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");        // all | coming_soon | in_progress | completed | blocked
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [newTaskInput, setNewTaskInput] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [showWsList, setShowWsList] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [agentPrompt, setAgentPrompt] = useState("");
  const importRef = useRef(null);

  // ── Bulk task select/deselect ──────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  if (!ctx) return null;

  const {
    workspaces, activeWorkspaceId, activeWorkspace, workspaceStats,
    setActiveWorkspaceId, createWorkspace, updateWorkspace, duplicateWorkspace,
    deleteWorkspace, archiveWorkspace, exportWorkspace, importWorkspace,
    addTask, updateTask, updateTaskStatus, deleteTask, bulkUpdateTasks, bulkDeleteTasks,
    saveOutput, deleteOutput, renameOutput,
    updateNotes, addTimelineEvent, clearTimeline,
    agentRun, startAgentRun, stopAgentRun, processAgentEvent,
  } = ctx;

  const ws = activeWorkspace;
  const tasks = ws?.tasks || [];
  const outputs = ws?.outputs || [];
  const timeline = ws?.timeline || [];

  // ── Filtered tasks ─────────────────────────────────────────────
  const filteredTasks = taskFilter === "all"
    ? tasks
    : tasks.filter(t => t.status === taskFilter);

  // ── Task quick-add ─────────────────────────────────────────────
  const handleAddTask = () => {
    if (!newTaskInput.trim()) return;
    addTask(newTaskInput.trim(), "coming_soon", { priority: newTaskPriority });
    addTimelineEvent(`Task added: "${newTaskInput.trim()}"`, "task");
    setNewTaskInput("");
  };

  const clearSelection = () => setSelectedTasks(new Set());

  const handleBulkComplete = () => {
    bulkUpdateTasks([...selectedTasks], { status: "completed", completedAt: new Date().toISOString() });
    clearSelection();
  };

  const handleBulkDelete = () => {
    bulkDeleteTasks([...selectedTasks]);
    clearSelection();
  };

  // ── Agent run handler ──────────────────────────────────────────
  const handleAgentRun = () => {
    if (!agentPrompt.trim() || !ws) return;
    startAgentRun(ws.id, agentPrompt.trim());
    addTimelineEvent(`Agent run started: "${agentPrompt.trim().slice(0, 60)}"`, "agent");
    setAgentPrompt("");
  };

  const handleStopAgent = () => {
    stopAgentRun();
    addTimelineEvent("Agent run stopped by user", "agent");
  };

  // ── Workspace list ─────────────────────────────────────────────
  const activeWorkspaces = workspaces.filter(w => !w.isArchived);
  const archivedWorkspaces = workspaces.filter(w => w.isArchived);

  // ── Timeline type colors ───────────────────────────────────────
  const timelineTypeColor = {
    info: "rgba(200,255,192,0.3)",
    task: "var(--neon-cyan)",
    output: "var(--neon-green)",
    agent: "rgba(255,165,0,0.8)",
    error: "var(--neon-magenta, #ff2d78)",
  };
  const timelineTypeIcon = { info: "·", task: "✓", output: "📄", agent: "⚡", error: "⚠" };

  // ── Import handler ─────────────────────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = importWorkspace(ev.target.result);
      if (!result.ok) alert("Import failed: " + result.error);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Agent console entries (last 5) ─────────────────────────────
  const agentConsoleEntries = (agentRun?.console || []).slice(-5);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="workspace-panel flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Workspace Selector Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgba(57,255,20,0.1)" }}
      >
        <button
          onClick={() => setShowWsList(p => !p)}
          className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity duration-200"
        >
          <span style={{ fontSize: 16 }}>{ws?.emoji || "🌐"}</span>
          <div className="min-w-0 text-left">
            <p className="text-xs font-bold truncate" style={{ color: ws ? "var(--neon-green)" : "rgba(200,255,192,0.4)" }}>
              {ws?.name || "No workspace selected"}
            </p>
            {ws && (
              <p className="text-[9px] truncate" style={{ color: "rgba(200,255,192,0.35)" }}>
                {ws.type}
              </p>
            )}
          </div>
          <ChevronDown size={11} style={{ color: "rgba(200,255,192,0.35)", flexShrink: 0, transform: showWsList ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        <div className="flex items-center gap-1 ml-3">
          {ws && (
            <>
              <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors duration-150" style={{ color: "rgba(200,255,192,0.4)" }} title="Edit workspace">
                <Pencil size={10} />
              </button>
              <button onClick={() => exportWorkspace(ws.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors duration-150" style={{ color: "rgba(200,255,192,0.4)" }} title="Export workspace">
                <Download size={10} />
              </button>
              <button onClick={() => duplicateWorkspace(ws.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors duration-150" style={{ color: "rgba(200,255,192,0.4)" }} title="Duplicate workspace">
                <Copy size={10} />
              </button>
            </>
          )}
          <button onClick={() => setShowCreate(true)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors duration-150" style={{ color: "var(--neon-green)" }} title="New workspace">
            <Plus size={11} />
          </button>
          <button onClick={() => importRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors duration-150" style={{ color: "rgba(200,255,192,0.4)" }} title="Import workspace">
            <Upload size={10} />
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* ── Workspace list dropdown ── */}
      <AnimatePresence>
        {showWsList && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b"
            style={{ borderColor: "rgba(57,255,20,0.08)" }}
          >
            <div className="max-h-[200px] overflow-y-auto py-1">
              {activeWorkspaces.length === 0 && archivedWorkspaces.length === 0 && (
                <p className="text-[10px] text-center py-4" style={{ color: "rgba(200,255,192,0.25)" }}>No workspaces yet</p>
              )}
              {activeWorkspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setActiveWorkspaceId(w.id); setShowWsList(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/5 transition-colors duration-150"
                >
                  <span style={{ fontSize: 13 }}>{w.emoji || "🌐"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: w.id === activeWorkspaceId ? "var(--neon-green)" : "rgba(200,255,192,0.7)" }}>{w.name}</p>
                    <p className="text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>{w.type} · {w.tasks?.length || 0} tasks</p>
                  </div>
                  {w.id === activeWorkspaceId && <Check size={10} style={{ color: "var(--neon-green)", flexShrink: 0 }} />}
                  <div className="flex items-center gap-0.5">
                    <button onClick={e => { e.stopPropagation(); archiveWorkspace(w.id); }} className="p-1 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100" style={{ color: "rgba(200,255,192,0.4)" }} title="Archive">
                      <Archive size={9} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirmDelete === w.id) { deleteWorkspace(w.id); setConfirmDelete(null); }
                        else { setConfirmDelete(w.id); setTimeout(() => setConfirmDelete(null), 2500); }
                      }}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors duration-150"
                      style={{ color: confirmDelete === w.id ? "var(--neon-magenta, #ff2d78)" : "rgba(200,255,192,0.3)" }}
                      title={confirmDelete === w.id ? "Click again to confirm delete" : "Delete"}
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                </button>
              ))}
              {archivedWorkspaces.length > 0 && (
                <div className="px-4 py-1.5 text-[8px] uppercase tracking-widest" style={{ color: "rgba(200,255,192,0.2)" }}>Archived</div>
              )}
              {archivedWorkspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setActiveWorkspaceId(w.id); setShowWsList(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/5 opacity-50 transition-colors duration-150"
                >
                  <span style={{ fontSize: 11 }}>{w.emoji || "🌐"}</span>
                  <span className="text-[10px] truncate" style={{ color: "rgba(200,255,192,0.5)" }}>{w.name}</span>
                  <button onClick={e => { e.stopPropagation(); archiveWorkspace(w.id); }} className="ml-auto p-1 rounded-lg hover:bg-white/10" style={{ color: "var(--neon-cyan)" }} title="Unarchive"><RefreshCw size={9} /></button>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create / Edit form ── */}
      <AnimatePresence>
        {(showCreateForm || showEditForm) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b"
            style={{ borderColor: "rgba(0,245,255,0.12)", background: "rgba(0,245,255,0.015)" }}
          >
            <WorkspaceForm
              initial={showEditForm ? ws : null}
              onSave={(data) => {
                if (showEditForm && ws) updateWorkspace(ws.id, data);
                else createWorkspace(data);
                setShowCreate(false);
                setShowEdit(false);
                setShowWsList(false);
              }}
              onCancel={() => { setShowCreate(false); setShowEdit(false); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── No workspace selected ── */}
      {!ws && !showCreateForm && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Folder size={30} style={{ color: "rgba(200,255,192,0.12)" }} />
          <p className="text-xs" style={{ color: "rgba(200,255,192,0.3)" }}>No workspace active</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
            style={{ background: "rgba(57,255,20,0.1)", color: "var(--neon-green)", border: "1px solid var(--neon-green)", borderRadius: 8 }}
          >
            + Create Workspace
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MAIN WORKSPACE CONTENT
       ══════════════════════════════════════════════════════════ */}
      {ws && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

          {/* ── Stats bar ── */}
          {workspaceStats && (
            <div
              className="flex items-center gap-5 px-4 py-3.5 border-b"
              style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.12)" }}
            >
              <ProgressRing percent={workspaceStats.progress} size={42} stroke={2.5} />
              <div className="flex gap-5 flex-wrap">
                {[
                  { label: "To Do", val: workspaceStats.toDo, color: TASK_STATUS_COLORS.coming_soon },
                  { label: "Doing", val: workspaceStats.inProgress, color: TASK_STATUS_COLORS.in_progress },
                  { label: "Done", val: workspaceStats.done, color: TASK_STATUS_COLORS.completed },
                  { label: "Blocked", val: workspaceStats.blocked, color: TASK_STATUS_COLORS.blocked },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-start">
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: s.color }}>{s.val}</span>
                    <span className="text-[8px] mt-0.5" style={{ color: "rgba(200,255,192,0.3)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
              {/* ── Agent LIVE indicator ── */}
              {agentRun?.isRunning && (
                <div className="ml-auto flex items-center gap-2">
                  <span
                    className="text-[8px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest"
                    style={{
                      color: "#ff8c00",
                      background: "rgba(255,140,0,0.1)",
                      border: "1px solid rgba(255,140,0,0.25)",
                      animation: "db-pulse 1.5s infinite",
                      borderRadius: 8,
                    }}
                  >
                    ● LIVE
                  </span>
                  {agentRun.currentAgent && (
                    <span className="text-[7px]" style={{ color: "rgba(255,140,0,0.6)" }}>
                      {agentRun.currentAgent}
                    </span>
                  )}
                  {agentRun.iteration != null && (
                    <span className="text-[7px]" style={{ color: "rgba(255,140,0,0.5)" }}>
                      iter {agentRun.iteration}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Agent ── */}
          <div
            className="px-4 py-3 border-b"
            style={{
              borderColor: agentRun?.isRunning ? "rgba(255,140,0,0.15)" : "rgba(255,255,255,0.04)",
              background: agentRun?.isRunning ? "rgba(255,140,0,0.025)" : "transparent",
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={10} style={{ color: agentRun?.isRunning ? "#ff8c00" : "rgba(200,255,192,0.3)" }} />
              <span className="text-[8px] font-bold uppercase tracking-[0.15em]" style={{ color: agentRun?.isRunning ? "#ff8c00" : "rgba(200,255,192,0.3)" }}>
                Agent
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-lg px-3 py-2 transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  opacity: agentRun?.isRunning ? 0.5 : 1,
                }}
              >
                <input
                  type="text"
                  placeholder="Tell the agent what to do…"
                  value={agentPrompt}
                  onChange={e => setAgentPrompt(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAgentRun()}
                  disabled={agentRun?.isRunning}
                  className="w-full bg-transparent text-[10px] outline-none"
                  style={{ color: "rgba(200,255,192,0.8)" }}
                />
              </div>
              {agentRun?.isRunning ? (
                <button
                  onClick={handleStopAgent}
                  className="flex items-center gap-1 px-3 py-2 text-[9px] font-bold transition-all duration-200 hover:opacity-80"
                  style={{
                    color: "#ff2d78",
                    background: "rgba(255,45,120,0.1)",
                    border: "1px solid rgba(255,45,120,0.25)",
                    borderRadius: 8,
                  }}
                >
                  <StopIcon size={8} /> Stop
                </button>
              ) : (
                <button
                  onClick={handleAgentRun}
                  disabled={!agentPrompt.trim()}
                  className="flex items-center gap-1 px-3 py-2 text-[9px] font-bold transition-all duration-200 hover:opacity-80"
                  style={{
                    color: agentPrompt.trim() ? "#ff8c00" : "rgba(200,255,192,0.15)",
                    background: agentPrompt.trim() ? "rgba(255,140,0,0.1)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${agentPrompt.trim() ? "rgba(255,140,0,0.25)" : "rgba(255,255,255,0.04)"}`,
                    borderRadius: 8,
                    cursor: agentPrompt.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  <Play size={8} /> Run
                </button>
              )}
            </div>

            {/* Agent status when running */}
            {agentRun?.isRunning && (
              <div className="mt-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  {agentRun.currentAgent && (
                    <Badge label={agentRun.currentAgent} color="#ff8c00" bg="rgba(255,140,0,0.1)" />
                  )}
                  {agentRun.iteration != null && (
                    <span className="text-[8px]" style={{ color: "rgba(255,140,0,0.6)" }}>
                      Iteration {agentRun.iteration}
                    </span>
                  )}
                </div>

                {/* Mini console (last 5 entries) */}
                {agentConsoleEntries.length > 0 && (
                  <div
                    className="rounded-lg border overflow-hidden"
                    style={{
                      borderColor: "rgba(255,140,0,0.12)",
                      background: "rgba(0,0,0,0.25)",
                      maxHeight: 100,
                      overflowY: "auto",
                      borderRadius: 8,
                    }}
                  >
                    <div className="px-3 py-2 space-y-1">
                      {agentConsoleEntries.map((entry, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-[7px] mt-0.5 flex-shrink-0" style={{ color: "rgba(255,140,0,0.5)" }}>
                            {entry.type === "error" ? "⚠" : entry.type === "result" ? "✓" : "›"}
                          </span>
                          <span
                            className="text-[8px] leading-relaxed break-all"
                            style={{
                              color: entry.type === "error" ? "rgba(255,45,120,0.8)" : "rgba(200,255,192,0.45)",
                            }}
                          >
                            {typeof entry.text === "string" ? entry.text.slice(0, 120) : JSON.stringify(entry.text).slice(0, 120)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Tab bar ── */}
          <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {[
              { id: "tasks", Icon: ListTodo, label: "Tasks" },
              { id: "outputs", Icon: FileText, label: "Outputs" },
              { id: "timeline", Icon: Clock, label: "Log" },
              { id: "notes", Icon: StickyNote, label: "Notes" },
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-200"
                style={{
                  color: tab === id ? "var(--neon-green)" : "rgba(200,255,192,0.28)",
                  borderBottom: tab === id ? "2px solid var(--neon-green)" : "2px solid transparent",
                  background: tab === id ? "rgba(57,255,20,0.025)" : "transparent",
                }}
              >
                <Icon size={9} /> {label}
                {id === "tasks" && tasks.length > 0 && <span className="text-[7px] px-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>{tasks.length}</span>}
                {id === "outputs" && outputs.length > 0 && <span className="text-[7px] px-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>{outputs.length}</span>}
              </button>
            ))}
          </div>

          {/* ══ TASKS TAB ══════════════════════════════════════════ */}
          {tab === "tasks" && (
            <div>
              {/* Quick-add */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                <div
                  className="flex-1 rounded-lg px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}
                >
                  <input
                    type="text"
                    placeholder="Add task…"
                    value={newTaskInput}
                    onChange={e => setNewTaskInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddTask()}
                    className="w-full bg-transparent text-xs outline-none"
                    style={{ color: "rgba(200,255,192,0.8)" }}
                  />
                </div>
                {/* Priority picker */}
                <div className="flex items-center gap-1">
                  {["low", "normal", "high", "urgent"].map(p => (
                    <button
                      key={p}
                      onClick={() => setNewTaskPriority(p)}
                      title={p}
                      className="w-3 h-3 rounded-full border transition-all duration-200"
                      style={{
                        background: newTaskPriority === p ? TASK_PRIORITY_COLORS[p] : "transparent",
                        borderColor: TASK_PRIORITY_COLORS[p],
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAddTask}
                  className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 transition-colors duration-150"
                  style={{ color: "var(--neon-green)" }}
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                {["all", "coming_soon", "in_progress", "completed", "blocked"].map(f => (
                  <button
                    key={f}
                    onClick={() => setTaskFilter(f)}
                    className="flex-shrink-0 px-2.5 py-0.5 text-[8px] font-bold transition-all duration-200"
                    style={{
                      background: taskFilter === f ? "rgba(57,255,20,0.1)" : "transparent",
                      color: taskFilter === f ? "var(--neon-green)" : "rgba(200,255,192,0.3)",
                      border: `1px solid ${taskFilter === f ? "rgba(57,255,20,0.25)" : "transparent"}`,
                      borderRadius: 8,
                    }}
                  >
                    {f === "all" ? `All (${tasks.length})` : `${TASK_STATUS_LABELS[f]} (${tasks.filter(t => t.status === f).length})`}
                  </button>
                ))}
              </div>

              {/* Bulk action bar */}
              <AnimatePresence>
                {selectedTasks.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-2 border-b"
                    style={{ borderColor: "rgba(57,255,20,0.08)", background: "rgba(57,255,20,0.03)" }}
                  >
                    <span className="text-[9px] font-bold" style={{ color: "var(--neon-green)" }}>
                      {selectedTasks.size} selected
                    </span>
                    <button onClick={handleBulkComplete} className="flex items-center gap-1 text-[9px] px-2.5 py-1 transition-colors duration-150" style={{ color: "var(--neon-green)", border: "1px solid rgba(57,255,20,0.25)", borderRadius: 8 }}>
                      <CheckSquare size={9} /> Complete
                    </button>
                    <button onClick={handleBulkDelete} className="flex items-center gap-1 text-[9px] px-2.5 py-1 transition-colors duration-150" style={{ color: "var(--neon-magenta, #ff2d78)", border: "1px solid rgba(255,45,120,0.25)", borderRadius: 8 }}>
                      <Trash2 size={9} /> Delete
                    </button>
                    <button onClick={clearSelection} className="ml-auto" style={{ color: "rgba(200,255,192,0.3)" }}>
                      <X size={10} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Task list */}
              <div className="py-1">
                <AnimatePresence>
                  {filteredTasks.length === 0 && (
                    <p className="text-[10px] text-center py-6" style={{ color: "rgba(200,255,192,0.2)" }}>
                      {taskFilter === "all" ? "No tasks yet. Add one above." : `No ${TASK_STATUS_LABELS[taskFilter]} tasks.`}
                    </p>
                  )}
                  {filteredTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                      onSelect={toggleSelect}
                      isSelected={selectedTasks.has(task.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ══ OUTPUTS TAB ════════════════════════════════════════ */}
          {tab === "outputs" && (
            <div className="py-1">
              {outputs.length === 0 && (
                <p className="text-[10px] text-center py-8" style={{ color: "rgba(200,255,192,0.2)" }}>
                  No outputs yet. The AI agent will save files here.
                </p>
              )}
              <AnimatePresence>
                {outputs.map(output => (
                  <OutputItem
                    key={output.id}
                    output={output}
                    onDelete={deleteOutput}
                    onRename={renameOutput}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* ══ TIMELINE TAB ═══════════════════════════════════════ */}
          {tab === "timeline" && (
            <div>
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                <span className="text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>{timeline.length} events</span>
                {timeline.length > 0 && (
                  <button onClick={clearTimeline} className="flex items-center gap-1 text-[9px] hover:opacity-80 transition-opacity duration-150" style={{ color: "rgba(255,45,120,0.6)" }}>
                    <RotateCcw size={9} /> Clear
                  </button>
                )}
              </div>
              <div className="py-1 px-4">
                {timeline.length === 0 && (
                  <p className="text-[10px] text-center py-8" style={{ color: "rgba(200,255,192,0.2)" }}>
                    No events yet.
                  </p>
                )}
                {timeline.map((ev, i) => (
                  <div key={ev.id} className="flex items-start gap-2.5 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                    <span className="text-[10px] flex-shrink-0 mt-0.5 w-3 text-center" style={{ color: timelineTypeColor[ev.type] || "rgba(200,255,192,0.3)" }}>
                      {timelineTypeIcon[ev.type] || "·"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] leading-relaxed" style={{ color: "rgba(200,255,192,0.65)" }}>{ev.text}</p>
                      <p className="text-[8px] mt-0.5" style={{ color: "rgba(200,255,192,0.2)" }}>
                        {new Date(ev.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ NOTES TAB ══════════════════════════════════════════ */}
          {tab === "notes" && (
            <div className="px-4 py-3 flex flex-col gap-2">
              <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(200,255,192,0.3)" }}>
                Workspace Notes
              </p>
              <textarea
                className="w-full bg-transparent border px-3 py-2.5 text-xs outline-none resize-none transition-colors duration-200 focus:border-[rgba(57,255,20,0.3)]"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "rgba(200,255,192,0.8)",
                  minHeight: 180,
                  lineHeight: 1.7,
                  borderRadius: 8,
                }}
                placeholder="Free-form notes for this workspace…"
                value={ws.notes || ""}
                onChange={e => updateNotes(e.target.value)}
              />
              <p className="text-[8px]" style={{ color: "rgba(200,255,192,0.2)" }}>
                Auto-saved · {ws.notes?.length || 0} chars
              </p>
            </div>
          )}

          {/* ── Rules display (always visible at bottom) ── */}
          {ws.rules?.length > 0 && (
            <div className="px-4 py-3 mt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <p className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(200,255,192,0.25)" }}>
                Agent Rules ({ws.rules.length})
              </p>
              <div className="space-y-1.5">
                {ws.rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[8px] mt-0.5 flex-shrink-0" style={{ color: "rgba(200,255,192,0.2)" }}>{i + 1}.</span>
                    <p className="text-[9px] leading-relaxed" style={{ color: "rgba(200,255,192,0.45)" }}>{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
