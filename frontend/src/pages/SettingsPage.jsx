import { useContext, useState, useRef, useEffect as useAppEffect } from "react";
import {
  X, Plus, Trash2, Key, Download, Upload, Clock, Zap, Sparkles,
  ChevronDown, ChevronUp, Bot, Settings2, Database, MessageSquare,
  LayoutList, Wand2, Gauge, Layers, Wrench, Check, Eye, EyeOff,
  AlertCircle, Loader, MousePointerClick, ArrowLeft, Wifi,
} from "lucide-react";
import { chatsContext, SKILLS, MODELS } from "../context/chatsContext";
import { api } from "../services/api";
import { KeysService, StorageService } from "../services/db";
import { radius, shadows } from "../lib/design-tokens";

const EMOJI_OPTIONS = [
  "⭐", "🎯", "🔥", "💡", "🧩", "🎨", "🚀", "⚙️", "🌟", "🎤",
  "📚", "🧠", "🔮", "💎", "🌈", "🎭", "🤖", "🦊", "🐉", "🌀",
];

const ROUTING_OPTIONS = [
  { id: "smart", label: "Smart Router (Auto)", icon: "🔄", desc: "Shorts → Together/Mistral/Groq, Code → Gemini/OpenRouter, Creative → OpenRouter." },
  { id: "groq", label: "Force Groq", icon: "⚡", desc: "Send everything to Groq (requires Groq key)." },
  { id: "gemini", label: "Force Gemini", icon: "🧠", desc: "Send everything to Gemini (requires Gemini key)." },
  { id: "openrouter", label: "Force OpenRouter", icon: "🌐", desc: "Send everything to OpenRouter (mandatory fallback)." },
  { id: "together", label: "Force Together AI", icon: "🤝", desc: "Send everything to Together AI (requires Together key)." },
  { id: "mistral", label: "Force Mistral AI", icon: "🌪️", desc: "Send everything to Mistral AI (requires Mistral key)." },
];

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", icon: "🌐", required: true, placeholder: "sk-or-v1-...", hint: "Required. Powers the primary AI fallback chain.", link: "https://openrouter.ai/settings/keys" },
  { id: "groq", label: "Groq", icon: "⚡", required: false, placeholder: "gsk_...", hint: "Optional. Used for short & fast queries.", link: "https://console.groq.com/keys" },
  { id: "gemini", label: "Gemini", icon: "🧠", required: false, placeholder: "AIza...", hint: "Optional. Used for code & programming tasks.", link: "https://aistudio.google.com/app/apikey" },
  { id: "huggingface", label: "Hugging Face", icon: "🤗", required: false, placeholder: "hf_...", hint: "Optional. Specialized open source models.", link: "https://huggingface.co/settings/tokens" },
  { id: "together", label: "Together AI", icon: "🤝", required: false, placeholder: "tgp-...", hint: "Optional. 200M tokens/month free tier. Fast fallback.", link: "https://api.together.xyz/settings/api-keys" },
  { id: "mistral", label: "Mistral AI", icon: "🌪️", required: false, placeholder: "Enter Mistral API key...", hint: "Optional. 1B tokens free trial. Great for generation.", link: "https://console.mistral.ai/api-keys" },
];

const PARAMS = [
  { key: "temperature", label: "Creativity", min: 0, max: 15, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 7 },
  { key: "topP", label: "Top P", min: 0, max: 10, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 10 },
  { key: "frequencyPenalty", label: "Freq Penalty", min: -20, max: 20, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 0 },
  { key: "presencePenalty", label: "Pres Penalty", min: -20, max: 20, step: 1, display: (v) => (v / 10).toFixed(1), defaultVal: 0 },
  { key: "maxTokens", label: "Max Tokens", min: 256, max: 4096, step: 256, display: (v) => v, defaultVal: 2048 },
];

const RESPONSE_PRESETS = {
  short: { maxTokens: 1024, temperature: 3, topP: 9, frequencyPenalty: 5, presencePenalty: 5 },
  balanced: { maxTokens: 2048, temperature: 7, topP: 10, frequencyPenalty: 0, presencePenalty: 0 },
  detailed: { maxTokens: 4096, temperature: 10, topP: 10, frequencyPenalty: 0, presencePenalty: 0 },
};

function Toggle({ value, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`w-12 h-7 border-2 border-ink transition-all duration-100 flex items-center shadow-hard-sm hover:-rotate-1 ${value ? "bg-green justify-end" : "bg-white justify-start"}`}
      style={{ borderRadius: radius.wobblySm }}
      role="switch"
      aria-checked={value}
    >
      <div
        className="w-5 h-5 border-2 border-ink bg-white mx-0.5 transition-all duration-100"
        style={{ borderRadius: radius.wobblySm }}
      />
    </button>
  );
}

