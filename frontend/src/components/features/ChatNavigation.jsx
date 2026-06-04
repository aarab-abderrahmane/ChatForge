import { useState, useEffect, useRef } from "react";

export function ChatNavigation({ chats, scrollRef }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sliderTop, setSliderTop] = useState(0);
  const [sliderHeight, setSliderHeight] = useState(24);
  const trackRef = useRef(null);
  const dragRef = useRef({ y: 0, top: 0 });
  const ignoreClickRef = useRef(false);

  const items = chats.filter(c => c.type === "ch");
  if (items.length < 1) return null;

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;

    let rafId = null;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const trackH = trackRef.current?.clientHeight || 1;
      if (scrollHeight <= clientHeight) {
        setSliderTop(0);
        setSliderHeight(trackH);
        return;
      }
      const ratio = scrollTop / (scrollHeight - clientHeight);
      const sh = Math.max(24, (clientHeight / scrollHeight) * trackH);
      setSliderHeight(sh);
      setSliderTop(ratio * (trackH - sh));
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollRef]);

  const scrollToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTrackClick = (e) => {
    if (ignoreClickRef.current) { ignoreClickRef.current = false; return; }
    const track = trackRef.current;
    if (!track || !scrollRef.current) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const el = scrollRef.current;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { y: e.clientY, top: sliderTop };
    ignoreClickRef.current = true;
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e) => {
      const track = trackRef.current;
      if (!track || !scrollRef.current) return;
      const rect = track.getBoundingClientRect();
      const trackH = rect.height;
      const sh = sliderHeight;
      const availableH = trackH - sh;
      if (availableH <= 0) return;
      const dy = e.clientY - dragRef.current.y;
      const newTop = Math.max(0, Math.min(availableH, dragRef.current.top + dy));
      const ratio = newTop / availableH;
      scrollRef.current.scrollTop = ratio * (scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
    };

    const onUp = () => setIsDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, sliderHeight, scrollRef]);

  const getLabel = (msg) => {
    const text = msg.question || "";
    return text.replace(/^\/\/>\s*/i, "").trim().substring(0, 60) || "...";
  };

  return (
    <div
      className="relative w-0 shrink-0 hidden md:block select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { if (!isDragging) setIsHovered(false); }}
    >
      {/* ── Outline Popup ── */}
      {isHovered && (
        <div className="absolute right-[84px] top-0 w-56 max-h-[75vh] overflow-y-auto bg-paper border border-ink z-50 shadow-[2px_2px_0_0_#111111]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-divider bg-muted-100">
            <div className="w-2 h-2 bg-ink" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink">
              Chat Outline
            </span>
            <span className="font-mono text-[8px] text-muted-500 ml-auto">
              {items.length} msgs
            </span>
          </div>
          <div className="py-1">
            {items.map((msg, i) => (
              <button
                key={msg.id}
                onClick={() => scrollToMessage(msg.id)}
                className="w-full text-left group flex items-start gap-2 px-3 py-1.5 hover:bg-muted-100 transition-colors border-l-2 border-transparent hover:border-ink"
              >
                <span className="font-mono text-[9px] text-muted-400 tabular-nums mt-[2px] shrink-0 w-[18px]">
                  {i + 1}
                </span>
                <span className="font-mono text-[11px] text-muted-600 group-hover:text-ink transition-colors leading-snug line-clamp-2">
                  {getLabel(msg)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Minimap Track ── */}
      <div
        ref={trackRef}
        className="absolute right-0 top-0 bottom-0 w-[76px] cursor-pointer overflow-hidden bg-black/[0.03] border-l border-divider hover:bg-black/[0.05] transition-colors"
        onClick={handleTrackClick}
      >
        {/* Micro Preview */}
        <div className="px-2 py-3 space-y-[2px] pointer-events-none">
          {items.map((msg) => {
            const text = getLabel(msg);
            return (
              <div key={msg.id} className="flex items-center h-[5px] gap-[2px]">
                <div className={`w-[2px] h-full shrink-0 ${msg.answer ? "bg-red/20" : "bg-ink/20"}`} />
                <span className="text-[2.5px] leading-[2.5px] text-ink/15 font-mono truncate whitespace-nowrap">
                  {text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Viewport Slider */}
        <div
          className={`absolute left-0 right-0 bg-white/15 border-l-2 border-ink cursor-grab
            ${isDragging ? "bg-white/25 cursor-grabbing" : "hover:bg-white/[0.08]"}
            transition-colors`}
          style={{ top: sliderTop, height: sliderHeight }}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-0 border-t border-b border-ink/5 mx-[2px]" />
        </div>
      </div>
    </div>
  );
}
