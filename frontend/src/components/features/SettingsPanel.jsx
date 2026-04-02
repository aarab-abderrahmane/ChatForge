// Trigger Vite HMR Reload
import { useContext, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Monitor,
  Volume2,
  VolumeX,
  Key,
  Download,
  Upload,
  Trash2,
  Type,
  Plus,
  Clock,
  AlignJustify,
  Zap,
  MousePointerClick,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Palette,
  Bot,
  Settings2,
  Database,
  SlidersHorizontal,
  MessageSquare,
  AlignLeft,
  LayoutList,
  Wand2,
  Gauge,
  CaseSensitive,
  Layers,
  Wrench,
  Smile,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
} from "lucide-react";
import { chatsContext, SKILLS, MODELS, THEMES } from "../../context/chatsContext";
import { api } from "../../services/api";
import { StorageService } from "../../services/db";
import { useEffect as useAppEffect } from "react";

// ── Inline Toggle ────────────────────────────────────────────
function Toggle({ value, onToggle }) {
  return (
    <div
      className={`toggle-track ${value ? "on" : ""}`}
      onClick={onToggle}
      role="switch"
      aria-checked={value}
    >
      <div className="toggle-thumb" />
    </div>
  );
}

// ── Emoji picker options ──────────────────────────────────────
const EMOJI_OPTIONS = [
  "⭐", "🎯", "🔥", "💡", "🧩", "🎨", "🚀", "⚙️", "🌟", "🎤",
  "📚", "🧠", "🔮", "💎", "🌈", "🎭", "🤖", "🦊", "🐉", "🌀",
];