function SectionCard({ title, icon: Icon, children, className = "", colSpan = "" }) {
  return (
    <div
      className={`card-sketch bg-white ${colSpan} ${className}`}
      style={{ borderRadius: radius.wobblyMd }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-dashed border-ink/30 bg-yellow/20">
        {Icon && <Icon size={16} className="text-ink" strokeWidth={2.5} />}
        <span className="font-serif text-lg font-bold text-ink">{title}</span>
      </div>
      <div className="p-4 md:p-5">
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
    providerStatus, setProviderStatus, activeSessionId,
    personalInfo, updatePersonalInfo,
  } = useContext(chatsContext);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showToolForm, setShowToolForm] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [showRouting, setShowRouting] = useState(false);
  const [showModels, setShowModels] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const [keyValues, setKeyValues] = useState({ openrouter: "", groq: "", gemini: "", huggingface: "", together: "", mistral: "" });
  const [keyVisible, setKeyVisible] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false, together: false, mistral: false });
  const [keySaving, setKeySaving] = useState({ openrouter: false, groq: false, gemini: false, huggingface: false, together: false, mistral: false });
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
      const res = await api.validateAndSaveKey(preferences.userId, { [provider]: key });
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

  const goBack = async () => {
    const status = await KeysService.getStatus();
    const hasAnyKey = status.openrouter || status.groq || status.gemini || status.huggingface || status.together || status.mistral;
    setPreferences((prev) => ({ ...prev, currentPage: hasAnyKey ? "chat" : "guide" }));
  };
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

  const allSkills = [...SKILLS, ...customSkills].filter(s => !(settings.hiddenSkillIds || []).includes(s.id));

  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.filter((m) => m.type === "ch").length, 0);
  const totalWords = sessions.reduce((acc, s) => acc + s.messages.filter((m) => m.type === "ch").reduce((a, m) => a + ((m.question || "") + " " + (m.answer || "")).split(" ").length, 0), 0);
  const estTokens = Math.round(totalWords * 1.3);

  return (
    <div className="w-screen h-screen flex flex-col bg-paper dot-grid-bg overflow-hidden">
      {/* ── Masthead ── */}
      <header className="border-b-2 border-ink bg-paper shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="btn-sketch btn-sketch-sm btn-sketch-secondary flex items-center gap-1.5">
              <ArrowLeft size={16} strokeWidth={2.5} />
              Back
            </button>
            <div className="w-px h-5 bg-divider rotate-12" />
            <Settings2 size={18} className="text-ink" strokeWidth={2.5} />
            <h1 className="font-serif text-2xl font-bold text-ink -rotate-1">Settings</h1>
          </div>
        
        </div>
      </header>

      {/* ── Scrollable Grid Content ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 auto-rows-min py-4">

          {/* ═══ AI SKILLS ═══ */}
          <SectionCard title="AI Personality / Skill" icon={Bot} colSpan="md:col-span-2">
            {/* Skill selection mode toggle */}
            <div className="flex items-center gap-3 mb-3 p-2 border-2 border-ink/30 bg-white shadow-hard-sm" style={{ borderRadius: radius.wobblySm }}>
              <span className="font-mono text-xs text-muted-400 uppercase tracking-wider">Mode</span>
              <div className="flex gap-1">
                {['manual', 'smart'].map((mode) => (
                  <button key={mode} onClick={() => setSettings({ ...settings, skillSelectionMode: mode })}
                    className={`px-2.5 py-1 text-xs font-body uppercase tracking-widest border-2 transition-all duration-100 ${
                      settings.skillSelectionMode === mode
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/40 text-muted-500 hover:border-ink hover:text-ink'
                    }`}
                    style={{ borderRadius: radius.wobblySm }}>
                    {mode === 'manual' ? 'Force Select' : 'Smart'}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-400 ml-auto">
                {settings.skillSelectionMode === 'manual' ? 'Your choice always used' : 'Auto-detected from keywords'}
              </span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-400">Select or create a skill</span>
              <button onClick={() => setShowSkillForm((p) => !p)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-body uppercase tracking-widest border-2 border-ink bg-white text-ink hover:bg-ink hover:text-paper transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                style={{ borderRadius: radius.wobblySm }}>
                <Plus size={12} strokeWidth={2.5} />New Skill
              </button>
            </div>
            {showSkillForm && (
              <div className="mb-3 p-4 border-2 border-ink bg-muted-100 space-y-3 shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
                <SkillFormContent onSave={(form) => { addCustomSkill(form); setShowSkillForm(false); }} onCancel={() => setShowSkillForm(false)} />
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {allSkills.map((skill) => {
                    const isActive = settings.activeSkillId === skill.id;
                    const isHidden = (settings.hiddenSkillIds || []).includes(skill.id);
                    return (
                      <div key={skill.id} onClick={() => { if (!isHidden) setSettings({ ...settings, activeSkillId: skill.id }); }}
                        className={`relative flex flex-col items-center gap-1.5 p-3 border-2 cursor-pointer transition-all duration-100 bg-white ${
                          isHidden ? 'opacity-30 pointer-events-none border-ink/20' : 'hover:-rotate-1 hover:shadow-hard-sm'
                        } ${isActive && !isHidden ? "border-ink shadow-hard bg-yellow/30" : "border-ink/40 shadow-hard-sm"}`}
                        style={{ borderRadius: radius.wobblySm }}
                        title={skill.description}>
                        {skill.isCustom && <span className="absolute top-1 right-1 font-body text-[10px] uppercase text-muted-400">custom</span>}
                        <span className="text-lg">{skill.icon}</span>
                        <span className={`font-body text-sm text-center ${isActive && !isHidden ? "text-ink font-bold" : "text-muted-500"}`}>{skill.name}</span>
                        {skill.isCustom ? (
                          <button onClick={(e) => { e.stopPropagation(); deleteCustomSkill(skill.id); }} className="absolute bottom-1 right-1 text-muted-400 hover:text-red transition-colors"><X size={10} strokeWidth={2.5} /></button>
                        ) : (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const current = settings.hiddenSkillIds || [];
                            const next = current.includes(skill.id)
                              ? current.filter(id => id !== skill.id)
                              : [...current, skill.id];
                            setSettings({ ...settings, hiddenSkillIds: next });
                          }} className="absolute bottom-1 right-1 text-muted-400 hover:text-ink transition-colors" title={isHidden ? 'Show skill' : 'Hide skill'}>
                            {isHidden ? <Eye size={10} strokeWidth={2.5} /> : <EyeOff size={10} strokeWidth={2.5} />}
                          </button>
                        )}
                      </div>
                    );
                  })}
            </div>
            {(settings.hiddenSkillIds || []).length > 0 && (
              <button onClick={() => setSettings({ ...settings, hiddenSkillIds: [] })}
                className="mt-2 font-mono text-[11px] text-muted-400 hover:text-ink underline underline-offset-2 transition-colors">
                Restore all hidden skills
              </button>
            )}
          </SectionCard>

          {/* ═══ ROUTING STRATEGY ═══ */}
          <SectionCard title="Routing Strategy" icon={Layers}>
            <button onClick={() => setShowRouting((p) => !p)} className="w-full flex items-center justify-between py-2 hover:bg-yellow/20 hover:-rotate-1 transition-all duration-100 px-2 -mx-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{settings.routingMode === "smart" ? "🔄" : settings.routingMode === "groq" ? "⚡" : settings.routingMode === "gemini" ? "🧠" : "🌐"}</span>
                <span className="font-body text-sm text-ink font-bold">
                  {settings.routingMode === "smart" ? "Smart Router" : settings.routingMode === "groq" ? "Force Groq" : settings.routingMode === "gemini" ? "Force Gemini" : "Force OpenRouter"}
                </span>
              </div>
              {showRouting ? <ChevronUp size={12} className="text-muted-400" strokeWidth={2.5} /> : <ChevronDown size={12} className="text-muted-400" strokeWidth={2.5} />}
            </button>
            {showRouting && (
              <div className="flex flex-col gap-1.5 mt-1">
                  {ROUTING_OPTIONS.map((route) => {
                    const isActive = settings.routingMode === route.id;
                    const isMissingKey = route.id !== "smart" && !providerStatus[route.id];
                    return (
                      <div key={route.id} onClick={() => !isMissingKey && setSettings({ ...settings, routingMode: route.id })}
                        className={`flex items-center gap-2 p-2.5 border-2 transition-all duration-100 bg-white ${isMissingKey ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:-rotate-1 hover:shadow-hard-sm"} ${isActive ? "border-ink shadow-hard bg-yellow/20" : "border-ink/40 shadow-hard-sm"}`}
                        style={{ borderRadius: radius.wobblySm }}>
                        <span className="text-sm">{route.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-body text-sm font-bold ${isActive ? "text-ink" : "text-muted-500"}`}>{route.label}</span>
                            {isMissingKey && <span className="font-body text-xs px-1.5 border-2 border-red text-red" style={{ borderRadius: radius.wobblySm }}>key missing</span>}
                          </div>
                          <div className="font-body text-sm mt-0.5 text-muted-400">{route.desc}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            {settings.routingMode === "smart" && (
              <div className="border-t border-divider pt-3 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge size={13} className="text-muted-400" strokeWidth={2.5} />
                  <span className="font-body text-sm text-ink font-bold">Task Profile</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "auto", label: "Auto", desc: "Auto-detect based on message" },
                    { id: "speedster", label: "Speedster", desc: "Short & fast queries" },
                    { id: "specialist", label: "Specialist", desc: "Code & complex tasks" },
                    { id: "architect", label: "Architect", desc: "Creative & long text" },
                  ].map((t) => {
                    const isActive = settings.smartTaskType === t.id;
                    return (
                      <div key={t.id} onClick={() => setSettings({ ...settings, smartTaskType: t.id })}
                        className={`flex items-center gap-2 p-2.5 border-2 cursor-pointer transition-all duration-100 bg-white hover:-rotate-1 hover:shadow-hard-sm ${isActive ? "border-ink shadow-hard bg-yellow/20" : "border-ink/40 shadow-hard-sm"}`}
                        style={{ borderRadius: radius.wobblySm }}>
                        <div className="flex-1 min-w-0">
                          <div className={`font-body text-sm font-bold ${isActive ? "text-ink" : "text-muted-500"}`}>{t.label}</div>
                          <div className="font-body text-sm mt-0.5 text-muted-400">{t.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ═══ AI MODEL ═══ */}
          <SectionCard title="OpenRouter Model" icon={Wifi}>
            <p className="font-body text-xs text-muted-400 mb-2 leading-relaxed">Model used when OpenRouter is the active provider. Other providers use their own default models.</p>
            <button onClick={() => setShowModels((p) => !p)} className="w-full flex items-center justify-between py-2 hover:bg-yellow/20 hover:-rotate-1 transition-all duration-100 px-2 -mx-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{MODELS.find((m) => m.id === settings.activeModelId)?.icon || "🧠"}</span>
                <span className="font-body text-sm text-ink font-bold">{MODELS.find((m) => m.id === settings.activeModelId)?.name || "Select model"}</span>
              </div>
              {showModels ? <ChevronUp size={12} className="text-muted-400" strokeWidth={2.5} /> : <ChevronDown size={12} className="text-muted-400" strokeWidth={2.5} />}
            </button>
            {showModels && (
              <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                  {MODELS.map((model) => {
                    const isActive = settings.activeModelId === model.id;
                    return (
                      <div key={model.id} onClick={() => { setSettings({ ...settings, activeModelId: model.id }); setShowModels(false); }}
                        className={`flex items-center gap-2 p-2.5 border-2 cursor-pointer transition-all duration-100 bg-white hover:-rotate-1 hover:shadow-hard-sm ${isActive ? "border-ink shadow-hard bg-yellow/20" : "border-ink/40 shadow-hard-sm"}`}
                        style={{ borderRadius: radius.wobblySm }}>
                        <span className="text-sm">{model.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-body text-sm font-bold ${isActive ? "text-ink" : "text-muted-500"}`}>{model.name}</div>
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
                  className={`flex-1 py-2 text-sm font-body uppercase tracking-widest border-2 transition-all duration-100 ${settings.responseLength === opt ? "bg-green text-paper border-green shadow-hard-sm" : "bg-white border-ink/40 text-muted-500 hover:border-ink hover:text-ink hover:-rotate-1 shadow-hard-sm"}`}
                  style={{ borderRadius: radius.wobblySm }}>
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
                      className="w-7 h-7 border-2 border-ink flex items-center justify-center text-ink bg-white hover:bg-red hover:text-white transition-all duration-100 shadow-hard-sm hover:shadow-hard font-body text-base"
                      style={{ borderRadius: radius.wobblySm }}>-</button>
                    <input type="range" min={param.min} max={param.max} step={param.step}
                      value={settings[param.key] ?? param.defaultVal}
                      onChange={(e) => setSettings({ ...settings, [param.key]: +e.target.value })}
                      className="flex-1 h-2 appearance-none bg-muted-200 cursor-pointer accent-ink outline-none border-2 border-ink/30" />
                    <button type="button" onClick={() => setSettings({ ...settings, [param.key]: Math.min(param.max, (settings[param.key] ?? param.defaultVal) + param.step) })}
                      className="w-7 h-7 border-2 border-ink flex items-center justify-center text-ink bg-white hover:bg-green hover:text-white transition-all duration-100 shadow-hard-sm hover:shadow-hard font-body text-base"
                      style={{ borderRadius: radius.wobblySm }}>+</button>
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
            <textarea className="input-sketch w-full resize-none min-h-[80px] text-base"
              rows={3} placeholder="e.g. Always respond in French. My project uses React and Node.js..."
              value={settings.systemPromptPrefix || ""}
              onChange={(e) => setSettings({ ...settings, systemPromptPrefix: e.target.value })} />
          </SectionCard>

          {/* ═══ AI TOOLS ═══ */}
          <SectionCard title="AI Action Tools" icon={Wrench} colSpan="md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-400">Custom quick-action tools</span>
              <button onClick={() => { setEditingTool(null); setShowToolForm((p) => !p); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-body uppercase tracking-widest border-2 border-ink bg-white text-ink hover:bg-ink hover:text-paper transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                style={{ borderRadius: radius.wobblySm }}>
                <Plus size={12} strokeWidth={2.5} />New Tool
              </button>
            </div>
              {showToolForm && (
                <div className="mb-3 p-4 border-2 border-ink bg-muted-100 space-y-3 shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
                  <ToolFormContent initialData={editingTool}
                    onSave={(form) => { if (editingTool) updateAITool(editingTool.id, form); else addAITool(form); setShowToolForm(false); setEditingTool(null); }}
                    onCancel={() => { setShowToolForm(false); setEditingTool(null); }} />
                </div>
              )}
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {aiTools.map((tool) => {
                  const hidden = (settings.hiddenTools || []).includes(tool.id);
                  return (
                    <div key={tool.id} className="flex items-center justify-between p-2.5 border-2 border-ink/40 bg-white hover:border-ink hover:shadow-hard-sm transition-all duration-100 group"
                      style={{ borderRadius: radius.wobblySm }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => {
                          const current = settings.hiddenTools || [];
                          const next = hidden ? current.filter(id => id !== tool.id) : [...current, tool.id];
                          setSettings({ ...settings, hiddenTools: next });
                        }} className={`p-1 transition-colors ${hidden ? "text-muted-300" : "text-muted-400 hover:text-ink"}`} title={hidden ? "Show in toolbar" : "Hide from toolbar"}>
                          {hidden ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
                        </button>
                        <span className={`text-sm ${hidden ? "opacity-30" : ""}`}>{tool.icon}</span>
                        <div>
                          <span className={`font-body text-sm font-bold ${hidden ? "text-muted-300 line-through" : "text-ink"}`}>{tool.label}</span>
                          <span className="font-body text-sm text-muted-400 block">{tool.prompt?.slice(0, 30)}...</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTool(tool); setShowToolForm(true); }} className="p-1 text-muted-400 hover:text-ink"><Settings2 size={11} strokeWidth={2.5} /></button>
                        <button onClick={() => deleteAITool(tool.id)} className="p-1 text-muted-400 hover:text-red"><Trash2 size={11} strokeWidth={2.5} /></button>
                      </div>
                    </div>
                  );
                })}
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
                <div key={item.key} className="flex items-center justify-between py-1.5 hover:bg-yellow/20 hover:-rotate-1 px-2 -mx-2 transition-all duration-100 cursor-pointer" onClick={() => toggle(item.key)}>
                  <div className="flex items-center gap-2">
                    <item.icon size={12} className="text-muted-400" strokeWidth={2.5} />
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
                <div key={item.key} className="flex items-center justify-between py-1.5 hover:bg-yellow/20 hover:-rotate-1 px-2 -mx-2 transition-all duration-100 cursor-pointer" onClick={() => toggle(item.key)}>
                  <div className="flex items-center gap-2">
                    <item.icon size={12} className="text-muted-400" strokeWidth={2.5} />
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

          {/* ═══ PERSONAL INFO (global, persists across all sessions) ═══ */}
          <SectionCard title="Personal Info" icon={Bot} colSpan="md:col-span-2">
            <p className="font-body text-xs text-muted-500 mb-3 leading-relaxed">
              Stored across all sessions. Edit your name, profession, hobbies, or preferences — the AI will use these to personalize responses.
            </p>
            <PersonalInfoEditor info={personalInfo} onSave={updatePersonalInfo} />
          </SectionCard>

          {/* ═══ SESSION MEMORY (per-session facts) ═══ */}
          <SectionCard title="Session Memory" icon={MessageSquare}>
            <p className="font-body text-xs text-muted-500 mb-3 leading-relaxed">
              Facts learned from this session-specific conversation. Starts from your Personal Info and grows as we talk.
            </p>
            {Object.keys(activeSession?.userFacts || {}).length === 0 ? (
              <p className="font-body text-sm text-muted-400">
                No session-specific facts yet.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(activeSession?.userFacts || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center border-b border-divider pb-1">
                    <span className="font-mono text-xs uppercase text-muted-400">{key}</span>
                    <span className="font-body text-sm text-ink">{value}</span>
                  </div>
                ))}
              </div>
            )}
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
            <div className="h-2 w-full border-2 border-ink bg-paper mb-1.5 shadow-hard-sm" style={{ borderRadius: radius.wobblySm }}>
              <div className="h-full bg-ink transition-all duration-300" style={{ width: `${storageUsage.percentage}%`, borderRadius: radius.wobblySm }} />
            </div>
            <div className="flex justify-between font-mono text-sm uppercase tracking-widest text-muted-400">
              <span>{(storageUsage.used / (1024 * 1024)).toFixed(1)} MB</span>
              <span>{(storageUsage.quota / (1024 * 1024)).toFixed(0)} MB</span>
            </div>
          </SectionCard>

          {/* ═══ EXPORT / IMPORT ═══ */}
          <SectionCard title="Data Management" icon={Database} colSpan="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={exportChats} className="flex items-center gap-2 p-3 border-2 border-ink/40 bg-white hover:border-ink hover:-rotate-1 hover:shadow-hard-sm transition-all duration-100 text-left"
                style={{ borderRadius: radius.wobblySm }}>
                <Download size={15} className="text-ink" strokeWidth={2.5} />
                <span className="font-body text-sm text-ink">Export JSON</span>
              </button>
              <button onClick={exportTxt} className="flex items-center gap-2 p-3 border-2 border-ink/40 bg-white hover:border-ink hover:-rotate-1 hover:shadow-hard-sm transition-all duration-100 text-left"
                style={{ borderRadius: radius.wobblySm }}>
                <Download size={15} className="text-ink" strokeWidth={2.5} />
                <span className="font-body text-sm text-ink">Export TXT</span>
              </button>
              <div>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 p-3 border-2 border-ink/40 bg-white hover:border-ink hover:-rotate-1 hover:shadow-hard-sm transition-all duration-100 text-left"
                  style={{ borderRadius: radius.wobblySm }}>
                  <Upload size={15} className="text-ink" strokeWidth={2.5} />
                  <div>
                    <span className="font-body text-sm text-ink block">Import JSON</span>
                    <span className="font-body text-sm text-muted-400">Merges sessions</span>
                  </div>
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ═══ DANGER ZONE ═══ */}
          <SectionCard title="Danger Zone" icon={Trash2}>
            <div className="space-y-2">
              <button onClick={clearCurrentChat} className="w-full flex items-center gap-2 p-3 border-2 border-red bg-white text-red hover:bg-red hover:text-white transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                style={{ borderRadius: radius.wobblySm }}>
                <Trash2 size={14} strokeWidth={2.5} />
                <span className="font-body text-sm">Clear current chat</span>
              </button>
              <button onClick={() => setShowClearConfirm(true)} className="w-full flex items-center gap-2 p-3 border-2 border-red bg-white text-red hover:bg-red hover:text-white transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                style={{ borderRadius: radius.wobblySm }}>
                <Layers size={14} strokeWidth={2.5} />
                <span className="font-body text-sm">Clear ALL sessions</span>
              </button>
              <button onClick={resetAPIKey} className="w-full flex items-center gap-2 p-3 border-2 border-red bg-white text-red hover:bg-red hover:text-white transition-all duration-100 shadow-hard-sm hover:shadow-hard"
                style={{ borderRadius: radius.wobblySm }}>
                <Key size={14} strokeWidth={2.5} />
                <span className="font-body text-sm">Reset API key</span>
              </button>
            </div>
          </SectionCard>

          {/* ═══ API KEYS ═══ */}
          <div className="border-2 border-ink bg-paper col-span-1 md:col-span-2 lg:col-span-3 shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-dashed border-ink/30 bg-yellow/20">
              <Key size={14} className="text-ink" strokeWidth={2.5} />
              <span className="font-serif text-base font-bold text-ink">API Keys</span>
            </div>
            <div className="p-4 md:p-5">
              <p className="font-body text-base text-muted-500 mb-4 leading-relaxed">
                You provide your own API keys — they are encrypted and stored locally in your browser.
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
                    <div key={prov.id} className="border-2 border-ink bg-white p-3 shadow-hard-sm hover:shadow-hard transition-all duration-100 hover:-rotate-1"
                      style={{ borderRadius: radius.wobblySm }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{prov.icon}</span>
                          <span className={`font-body text-sm font-bold ${isActive ? "text-ink" : "text-muted-500"}`}>{prov.label}</span>
                          {prov.required && <span className="font-body text-xs px-1.5 border-2 border-red text-red" style={{ borderRadius: radius.wobblySm }}>required</span>}
                        </div>
                        {isActive ? (
                          <span className="flex items-center gap-1 font-body text-sm text-green"><Check size={12} className="text-green" strokeWidth={2.5} /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 font-body text-sm text-muted-400"><AlertCircle size={12} strokeWidth={2.5} /> Not set</span>
                        )}
                      </div>
                      <div className="flex gap-1.5 mb-1">
                        <div className="relative flex-1">
                          <input type={visible ? "text" : "password"} placeholder={prov.placeholder}
                            value={keyValues[prov.id]}
                            onChange={(e) => setKeyValues((p) => ({ ...p, [prov.id]: e.target.value }))}
                            className="input-sketch text-base pr-8"
                            style={{ borderRadius: radius.wobblySm }}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveKey(prov.id)} />
                          <button onClick={() => setKeyVisible((p) => ({ ...p, [prov.id]: !p[prov.id] }))}
                            className="absolute right-2 top-[7px] text-muted-400 hover:text-ink transition-colors">
                            {visible ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
                          </button>
                        </div>
                        <button disabled={!keyValues[prov.id]?.trim() || saving} onClick={() => handleSaveKey(prov.id)}
                          className={`px-3 py-1.5 text-sm font-body font-bold uppercase tracking-widest border-2 transition-all duration-100 flex items-center gap-1 ${keyValues[prov.id]?.trim() && !saving ? "border-ink text-ink bg-white hover:bg-ink hover:text-paper shadow-hard-sm" : "border-muted-200 text-muted-400 cursor-not-allowed bg-muted-100"}`}
                          style={{ borderRadius: radius.wobblySm }}>
                          {saving ? <Loader size={12} className="animate-spin" strokeWidth={2.5} /> : "Save"}
                        </button>
                      </div>
                      {result && (
                        <div className={`font-body text-sm mt-1 flex items-start gap-1 ${result.ok ? (result.warning ? "text-muted-500" : "text-green") : "text-red"}`}>
                          <span>{result.ok ? (result.warning ? "!" : "+") : "-"}</span>
                          <span>{result.ok ? result.warning || "Key saved" : result.error}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-body text-sm text-muted-400">{prov.hint}</span>
                        <a href={prov.link} target="_blank" rel="noreferrer" className="font-body text-sm text-ink hover:text-green underline decoration-wavy underline-offset-2">Get key</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            
            </div>
          </div>

        </div>
      </div>

      {/* ── Clear All Confirm Dialog ── */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="card-sketch card-sketch-tack p-6 md:p-8 max-w-sm w-full mx-4 text-center bg-white shadow-hard"
            style={{ borderRadius: radius.wobblyMd }}>
            <p className="font-serif text-4xl font-bold text-red mb-3 -rotate-2">!</p>
            <p className="font-serif text-2xl font-bold text-ink mb-2 -rotate-1">Clear All Sessions?</p>
            <p className="font-body text-lg text-muted-600 mb-6">This will permanently delete all {sessions.length} sessions. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { clearAllSessions(); setShowClearConfirm(false); setPreferences((prev) => ({ ...prev, currentPage: "chat" })); }}
                className="btn-sketch btn-sketch-sm flex-1 bg-red text-white border-red hover:bg-red/90">Delete All</button>
              <button onClick={() => setShowClearConfirm(false)}
                className="btn-sketch btn-sketch-sm btn-sketch-secondary flex-1">Cancel</button>
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
          <button onClick={() => setShowEmojiPicker((p) => !p)} className="w-8 h-8 border-2 border-ink flex items-center justify-center bg-white hover:bg-yellow/30 transition-all duration-100 shadow-hard-sm text-base"
            style={{ borderRadius: radius.wobblySm }}>{form.icon}</button>
          {showEmojiPicker && (
            <div className="absolute top-9 left-0 z-50 p-2 border-2 border-ink bg-paper grid grid-cols-5 gap-1 shadow-hard" style={{ borderRadius: radius.wobblyMd }}>
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => { setForm((p) => ({ ...p, icon: e })); setShowEmojiPicker(false); }} className="w-7 h-7 text-sm hover:bg-yellow/30 flex items-center justify-center transition-colors border-2 border-transparent hover:border-ink"
                  style={{ borderRadius: radius.wobblySm }}>{e}</button>
              ))}
            </div>
          )}
        </div>
        <input type="text" placeholder="Skill name..." maxLength={24} value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="input-sketch flex-1 text-base" />
      </div>
      <input type="text" placeholder="Short description..." maxLength={60} value={form.description}
        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        className="input-sketch w-full text-base" />
      <textarea placeholder="System prompt..." value={form.systemPrompt}
        onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))} rows={3}
        className="input-sketch w-full resize-none min-h-[60px] text-base" />
      <div className="flex gap-2">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className={`btn-sketch btn-sketch-sm flex-1 ${valid ? "" : "opacity-40 cursor-not-allowed"}`}>Save</button>
        <button onClick={onCancel} className="btn-sketch btn-sketch-sm btn-sketch-secondary">Cancel</button>
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
          <button onClick={() => setShowEmojiPicker((p) => !p)} className="w-8 h-8 border-2 border-ink flex items-center justify-center bg-white hover:bg-yellow/30 transition-all duration-100 shadow-hard-sm text-base"
            style={{ borderRadius: radius.wobblySm }}>{form.icon}</button>
          {showEmojiPicker && (
            <div className="absolute top-9 left-0 z-50 p-2 border-2 border-ink bg-paper grid grid-cols-5 gap-1 shadow-hard" style={{ borderRadius: radius.wobblyMd }}>
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => { setForm((p) => ({ ...p, icon: e })); setShowEmojiPicker(false); }} className="w-7 h-7 text-sm hover:bg-yellow/30 flex items-center justify-center transition-colors border-2 border-transparent hover:border-ink"
                  style={{ borderRadius: radius.wobblySm }}>{e}</button>
              ))}
            </div>
          )}
        </div>
        <input type="text" placeholder="Tool label..." maxLength={16} value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          className="input-sketch flex-1 text-base" />
      </div>
      <textarea placeholder="Prompt template..." value={form.prompt || ""}
        onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))} rows={2}
        className="input-sketch w-full resize-none min-h-[60px] text-base" />
      <div className="flex gap-2">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className={`btn-sketch btn-sketch-sm flex-1 ${valid ? "" : "opacity-40 cursor-not-allowed"}`}>Save</button>
        <button onClick={onCancel} className="btn-sketch btn-sketch-sm btn-sketch-secondary">Cancel</button>
      </div>
    </>
  );
}

