import { useContext } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Monitor,
  Volume2,
  VolumeX,
  Key,
  Download,
  Trash2,
  Type,
} from "lucide-react";
import { chatsContext } from "../../context/chatsContext";

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

export function SettingsPanel({ onClose }) {
  const { settings, setSettings, setPreferences, sessions, clearCurrentChat } =
    useContext(chatsContext);

  const toggle = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

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

  return (
    <AnimatePresence>
      <motion.div
        className="settings-panel"
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border-green)" }}
        >
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--neon-cyan)" }}
          >
            ⚙ Settings
          </span>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={13} />
          </button>
        </div>

        {/* Section: Display */}
        <div
          className="px-4 py-2 text-[9px] tracking-widest uppercase"
          style={{ color: "rgba(200,255,192,0.3)" }}
        >
          Display
        </div>

        <div className="settings-toggle" onClick={() => toggle("scanlines")}>
          <Monitor size={14} style={{ color: "var(--neon-green)" }} />
          <span
            className="flex-1 text-xs"
            style={{ color: "rgba(200,255,192,0.8)" }}
          >
            Scanlines effect
          </span>
          <Toggle value={settings.scanlines} onToggle={() => toggle("scanlines")} />
        </div>

        <div
          className="settings-toggle"
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              font: prev.font === "fira" ? "jetbrains" : "fira",
            }))
          }
        >
          <Type size={14} style={{ color: "var(--neon-green)" }} />
          <span
            className="flex-1 text-xs"
            style={{ color: "rgba(200,255,192,0.8)" }}
          >
            Font:{" "}
            <span style={{ color: "var(--neon-cyan)" }}>
              {settings.font === "fira" ? "Fira Code" : "JetBrains Mono"}
            </span>
          </span>
          <div
            className="text-[9px] px-2 py-0.5 rounded border"
            style={{
              color: "var(--neon-cyan)",
              borderColor: "var(--neon-cyan-dim)",
            }}
          >
            swap
          </div>
        </div>

        {/* Section: Audio */}
        <div
          className="px-4 py-2 text-[9px] tracking-widest uppercase border-t"
          style={{
            color: "rgba(200,255,192,0.3)",
            borderColor: "rgba(255,255,255,0.04)",
          }}
        >
          Audio
        </div>

        <div className="settings-toggle" onClick={() => toggle("sounds")}>
          {settings.sounds ? (
            <Volume2 size={14} style={{ color: "var(--neon-green)" }} />
          ) : (
            <VolumeX size={14} style={{ color: "rgba(200,255,192,0.3)" }} />
          )}
          <span
            className="flex-1 text-xs"
            style={{ color: "rgba(200,255,192,0.8)" }}
          >
            Keyboard sounds
          </span>
          <Toggle value={settings.sounds} onToggle={() => toggle("sounds")} />
        </div>

        {/* Section: Data */}
        <div
          className="px-4 py-2 text-[9px] tracking-widest uppercase border-t"
          style={{
            color: "rgba(200,255,192,0.3)",
            borderColor: "rgba(255,255,255,0.04)",
          }}
        >
          Data
        </div>

        <div className="settings-toggle" onClick={exportChats}>
          <Download size={14} style={{ color: "var(--neon-green)" }} />
          <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
            Export chats (.json)
          </span>
        </div>

        <div className="settings-toggle" onClick={exportTxt}>
          <Download size={14} style={{ color: "var(--neon-green)" }} />
          <span className="flex-1 text-xs" style={{ color: "rgba(200,255,192,0.8)" }}>
            Export chats (.txt)
          </span>
        </div>

        {/* Danger zone */}
        <div
          className="px-4 py-2 text-[9px] tracking-widest uppercase border-t"
          style={{
            color: "rgba(255,45,120,0.4)",
            borderColor: "rgba(255,255,255,0.04)",
          }}
        >
          Danger Zone
        </div>

        <div className="settings-toggle" onClick={clearCurrentChat}>
          <Trash2 size={14} style={{ color: "var(--neon-magenta)" }} />
          <span className="flex-1 text-xs" style={{ color: "rgba(255,45,120,0.7)" }}>
            Clear current chat
          </span>
        </div>

        <div
          className="settings-toggle border-b-0"
          style={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
          onClick={resetAPIKey}
        >
          <Key size={14} style={{ color: "var(--neon-magenta)" }} />
          <span className="flex-1 text-xs" style={{ color: "rgba(255,45,120,0.7)" }}>
            Reset API key
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
