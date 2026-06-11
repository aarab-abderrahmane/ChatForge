import { useState, useEffect, useRef } from "react";
import { radius, shadows } from "../../lib/design-tokens";

export function ChatNavigation({ chats, scrollRef }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sliderTop, setSliderTop] = useState(0);
  const [sliderHeight, setSliderHeight] = useState(24);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [messageTops, setMessageTops] = useState([]);
  const [popupHovered, setPopupHovered] = useState(false);
  const trackRef = useRef(null);
  const dragRef = useRef({ y: 0, top: 0 });
  const ignoreClickRef = useRef(false);

  const items = chats.filter(c => c.type === "ch");

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

  useEffect(() => {
    if (!items.length || !scrollRef?.current) return;
    const container = scrollRef.current;
    const tops = items.map((msg) => {
      const el = document.getElementById(`msg-${msg.id}`);
      if (!el) return 0;
      const offset = el.offsetTop;
      const total = container.scrollHeight;
      return total > 0 ? offset / total : 0;
    });
    setMessageTops(tops);
  }, [chats, scrollRef]);

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

  if (items.length < 1) return null;

  const showPopup = isHovered || hoveredIndex !== null || popupHovered;

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

  const getLabel = (msg) => {
    const text = msg.question || "";
    return text.replace(/^\/\/>\s*/i, "").trim().substring(0, 60) || "...";
  };

  return (
    <div
      className="relative w-0 shrink-0 hidden md:block select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDragging) {
          setIsHovered(false);
          setHoveredIndex(null);
        }
      }}
    >
      {/* ── Outline Popup ── */}
      <div
        className={`absolute right-[82px] top-0 w-56 max-h-[75vh] overflow-y-auto bg-paper border-2 border-ink z-50 shadow-hard-sm transition-all duration-200 ease-in-out ${
          showPopup ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-2 pointer-events-none"
        }`}
        style={{ borderRadius: radius.wobblyMd }}
        onMouseEnter={() => setPopupHovered(true)}
        onMouseLeave={() => setPopupHovered(false)}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-dashed border-ink/30 bg-muted-100">
          <div className="w-2 h-2 bg-ink -rotate-3" />
          <span className="font-body text-[10px] font-bold uppercase tracking-widest text-ink">
            Chat Outline
          </span>
          <span className="font-body text-[9px] text-muted-500 ml-auto">
            {items.length} msgs
          </span>
        </div>
        <div className="py-1">
          {items.map((msg, i) => (
            <button
              key={msg.id}
              onClick={() => scrollToMessage(msg.id)}
              onMouseEnter={() => setHoveredIndex(i)}
              className={`w-full text-left group flex items-start gap-2 px-3 py-1.5 transition-all duration-100 border-l-[3px] ${
                hoveredIndex === i
                  ? "bg-yellow/30 border-ink text-ink"
                  : "border-transparent hover:bg-muted-100 hover:border-ink/50 text-muted-600"
              }`}
            >
              <span className="font-body text-[9px] text-muted-400 tabular-nums mt-[2px] shrink-0 w-[18px]">
                {i + 1}
              </span>
              <span className="font-body text-sm group-hover:text-ink transition-colors leading-snug line-clamp-2">
                {getLabel(msg)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Minimap Track ── */}
      <div
        ref={trackRef}
        className="absolute right-0 top-0 bottom-0 w-[76px] cursor-pointer overflow-hidden bg-paper border-l-2 border-dashed border-ink/20 hover:bg-muted-100/50 transition-colors"
        onClick={handleTrackClick}
      >
        {/* Micro-lines Indicators */}
        <div className="absolute inset-0 pointer-events-none">
          {items.map((msg, i) => {
            const top = messageTops[i];
            if (top === undefined) return null;
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={msg.id}
                className="absolute left-[6px] w-[5px] h-[2px] rounded-full pointer-events-auto cursor-pointer"
                style={{ top: `calc(${top * 100}% + 1px)` }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={`w-full h-full transition-all duration-150 ${
                    isHovered
                      ? "bg-ink/45 scale-x-150 origin-left"
                      : "bg-ink/12"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Viewport Slider */}
        <div
          className={`absolute left-0 right-0 bg-muted-200/30 border-l-[3px] border-ink cursor-grab
            ${isDragging ? "bg-muted-200/50 cursor-grabbing" : "hover:bg-muted-200/40"}
            transition-colors`}
          style={{ top: sliderTop, height: sliderHeight }}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-0 border-t border-b border-ink/10 mx-[2px]" />
        </div>
      </div>
    </div>
  );
}
