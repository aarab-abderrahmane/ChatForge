import { useContext, useState, useRef, useEffect as useAppEffect } from "react";
import {
  X, Plus, Trash2, Key, Download, Upload, Clock, Zap, Sparkles,
  ChevronDown, ChevronUp, Bot, Settings2, Database, MessageSquare,
  LayoutList, Wand2, Gauge, Layers, Wrench, Check, Eye, EyeOff,
  AlertCircle, Loader, MousePointerClick, ArrowLeft, Wifi,
} from "lucide-react";
import { chatsContext, SKILLS, MODELS } from "../context/chatsContext";
import { api } from "../services/api";
import { StorageService } from "../services/db";

const EMOJI_OPTIONS = [
  "⭐", "🎯", "🔥", "💡", "🧩", "🎨", "🚀", "⚙️", "🌟", "🎤",
  "📚", "🧠", "🔮", "💎", "🌈", "🎭", "🤖", "🦊", "🐉", "🌀",
];

const ROUTING_OPTIONS = [
  { id: "smart", label: "Smart Router (Auto)", icon: "🔄", desc: "Shorts → Groq, Code → Gemini, Long → OpenRouter." },
  { id: "groq", label: "Force Groq", icon: "⚡", desc: "Send everything to Groq (requires Groq key)." },
  { id: "gemini", label: "Force Gemini", icon: "🧠", desc: "Send everything to Gemini (requires Gemini key)." },
  { id: "openrouter", label: "Force OpenRouter", icon: "🌐", desc: "Send everything to OpenRouter (mandatory fallback)." },
];

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", icon: "🌐", required: true, placeholder: "sk-or-v1-...", hint: "Required. Powers the primary AI fallback chain.", link: "https://openrouter.ai/settings/keys" },
  { id: "groq", label: "Groq", icon: "⚡", required: false, placeholder: "gsk_...", hint: "Optional. Used for short & fast queries.", link: "https://console.groq.com/keys" },
  { id: "gemini", label: "Gemini", icon: "🧠", required: false, placeholder: "AIza...", hint: "Optional. Used for code & programming tasks.", link: "https://aistudio.google.com/app/apikey" },
  { id: "huggingface", label: "Hugging Face", icon: "🤗", required: false, placeholder: "hf_...", hint: "Optional. Specialized open source models.", link: "https://huggingface.co/settings/tokens" },
];

const PARAMS = [
  { key: "temperature", label: "Creativity", min: 0, max: 15, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 7 },
  { key: "topP", label: "Top P", min: 0, max: 10, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 10 },
  { key: "frequencyPenalty", label: "Freq Penalty", min: -20, max: 20, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 0 },
  { key: "presencePenalty", label: "Pres Penalty", min: -20, max: 20, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 0 },
  { key: "maxTokens", label: "Max Tokens", min: 256, max: 8192, step: 256, display: (v) => v, defaultVal: 2048 },
];

const RESPONSE_PRESETS = {
  short: { maxTokens: 1024, temperature: 3, topP: 9, frequencyPenalty: 5, presencePenalty: 5 },
  balanced: { maxTokens: 2048, temperature: 7, topP: 10, frequencyPenalty: 0, presencePenalty: 0 },
  detailed: { maxTokens: 4096, temperature: 10, topP: 10, frequencyPenalty: 0, presencePenalty: 0 },
};

function Toggle({ value, onToggle }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} className={`w-8 h-4 border transition-colors duration-150 flex items-center ${value ? "bg-green border-green justify-end" : "bg-paper border-muted-400 justify-start"}`} role="switch" aria-checked={value}>
      <div className={`w-3 h-3 border transition-colors duration-150 mx-[1px] ${value ? "bg-paper border-[var(--color-border)]" : "bg-paper border-muted-400"}`} />
    </button>
  );
}

