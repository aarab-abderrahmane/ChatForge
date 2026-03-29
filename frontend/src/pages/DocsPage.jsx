import { useState, useEffect, useRef, useContext } from "react";
import { motion } from "motion/react";
import { chatsContext } from "../context/chatsContext";
import "./DocsPage.css";
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
    Smile,
    Sparkles,
    Gauge,
    ChevronRight,
    ExternalLink,
    BookOpen,
    Command,
} from "lucide-react";


// ── Picsum placeholder helper ─────────────────────────────────
const pic = (w, h, seed) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

// ── Data mirrors from chatsContext ────────────────────────────
const SKILLS = [
    { id: "general", name: "General", icon: "🤖", description: "Balanced for general tasks and conversation." },
    { id: "code", name: "Code Master", icon: "💻", description: "Expert in 50+ languages and debugging." },
    { id: "creative", name: "Creative", icon: "✍️", description: "Unleash imagination and storytelling." },
    { id: "security", name: "Cyber Security", icon: "🛡️", description: "Specialized in security and audit tasks." },
    { id: "translator", name: "Translator", icon: "🌍", description: "Expert multilingual translator for any language." },
    { id: "summarizer", name: "Summarizer", icon: "📋", description: "Condenses content into clear bullet-point summaries." },
];

const MODELS = [
    { icon: "🦙", name: "Llama 3.3 70B", provider: "Meta", description: "Powerful open-source reasoning model. Primary recommendation." },
    { icon: "🌪️", name: "Mistral Small", provider: "Mistral", description: "Fast and efficient European model. Great for general tasks." },
    { icon: "🏛️", name: "Hermes 3 405B", provider: "Nous", description: "Massive 405B model. Best for complex reasoning." },
    { icon: "🦙", name: "Llama 3.1 405B", provider: "Meta", description: "Meta's largest open model. Excellent for hard problems." },
    { icon: "⚡", name: "Step 3.5 Flash", provider: "StepFun", description: "Ultra-fast Chinese model. Great for quick responses." },
    { icon: "🔱", name: "Trinity Large", provider: "Arcee", description: "Arcee's large preview model. Diverse capabilities." },
    { icon: "🐇", name: "Llama 3.2 3B", provider: "Meta", description: "Tiny but fast. Best for simple, quick queries." },
];

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
        <div id={id} className="docs-section-title">
            <Icon size={18} style={{ color: "var(--neon-green)" }} />
            <h2>{children}</h2>
        </div>
    );
}

function Badge({ children, color = "green" }) {
    const colors = {
        green: { bg: "rgba(57,255,20,0.1)", border: "rgba(57,255,20,0.3)", text: "#39ff14" },
        cyan: { bg: "rgba(0,245,255,0.1)", border: "rgba(0,245,255,0.3)", text: "#00f5ff" },
        pink: { bg: "rgba(255,45,120,0.1)", border: "rgba(255,45,120,0.3)", text: "#ff2d78" },
    };
    const c = colors[color] || colors.green;
    return (
        <span className="docs-badge" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
            {children}
        </span>
    );
}

function Card({ children, glow = false }) {
    return (
        <div className="docs-card" style={{ boxShadow: glow ? "0 0 20px rgba(57,255,20,0.07)" : "none" }}>
            {children}
        </div>
    );
}

