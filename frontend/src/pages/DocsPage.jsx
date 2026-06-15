import { useState, useEffect, useRef, useContext } from "react";
import { chatsContext, SKILLS, MODELS } from "../context/chatsContext";
import { radius, shadows } from "../lib/design-tokens";
import {
    ArrowLeft,
    Terminal,
    Palette,
    Bot,
    Settings2,
    Database,
    Keyboard,
    Star,
    Zap,
    Copy,
    Eye,
    RotateCcw,
    Edit3,
    Pin,
    Search,
    Plus,
    Download,
    Upload,
    Trash2,
    Volume2,
    Clock,
    MousePointerClick,
    AlignLeft,
    LayoutList,
    Layers,
    Sparkles,
    Gauge,
    ChevronRight,
    ExternalLink,
    BookOpen,
    Command,
} from "lucide-react";


// ── Placeholder helper (inline SVG, no external dependency) ────
const pic = (w, h, seed) => {
  const label = seed.replace(/chatforge-/i, "").replace(/-/g, " ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#fdfbf7"/><rect x="1" y="1" width="${w-2}" height="${h-2}" fill="none" stroke="#2d2d2d" stroke-width="2" rx="8"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Patrick Hand, cursive" font-size="14" fill="#8a8580">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// ── Skills and Models imported from chatsContext ─────────────

const THEMES = [
    { icon: "🟢", name: "Matrix Green", primary: "#39ff14", secondary: "#00f5ff", accent: "#ff2d78" },
    { icon: "🔵", name: "Cyber Cyan", primary: "#00f5ff", secondary: "#7b2fff", accent: "#ff6b35" },
    { icon: "🟡", name: "Solar Amber", primary: "#ffd700", secondary: "#ff8c00", accent: "#ff2d78" },
    { icon: "🟣", name: "Void Purple", primary: "#b44fff", secondary: "#00f5ff", accent: "#ff2d78" },
    { icon: "🔴", name: "Crimson Edge", primary: "#ff3b5c", secondary: "#ff8c00", accent: "#00f5ff" },
    { icon: "🎨", name: "Custom", primary: "#39ff14", secondary: "#00f5ff", accent: "#ff2d78" },
];

const COMMANDS = [
    { cmd: "//>summarize", desc: "AI summarizes the entire current conversation into bullet points." },
    { cmd: "//>translate", desc: "Switch to Translator mode and start translating text." },
    { cmd: "//>quiz [topic]", desc: "Generates an interactive multiple choice quiz about the given topic." },
    { cmd: "//>flashcards [topic]", desc: "Generates interactive study flashcards about the topic." },
    { cmd: "//>mindmap [topic]", desc: "Creates a visual mindmap structure for exploring the topic." },
    { cmd: "//>help", desc: "Shows a Markdown table of all available commands and shortcuts." },
    { cmd: "//>skill", desc: "The active AI skill describes itself and gives 3 example prompts." },
    { cmd: "//>model", desc: "The active AI model introduces itself and its strengths." },
    { cmd: "//>clear", desc: "Clears the current chat history back to the welcome state." },
    { cmd: "//>new", desc: "Creates a brand-new chat session." },
    { cmd: "//>export", desc: "Exports all sessions as a JSON file." },
    { cmd: "//>stats", desc: "Displays session statistics in the chat." },
    { cmd: "//>retry", desc: "Re-sends the last prompt and regenerates the AI response." },
];

const SHORTCUTS = [
    { key: "Enter", desc: "Send current message to the AI" },
    { key: "Shift+Enter", desc: "Insert a newline without sending" },
    { key: "↑ / ↓", desc: "Navigate through your prompt history" },
    { key: "Ctrl+F", desc: "Open the in-chat search bar" },
];

// ── Nav Sections ──────────────────────────────────────────────
const NAV_SECTIONS = [
    { id: "getting-started", label: "Getting Started", icon: BookOpen },
    { id: "commands", label: "Commands", icon: Command },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
    { id: "sidebar", label: "Sidebar", icon: LayoutList },
    { id: "messages", label: "Messages", icon: Copy },
    { id: "skills", label: "AI Skills", icon: Bot },
    { id: "models", label: "AI Models", icon: Zap },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "ai-settings", label: "AI Settings", icon: Gauge },
    { id: "interface", label: "Interface", icon: Settings2 },
    { id: "data", label: "Data", icon: Database },
];

// ── Reusable styled components ────────────────────────────────
function SectionTitle({ id, icon: Icon, children }) {
    return (
        <div id={id} className="flex items-center gap-2.5 mb-5 pb-3 border-b-2 border-dashed border-ink/30">
            <Icon size={18} className="text-ink" strokeWidth={2.5} />
            <h2 className="font-serif text-xl font-bold text-ink">{children}</h2>
        </div>
    );
}

function Badge({ children }) {
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 font-body text-xs uppercase tracking-widest border-2 border-ink bg-white shadow-hard-sm"
            style={{ borderRadius: radius.wobblySm }}>
            {children}
        </span>
    );
}