// ── Custom Skill Form ─────────────────────────────────────────
function CustomSkillForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ icon: "⭐", name: "", description: "", systemPrompt: "" });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const valid = form.name.trim().length > 0 && form.systemPrompt.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-3 mb-3 rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--neon-cyan-dim)", background: "rgba(0,245,255,0.03)" }}
    >
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker((p) => !p)}
              className="w-9 h-9 text-xl rounded-lg border flex items-center justify-center hover:bg-white/5 transition-all"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
            >
              {form.icon}
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-10 left-0 z-50 p-2 rounded-lg border grid grid-cols-5 gap-1"
                  style={{ background: "var(--bg-panel)", borderColor: "var(--border-green)" }}
                >
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { setForm((p) => ({ ...p, icon: e })); setShowEmojiPicker(false); }}
                      className="w-7 h-7 text-base rounded hover:bg-white/10 transition-all flex items-center justify-center"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            type="text"
            placeholder="Skill name…"
            maxLength={24}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="flex-1 bg-transparent border rounded px-2 text-xs outline-none"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(200,255,192,0.9)", height: 36 }}
          />
        </div>
        <input
          type="text"
          placeholder="Short description (optional)…"
          maxLength={60}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="w-full bg-transparent border rounded px-2 text-xs outline-none"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(200,255,192,0.7)", height: 32 }}
        />
        <textarea
          placeholder="System prompt — define how the AI behaves…"
          value={form.systemPrompt}
          onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
          rows={4}
          className="w-full bg-transparent border rounded px-2 py-2 text-xs outline-none resize-none"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(200,255,192,0.85)", lineHeight: 1.5 }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all"
            style={{
              background: valid ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.03)",
              color: valid ? "var(--neon-green)" : "rgba(200,255,192,0.2)",
              border: `1px solid ${valid ? "var(--neon-green)" : "rgba(255,255,255,0.05)"}`,
              cursor: valid ? "pointer" : "not-allowed",
              boxShadow: valid ? "var(--glow-green)" : "none",
            }}
          >
            ✓ Save Skill
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[10px] transition-all hover:bg-white/5"
            style={{ color: "rgba(200,255,192,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Custom AI Tool Form ───────────────────────────────────────
function CustomAIToolForm({ onSave, onCancel, initialData }) {
  const [form, setForm] = useState(initialData || { icon: "🔧", label: "", prompt: "" });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // They must have a label and prompt
  const valid = form.label.trim().length > 0 && (form.prompt || "").trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-3 mb-3 rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--neon-cyan-dim)", background: "rgba(0,245,255,0.03)" }}
    >
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker((p) => !p)}
              className="w-9 h-9 text-xl rounded-lg border flex items-center justify-center hover:bg-white/5 transition-all"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
            >
              {form.icon}
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-10 left-0 z-50 p-2 rounded-lg border grid grid-cols-5 gap-1"
                  style={{ background: "var(--bg-panel)", borderColor: "var(--border-green)" }}
                >
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { setForm((p) => ({ ...p, icon: e })); setShowEmojiPicker(false); }}
                      className="w-7 h-7 text-base rounded hover:bg-white/10 transition-all flex items-center justify-center"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            type="text"
            placeholder="Tool Label…"
            maxLength={16}
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            className="flex-1 bg-transparent border rounded px-2 text-xs outline-none"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(200,255,192,0.9)", height: 36 }}
          />
        </div>
        <textarea
          placeholder="Prompt template (e.g. 'Fix grammar for: ')"
          value={form.prompt || ""}
          onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
          rows={3}
          className="w-full bg-transparent border rounded px-2 py-2 text-xs outline-none resize-none"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(200,255,192,0.85)", lineHeight: 1.5 }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all"
            style={{
              background: valid ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.03)",
              color: valid ? "var(--neon-green)" : "rgba(200,255,192,0.2)",
              border: `1px solid ${valid ? "var(--neon-green)" : "rgba(255,255,255,0.05)"}`,
              cursor: valid ? "pointer" : "not-allowed",
              boxShadow: valid ? "var(--glow-green)" : "none",
            }}
          >
            ✓ Save Tool
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[10px] transition-all hover:bg-white/5"
            style={{ color: "rgba(200,255,192,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section Header ────────────────────────────────────────────
function SectionHeader({ label, danger = false, action, actionLabel }) {
  return (
    <div
      className="px-4 py-2 text-[9px] tracking-widest uppercase border-t flex items-center justify-between"
      style={{
        color: danger ? "rgba(255,45,120,0.5)" : "rgba(200,255,192,0.3)",
        borderColor: "rgba(255,255,255,0.04)",
      }}
    >
      <span>{label}</span>
      {action && (
        <button
          onClick={action}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[8px] border transition-all hover:bg-white/5"
          style={{ color: "var(--neon-cyan)", borderColor: "var(--neon-cyan-dim)" }}
        >
          <Plus size={9} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Color Row ─────────────────────────────────────────────────
function ColorRow({ label, value, onChange }) {
  const inputRef = useRef(null);
  const isValid = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <div className="color-input-row">
      <span className="color-label">{label}</span>
      <div
        className="color-swatch-preview"
        style={{ background: isValid ? value : "#333" }}
        onClick={() => inputRef.current?.click()}
        title="Click to open color picker"
      />
      {/* Hidden native color input */}
      <input
        ref={inputRef}
        type="color"
        value={isValid ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 0, height: 0, opacity: 0, border: "none", padding: 0, position: "absolute" }}
        tabIndex={-1}
      />
      <input
        type="text"
        className="color-hex-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={7}
        placeholder="#RRGGBB"
      />
    </div>
  );
}

// ── TAB DATA ──────────────────────────────────────────────────
const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ai", label: "AI", icon: Bot },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "interface", label: "Interface", icon: Settings2 },
  { id: "data", label: "Data", icon: Database },
  { id: "keys", label: "Keys", icon: Key },
];

// ── Main Settings Panel ───────────────────────────────────────
export function SettingsPanel({ onClose }) {
  const {
    settings,
    setSettings,
    setPreferences,
    preferences,
    sessions,
    clearCurrentChat,
    clearAllSessions,
    importSessions,
    customSkills,
    addCustomSkill,
    deleteCustomSkill,
    aiTools,
    addAITool,
    updateAITool,
    deleteAITool,
    providerStatus,
    setProviderStatus,
  } = useContext(chatsContext);

  const [activeTab, setActiveTab] = useState("appearance");
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showToolForm, setShowToolForm] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [showRouting, setShowRouting] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef(null);

  // ── Keys tab state ────────────────────────────────────────────
  const [keyValues, setKeyValues] = useState({ openrouter: "", groq: "", gemini: "", huggingface: "" });
  const [keyVisible, setKeyVisible] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false });
  const [keySaving, setKeySaving] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false });
  const [keyResults, setKeyResults] = useState({});
  const [storageUsage, setStorageUsage] = useState({ used: 0, quota: 0, percentage: 0 });

  const fetchStorageUsage = async () => {
    const usage = await StorageService.getUsage();
    setStorageUsage(usage);
  };

  useAppEffect(() => {
    if (activeTab === "data") {
      fetchStorageUsage();
    }
  }, [activeTab]);

  const handleSaveKey = async (provider) => {
    const key = keyValues[provider]?.trim();
    if (!key) return;
    setKeySaving((p) => ({ ...p, [provider]: true }));
    setKeyResults((p) => ({ ...p, [provider]: null }));
    try {
      const res = await api.saveKeys(preferences.userId, { [provider]: key });
      const result = res?.results?.[provider];
      setKeyResults((p) => ({ ...p, [provider]: result }));
      if (result?.ok) {
        setProviderStatus((p) => ({ ...p, [provider]: true }));
        // Clear the input on success
        setKeyValues((p) => ({ ...p, [provider]: "" }));
        // Only auto-navigate if no other providers are partially filled
        const othersFilled = Object.entries(keyValues).some(([k, v]) => k !== provider && v.trim().length > 0);
        if (!othersFilled) {
          setPreferences((p) => ({ ...p, currentPage: "chat" }));
        }
      }
    } catch {
      setKeyResults((p) => ({ ...p, [provider]: { ok: false, error: "Network error" } }));
    } finally {
      setKeySaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const toggle = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const resetAPIKey = () => {
    setPreferences((prev) => ({ ...prev, currentPage: "guide" }));
    onClose();
  };

  const exportChats = () => {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chatforge_export_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTxt = () => {
    const lines = [];
    sessions.forEach((session) => {
      lines.push(`=== ${session.title} (${new Date(session.createdAt).toLocaleString()}) ===`);
      session.messages.forEach((m) => {
        if (m.type === "ch") {
          lines.push(`\n> ${m.question}`);
          lines.push(m.answer || "");
        }
      });
      lines.push("\n");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chatforge_export_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const ok = importSessions(parsed);
        if (!ok) alert("Invalid ChatForge export file.");
      } catch {
        alert("Could not parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveSkill = (form) => {
    addCustomSkill(form);
    setShowSkillForm(false);
  };

  const activeTheme = THEMES.find((t) => t.id === settings.theme) || THEMES[0];
  const allSkills = [...SKILLS, ...customSkills];

  // Stats
  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.filter((m) => m.type === "ch").length, 0);
  const totalWords = sessions.reduce(
    (acc, s) =>
      acc +
      s.messages
        .filter((m) => m.type === "ch")
        .reduce((a, m) => a + ((m.question || "") + " " + (m.answer || "")).split(" ").length, 0),
    0
  );
  const estTokens = Math.round(totalWords * 1.3);

  // Update custom theme color
  const setCustomColor = (key, val) => {
    setSettings((prev) => ({
      ...prev,
      customTheme: { ...prev.customTheme, [key]: val },
    }));
  };

  return (
    <AnimatePresence>
      <motion.div
        className="settings-panel"
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{ maxHeight: "82vh", overflowY: "hidden", width: 380, display: "flex", flexDirection: "column" }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border-green)", background: "var(--bg-panel)" }}
        >
          <div className="flex items-center gap-2">
            <Settings2 size={13} style={{ color: "var(--neon-cyan)" }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--neon-cyan)" }}>
              Settings
            </span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={13} />
          </button>
        </div>

        {/* ── Tab List ───────────────────────────────────────── */}
        <div className="settings-tab-list flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`settings-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`settings-tab-btn ${activeTab === t.id ? "active" : ""}`}
            >
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────────── */}
        <div className="settings-tab-content" style={{ overflowY: "auto" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
            >

              {/* ══════════════════════════════════════════════
                  TAB: APPEARANCE
              ══════════════════════════════════════════════ */}
              {activeTab === "appearance" && (
                <>
                  {/* Color Theme */}
                  <SectionHeader label="Color Theme" />
                  <div className="theme-grid">
                    {THEMES.map((t) => {
                      const isActive = settings.theme === t.id;
                      return (
                        <button
                          key={t.id}
                          id={`theme-${t.id}`}
                          onClick={() => setSettings((prev) => ({ ...prev, theme: t.id }))}
                          className={`theme-card ${isActive ? "active" : ""}`}
                          style={{
                            borderColor: isActive ? t.primary : "rgba(255,255,255,0.06)",
                            boxShadow: isActive ? `0 0 14px ${t.primary}44` : "none",
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{t.icon}</span>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider text-center"
                            style={{ color: isActive ? t.primary : "rgba(200,255,192,0.4)" }}
                          >
                            {t.name}
                          </span>
                          <div className="theme-swatches">
                            <div className="theme-swatch" style={{ background: t.primary }} />
                            <div className="theme-swatch" style={{ background: t.secondary }} />
                            <div className="theme-swatch" style={{ background: t.accent }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom theme color picker — show only when "custom" is selected */}
                  <AnimatePresence>
                    {settings.theme === "custom" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="custom-theme-section">
                          <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "var(--neon-cyan)" }}>
                            ✏ Custom Colors
                          </div>
                          <ColorRow
                            label="Primary"
                            value={settings.customTheme?.primary || "#39ff14"}
                            onChange={(v) => setCustomColor("primary", v)}
                          />
                          <ColorRow
                            label="Secondary"
                            value={settings.customTheme?.secondary || "#00f5ff"}
                            onChange={(v) => setCustomColor("secondary", v)}
                          />
                          <ColorRow
                            label="Accent"
                            value={settings.customTheme?.accent || "#ff2d78"}
                            onChange={(v) => setCustomColor("accent", v)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Font Family */}
                  <SectionHeader label="Typography" />

                  <div className="px-4 py-2 flex gap-2">
                    {[
                      { id: "fira", label: "Fira Code" },
                      { id: "jetbrains", label: "JetBrains" },
                      { id: "cascadia", label: "Cascadia" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        id={`font-${f.id}`}
                        onClick={() => setSettings((p) => ({ ...p, font: f.id }))}
                        className={`radio-btn ${settings.font === f.id ? "active" : ""}`}
                        style={{ border: "none", padding: "7px 4px", flex: 1 }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Font Size Slider */}
                  <div className="range-row">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
                        <CaseSensitive size={14} style={{ color: "var(--neon-green)" }} />
                        Font Size
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                        {settings.fontSize || 14}px
                      </span>
                    </div>
                    <input
                      type="range"
                      className="neon-range"
                      min={12}
                      max={18}
                      step={1}
                      value={settings.fontSize || 14}
                      onChange={(e) => setSettings((p) => ({ ...p, fontSize: +e.target.value }))}
                    />
                    <div className="range-labels">
                      <span>12px · Small</span>
                      <span>18px · Large</span>
                    </div>
                  </div>

                  {/* Scanlines */}
                  <div className="settings-toggle" onClick={() => toggle("scanlines")}>
                    <Monitor size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Scanlines effect</span>
                    <Toggle value={settings.scanlines} onToggle={() => toggle("scanlines")} />
                  </div>

                  {/* Compact mode */}
                  <div className="settings-toggle" onClick={() => toggle("compactMode")}>
                    <AlignJustify size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Compact mode</span>
                    <Toggle value={settings.compactMode} onToggle={() => toggle("compactMode")} />
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════
                  TAB: TOOLS
              ══════════════════════════════════════════════ */}
              {activeTab === "tools" && (
                <>
                  <SectionHeader
                    label="AI Action Tools"
                    action={() => { setEditingTool(null); setShowToolForm((p) => !p); }}
                    actionLabel="New Tool"
                  />

                  <AnimatePresence>
                    {showToolForm && (
                      <CustomAIToolForm
                        initialData={editingTool}
                        onSave={(form) => {
                          if (editingTool) {
                            updateAITool(editingTool.id, form);
                          } else {
                            addAITool(form);
                          }
                          setShowToolForm(false);
                          setEditingTool(null);
                        }}
                        onCancel={() => { setShowToolForm(false); setEditingTool(null); }}
                      />
                    )}
                  </AnimatePresence>

                  <div className="px-3 pb-3 flex flex-col gap-2">
                    {aiTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between p-2 rounded-lg border group transition-all hover:bg-white/5"
                        style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-center gap-3">
                          <span style={{ fontSize: 16 }}>{tool.icon}</span>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                              {tool.label}
                            </span>
                            <span className="text-[9px]" style={{ color: "rgba(200,255,192,0.4)" }}>
                              {tool.prompt ? `Prompt: ${tool.prompt.substring(0, 35)}${tool.prompt.length > 35 ? "..." : ""}` : `Command: ${tool.cmd}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingTool(tool); setShowToolForm(true); }}
                            className="p-1 rounded hover:bg-white/10"
                            style={{ color: "var(--neon-green)" }}
                          >
                            <Settings2 size={12} />
                          </button>
                          <button
                            onClick={() => deleteAITool(tool.id)}
                            className="p-1 rounded hover:bg-white/10"
                            style={{ color: "rgba(255,45,120,0.8)" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════
                  TAB: AI
              ══════════════════════════════════════════════ */}
              {activeTab === "ai" && (
                <>
                  {/* AI Skill */}
                  <SectionHeader
                    label="AI Personality / Skill"
                    action={() => setShowSkillForm((p) => !p)}
                    actionLabel="New Skill"
                  />

                  <AnimatePresence>
                    {showSkillForm && (
                      <CustomSkillForm
                        onSave={handleSaveSkill}
                        onCancel={() => setShowSkillForm(false)}
                      />
                    )}
                  </AnimatePresence>

                  <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                    {allSkills.map((skill) => {
                      const isActive = settings.activeSkillId === skill.id;
                      return (
                        <div
                          key={skill.id}
                          id={`skill-${skill.id}`}
                          onClick={() => setSettings((prev) => ({ ...prev, activeSkillId: skill.id }))}
                          className="relative flex flex-col items-center gap-1 p-2 rounded-lg border cursor-pointer transition-all"
                          style={{
                            background: isActive ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.02)",
                            borderColor: isActive ? "var(--neon-green)" : "rgba(255,255,255,0.05)",
                            boxShadow: isActive ? "0 0 10px rgba(57,255,20,0.15)" : "none",
                          }}
                          title={skill.description}
                        >
                          {skill.isCustom && (
                            <span className="absolute top-1 right-1 text-[7px] px-1 rounded" style={{ background: "rgba(0,245,255,0.1)", color: "var(--neon-cyan)" }}>
                              custom
                            </span>
                          )}
                          <span style={{ fontSize: 20 }}>{skill.icon}</span>
                          <span className="text-[10px] uppercase tracking-tighter text-center" style={{ color: isActive ? "var(--neon-green)" : "rgba(200,255,192,0.4)" }}>
                            {skill.name}
                          </span>
                          {skill.isCustom && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteCustomSkill(skill.id); }}
                              className="absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity"
                              style={{ color: "rgba(255,45,120,0.7)" }}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Routing Strategy */}
                  <SectionHeader label="Routing Strategy" actionLabel={settings.routingMode === "smart" ? "⚡ Auto" : "🔒 Forced"} />

                  <button
                    id="routing-picker-toggle"
                    onClick={() => setShowRouting((p) => !p)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-all mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 16 }}>
                        {settings.routingMode === "smart" ? "🔄" : settings.routingMode === "groq" ? "⚡" : settings.routingMode === "gemini" ? "🧠" : "🌐"}
                      </span>
                      <span className="text-xs font-bold" style={{ color: "var(--neon-green)" }}>
                        {settings.routingMode === "smart" ? "Smart Router (Auto)" : settings.routingMode === "groq" ? "Force Groq" : settings.routingMode === "gemini" ? "Force Gemini" : "Force OpenRouter"}
                      </span>
                    </div>
                    {showRouting
                      ? <ChevronUp size={12} style={{ color: "rgba(200,255,192,0.3)" }} />
                      : <ChevronDown size={12} style={{ color: "rgba(200,255,192,0.3)" }} />}
                  </button>

                  <AnimatePresence>
                    {showRouting && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mb-4"
                      >
                        <div className="px-3 pb-3 flex flex-col gap-1.5">
                          {[
                            { id: "smart", label: "Smart Router (Auto)", icon: "🔄", desc: "Shorts → Groq, Code → Gemini, Long → OpenRouter." },
                            { id: "groq", label: "Force Groq", icon: "⚡", desc: "Send everything to Groq (requires Groq key)." },
                            { id: "gemini", label: "Force Gemini", icon: "🧠", desc: "Send everything to Gemini (requires Gemini key)." },
                            { id: "openrouter", label: "Force OpenRouter", icon: "🌐", desc: "Send everything to OpenRouter (mandatory fallback)." },
                          ].map((route) => {
                            const isActive = settings.routingMode === route.id;
                            const isMissingKey = route.id !== "smart" && !providerStatus[route.id];
                            return (
                              <div
                                key={route.id}
                                onClick={() => !isMissingKey && setSettings((prev) => ({ ...prev, routingMode: route.id }))}
                                className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${isMissingKey ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/5"}`}
                                style={{
                                  background: isActive ? "rgba(57,255,20,0.06)" : "rgba(255,255,255,0.02)",
                                  borderColor: isActive ? "var(--neon-green)" : "rgba(255,255,255,0.05)",
                                }}
                              >
                                <span style={{ fontSize: 16 }}>{route.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold" style={{ color: isActive ? "var(--neon-green)" : "rgba(200,255,192,0.8)" }}>{route.label}</span>
                                    {isMissingKey && <span className="text-[7px] text-[var(--neon-magenta)] border border-[var(--neon-magenta)] px-1 rounded uppercase">key missing</span>}
                                  </div>
                                  <div className="text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>{route.desc}</div>
                                </div>
                                {isActive && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(57,255,20,0.1)", color: "var(--neon-green)" }}>active</span>}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AI Model */}
                  <SectionHeader label="OpenRouter Fallback Model" />

                  <button
                    id="model-picker-toggle"
                    onClick={() => setShowModels((p) => !p)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 16 }}>
                        {MODELS.find((m) => m.id === settings.activeModelId)?.icon || "🧠"}
                      </span>
                      <span className="text-xs" style={{ color: "var(--neon-cyan)" }}>
                        {MODELS.find((m) => m.id === settings.activeModelId)?.name || "Select model"}
                      </span>
                    </div>
                    {showModels
                      ? <ChevronUp size={12} style={{ color: "rgba(200,255,192,0.3)" }} />
                      : <ChevronDown size={12} style={{ color: "rgba(200,255,192,0.3)" }} />}
                  </button>

                  <AnimatePresence>
                    {showModels && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 flex flex-col gap-1.5">
                          {MODELS.map((model) => {
                            const isActive = settings.activeModelId === model.id;
                            return (
                              <div
                                key={model.id}
                                id={`model-${model.id.replace(/[^a-z0-9]/gi, "-")}`}
                                onClick={() => { setSettings((prev) => ({ ...prev, activeModelId: model.id })); setShowModels(false); }}
                                className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all hover:bg-white/5"
                                style={{
                                  background: isActive ? "rgba(0,245,255,0.06)" : "rgba(255,255,255,0.02)",
                                  borderColor: isActive ? "var(--neon-cyan)" : "rgba(255,255,255,0.05)",
                                }}
                                title={model.description}
                              >
                                <span style={{ fontSize: 16 }}>{model.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-semibold" style={{ color: isActive ? "var(--neon-cyan)" : "rgba(200,255,192,0.8)" }}>
                                    {model.name}
                                  </div>
                                  <div className="text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>
                                    {model.provider} · {model.description.slice(0, 36)}…
                                  </div>
                                </div>
                                {isActive && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,245,255,0.1)", color: "var(--neon-cyan)" }}>
                                    active
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Response Length */}
                  <SectionHeader label="Response Length" />
                  <div className="radio-group">
                    {["short", "balanced", "detailed"].map((opt) => (
                      <button
                        key={opt}
                        id={`response-length-${opt}`}
                        onClick={() => setSettings((p) => ({ ...p, responseLength: opt }))}
                        className={`radio-btn ${settings.responseLength === opt ? "active" : ""}`}
                      >
                        {opt === "short" ? "✦ Short" : opt === "balanced" ? "⬡ Balanced" : "≡ Detailed"}
                      </button>
                    ))}
                  </div>

                  {/* Temperature Slider */}
                  <div className="range-row">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
                        <Gauge size={14} style={{ color: "var(--neon-green)" }} />
                        Creativity
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                        {(settings.temperature ?? 0.7).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="neon-range"
                      min={0}
                      max={15}
                      step={1}
                      value={Math.round((settings.temperature ?? 0.7) * 10)}
                      onChange={(e) => setSettings((p) => ({ ...p, temperature: +e.target.value / 10 }))}
                    />
                    <div className="range-labels">
                      <span>0.0 · Precise</span>
                      <span>1.5 · Creative</span>
                    </div>
                  </div>

                  {/* Top P Slider */}
                  <div className="range-row">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
                        <Gauge size={14} style={{ color: "var(--neon-green)" }} />
                        Top P
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                        {(settings.topP ?? 1.0).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="neon-range"
                      min={0}
                      max={10}
                      step={1}
                      value={Math.round((settings.topP ?? 1.0) * 10)}
                      onChange={(e) => setSettings((p) => ({ ...p, topP: +e.target.value / 10 }))}
                    />
                    <div className="range-labels">
                      <span>0.0 · Focused</span>
                      <span>1.0 · Diverse</span>
                    </div>
                  </div>

                  {/* Frequency Penalty */}
                  <div className="range-row">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
                        <SlidersHorizontal size={14} style={{ color: "var(--neon-green)" }} />
                        Freq Penalty
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                        {(settings.frequencyPenalty ?? 0.0).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="neon-range"
                      min={-20}
                      max={20}
                      step={1}
                      value={Math.round((settings.frequencyPenalty ?? 0.0) * 10)}
                      onChange={(e) => setSettings((p) => ({ ...p, frequencyPenalty: +e.target.value / 10 }))}
                    />
                    <div className="range-labels">
                      <span>-2.0</span>
                      <span>2.0</span>
                    </div>
                  </div>

                  {/* Presence Penalty */}
                  <div className="range-row">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
                        <SlidersHorizontal size={14} style={{ color: "var(--neon-green)" }} />
                        Pres Penalty
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                        {(settings.presencePenalty ?? 0.0).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="neon-range"
                      min={-20}
                      max={20}
                      step={1}
                      value={Math.round((settings.presencePenalty ?? 0.0) * 10)}
                      onChange={(e) => setSettings((p) => ({ ...p, presencePenalty: +e.target.value / 10 }))}
                    />
                    <div className="range-labels">
                      <span>-2.0</span>
                      <span>2.0</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="range-row">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
                        <AlignJustify size={14} style={{ color: "var(--neon-green)" }} />
                        Max Tokens
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--neon-cyan)" }}>
                        {settings.maxTokens ?? 2048}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="neon-range"
                      min={256}
                      max={8192}
                      step={256}
                      value={settings.maxTokens ?? 2048}
                      onChange={(e) => setSettings((p) => ({ ...p, maxTokens: +e.target.value }))}
                    />
                    <div className="range-labels">
                      <span>256</span>
                      <span>8192</span>
                    </div>
                  </div>

                  {/* System Prompt Prefix */}
                  <SectionHeader label="Context Prefix" />
                  <div className="px-3 pb-3">
                    <p className="text-[9px] mb-2" style={{ color: "rgba(200,255,192,0.35)" }}>
                      Added to every AI skill prompt. Use it to give background context (e.g. your name, project, language preference).
                    </p>
                    <textarea
                      className="system-prompt-textarea"
                      rows={3}
                      placeholder="e.g. Always respond in French. My project uses React and Node.js…"
                      value={settings.systemPromptPrefix || ""}
                      onChange={(e) => setSettings((p) => ({ ...p, systemPromptPrefix: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════
                  TAB: INTERFACE
              ══════════════════════════════════════════════ */}
              {activeTab === "interface" && (
                <>
                  <SectionHeader label="Behavior" />

                  <div className="settings-toggle" onClick={() => toggle("autoScroll")}>
                    <MousePointerClick size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Auto-scroll to bottom</span>
                    <Toggle value={settings.autoScroll} onToggle={() => toggle("autoScroll")} />
                  </div>

                  <div className="settings-toggle" onClick={() => toggle("streamingIndicator")}>
                    <Zap size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Streaming indicator</span>
                    <Toggle value={settings.streamingIndicator} onToggle={() => toggle("streamingIndicator")} />
                  </div>

                  <div className="settings-toggle" onClick={() => toggle("showTimestamps")}>
                    <Clock size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Show timestamps</span>
                    <Toggle value={settings.showTimestamps} onToggle={() => toggle("showTimestamps")} />
                  </div>

                  <div className="settings-toggle" onClick={() => toggle("animations")}>
                    <Sparkles size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Animations</span>
                    <Toggle value={settings.animations !== false} onToggle={() => toggle("animations")} />
                  </div>

                  <SectionHeader label="Layout" />

                  <div className="settings-toggle" onClick={() => toggle("showToolbar")}>
                    <LayoutList size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Show AI toolbar</span>
                    <Toggle value={settings.showToolbar !== false} onToggle={() => toggle("showToolbar")} />
                  </div>

                  <div className="settings-toggle" onClick={() => toggle("showHintBar")}>
                    <AlignLeft size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Show keyboard hints</span>
                    <Toggle value={settings.showHintBar !== false} onToggle={() => toggle("showHintBar")} />
                  </div>

                  <div className="settings-toggle" onClick={() => toggle("showAvatars")}>
                    <Smile size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Message avatars</span>
                    <Toggle value={settings.showAvatars} onToggle={() => toggle("showAvatars")} />
                  </div>

                  <SectionHeader label="Audio" />

                  <div className="settings-toggle" onClick={() => toggle("sounds")}>
                    {settings.sounds
                      ? <Volume2 size={14} style={{ color: "var(--neon-green)" }} />
                      : <VolumeX size={14} style={{ color: "rgba(200,255,192,0.3)" }} />}
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Keyboard sounds</span>
                    <Toggle value={settings.sounds} onToggle={() => toggle("sounds")} />
                  </div>

                  <SectionHeader label="Keyboard Shortcuts" />
                  <div className="p-3 mb-2 flex flex-col gap-2 bg-[rgba(0,0,0,0.3)] rounded-lg border border-[rgba(255,255,255,0.05)] text-xs" style={{ color: "rgba(200,255,192,0.7)" }}>
                    <div className="flex justify-between items-center"><span className="opacity-80">Send Message</span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">Enter</kbd></div>
                    <div className="flex justify-between items-center"><span className="opacity-80">New Line</span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">Shift+Enter</kbd></div>
                    <div className="flex justify-between items-center"><span className="opacity-80">Command Menu</span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">//&gt;</kbd></div>
                    <div className="flex justify-between items-center"><span className="opacity-80">Search Chat</span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">Ctrl+F</kbd></div>
                    <div className="flex justify-between items-center"><span className="opacity-80">Prompt History</span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">↑ / ↓</kbd></div>
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════
                  TAB: DATA
              ══════════════════════════════════════════════ */}
              {activeTab === "data" && (
                <>
                  {/* Stats */}
                  <SectionHeader label="Session Stats" />
                  <div className="px-0 py-2">
                    <div className="stat-pill">
                      <span className="stat-pill-label">Total sessions</span>
                      <span className="stat-pill-value">{sessions.length}</span>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-pill-label">Total messages</span>
                      <span className="stat-pill-value">{totalMessages}</span>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-pill-label">Est. tokens used</span>
                      <span className="stat-pill-value">~{estTokens.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Storage Usage */}
                  <SectionHeader
                    label="Disk Storage Usage"
                    action={fetchStorageUsage}
                    actionLabel="Refresh"
                  />
                  <div className="px-4 py-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "rgba(200,255,192,0.6)" }}>
                        IndexedDB usage
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--neon-cyan)" }}>
                        {storageUsage.percentage}%
                      </span>
                    </div>

                    <div
                      className="h-1 w-full rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${storageUsage.percentage}%` }}
                        className="h-full"
                        style={{
                          background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-green))",
                          boxShadow: "0 0 8px var(--neon-cyan)",
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[8px] uppercase tracking-widest" style={{ color: "rgba(200,255,192,0.3)" }}>
                      <span>Used: {(storageUsage.used / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>Quota: {(storageUsage.quota / (1024 * 1024)).toFixed(0)} MB</span>
                    </div>
                  </div>

                  {/* Export */}
                  <SectionHeader label="Export" />

                  <div className="settings-toggle" onClick={exportChats}>
                    <Download size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Export all chats (.json)</span>
                  </div>

                  <div className="settings-toggle" onClick={exportTxt}>
                    <Download size={14} style={{ color: "var(--neon-green)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>Export all chats (.txt)</span>
                  </div>

                  {/* Import */}
                  <SectionHeader label="Import" />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={handleImport}
                  />

                  <div className="settings-toggle" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} style={{ color: "var(--neon-cyan)" }} />
                    <div className="flex-1">
                      <span className="text-xs block" style={{ color: "rgba(200,255,192,0.8)" }}>Import chats (.json)</span>
                      <span className="text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>Merges with existing sessions</span>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <SectionHeader label="Danger Zone" danger />

                  <div className="settings-toggle" onClick={clearCurrentChat}>
                    <Trash2 size={14} style={{ color: "var(--neon-magenta)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(255,45,120,0.7)" }}>Clear current chat</span>
                  </div>

                  <div className="settings-toggle" onClick={() => setShowClearConfirm(true)}>
                    <Layers size={14} style={{ color: "var(--neon-magenta)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(255,45,120,0.7)" }}>Clear ALL sessions</span>
                  </div>

                  <div
                    className="settings-toggle border-b-0"
                    style={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
                    onClick={resetAPIKey}
                  >
                    <Key size={14} style={{ color: "var(--neon-magenta)" }} />
                    <span className="flex-1 text-xs" style={{ color: "rgba(255,45,120,0.7)" }}>Reset API key</span>
                  </div>
                </>
              )}

              {/* ════════════════════════════════════════════
                  TAB: KEYS
              ════════════════════════════════════════════ */}
              {activeTab === "keys" && (
                <>
                  {/* Info banner */}
                  <div className="mx-3 mt-3 mb-1 p-3 rounded-lg border" style={{ borderColor: "rgba(0,245,255,0.15)", background: "rgba(0,245,255,0.04)" }}>
                    <p className="text-[10px] leading-relaxed" style={{ color: "rgba(200,255,192,0.6)" }}>
                      🔑 You provide your own API keys — they are encrypted and stored securely.
                      <br />
                      <span style={{ color: "var(--neon-cyan)" }}>OpenRouter</span> is <strong>required</strong>.
                      &nbsp;<span style={{ color: "rgba(200,255,192,0.5)" }}>Groq</span> and <span style={{ color: "rgba(200,255,192,0.5)" }}>Gemini</span> are optional but enable smarter routing.
                    </p>
                  </div>

                  {/* Provider blocks */}
                  {[
                    {
                      id: "openrouter",
                      label: "OpenRouter",
                      icon: "🌐",
                      required: true,
                      placeholder: "sk-or-v1-...",
                      hint: "Required. Powers the primary AI fallback chain.",
                      link: "https://openrouter.ai/settings/keys",
                    },
                    {
                      id: "groq",
                      label: "Groq",
                      icon: "⚡",
                      required: false,
                      placeholder: "gsk_...",
                      hint: "Optional. Used for short & fast queries.",
                      link: "https://console.groq.com/keys",
                    },
                    {
                      id: "gemini",
                      label: "Gemini",
                      icon: "🧠",
                      required: false,
                      placeholder: "AIza...",
                      hint: "Optional. Used for code & programming tasks.",
                      link: "https://aistudio.google.com/app/apikey",
                    },
                    {
                      id: "huggingface",
                      label: "Hugging Face",
                      icon: "🤗",
                      required: false,
                      placeholder: "hf_...",
                      hint: "Optional. Specialized open source models.",
                      link: "https://huggingface.co/settings/tokens",
                    },
                  ].map((prov) => {
                    const isActive = providerStatus[prov.id];
                    const result = keyResults[prov.id];
                    const saving = keySaving[prov.id];
                    const visible = keyVisible[prov.id];
                    return (
                      <div key={prov.id} className="mx-3 my-2 p-3 rounded-lg border" style={{ borderColor: isActive ? "rgba(57,255,20,0.2)" : "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 16 }}>{prov.icon}</span>
                            <span className="text-xs font-bold" style={{ color: isActive ? "var(--neon-green)" : "rgba(200,255,192,0.7)" }}>
                              {prov.label}
                            </span>
                            {prov.required && (
                              <span className="text-[8px] px-1 rounded" style={{ background: "rgba(255,45,120,0.15)", color: "var(--neon-magenta)" }}>required</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isActive ? (
                              <span className="flex items-center gap-1 text-[9px]" style={{ color: "var(--neon-green)" }}>
                                <CheckCircle size={10} /> Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>
                                <AlertCircle size={10} /> Not set
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Input */}
                        <div className="flex gap-2 mb-1">
                          <div className="relative flex-1">
                            <input
                              type={visible ? "text" : "password"}
                              placeholder={prov.placeholder}
                              value={keyValues[prov.id]}
                              onChange={(e) => setKeyValues((p) => ({ ...p, [prov.id]: e.target.value }))}
                              className="w-full bg-transparent border rounded px-2 pr-7 text-[10px] outline-none"
                              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(200,255,192,0.9)", height: 30, fontFamily: "monospace" }}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveKey(prov.id)}
                            />
                            <button
                              onClick={() => setKeyVisible((p) => ({ ...p, [prov.id]: !p[prov.id] }))}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2"
                              style={{ color: "rgba(200,255,192,0.3)" }}
                            >
                              {visible ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                          </div>
                          <button
                            disabled={!keyValues[prov.id]?.trim() || saving}
                            onClick={() => handleSaveKey(prov.id)}
                            className="px-3 rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1"
                            style={{
                              height: 30,
                              background: keyValues[prov.id]?.trim() ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.03)",
                              color: keyValues[prov.id]?.trim() ? "var(--neon-green)" : "rgba(200,255,192,0.2)",
                              border: `1px solid ${keyValues[prov.id]?.trim() ? "var(--neon-green)" : "rgba(255,255,255,0.05)"}`,
                              cursor: keyValues[prov.id]?.trim() && !saving ? "pointer" : "not-allowed",
                            }}
                          >
                            {saving ? <Loader size={10} className="animate-spin" /> : "Save"}
                          </button>
                        </div>

                        {/* Feedback */}
                        {result && (
                          <div
                            className="text-[9px] mt-1 flex items-start gap-1"
                            style={{
                              color: result.ok
                                ? result.warning ? "var(--neon-yellow, #ffd700)" : "var(--neon-green)"
                                : "rgba(255,45,120,0.8)"
                            }}
                          >
                            <span>{result.ok ? (result.warning ? "⚠" : "✓") : "✗"}</span>
                            <span>
                              {result.ok
                                ? result.warning || "Key saved and verified successfully"
                                : result.error}
                            </span>
                          </div>
                        )}

                        {/* Hint + link */}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[9px]" style={{ color: "rgba(200,255,192,0.3)" }}>{prov.hint}</span>
                          <a href={prov.link} target="_blank" rel="noreferrer" className="text-[9px]" style={{ color: "var(--neon-cyan)" }}>Get key ↗</a>
                        </div>
                      </div>
                    );
                  })}

                  {/* Smart Router info */}
                  <div className="mx-3 mt-2 mb-3 p-3 rounded-lg border" style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.2)" }}>
                    <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(200,255,192,0.3)" }}>Smart Router</div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[9px]" style={{ color: "rgba(200,255,192,0.5)" }}>
                        <span>⚡</span><span><strong style={{ color: "rgba(200,255,192,0.8)" }}>Short messages</strong> → Groq (fastest)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]" style={{ color: "rgba(200,255,192,0.5)" }}>
                        <span>🧠</span><span><strong style={{ color: "rgba(200,255,192,0.8)" }}>Code &amp; programming</strong> → Gemini</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]" style={{ color: "rgba(200,255,192,0.5)" }}>
                        <span>🌐</span><span><strong style={{ color: "rgba(200,255,192,0.8)" }}>Creative &amp; long text</strong> → OpenRouter</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] mt-1 pt-1" style={{ color: "rgba(200,255,192,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <span>🔄</span><span>If a provider fails, it auto-falls back to the next available one.</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Clear All Confirm Dialog ────────────────────── */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              className="confirm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="confirm-card">
                <div className="text-2xl mb-3">⚠️</div>
                <div className="text-xs font-bold mb-2" style={{ color: "var(--neon-magenta)" }}>
                  Clear All Sessions?
                </div>
                <div className="text-[10px] mb-5" style={{ color: "rgba(200,255,192,0.5)" }}>
                  This will permanently delete all {sessions.length} sessions. This action cannot be undone.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { clearAllSessions(); setShowClearConfirm(false); onClose(); }}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                    style={{
                      background: "rgba(255,45,120,0.12)",
                      border: "1px solid var(--neon-magenta)",
                      color: "var(--neon-magenta)",
                    }}
                  >
                    Delete All
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5"
                    style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(200,255,192,0.5)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
