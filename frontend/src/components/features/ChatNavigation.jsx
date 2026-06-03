import { useState } from "react";

export function ChatNavigation({ chats }) {
  const [isHovered, setIsHovered] = useState(false);

  const items = chats.filter(c => c.type === "ch" && c.question);
  if (items.length < 3) return null;

  const scrollToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="relative w-0 shrink-0 hidden md:block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div className="absolute right-[7px] top-4 w-56 max-h-[75vh] overflow-y-auto bg-paper border border-divider rounded-lg shadow-xl p-3 z-50">
          <div className="text-[10px] font-semibold text-muted-500 uppercase tracking-wider mb-2">
            On this page
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToMessage(item.id)}
              className="w-full text-left text-xs py-1.5 px-2 rounded hover:bg-muted-100 text-muted-600 hover:text-ink transition-colors truncate border-l-2 border-transparent hover:border-ink mb-0.5"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-300 mr-2 shrink-0" />
              {item.question}
            </button>
          ))}
        </div>
      )}
      <div className="absolute right-0 top-0 bottom-0 w-[6px] cursor-pointer rounded-full hover:bg-muted-200 transition-colors" />
    </div>
  );
}