function Card({ children }) {
    return (
        <div className="bg-white border-2 border-ink p-4 md:p-5 shadow-hard-sm hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-100"
            style={{ borderRadius: radius.wobblyMd }}>
            {children}
        </div>
    );
}

function Screenshot({ src, alt, caption }) {
    return (
        <div className="my-6 border-2 border-ink bg-paper overflow-hidden shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
            <img src={src} alt={alt} loading="lazy" className="block w-full h-auto" />
            {caption && <p className="font-body text-sm text-muted-500 text-center py-2 px-4 bg-muted-100 border-t-2 border-dashed border-ink/20 m-0">{caption}</p>}
        </div>
    );
}

// ── Main DocsPage ─────────────────────────────────────────────
export function DocsPage() {
    const { setPreferences, preferences } = useContext(chatsContext);
    const [activeSection, setActiveSection] = useState("getting-started");
    const contentRef = useRef(null);

    // Scroll-spy
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const handler = () => {
            const secs = NAV_SECTIONS.map(({ id }) => document.getElementById(id));
            for (let i = secs.length - 1; i >= 0; i--) {
                if (secs[i] && secs[i].getBoundingClientRect().top <= 120) {
                    setActiveSection(NAV_SECTIONS[i].id);
                    break;
                }
            }
        };
        el.addEventListener("scroll", handler, { passive: true });
        return () => el.removeEventListener("scroll", handler);
    }, []);

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const goBack = () => {
        setPreferences((prev) => ({
            ...prev,
            currentPage: "chat",
        }));
    };

    return (
        <div className="flex h-screen bg-paper text-ink font-body overflow-hidden relative">
            {/* ── Left Nav ─────────────────────────────────────────── */}
            <aside className="w-[260px] min-w-[260px] bg-paper border-r-2 border-ink flex flex-col relative z-10">
                {/* Header */}
                <div className="px-4 py-5 border-b-2 border-dashed border-ink/30">
                    <button onClick={goBack} className="btn-sketch btn-sketch-sm mb-4">
                        <ArrowLeft size={14} strokeWidth={2.5} />
                        Back to App
                    </button>
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-ink" strokeWidth={2.5} />
                        <span className="font-serif text-base font-bold text-ink">ChatForge</span>
                        <Badge>v2.0</Badge>
                    </div>
                    <p className="font-body text-sm text-muted-400 uppercase tracking-widest mt-1.5">Documentation</p>
                </div>

                {/* Nav links */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                    {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => scrollTo(id)}
                            className={`w-full flex items-center gap-2.5 text-left bg-none border-l-[3px] border-transparent text-muted-500 font-body text-sm py-2 px-3 cursor-pointer mb-0.5 transition-all duration-100 hover:text-ink hover:bg-muted-100 ${
                                activeSection === id ? "!border-red bg-muted-100 text-ink font-bold" : ""
                            }`}
                        >
                            <Icon size={13} strokeWidth={2.5} />
                            {label}
                            {activeSection === id && <ChevronRight size={11} className="ml-auto text-red" strokeWidth={2.5} />}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-4 py-3 border-t-2 border-dashed border-ink/30 flex flex-col gap-1.5">
                    <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted-400 font-body text-sm hover:text-ink transition-colors">
                        OpenRouter API <ExternalLink size={11} strokeWidth={2.5} />
                    </a>
                    <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted-400 font-body text-sm hover:text-ink transition-colors">
                        GitHub <ExternalLink size={11} strokeWidth={2.5} />
                    </a>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto" ref={contentRef}>

                {/* ── Hero ─────────────────────────────────────────────── */}
                <div className="px-10 py-12 max-w-[880px] mx-auto">
                    <div>
                        <div className="flex gap-2 mb-5">
                            <Badge>v2.0</Badge>
                            <Badge>React 19</Badge>
                            <Badge>Free AI Models</Badge>
                        </div>
                        <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-4 text-ink -rotate-1">
                            <span className="text-ink">Chat</span>
                            <span className="text-red">Forge</span>
                            <span className="text-muted-500"> Documentation</span>
                        </h1>
                        <p className="font-body text-lg text-muted-500 leading-relaxed max-w-[560px] mb-7">
                            A retro-inspired AI terminal interface. Everything you need to master ChatForge —
                            from keyboard shortcuts to custom AI skills and model selection.
                        </p>
                        <div className="flex gap-3 items-center">
                            <button onClick={goBack} className="btn-sketch">
                                <Terminal size={16} strokeWidth={2.5} className="mr-1" />
                                Launch App
                            </button>
                            <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="btn-sketch btn-sketch-secondary">
                                Get API Key <ExternalLink size={14} strokeWidth={2.5} className="ml-1" />
                            </a>
                        </div>
                    </div>
                    <Screenshot
                        src={pic(900, 480, "chatforge-hero")}
                        alt="ChatForge terminal interface"
                        caption="ChatForge — retro terminal AI interface"
                    />
                </div>

                <div className="max-w-[820px] mx-auto px-10 pb-14">

                    {/* ── Getting Started ──────────────────────────────────── */}
                    <section className="mt-12 first:mt-0">
                        <SectionTitle id="getting-started" icon={BookOpen}>Getting Started</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">
                            ChatForge connects to <strong className="text-ink font-bold">OpenRouter</strong> — a free gateway to dozens of powerful AI models.
                            You'll need a free API key to begin.
                        </p>
                        <div className="flex flex-col gap-4 my-5">
                            {[
                                { n: "01", title: "Get your API key", desc: <>Visit <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-red underline decoration-wavy underline-offset-2 hover:text-ink">openrouter.ai</a> and create a free account. Copy your API key from the dashboard.</> },
                                { n: "02", title: "Paste & authenticate", desc: "On the ChatForge guide page, paste your key in the terminal input and press Enter. Your key is encrypted and stored securely in your browser — it is sent to our server only during chat requests and is never logged." },
                                { n: "03", title: "Start chatting", desc: "Once authenticated, the full terminal interface loads. Type any question and press Enter to send. Use //> commands for advanced interactions." },
                            ].map(({ n, title, desc }) => (
                                <div key={n} className="flex gap-4 items-start p-4 border-l-[3px] border-ink bg-white shadow-hard-sm hover:shadow-hard transition-all duration-100"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <div className="font-body text-sm font-bold text-ink px-3 py-1 border-2 border-ink bg-paper shrink-0 mt-0.5 whitespace-nowrap"
                                        style={{ borderRadius: radius.wobblySm }}>{n}</div>
                                    <div>
                                        <h3 className="font-body text-base font-bold text-ink mb-1">{title}</h3>
                                        <p className="font-body text-sm text-muted-500 leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Screenshot
                            src={pic(900, 400, "chatforge-guide")}
                            alt="ChatForge guide page"
                            caption="The guide page — paste your OpenRouter key to authenticate"
                        />
                    </section>

                    {/* ── Commands ─────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="commands" icon={Command}>Terminal Commands</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">
                            Type <code className="inline-flex items-center px-1.5 py-0.5 font-code text-xs bg-muted-100 border-2 border-ink text-ink font-medium"
                            style={{ borderRadius: radius.wobblySm }}>{"//> "}</code> in the input to see a live command menu. Commands are processed instantly — some trigger AI responses, others perform local actions.
                        </p>
                        <div className="my-5 overflow-x-auto border-2 border-ink shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
                            <table className="w-full border-collapse font-body text-sm">
                                <thead className="bg-muted-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-body text-xs text-muted-500 uppercase tracking-widest border-b-2 border-ink whitespace-nowrap">Command</th>
                                        <th className="px-4 py-3 text-left font-body text-xs text-muted-500 uppercase tracking-widest border-b-2 border-ink whitespace-nowrap">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMMANDS.map(({ cmd, desc }, i) => (
                                        <tr key={cmd} className="border-b border-dashed border-ink/20 last:border-b-0 hover:bg-yellow/10 transition-colors">
                                            <td className="px-4 py-2.5"><code className="inline-flex items-center px-1.5 py-0.5 font-code text-xs bg-muted-100 border-2 border-ink text-ink font-medium"
                                                style={{ borderRadius: radius.wobblySm }}>{cmd}</code></td>
                                            <td className="px-4 py-2.5 text-muted-500">{desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* ── Shortcuts ────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="shortcuts" icon={Keyboard}>Keyboard Shortcuts</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">ChatForge is built for speed. Learn these shortcuts to work without leaving the keyboard.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-5">
                            {SHORTCUTS.map(({ key, desc }) => (
                                <div key={key} className="flex items-center gap-3 p-3 bg-white border-2 border-ink shadow-hard-sm hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <kbd className="font-code text-sm font-bold text-ink bg-muted-100 border-2 border-ink px-2.5 py-1 whitespace-nowrap shrink-0"
                                        style={{ borderRadius: radius.wobblySm }}>{key}</kbd>
                                    <p className="font-body text-sm text-muted-500 leading-snug">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Sidebar ──────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="sidebar" icon={LayoutList}>Sidebar & Sessions</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">
                            The left sidebar is your chat history catalog. Each conversation is saved as an independent session with its own context.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-5">
                            {[
                                { icon: <Search size={16} />, title: "Search Sessions", desc: "Use the persistent search bar at the top of the sidebar to instantly filter past sessions by title." },
                                { icon: <Pin size={16} />, title: "Pin Sessions", desc: "Hover a session and click the 📌 pin icon to stick it to the very top of the list. Pinned sessions survive re-ordering." },
                                { icon: <Edit3 size={16} />, title: "Rename Sessions", desc: "Click the pencil icon on hover to open an inline editor. Rename any session with a double-click on its title." },
                                { icon: <Plus size={16} />, title: "New Session", desc: "Click the + button at the top of the sidebar to create a fresh session with a clean slate." },
                                { icon: <Trash2 size={16} />, title: "Delete Session", desc: "Hover a session and click the trash icon to permanently delete it. This cannot be undone." },
                                { icon: <Star size={16} />, title: "Auto-title", desc: "Sessions are automatically titled using the first message you send. You can rename them at any time." },
                            ].map(({ icon, title, desc }) => (
                                <div key={title} className="bg-white border-2 border-ink shadow-hard-sm p-4 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100 flex flex-col gap-2"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <div className="text-ink">{icon}</div>
                                    <h3 className="font-body text-sm font-bold text-ink">{title}</h3>
                                    <p className="font-body text-xs text-muted-500 leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                        <Screenshot
                            src={pic(380, 520, "chatforge-sidebar")}
                            alt="Sidebar with pinned sessions"
                            caption="Sidebar — search, pin, rename and manage sessions"
                        />
                    </section>

                    {/* ── Messages ─────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="messages" icon={Copy}>Message Interactions</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">
                            Every message block has a rich set of actions available on hover. These let you refine, save, and manage responses without leaving the flow.
                        </p>
                        <Screenshot
                            src={pic(900, 420, "chatforge-messages")}
                            alt="Message block with action buttons"
                            caption="Hover a message to reveal all available actions"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-5">
                            {[
                                { icon: <Edit3 size={16} />, title: "Edit Prompt", desc: "Opens a large inline textarea. Fix your prompt and click 'Save & Re-send' to regenerate the AI response from that point." },
                                { icon: <RotateCcw size={16} />, title: "Retry", desc: "Wipes the current AI response and re-sends the exact same prompt to get a fresh answer." },

                                { icon: <Eye size={16} />, title: "Raw Markdown", desc: "Toggle between rendered Markdown and the raw source text. Useful when the renderer mangles tables or code." },
                                { icon: <Copy size={16} />, title: "Copy Response", desc: "Instantly copies the full AI response text to your clipboard. A ✓ flash confirms the copy." },
                                { icon: <Layers size={16} />, title: "Multi-Drafts", desc: "Toggle multiple drafts above the input to generate 3 AI responses simultaneously. Choose the best, or use AI to merge and summarize them." },
                            ].map(({ icon, title, desc }) => (
                                <div key={title} className="bg-white border-2 border-ink shadow-hard-sm p-4 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100 flex flex-col gap-2"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <div className="text-ink">{icon}</div>
                                    <h3 className="font-body text-sm font-bold text-ink">{title}</h3>
                                    <p className="font-body text-xs text-muted-500 leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── AI Skills ────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="skills" icon={Bot}>AI Skills &amp; Personas</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">
                            Skills are predefined AI personas with specialized system prompts. Switch between them in Settings → AI, or activate one on-the-fly with <code className="inline-flex items-center px-1.5 py-0.5 font-code text-xs bg-muted-100 border-2 border-ink text-ink font-medium"
                            style={{ borderRadius: radius.wobblySm }}>{"//>skill"}</code>.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-5">
                            {SKILLS.map((s) => (
                                <div key={s.id} className="bg-white border-2 border-ink shadow-hard-sm p-4 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100 flex flex-col gap-2"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <span className="font-body text-lg">{s.icon}</span>
                                    <h3 className="font-body text-sm font-bold text-ink">{s.name}</h3>
                                    <p className="font-body text-xs text-muted-500 leading-relaxed">{s.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="border-2 border-ink shadow-hard-sm p-5 mt-6" style={{ borderRadius: radius.wobblyMd }}>
                            <div className="flex items-center gap-2 font-body text-sm font-bold text-ink mb-3">
                                <Plus size={16} strokeWidth={2.5} />
                                Creating Custom Skills
                            </div>
                            <ol className="font-body text-sm text-muted-500 leading-relaxed ml-5 list-decimal space-y-1.5 marker:text-ink marker:font-bold">
                                <li>Open Settings (⚙️) → <strong className="text-ink">AI</strong> tab</li>
                                <li>Click <strong className="text-ink">"New Skill"</strong> in the AI Personality section</li>
                                <li>Choose an emoji icon and give your skill a name</li>
                                <li>Write a deep system prompt that defines the AI's behavior</li>
                                <li>Click <strong className="text-ink">"✓ Save Skill"</strong> — it's instantly available in the skill grid</li>
                            </ol>
                            <p className="font-body text-sm text-muted-500 leading-relaxed mt-3 pt-3 border-t-2 border-dashed border-ink/20">Custom skills are stored in localStorage and survive page refreshes. Activate them via Settings or with <code className="inline-flex items-center px-1.5 py-0.5 font-code text-xs bg-muted-100 border-2 border-ink text-ink font-medium"
                                style={{ borderRadius: radius.wobblySm }}>{"//>skill"}</code>.</p>
                        </div>
                        <Screenshot
                            src={pic(900, 380, "chatforge-skills")}
                            alt="AI Skills panel in settings"
                            caption="Settings → AI — select built-in skills or create your own custom personas"
                        />
                    </section>

                    {/* ── AI Models ────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="models" icon={Zap}>AI Models</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">
                            ChatForge connects to OpenRouter's free model tier. If a model is at capacity, ChatForge automatically falls back to an available one — you always get an answer.
                        </p>
                        <div className="my-5 overflow-x-auto border-2 border-ink shadow-hard-sm" style={{ borderRadius: radius.wobblyMd }}>
                            <table className="w-full border-collapse font-body text-sm">
                                <thead className="bg-muted-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-body text-xs text-muted-500 uppercase tracking-widest border-b-2 border-ink"></th>
                                        <th className="px-4 py-3 text-left font-body text-xs text-muted-500 uppercase tracking-widest border-b-2 border-ink">Model</th>
                                        <th className="px-4 py-3 text-left font-body text-xs text-muted-500 uppercase tracking-widest border-b-2 border-ink">Provider</th>
                                        <th className="px-4 py-3 text-left font-body text-xs text-muted-500 uppercase tracking-widest border-b-2 border-ink">Best For</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MODELS.map((m) => (
                                        <tr key={m.name} className="border-b border-dashed border-ink/20 last:border-b-0 hover:bg-yellow/10 transition-colors">
                                            <td className="px-4 py-2.5 text-base">{m.icon}</td>
                                            <td className="px-4 py-2.5 font-bold text-ink">{m.name}</td>
                                            <td className="px-4 py-2.5"><Badge>{m.provider}</Badge></td>
                                            <td className="px-4 py-2.5 text-muted-500">{m.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px]">
                            Switch models in <strong className="text-ink">Settings → AI → AI Intelligence / Model</strong>. The active model is shown in the toolbar. Use <code className="inline-flex items-center px-1.5 py-0.5 font-code text-xs bg-muted-100 border-2 border-ink text-ink font-medium"
                            style={{ borderRadius: radius.wobblySm }}>{"//>model"}</code> to get a model self-introduction.
                        </p>
                    </section>

                    {/* ── Appearance ───────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="appearance" icon={Palette}>Appearance Settings</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">Open Settings (⚙️) → <strong className="text-ink">Appearance</strong> tab. All changes apply instantly and save to localStorage.</p>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Color Themes</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                            {THEMES.map((t) => (
                                <div key={t.name} className="bg-white border-2 border-ink shadow-hard-sm p-4 flex flex-col items-center gap-2 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <div className="flex gap-1">
                                        <div className="w-5 h-5 border border-ink/30" style={{ background: t.primary, borderRadius: radius.wobblySm }} />
                                        <div className="w-5 h-5 border border-ink/30" style={{ background: t.secondary, borderRadius: radius.wobblySm }} />
                                        <div className="w-5 h-5 border border-ink/30" style={{ background: t.accent, borderRadius: radius.wobblySm }} />
                                    </div>
                                    <span className="font-body text-lg">{t.icon}</span>
                                    <span className="font-body text-xs font-bold text-ink">{t.name}</span>
                                </div>
                            ))}
                        </div>
                        <p className="font-body text-sm text-muted-500 leading-relaxed mb-5">
                            The <strong className="text-ink">Custom</strong> theme reveals three color pickers: <em className="text-ink">Primary</em> (UI elements), <em className="text-ink">Secondary</em> (borders), and <em className="text-ink">Accent</em> (actions/errors). Enter any hex value or use the color picker swatch.
                        </p>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Typography</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                            {["Fira Code", "JetBrains Mono", "Cascadia Code"].map((f) => (
                                <div key={f} className="bg-white border-2 border-ink shadow-hard-sm p-4 flex flex-col items-center gap-2 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <span className="font-code text-lg text-ink" style={{ fontFamily: f }}>AaBbCc 0Oo</span>
                                    <span className="font-body text-xs font-bold text-ink">{f}</span>
                                </div>
                            ))}
                        </div>
                        <p className="font-body text-sm text-muted-500 leading-relaxed mb-5">Use the <strong className="text-ink">Font Size</strong> slider (12–18px) to fine-tune readability.</p>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Visual Effects</h3>
                        <div className="flex flex-col gap-2 my-3">
                            <div className="flex items-start gap-3 p-3 bg-white border-2 border-ink shadow-hard-sm"
                                style={{ borderRadius: radius.wobblySm }}>
                                <span className="font-body text-sm font-bold text-ink shrink-0 w-[130px]">≡ Compact mode</span>
                                <span className="font-body text-xs text-muted-500 leading-relaxed">Reduces padding and spacing in message blocks for a denser view.</span>
                            </div>
                        </div>
                        <Screenshot
                            src={pic(900, 460, "chatforge-appearance")}
                            alt="Appearance settings panel"
                            caption="Settings → Appearance — themes, fonts, and visual effects"
                        />
                    </section>

                    {/* ── AI Settings ──────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="ai-settings" icon={Gauge}>AI Settings</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">Fine-tune how the AI behaves and responds. Found in Settings (⚙️) → <strong className="text-ink">AI</strong> tab.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-5">
                            {[
                                {
                                    icon: <Gauge size={16} />,
                                    title: "Response Length",
                                    desc: "Choose between Short (concise), Balanced (default), or Detailed (thorough). This instruction is appended to every AI request.",
                                },
                                {
                                    icon: <Sparkles size={16} />,
                                    title: "Creativity (Temperature)",
                                    desc: "Slider from 0.0 (Precise, deterministic) to 1.5 (Highly creative, unpredictable). Default is 0.7.",
                                },
                                {
                                    icon: <AlignLeft size={16} />,
                                    title: "Context Prefix",
                                    desc: "A multi-line text area. Whatever you write here is prepended to every AI system prompt. Use it for persistent context like: 'I am a Python developer, avoid explaining basics.'",
                                },
                                {
                                    icon: <Bot size={16} />,
                                    title: "AI Skill / Persona",
                                    desc: "Each skill has a unique system prompt that defines the AI's personality and focus. The active skill persists across sessions until you change it.",
                                },
                            ].map(({ icon, title, desc }) => (
                                <div key={title} className="bg-white border-2 border-ink shadow-hard-sm p-4 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100 flex flex-col gap-2"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <div className="text-ink">{icon}</div>
                                    <h3 className="font-body text-sm font-bold text-ink">{title}</h3>
                                    <p className="font-body text-xs text-muted-500 leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Interface ────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="interface" icon={Settings2}>Interface Settings</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">Found in Settings (⚙️) → <strong className="text-ink">Interface</strong> tab. Toggle UI behaviors to match your workflow.</p>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Behavior</h3>
                        <div className="flex flex-col gap-2 my-3">
                            {[
                                { icon: <MousePointerClick size={16} />, label: "Auto-scroll to bottom", desc: "Automatically scrolls the chat view down when new messages arrive." },
                                { icon: <Zap size={16} />, label: "Streaming indicator", desc: "Shows a pulsing cursor animation while the AI is generating its response." },
                                { icon: <Clock size={16} />, label: "Show timestamps", desc: "Displays the time each message was sent below every message block." },
                                { icon: <Sparkles size={16} />, label: "Animations", desc: "Enables/disables all Motion-powered enter/exit animations throughout the UI." },
                            ].map(({ icon, label, desc }) => (
                                <div key={label} className="flex items-start gap-3 p-3 bg-white border-2 border-ink shadow-hard-sm"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <span className="font-body text-sm font-bold text-ink shrink-0 flex items-center gap-1.5">{icon} {label}</span>
                                    <span className="font-body text-xs text-muted-500 leading-relaxed">{desc}</span>
                                </div>
                            ))}
                        </div>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Layout</h3>
                        <div className="flex flex-col gap-2 my-3">
                            {[
                                { icon: <LayoutList size={16} />, label: "Show AI toolbar", desc: "Toggles the skill/model toolbar that appears above the chat input." },
                                { icon: <AlignLeft size={16} />, label: "Show keyboard hints", desc: "Toggles the hint bar below the input showing Enter/Shift+Enter shortcuts." },
                            ].map(({ icon, label, desc }) => (
                                <div key={label} className="flex items-start gap-3 p-3 bg-white border-2 border-ink shadow-hard-sm"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <span className="font-body text-sm font-bold text-ink shrink-0 flex items-center gap-1.5">{icon} {label}</span>
                                    <span className="font-body text-xs text-muted-500 leading-relaxed">{desc}</span>
                                </div>
                            ))}
                        </div>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Audio</h3>
                        <div className="flex flex-col gap-2 my-3">
                            <div className="flex items-start gap-3 p-3 bg-white border-2 border-ink shadow-hard-sm"
                                style={{ borderRadius: radius.wobblySm }}>
                                <span className="font-body text-sm font-bold text-ink shrink-0 flex items-center gap-1.5"><Volume2 size={16} /> Keyboard sounds</span>
                                <span className="font-body text-xs text-muted-500 leading-relaxed">Plays a subtle retro beep sound for each keypress using the Web Audio API. Off by default.</span>
                            </div>
                        </div>
                    </section>

                    {/* ── Data ─────────────────────────────────────────────── */}
                    <section className="mt-12">
                        <SectionTitle id="data" icon={Database}>Data Management</SectionTitle>
                        <p className="font-body text-base text-muted-500 leading-relaxed max-w-[680px] mb-5">Found in Settings (⚙️) → <strong className="text-ink">Data</strong> tab. Manage your chat history and API credentials.</p>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Session Stats</h3>
                        <p className="font-body text-sm text-muted-500 leading-relaxed mb-5">See your total sessions count, total messages exchanged, and an estimated token usage across all conversations.</p>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Export &amp; Import</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
                            {[
                                { icon: <Download size={16} />, title: "Export as JSON", desc: "Downloads all sessions as a structured JSON file. Perfect for backup or migrating to another device." },
                                { icon: <Download size={16} />, title: "Export as TXT", desc: "Downloads all sessions as a human-readable plain text file. Great for sharing or archiving conversations." },
                                { icon: <Upload size={16} />, title: "Import Sessions", desc: "Import a previously exported JSON file. Sessions are merged with your existing history — no duplicates." },
                            ].map(({ icon, title, desc }) => (
                                <div key={title} className="bg-white border-2 border-ink shadow-hard-sm p-4 hover:shadow-hard hover:-translate-y-0.5 transition-all duration-100 flex flex-col gap-2"
                                    style={{ borderRadius: radius.wobblySm }}>
                                    <div className="text-ink">{icon}</div>
                                    <h3 className="font-body text-sm font-bold text-ink">{title}</h3>
                                    <p className="font-body text-xs text-muted-500 leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>

                        <h3 className="font-body text-sm font-bold text-ink uppercase tracking-widest mb-3 mt-6">Danger Zone</h3>
                        <div className="flex flex-col gap-2 my-3 border-2 border-red shadow-hard-sm p-4"
                            style={{ borderRadius: radius.wobblyMd }}>
                            <div className="bg-white border-2 border-ink p-3"
                                style={{ borderRadius: radius.wobblySm }}>
                                <p className="font-body text-sm font-bold text-ink flex items-center gap-1.5 mb-0.5"><Trash2 size={14} strokeWidth={2.5} /> Clear current chat</p>
                                <p className="font-body text-xs text-muted-500">Resets the active session back to the welcome state. Only affects the current chat.</p>
                            </div>
                            <div className="bg-white border-2 border-ink p-3"
                                style={{ borderRadius: radius.wobblySm }}>
                                <p className="font-body text-sm font-bold text-ink flex items-center gap-1.5 mb-0.5"><Trash2 size={14} strokeWidth={2.5} /> Clear all sessions</p>
                                <p className="font-body text-xs text-muted-500">Permanently deletes ALL sessions and creates a fresh one. This cannot be undone.</p>
                            </div>
                            <div className="bg-white border-2 border-ink p-3"
                                style={{ borderRadius: radius.wobblySm }}>
                                <p className="font-body text-sm font-bold text-ink flex items-center gap-1.5 mb-0.5"><Settings2 size={14} strokeWidth={2.5} /> Reset API Key</p>
                                <p className="font-body text-xs text-muted-500">Returns to the guide page so you can enter a new OpenRouter API key.</p>
                            </div>
                        </div>
                        <Screenshot
                            src={pic(900, 400, "chatforge-data")}
                            alt="Data management settings"
                            caption="Settings → Data — export, import, and danger-zone actions"
                        />
                    </section>

                    {/* ── Footer ───────────────────────────────────────────── */}
                    <footer className="border-t-2 border-dashed border-ink/30 mt-12 pt-6 pb-8 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Terminal size={16} className="text-ink" strokeWidth={2.5} />
                            <span className="font-body text-sm font-bold text-ink">ChatForge v2.0</span>
                        </div>
                        <p className="font-body text-xs text-muted-400">Made with 💚 and retro vibes · by Abderrahmane Aarab</p>
                        <button onClick={goBack} className="btn-sketch">
                            <Terminal size={14} strokeWidth={2.5} className="mr-1" />
                            Return to App
                        </button>
                    </footer>

                </div>
            </main>
        </div>
    );
}