function SectionCard({ title, icon: Icon, children, className = "", colSpan = "" }) {
  return (
    <div className={`border border-[var(--color-border)] bg-paper ${colSpan} ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-muted-100">
        {Icon && <Icon size={12} className="text-ink" strokeWidth={1.5} />}
        <span className="font-mono text-xs text-ink uppercase tracking-widest font-bold">{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const {
    settings, setSettings, setPreferences, preferences, sessions,
    clearCurrentChat, clearAllSessions, importSessions,
    customSkills, addCustomSkill, deleteCustomSkill,
    aiTools, addAITool, updateAITool, deleteAITool,
    providerStatus, setProviderStatus,
  } = useContext(chatsContext);

  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showToolForm, setShowToolForm] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [showRouting, setShowRouting] = useState(true);
  const [showModels, setShowModels] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const [keyValues, setKeyValues] = useState({ openrouter: "", groq: "", gemini: "", huggingface: "" });
  const [keyVisible, setKeyVisible] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false });
  const [keySaving, setKeySaving] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false });
  const [keyResults, setKeyResults] = useState({});
  const [storageUsage, setStorageUsage] = useState({ used: 0, quota: 0, percentage: 0 });

  const fetchStorageUsage = async () => {
    const usage = await StorageService.getUsage();
    setStorageUsage(usage);
  };

  useAppEffect(() => { fetchStorageUsage(); }, []);

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
        setKeyValues((p) => ({ ...p, [provider]: "" }));
      }
    } catch {
      setKeyResults((p) => ({ ...p, [provider]: { ok: false, error: "Network error" } }));
    } finally {
      setKeySaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const toggle = (key) => setSettings({ ...settings, [key]: !settings[key] });

  const goBack = () => setPreferences((prev) => ({ ...prev, currentPage: "chat" }));
  const resetAPIKey = () => setPreferences((prev) => ({ ...prev, currentPage: "guide" }));

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
      } catch { alert("Could not parse JSON file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const allSkills = [...SKILLS, ...customSkills];

  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.filter((m) => m.type === "ch").length, 0);
  const totalWords = sessions.reduce((acc, s) => acc + s.messages.filter((m) => m.type === "ch").reduce((a, m) => a + ((m.question || "") + " " + (m.answer || "")).split(" ").length, 0), 0);
  const estTokens = Math.round(totalWords * 1.3);

  return (
    <div className="w-screen h-screen flex flex-col bg-paper dot-grid-bg overflow-hidden">
      {/* ── Masthead ── */}
      <header className="border-b border-[var(--color-border)] bg-paper shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="flex items-center gap-1.5 font-mono text-sm text-muted-400 hover:text-ink transition-colors duration-150 uppercase tracking-widest">
              <ArrowLeft size={13} strokeWidth={1.5} />
              Back
            </button>
            <div className="w-px h-4 bg-divider" />
            <Settings2 size={14} className="text-ink" strokeWidth={1.5} />
            <h1 className="font-serif text-lg font-black uppercase tracking-tight">Settings</h1>
          </div>
          <div className="flex items-center gap-2 text-green">
            <Wifi size={11} strokeWidth={1.5} />
            <span className="font-mono text-xs uppercase tracking-wider">{preferences.userId?.slice(0, 8) || "offline"}</span>
          </div>
        </div>
      </header>

      {/* ── Scrollable Grid Content ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">

          {/* ═══ AI SKILLS ═══ */}
          <SectionCard title="AI Personality / Skill" icon={Bot} colSpan="md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-400">Select or create a skill</span>
              <button onClick={() => setShowSkillForm((p) => !p)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-widest border border-[var(--color-border)] text-ink hover:bg-muted-100 transition-colors duration-150">
                <Plus size={9} strokeWidth={1.5} />New Skill
              </button>
            </div>
            {showSkillForm && (
              <div className="mb-3 p-3 border border-divider bg-muted-100 space-y-3">
                <SkillFormContent onSave={(form) => { addCustomSkill(form); setShowSkillForm(false); }} onCancel={() => setShowSkillForm(false)} />
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {allSkills.map((skill) => {
                const isActive = settings.activeSkillId === skill.id;
                return (
                  <div key={skill.id} onClick={() => setSettings({ ...settings, activeSkillId: skill.id })}
                    className={`relative flex flex-col items-center gap-1.5 p-3 border cursor-pointer transition-all duration-150 hover:bg-muted-100 ${isActive ? "border-l-4 border-green bg-muted-100" : "border-divider"}`}
                    title={skill.description}>
                    {skill.isCustom && <span className="absolute top-1 right-1 font-mono text-xs uppercase text-muted-400">custom</span>}
                    <span className="text-lg">{skill.icon}</span>
                    <span className={`font-mono text-[11px] uppercase tracking-tighter text-center ${isActive ? "text-ink font-bold" : "text-muted-500"}`}>{skill.name}</span>
                    {skill.isCustom && <button onClick={(e) => { e.stopPropagation(); deleteCustomSkill(skill.id); }} className="absolute bottom-1 right-1 text-muted-400 hover:text-red transition-colors"><X size={8} strokeWidth={1.5} /></button>}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ═══ ROUTING STRATEGY ═══ */}
          <SectionCard title="Routing Strategy" icon={Layers}>
            <button onClick={() => setShowRouting((p) => !p)} className="w-full flex items-center justify-between py-2 hover:bg-muted-100 transition-colors duration-150 px-2 -mx-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{settings.routingMode === "smart" ? "🔄" : settings.routingMode === "groq" ? "⚡" : settings.routingMode === "gemini" ? "🧠" : "🌐"}</span>
                <span className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">
                  {settings.routingMode === "smart" ? "Smart Router" : settings.routingMode === "groq" ? "Force Groq" : settings.routingMode === "gemini" ? "Force Gemini" : "Force OpenRouter"}
                </span>
              </div>
              {showRouting ? <ChevronUp size={11} className="text-muted-400" strokeWidth={1.5} /> : <ChevronDown size={11} className="text-muted-400" strokeWidth={1.5} />}
            </button>
            {showRouting && (
              <div className="flex flex-col gap-1.5 mt-1">
                {ROUTING_OPTIONS.map((route) => {
                  const isActive = settings.routingMode === route.id;
                  const isMissingKey = route.id !== "smart" && !providerStatus[route.id];
                  return (
                    <div key={route.id} onClick={() => !isMissingKey && setSettings({ ...settings, routingMode: route.id })}
                      className={`flex items-center gap-2 p-2 border transition-all duration-150 ${isMissingKey ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:bg-muted-100"} ${isActive ? "border-l-4 border-green bg-muted-100 border-divider" : "border-divider"}`}>
                      <span className="text-sm">{route.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-[11px] font-semibold uppercase ${isActive ? "text-ink" : "text-muted-500"}`}>{route.label}</span>
                          {isMissingKey && <span className="font-mono text-xs px-1 uppercase border border-red text-red">key missing</span>}
                        </div>
                        <div className="font-body text-[11px] mt-0.5 text-muted-400">{route.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* ═══ AI MODEL ═══ */}
          <SectionCard title="Fallback Model" icon={Bot}>
            <button onClick={() => setShowModels((p) => !p)} className="w-full flex items-center justify-between py-2 hover:bg-muted-100 transition-colors duration-150 px-2 -mx-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{MODELS.find((m) => m.id === settings.activeModelId)?.icon || "🧠"}</span>
                <span className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">{MODELS.find((m) => m.id === settings.activeModelId)?.name || "Select model"}</span>
              </div>
              {showModels ? <ChevronUp size={11} className="text-muted-400" strokeWidth={1.5} /> : <ChevronDown size={11} className="text-muted-400" strokeWidth={1.5} />}
            </button>
            {showModels && (
              <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                {MODELS.map((model) => {
                  const isActive = settings.activeModelId === model.id;
                  return (
                    <div key={model.id} onClick={() => { setSettings({ ...settings, activeModelId: model.id }); setShowModels(false); }}
                      className={`flex items-center gap-2 p-2 border cursor-pointer transition-all duration-150 hover:bg-muted-100 ${isActive ? "border-l-4 border-green bg-muted-100 border-divider" : "border-divider"}`}>
                      <span className="text-sm">{model.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-mono text-[11px] font-semibold uppercase ${isActive ? "text-ink" : "text-muted-500"}`}>{model.name}</div>
                        <div className="font-body text-sm text-muted-400">{model.provider}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* ═══ RESPONSE LENGTH ═══ */}
          <SectionCard title="Response" icon={MessageSquare}>
            <div className="flex gap-2 mb-3">
              {["short", "balanced", "detailed"].map((opt) => (
                <button key={opt} type="button" onClick={() => setSettings({ ...settings, responseLength: opt, ...RESPONSE_PRESETS[opt] })}
                  className={`flex-1 py-1.5 text-[11px] font-mono uppercase tracking-widest border transition-colors duration-150 ${settings.responseLength === opt ? "bg-green text-paper border-green" : "border-divider text-muted-500 hover:text-ink hover:border-[var(--color-border)]"}`}>
                  {opt}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {PARAMS.map((param) => (
                <div key={param.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-ink uppercase tracking-wider">{param.label}</span>
                    <span className="font-mono text-[11px] text-muted-500">{param.display(settings[param.key] ?? param.defaultVal)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setSettings({ ...settings, [param.key]: Math.max(param.min, (settings[param.key] ?? param.defaultVal) - param.step) })}
                      className="w-5 h-5 border border-[var(--color-border)] flex items-center justify-center text-ink hover:bg-muted-100 transition-colors text-sm">-</button>
                    <input type="range" min={param.min} max={param.max} step={param.step}
                      value={settings[param.key] ?? param.defaultVal}
                      onChange={(e) => setSettings({ ...settings, [param.key]: +e.target.value })}
                      className="flex-1 h-1 appearance-none bg-muted-200 cursor-pointer accent-green outline-none" />
                    <button type="button" onClick={() => setSettings({ ...settings, [param.key]: Math.min(param.max, (settings[param.key] ?? param.defaultVal) + param.step) })}
                      className="w-5 h-5 border border-[var(--color-border)] flex items-center justify-center text-ink hover:bg-muted-100 transition-colors text-sm">+</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ═══ CONTEXT PREFIX ═══ */}
          <SectionCard title="Context Prefix" icon={MessageSquare} colSpan="md:col-span-2">
            <p className="font-body text-xs text-muted-400 mb-2 leading-relaxed">
              Prepended to every AI skill prompt. Use it for persistent context (e.g. your name, project, language preference).
            </p>
            <textarea className="w-full bg-transparent border border-divider px-3 py-2 text-xs font-body text-ink outline-none resize-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400"
              rows={3} placeholder="e.g. Always respond in French. My project uses React and Node.js..."
              value={settings.systemPromptPrefix || ""}
              onChange={(e) => setSettings({ ...settings, systemPromptPrefix: e.target.value })} />
          </SectionCard>

          {/* ═══ AI TOOLS ═══ */}
          <SectionCard title="AI Action Tools" icon={Wrench} colSpan="md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-400">Custom quick-action tools</span>
              <button onClick={() => { setEditingTool(null); setShowToolForm((p) => !p); }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-widest border border-[var(--color-border)] text-ink hover:bg-muted-100 transition-colors duration-150">
                <Plus size={9} strokeWidth={1.5} />New Tool
              </button>
            </div>
            {showToolForm && (
              <div className="mb-3 p-3 border border-divider bg-muted-100 space-y-3">
                <ToolFormContent initialData={editingTool}
                  onSave={(form) => { if (editingTool) updateAITool(editingTool.id, form); else addAITool(form); setShowToolForm(false); setEditingTool(null); }}
                  onCancel={() => { setShowToolForm(false); setEditingTool(null); }} />
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {aiTools.map((tool) => (
                <div key={tool.id} className="flex items-center justify-between p-2 border border-divider hover:bg-muted-100 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{tool.icon}</span>
                    <div>
                      <span className="font-mono text-xs font-semibold text-ink uppercase">{tool.label}</span>
                      <span className="font-body text-[11px] text-muted-400 block">{tool.prompt?.slice(0, 30)}...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingTool(tool); setShowToolForm(true); }} className="p-1 text-muted-400 hover:text-ink"><Settings2 size={10} strokeWidth={1.5} /></button>
                    <button onClick={() => deleteAITool(tool.id)} className="p-1 text-muted-400 hover:text-red"><Trash2 size={10} strokeWidth={1.5} /></button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ═══ BEHAVIOR ═══ */}
          <SectionCard title="Behavior" icon={Zap}>
            <div className="space-y-2">
              {[
                { key: "autoScroll", icon: MousePointerClick, label: "Auto-scroll" },
                { key: "streamingIndicator", icon: Zap, label: "Streaming indicator" },
                { key: "showTimestamps", icon: Clock, label: "Timestamps" },
                { key: "animations", icon: Sparkles, label: "Animations" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-1.5 hover:bg-muted-100 px-2 -mx-2 transition-colors cursor-pointer" onClick={() => toggle(item.key)}>
                  <div className="flex items-center gap-2">
                    <item.icon size={11} className="text-muted-400" strokeWidth={1.5} />
                    <span className="font-body text-sm text-ink">{item.label}</span>
                  </div>
                  <Toggle value={settings[item.key]} onToggle={() => toggle(item.key)} />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ═══ LAYOUT ═══ */}
          <SectionCard title="Layout" icon={LayoutList}>
            <div className="space-y-2">
              {[
                { key: "showToolbar", icon: LayoutList, label: "AI toolbar" },
                { key: "showHintBar", icon: Wand2, label: "Keyboard hints" },
                { key: "showAvatars", icon: MessageSquare, label: "Message avatars" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-1.5 hover:bg-muted-100 px-2 -mx-2 transition-colors cursor-pointer" onClick={() => toggle(item.key)}>
                  <div className="flex items-center gap-2">
                    <item.icon size={11} className="text-muted-400" strokeWidth={1.5} />
                    <span className="font-body text-sm text-ink">{item.label}</span>
                  </div>
                  <Toggle value={settings[item.key]} onToggle={() => toggle(item.key)} />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ═══ KEYBOARD SHORTCUTS ═══ */}
          <SectionCard title="Keyboard Shortcuts" icon={MessageSquare}>
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Send", key: "Enter" }, { label: "New Line", key: "Shift+Enter" },
                { label: "Command Menu", key: "///>" }, { label: "Search", key: "Ctrl+F" },
                { label: "History", key: "↑ / ↓" },
              ].map((s) => (
                <div key={s.label} className="flex justify-between items-center py-1">
                  <span className="font-body text-xs text-muted-500">{s.label}</span>
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 border border-divider text-muted-400">{s.key}</kbd>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ═══ SESSION STATS ═══ */}
          <SectionCard title="Session Stats" icon={Database}>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center border-b border-divider pb-1">
                <span className="font-mono text-[11px] text-muted-400 uppercase tracking-wider">Sessions</span>
                <span className="font-mono text-xs text-ink font-bold">{sessions.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-divider pb-1">
                <span className="font-mono text-[11px] text-muted-400 uppercase tracking-wider">Messages</span>
                <span className="font-mono text-xs text-ink font-bold">{totalMessages}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[11px] text-muted-400 uppercase tracking-wider">Est. tokens</span>
                <span className="font-mono text-xs text-ink font-bold">~{estTokens.toLocaleString()}</span>
              </div>
            </div>
          </SectionCard>

          {/* ═══ STORAGE ═══ */}
          <SectionCard title="Storage" icon={Database}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] text-muted-400">IndexedDB</span>
              <button onClick={fetchStorageUsage} className="font-mono text-sm uppercase tracking-widest text-muted-400 hover:text-ink transition-colors">Refresh</button>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] text-muted-400">Usage</span>
              <span className="font-mono text-[11px] text-ink font-bold">{storageUsage.percentage}%</span>
            </div>
            <div className="h-1.5 w-full border border-[var(--color-border)] bg-paper mb-1.5">
              <div className="h-full bg-ink transition-all duration-300" style={{ width: `${storageUsage.percentage}%` }} />
            </div>
            <div className="flex justify-between font-mono text-sm uppercase tracking-widest text-muted-400">
              <span>{(storageUsage.used / (1024 * 1024)).toFixed(1)} MB</span>
              <span>{(storageUsage.quota / (1024 * 1024)).toFixed(0)} MB</span>
            </div>
          </SectionCard>

          {/* ═══ EXPORT / IMPORT ═══ */}
          <SectionCard title="Data Management" icon={Database} colSpan="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button onClick={exportChats} className="flex items-center gap-2 p-2.5 border border-divider hover:bg-muted-100 transition-colors text-left">
                <Download size={13} className="text-muted-400" strokeWidth={1.5} />
                <span className="font-body text-sm text-ink">Export JSON</span>
              </button>
              <button onClick={exportTxt} className="flex items-center gap-2 p-2.5 border border-divider hover:bg-muted-100 transition-colors text-left">
                <Download size={13} className="text-muted-400" strokeWidth={1.5} />
                <span className="font-body text-sm text-ink">Export TXT</span>
              </button>
              <div>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 p-2.5 border border-divider hover:bg-muted-100 transition-colors text-left">
                  <Upload size={13} className="text-muted-400" strokeWidth={1.5} />
                  <div>
                    <span className="font-body text-sm text-ink block">Import JSON</span>
                    <span className="font-mono text-sm text-muted-400">Merges sessions</span>
                  </div>
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ═══ DANGER ZONE ═══ */}
          <SectionCard title="Danger Zone" icon={Trash2}>
            <div className="space-y-1.5">
              <button onClick={clearCurrentChat} className="w-full flex items-center gap-2 p-2 border border-red hover:bg-red/5 transition-colors text-left">
                <Trash2 size={11} className="text-red" strokeWidth={1.5} />
                <span className="font-body text-sm text-red">Clear current chat</span>
              </button>
              <button onClick={() => setShowClearConfirm(true)} className="w-full flex items-center gap-2 p-2 border border-red hover:bg-red/5 transition-colors text-left">
                <Layers size={11} className="text-red" strokeWidth={1.5} />
                <span className="font-body text-sm text-red">Clear ALL sessions</span>
              </button>
              <button onClick={resetAPIKey} className="w-full flex items-center gap-2 p-2 border border-red hover:bg-red/5 transition-colors text-left">
                <Key size={11} className="text-red" strokeWidth={1.5} />
                <span className="font-body text-sm text-red">Reset API key</span>
              </button>
            </div>
          </SectionCard>

          {/* ═══ API KEYS ═══ */}
          <div className="border border-[var(--color-border)] bg-paper col-span-1 md:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-muted-100">
              <Key size={12} className="text-ink" strokeWidth={1.5} />
              <span className="font-mono text-xs text-ink uppercase tracking-widest font-bold">API Keys</span>
            </div>
            <div className="p-4">
              <p className="font-body text-sm text-muted-400 mb-3 leading-relaxed">
                You provide your own API keys — they are encrypted and stored securely.
                <span className="text-ink font-semibold"> OpenRouter</span> is <span className="text-ink">required</span>.
                Groq and Gemini are optional but enable smarter routing.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROVIDERS.map((prov) => {
                  const isActive = providerStatus[prov.id];
                  const result = keyResults[prov.id];
                  const saving = keySaving[prov.id];
                  const visible = keyVisible[prov.id];
                  return (
                    <div key={prov.id} className="border border-divider p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{prov.icon}</span>
                          <span className={`font-mono text-xs font-semibold uppercase tracking-wider ${isActive ? "text-ink" : "text-muted-500"}`}>{prov.label}</span>
                          {prov.required && <span className="font-mono text-xs px-1 uppercase border border-red text-red">required</span>}
                        </div>
                        {isActive ? (
                          <span className="flex items-center gap-1 font-mono text-sm text-green uppercase tracking-wider"><Check size={8} className="text-green" strokeWidth={1.5} /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 font-mono text-sm text-muted-400 uppercase tracking-wider"><AlertCircle size={8} strokeWidth={1.5} /> Not set</span>
                        )}
                      </div>
                      <div className="flex gap-1.5 mb-1">
                        <div className="relative flex-1">
                          <input type={visible ? "text" : "password"} placeholder={prov.placeholder}
                            value={keyValues[prov.id]}
                            onChange={(e) => setKeyValues((p) => ({ ...p, [prov.id]: e.target.value }))}
                            className="w-full bg-transparent border-b border-divider pb-1 pr-6 text-sm font-mono text-ink outline-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400"
                            onKeyDown={(e) => e.key === "Enter" && handleSaveKey(prov.id)} />
                          <button onClick={() => setKeyVisible((p) => ({ ...p, [prov.id]: !p[prov.id] }))}
                            className="absolute right-0 top-0 text-muted-400 hover:text-ink transition-colors">
                            {visible ? <EyeOff size={10} strokeWidth={1.5} /> : <Eye size={10} strokeWidth={1.5} />}
                          </button>
                        </div>
                        <button disabled={!keyValues[prov.id]?.trim() || saving} onClick={() => handleSaveKey(prov.id)}
                          className={`px-2.5 text-[11px] font-mono font-bold uppercase tracking-widest border transition-colors duration-150 flex items-center gap-1 ${keyValues[prov.id]?.trim() && !saving ? "border-[var(--color-border)] text-ink hover:bg-muted-100" : "border-muted-200 text-muted-400 cursor-not-allowed bg-muted-100"}`}>
                          {saving ? <Loader size={8} className="animate-spin" strokeWidth={1.5} /> : "Save"}
                        </button>
                      </div>
                      {result && (
                        <div className={`font-mono text-sm mt-1 flex items-start gap-1 ${result.ok ? (result.warning ? "text-muted-500" : "text-green") : "text-red"}`}>
                          <span>{result.ok ? (result.warning ? "!" : "+") : "-"}</span>
                          <span>{result.ok ? result.warning || "Key saved" : result.error}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-mono text-sm text-muted-400">{prov.hint}</span>
                        <a href={prov.link} target="_blank" rel="noreferrer" className="font-mono text-sm text-ink hover:text-green underline underline-offset-2">Get key</a>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 p-3 border border-divider">
                <div className="font-mono text-[11px] text-muted-500 uppercase tracking-widest mb-2 font-bold">Smart Router</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-sm text-muted-400">
                  <div><span className="text-ink font-semibold">Short messages</span> → Groq</div>
                  <div><span className="text-ink font-semibold">Code & programming</span> → Gemini</div>
                  <div><span className="text-ink font-semibold">Creative & long text</span> → OpenRouter</div>
                  <div className="sm:col-span-3 pt-2 border-t border-divider"><span className="text-ink font-semibold">Auto-fallback</span> — if a provider fails, it falls back to the next available.</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Clear All Confirm Dialog ── */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-paper/90">
          <div className="border border-[var(--color-border)] bg-paper p-6 text-center max-w-sm">
            <div className="font-serif text-3xl mb-3 text-red">!</div>
            <div className="font-mono text-sm font-bold text-ink uppercase tracking-widest mb-2">Clear All Sessions?</div>
            <div className="font-body text-sm text-muted-400 mb-5">This will permanently delete all {sessions.length} sessions. This action cannot be undone.</div>
            <div className="flex gap-2">
              <button onClick={() => { clearAllSessions(); setShowClearConfirm(false); setPreferences((prev) => ({ ...prev, currentPage: "chat" })); }}
                className="flex-1 py-2.5 text-sm font-mono font-bold uppercase tracking-widest border border-red text-red hover:bg-red hover:text-paper transition-colors duration-150">Delete All</button>
              <button onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 text-sm font-mono font-bold uppercase tracking-widest border border-[var(--color-border)] text-ink hover:bg-muted-100 transition-colors duration-150">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillFormContent({ onSave, onCancel }) {
  const [form, setForm] = useState({ icon: "⭐", name: "", description: "", systemPrompt: "" });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const valid = form.name.trim().length > 0 && form.systemPrompt.trim().length > 0;
  return (
    <>
      <div className="flex gap-2.5">
        <div className="relative">
          <button onClick={() => setShowEmojiPicker((p) => !p)} className="w-7 h-7 border border-[var(--color-border)] flex items-center justify-center hover:bg-muted-100 transition-colors text-base">{form.icon}</button>
          {showEmojiPicker && (
            <div className="absolute top-8 left-0 z-50 p-1.5 border border-[var(--color-border)] bg-paper grid grid-cols-5 gap-1 shadow-[4px_4px_0px_0px_#111]">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => { setForm((p) => ({ ...p, icon: e })); setShowEmojiPicker(false); }} className="w-6 h-6 text-sm hover:bg-muted-100 flex items-center justify-center">{e}</button>
              ))}
            </div>
          )}
        </div>
        <input type="text" placeholder="Skill name..." maxLength={24} value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="flex-1 bg-transparent border-b border-divider pb-1 text-xs font-body text-ink outline-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400" />
      </div>
      <input type="text" placeholder="Short description..." maxLength={60} value={form.description}
        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        className="w-full bg-transparent border-b border-divider pb-1 text-sm font-body text-ink outline-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400" />
      <textarea placeholder="System prompt..." value={form.systemPrompt}
        onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))} rows={3}
        className="w-full bg-transparent border border-divider px-2 py-1.5 text-sm font-body text-ink outline-none resize-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400" />
      <div className="flex gap-2">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border border-[var(--color-border)] transition-colors ${valid ? "bg-green text-paper" : "bg-muted-100 text-muted-400 border-muted-200 cursor-not-allowed"}`}>Save</button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest border border-[var(--color-border)] text-ink hover:bg-muted-100 transition-colors">Cancel</button>
      </div>
    </>
  );
}

function ToolFormContent({ onSave, onCancel, initialData }) {
  const [form, setForm] = useState(initialData || { icon: "🔧", label: "", prompt: "" });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const valid = form.label.trim().length > 0 && (form.prompt || "").trim().length > 0;
  return (
    <>
      <div className="flex gap-2.5">
        <div className="relative">
          <button onClick={() => setShowEmojiPicker((p) => !p)} className="w-7 h-7 border border-[var(--color-border)] flex items-center justify-center hover:bg-muted-100 transition-colors text-base">{form.icon}</button>
          {showEmojiPicker && (
            <div className="absolute top-8 left-0 z-50 p-1.5 border border-[var(--color-border)] bg-paper grid grid-cols-5 gap-1 shadow-[4px_4px_0px_0px_#111]">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => { setForm((p) => ({ ...p, icon: e })); setShowEmojiPicker(false); }} className="w-6 h-6 text-sm hover:bg-muted-100 flex items-center justify-center">{e}</button>
              ))}
            </div>
          )}
        </div>
        <input type="text" placeholder="Tool label..." maxLength={16} value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          className="flex-1 bg-transparent border-b border-divider pb-1 text-xs font-body text-ink outline-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400" />
      </div>
      <textarea placeholder="Prompt template..." value={form.prompt || ""}
        onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))} rows={2}
        className="w-full bg-transparent border border-divider px-2 py-1.5 text-sm font-body text-ink outline-none resize-none focus:border-[var(--color-border)] transition-colors placeholder:text-muted-400" />
      <div className="flex gap-2">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border border-[var(--color-border)] transition-colors ${valid ? "bg-green text-paper" : "bg-muted-100 text-muted-400 border-muted-200 cursor-not-allowed"}`}>Save</button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest border border-[var(--color-border)] text-ink hover:bg-muted-100 transition-colors">Cancel</button>
      </div>
    </>
  );
}