function Screenshot({ src, alt, caption }) {
    return (
        <div className="docs-screenshot">
            <img src={src} alt={alt} loading="lazy" />
            {caption && <p className="docs-screenshot-caption">{caption}</p>}
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
            currentPage: prev.currentPage === "docs" ? (prev._prevPage || "guide") : prev._prevPage || "guide",
        }));
    };

    return (
        <div className="docs-root">
            {/* ── Left Nav ─────────────────────────────────────────── */}
            <aside className="docs-nav">
                {/* Header */}
                <div className="docs-nav-header">
                    <button onClick={goBack} className="docs-back-btn">
                        <ArrowLeft size={13} />
                        Back to App
                    </button>
                    <div className="docs-nav-logo">
                        <Terminal size={14} style={{ color: "var(--neon-green)" }} />
                        <span>ChatForge</span>
                        <Badge color="cyan">v2.0</Badge>
                    </div>
                    <p className="docs-nav-subtitle">Documentation</p>
                </div>

                {/* Nav links */}
                <nav className="docs-nav-links">
                    {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => scrollTo(id)}
                            className={`docs-nav-link ${activeSection === id ? "active" : ""}`}
                        >
                            <Icon size={12} />
                            {label}
                            {activeSection === id && <ChevronRight size={10} className="docs-nav-arrow" />}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="docs-nav-footer">
                    <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="docs-footer-link">
                        OpenRouter API <ExternalLink size={10} />
                    </a>
                    <a href="https://github.com" target="_blank" rel="noreferrer" className="docs-footer-link">
                        GitHub <ExternalLink size={10} />
                    </a>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────── */}
            <main className="docs-content" ref={contentRef}>

                {/* ── Hero ─────────────────────────────────────────────── */}
                <div className="docs-hero">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <div className="docs-hero-badges">
                            <Badge color="green">v2.0</Badge>
                            <Badge color="cyan">React 19</Badge>
                            <Badge color="pink">Free AI Models</Badge>
                        </div>
                        <h1 className="docs-hero-title">
                            <span className="docs-hero-forge">Chat</span>
                            <span className="docs-hero-forge-accent">Forge</span>
                            <span className="docs-hero-subtitle"> Documentation</span>
                        </h1>
                        <p className="docs-hero-desc">
                            A retro-inspired AI terminal interface. Everything you need to master ChatForge —
                            from keyboard shortcuts to custom AI skills and model selection.
                        </p>
                        <div className="docs-hero-actions">
                            <button onClick={goBack} className="docs-cta-primary">
                                <Terminal size={14} />
                                Launch App
                            </button>
                            <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="docs-cta-secondary">
                                Get API Key <ExternalLink size={12} />
                            </a>
                        </div>
                    </motion.div>
                    <Screenshot
                        src={pic(900, 480, "chatforge-hero")}
                        alt="ChatForge terminal interface"
                        caption="ChatForge — retro terminal AI interface"
                    />
                </div>

                <div className="docs-sections">

                    {/* ── Getting Started ──────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="getting-started" icon={BookOpen}>Getting Started</SectionTitle>
                        <p className="docs-prose">
                            ChatForge connects to <strong>OpenRouter</strong> — a free gateway to dozens of powerful AI models.
                            You'll need a free API key to begin.
                        </p>
                        <div className="docs-steps">
                            {[
                                { n: "01", title: "Get your API key", desc: <>Visit <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="docs-link">openrouter.ai</a> and create a free account. Copy your API key from the dashboard.</> },
                                { n: "02", title: "Paste & authenticate", desc: "On the ChatForge guide page, paste your key in the terminal input and press Enter. Your key is encrypted and stored securely in MongoDB — it never appears in the browser." },
                                { n: "03", title: "Start chatting", desc: "Once authenticated, the full terminal interface loads. Type any question and press Enter to send. Use //> commands for advanced interactions." },
                            ].map(({ n, title, desc }) => (
                                <div key={n} className="docs-step">
                                    <div className="docs-step-num">{n}</div>
                                    <div>
                                        <h3 className="docs-step-title">{title}</h3>
                                        <p className="docs-step-desc">{desc}</p>
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
                    <section className="docs-section">
                        <SectionTitle id="commands" icon={Command}>Terminal Commands</SectionTitle>
                        <p className="docs-prose">
                            Type <code className="docs-code">{"//> "}</code> in the input to see a live command menu. Commands are processed instantly — some trigger AI responses, others perform local actions.
                        </p>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Command</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMMANDS.map(({ cmd, desc }) => (
                                        <tr key={cmd}>
                                            <td><code className="docs-code">{cmd}</code></td>
                                            <td>{desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* ── Shortcuts ────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="shortcuts" icon={Keyboard}>Keyboard Shortcuts</SectionTitle>
                        <p className="docs-prose">ChatForge is built for speed. Learn these shortcuts to work without leaving the keyboard.</p>
                        <div className="docs-shortcuts-grid">
                            {SHORTCUTS.map(({ key, desc }) => (
                                <Card key={key}>
                                    <kbd className="docs-kbd">{key}</kbd>
                                    <p className="docs-shortcut-desc">{desc}</p>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* ── Sidebar ──────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="sidebar" icon={LayoutList}>Sidebar & Sessions</SectionTitle>
                        <p className="docs-prose">
                            The left sidebar is your chat history catalog. Each conversation is saved as an independent session with its own context.
                        </p>
                        <div className="docs-feature-grid">
                            {[
                                { icon: <Search size={16} />, title: "Search Sessions", desc: "Use the persistent search bar at the top of the sidebar to instantly filter past sessions by title." },
                                { icon: <Pin size={16} />, title: "Pin Sessions", desc: "Hover a session and click the 📌 pin icon to stick it to the very top of the list. Pinned sessions survive re-ordering." },
                                { icon: <Edit3 size={16} />, title: "Rename Sessions", desc: "Click the pencil icon on hover to open an inline editor. Rename any session with a double-click on its title." },
                                { icon: <Plus size={16} />, title: "New Session", desc: "Click the + button at the top of the sidebar to create a fresh session with a clean slate." },
                                { icon: <Trash2 size={16} />, title: "Delete Session", desc: "Hover a session and click the trash icon to permanently delete it. This cannot be undone." },
                                { icon: <Star size={16} />, title: "Auto-title", desc: "Sessions are automatically titled using the first message you send. You can rename them at any time." },
                            ].map(({ icon, title, desc }) => (
                                <Card key={title} glow>
                                    <div className="docs-feature-icon">{icon}</div>
                                    <h3 className="docs-feature-title">{title}</h3>
                                    <p className="docs-feature-desc">{desc}</p>
                                </Card>
                            ))}
                        </div>
                        <Screenshot
                            src={pic(380, 520, "chatforge-sidebar")}
                            alt="Sidebar with pinned sessions"
                            caption="Sidebar — search, pin, rename and manage sessions"
                        />
                    </section>

                    {/* ── Messages ─────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="messages" icon={Copy}>Message Interactions</SectionTitle>
                        <p className="docs-prose">
                            Every message block has a rich set of actions available on hover. These let you refine, save, and manage responses without leaving the flow.
                        </p>
                        <Screenshot
                            src={pic(900, 420, "chatforge-messages")}
                            alt="Message block with action buttons"
                            caption="Hover a message to reveal all available actions"
                        />
                        <div className="docs-feature-grid">
                            {[
                                { icon: <Edit3 size={16} />, title: "Edit Prompt", color: "cyan", desc: "Opens a large inline textarea. Fix your prompt and click 'Save & Re-send' to regenerate the AI response from that point." },
                                { icon: <RotateCcw size={16} />, title: "Retry", color: "green", desc: "Wipes the current AI response and re-sends the exact same prompt to get a fresh answer." },
                                { icon: <Star size={16} />, title: "Star Message", color: "pink", desc: "Adds a glowing neon border to the message, making it easy to spot when scrolling through long conversations." },
                                { icon: <Eye size={16} />, title: "Raw Markdown", color: "cyan", desc: "Toggle between rendered Markdown and the raw source text. Useful when the renderer mangles tables or code." },
                                { icon: <Copy size={16} />, title: "Copy Response", color: "green", desc: "Instantly copies the full AI response text to your clipboard. A ✓ flash confirms the copy." },
                                { icon: <Layers size={16} />, title: "Multi-Drafts", color: "cyan", desc: "Toggle multiple drafts above the input to generate 3 AI responses simultaneously. Choose the best, or use AI to merge and summarize them." },
                                { icon: <Terminal size={16} />, title: "Avatars", color: "pink", desc: "Enable 'Message avatars' in Settings → Interface to show user and AI avatar icons on every message block." },
                            ].map(({ icon, title, color, desc }) => (
                                <Card key={title} glow>
                                    <div className="docs-feature-icon" style={{ color: color === "cyan" ? "var(--neon-cyan)" : color === "pink" ? "#ff2d78" : "var(--neon-green)" }}>
                                        {icon}
                                    </div>
                                    <h3 className="docs-feature-title">{title}</h3>
                                    <p className="docs-feature-desc">{desc}</p>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* ── AI Skills ────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="skills" icon={Bot}>AI Skills &amp; Personas</SectionTitle>
                        <p className="docs-prose">
                            Skills are predefined AI personas with specialized system prompts. Switch between them in Settings → AI, or activate one on-the-fly with <code className="docs-code">{"//>skill"}</code>.
                        </p>
                        <div className="docs-skills-grid">
                            {SKILLS.map((s) => (
                                <div key={s.id} className="docs-skill-card">
                                    <span className="docs-skill-icon">{s.icon}</span>
                                    <h3 className="docs-skill-name">{s.name}</h3>
                                    <p className="docs-skill-desc">{s.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="docs-callout">
                            <div className="docs-callout-title">
                                <Plus size={14} style={{ color: "var(--neon-cyan)" }} />
                                Creating Custom Skills
                            </div>
                            <ol className="docs-callout-list">
                                <li>Open Settings (⚙️) → <strong>AI</strong> tab</li>
                                <li>Click <strong>"New Skill"</strong> in the AI Personality section</li>
                                <li>Choose an emoji icon and give your skill a name</li>
                                <li>Write a deep system prompt that defines the AI's behavior</li>
                                <li>Click <strong>"✓ Save Skill"</strong> — it's instantly available in the skill grid</li>
                            </ol>
                            <p className="docs-callout-note">Custom skills are stored in localStorage and survive page refreshes. Activate them via Settings or with <code className="docs-code">{"//>skill"}</code>.</p>
                        </div>
                        <Screenshot
                            src={pic(900, 380, "chatforge-skills")}
                            alt="AI Skills panel in settings"
                            caption="Settings → AI — select built-in skills or create your own custom personas"
                        />
                    </section>

                    {/* ── AI Models ────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="models" icon={Zap}>AI Models</SectionTitle>
                        <p className="docs-prose">
                            ChatForge connects to OpenRouter's free model tier. If a model is at capacity, ChatForge automatically falls back to an available one — you always get an answer.
                        </p>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Model</th>
                                        <th>Provider</th>
                                        <th>Best For</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MODELS.map((m) => (
                                        <tr key={m.name}>
                                            <td style={{ fontSize: 18 }}>{m.icon}</td>
                                            <td><strong>{m.name}</strong></td>
                                            <td><Badge color="cyan">{m.provider}</Badge></td>
                                            <td>{m.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="docs-prose" style={{ marginTop: 16 }}>
                            Switch models in <strong>Settings → AI → AI Intelligence / Model</strong>. The active model is shown in the toolbar. Use <code className="docs-code">{"//>model"}</code> to get a model self-introduction.
                        </p>
                    </section>

                    {/* ── Appearance ───────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="appearance" icon={Palette}>Appearance Settings</SectionTitle>
                        <p className="docs-prose">Open Settings (⚙️) → <strong>Appearance</strong> tab. All changes apply instantly and save to localStorage.</p>

                        <h3 className="docs-sub-heading">Color Themes</h3>
                        <div className="docs-themes-grid">
                            {THEMES.map((t) => (
                                <div key={t.name} className="docs-theme-card">
                                    <div className="docs-theme-swatches">
                                        <div className="docs-theme-swatch" style={{ background: t.primary }} />
                                        <div className="docs-theme-swatch" style={{ background: t.secondary }} />
                                        <div className="docs-theme-swatch" style={{ background: t.accent }} />
                                    </div>
                                    <span className="docs-theme-icon">{t.icon}</span>
                                    <span className="docs-theme-name">{t.name}</span>
                                </div>
                            ))}
                        </div>
                        <p className="docs-prose">
                            The <strong>Custom</strong> theme reveals three color pickers: <em>Primary</em> (UI elements), <em>Secondary</em> (borders), and <em>Accent</em> (actions/errors). Enter any hex value or use the color picker swatch.
                        </p>

                        <h3 className="docs-sub-heading">Typography</h3>
                        <div className="docs-font-grid">
                            {["Fira Code", "JetBrains Mono", "Cascadia Code"].map((f) => (
                                <div key={f} className="docs-font-card">
                                    <span className="docs-font-preview" style={{ fontFamily: f }}>AaBbCc 0Oo</span>
                                    <span className="docs-font-name">{f}</span>
                                </div>
                            ))}
                        </div>
                        <p className="docs-prose">Use the <strong>Font Size</strong> slider (12–18px) to fine-tune readability.</p>

                        <h3 className="docs-sub-heading">Visual Effects</h3>
                        <div className="docs-toggles-list">
                            <div className="docs-toggle-row">
                                <span className="docs-toggle-label">✦ Scanlines effect</span>
                                <span className="docs-toggle-desc">Overlays retro CRT scan lines on the entire UI for that classic terminal feel.</span>
                            </div>
                            <div className="docs-toggle-row">
                                <span className="docs-toggle-label">≡ Compact mode</span>
                                <span className="docs-toggle-desc">Reduces padding and spacing in message blocks for a denser view.</span>
                            </div>
                        </div>
                        <Screenshot
                            src={pic(900, 460, "chatforge-appearance")}
                            alt="Appearance settings panel"
                            caption="Settings → Appearance — themes, fonts, and visual effects"
                        />
                    </section>

                    {/* ── AI Settings ──────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="ai-settings" icon={Gauge}>AI Settings</SectionTitle>
                        <p className="docs-prose">Fine-tune how the AI behaves and responds. Found in Settings (⚙️) → <strong>AI</strong> tab.</p>

                        <div className="docs-feature-grid">
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
                                <Card key={title} glow>
                                    <div className="docs-feature-icon">{icon}</div>
                                    <h3 className="docs-feature-title">{title}</h3>
                                    <p className="docs-feature-desc">{desc}</p>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* ── Interface ────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="interface" icon={Settings2}>Interface Settings</SectionTitle>
                        <p className="docs-prose">Found in Settings (⚙️) → <strong>Interface</strong> tab. Toggle UI behaviors to match your workflow.</p>

                        <h3 className="docs-sub-heading">Behavior</h3>
                        <div className="docs-toggles-list">
                            {[
                                { icon: <MousePointerClick size={14} />, label: "Auto-scroll to bottom", desc: "Automatically scrolls the chat view down when new messages arrive." },
                                { icon: <Zap size={14} />, label: "Streaming indicator", desc: "Shows a pulsing cursor animation while the AI is generating its response." },
                                { icon: <Clock size={14} />, label: "Show timestamps", desc: "Displays the time each message was sent below every message block." },
                                { icon: <Sparkles size={14} />, label: "Animations", desc: "Enables/disables all Motion-powered enter/exit animations throughout the UI." },
                            ].map(({ icon, label, desc }) => (
                                <div key={label} className="docs-toggle-row">
                                    <span className="docs-toggle-label">{icon} {label}</span>
                                    <span className="docs-toggle-desc">{desc}</span>
                                </div>
                            ))}
                        </div>

                        <h3 className="docs-sub-heading">Layout</h3>
                        <div className="docs-toggles-list">
                            {[
                                { icon: <LayoutList size={14} />, label: "Show AI toolbar", desc: "Toggles the skill/model toolbar that appears above the chat input." },
                                { icon: <AlignLeft size={14} />, label: "Show keyboard hints", desc: "Toggles the hint bar below the input showing Enter/Shift+Enter shortcuts." },
                                { icon: <Smile size={14} />, label: "Message avatars", desc: "Shows circular avatar icons next to each message for visual distinction." },
                            ].map(({ icon, label, desc }) => (
                                <div key={label} className="docs-toggle-row">
                                    <span className="docs-toggle-label">{icon} {label}</span>
                                    <span className="docs-toggle-desc">{desc}</span>
                                </div>
                            ))}
                        </div>

                        <h3 className="docs-sub-heading">Audio</h3>
                        <div className="docs-toggles-list">
                            <div className="docs-toggle-row">
                                <span className="docs-toggle-label"><Volume2 size={14} /> Keyboard sounds</span>
                                <span className="docs-toggle-desc">Plays a subtle retro beep sound for each keypress using the Web Audio API. Off by default.</span>
                            </div>
                        </div>
                    </section>

                    {/* ── Data ─────────────────────────────────────────────── */}
                    <section className="docs-section">
                        <SectionTitle id="data" icon={Database}>Data Management</SectionTitle>
                        <p className="docs-prose">Found in Settings (⚙️) → <strong>Data</strong> tab. Manage your chat history and API credentials.</p>

                        <h3 className="docs-sub-heading">Session Stats</h3>
                        <p className="docs-prose">See your total sessions count, total messages exchanged, and an estimated token usage across all conversations.</p>

                        <h3 className="docs-sub-heading">Export &amp; Import</h3>
                        <div className="docs-feature-grid">
                            {[
                                { icon: <Download size={16} />, title: "Export as JSON", desc: "Downloads all sessions as a structured JSON file. Perfect for backup or migrating to another device." },
                                { icon: <Download size={16} />, title: "Export as TXT", desc: "Downloads all sessions as a human-readable plain text file. Great for sharing or archiving conversations." },
                                { icon: <Upload size={16} />, title: "Import Sessions", desc: "Import a previously exported JSON file. Sessions are merged with your existing history — no duplicates." },
                            ].map(({ icon, title, desc }) => (
                                <Card key={title} glow>
                                    <div className="docs-feature-icon">{icon}</div>
                                    <h3 className="docs-feature-title">{title}</h3>
                                    <p className="docs-feature-desc">{desc}</p>
                                </Card>
                            ))}
                        </div>

                        <h3 className="docs-sub-heading">Danger Zone</h3>
                        <div className="docs-danger-zone">
                            <div className="docs-danger-item">
                                <div>
                                    <p className="docs-danger-title"><Trash2 size={13} /> Clear current chat</p>
                                    <p className="docs-danger-desc">Resets the active session back to the welcome state. Only affects the current chat.</p>
                                </div>
                            </div>
                            <div className="docs-danger-item">
                                <div>
                                    <p className="docs-danger-title"><Trash2 size={13} /> Clear all sessions</p>
                                    <p className="docs-danger-desc">Permanently deletes ALL sessions and creates a fresh one. This cannot be undone.</p>
                                </div>
                            </div>
                            <div className="docs-danger-item">
                                <div>
                                    <p className="docs-danger-title"><Settings2 size={13} /> Reset API Key</p>
                                    <p className="docs-danger-desc">Returns to the guide page so you can enter a new OpenRouter API key.</p>
                                </div>
                            </div>
                        </div>
                        <Screenshot
                            src={pic(900, 400, "chatforge-data")}
                            alt="Data management settings"
                            caption="Settings → Data — export, import, and danger-zone actions"
                        />
                    </section>

                    {/* ── Footer ───────────────────────────────────────────── */}
                    <footer className="docs-footer">
                        <div className="docs-footer-inner">
                            <div className="docs-footer-logo">
                                <Terminal size={16} style={{ color: "var(--neon-green)" }} />
                                <span>ChatForge v2.0</span>
                            </div>
                            <p className="docs-footer-text">Made with 💚 and retro vibes · by Abderrahmane Aarab</p>
                            <button onClick={goBack} className="docs-cta-primary" style={{ marginTop: 12 }}>
                                <Terminal size={13} />
                                Return to App
                            </button>
                        </div>
                    </footer>

                </div>
            </main>
        </div>
    );
}