function PersonalInfoEditor({ info, onSave }) {
  const [entries, setEntries] = useState(() => Object.entries(info).map(([k, v]) => ({ key: k, value: v })));
  const [editingIdx, setEditingIdx] = useState(null);

  const handleSave = () => {
    const obj = {};
    for (const e of entries) {
      if (e.key.trim()) obj[e.key.trim()] = e.value.trim();
    }
    onSave(obj);
    setEditingIdx(null);
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { key: "", value: "" }]);
    setEditingIdx(entries.length);
  };

  const removeEntry = (idx) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const updateEntry = (idx, field, val) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  return (
    <div className="space-y-2">
      {entries.map((e, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {editingIdx === idx ? (
            <>
              <input
                value={e.key}
                onChange={(v) => updateEntry(idx, "key", v.target.value)}
                placeholder="Label (e.g. name)"
                className="input-sketch w-28 text-sm"
                style={{ borderRadius: radius.wobblySm }}
              />
              <input
                value={e.value}
                onChange={(v) => updateEntry(idx, "value", v.target.value)}
                placeholder="Value"
                className="input-sketch flex-1 text-sm"
                style={{ borderRadius: radius.wobblySm }}
              />
              <button onClick={handleSave} className="shrink-0 p-1 hover:bg-muted-100 transition-colors">
                <Check size={14} strokeWidth={1.5} />
              </button>
              <button onClick={() => removeEntry(idx)} className="shrink-0 p-1 hover:bg-muted-100 transition-colors text-red-500">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </>
          ) : (
            <>
              <span className="w-28 font-mono text-xs uppercase text-muted-400 truncate">{e.key}</span>
              <span className="flex-1 font-body text-sm text-ink truncate">{e.value}</span>
              <button onClick={() => setEditingIdx(idx)} className="shrink-0 p-1 hover:bg-muted-100 transition-colors text-muted-400 hover:text-ink">
                <span className="text-xs font-mono uppercase tracking-widest">edit</span>
              </button>
            </>
          )}
        </div>
      ))}
      {editingIdx === null && (
        <button onClick={addEntry} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-body uppercase tracking-widest border-2 border-dashed border-ink/40 text-muted-400 hover:border-ink hover:text-ink hover:shadow-hard-sm transition-all duration-100"
          style={{ borderRadius: radius.wobblySm }}>
          <Plus size={14} strokeWidth={2.5} /> Add
        </button>
      )}
    </div>
  );
}
