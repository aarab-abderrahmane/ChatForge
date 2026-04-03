import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RotateCcw, Layers } from 'lucide-react';

function safeParseJSON(code) {
  if (!code) return null;
  try {
    const match = code.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : code);
  } catch {
    return null;
  }
}

export function FlashcardBlock({ code }) {
  const data = useMemo(() => safeParseJSON(code), [code]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState(0); // -1 = left, 1 = right

  // ── Keyboard navigation ──
  useEffect(() => {
    if (!data?.cards) return;

    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentIdx]);

  const goTo = useCallback(
    (newIdx, dir) => {
      if (!data) return;
      setFlipped(false);
      setDirection(dir);
      setTimeout(() => {
        setCurrentIdx((newIdx + data.cards.length) % data.cards.length);
      }, 180);
    },
    [data]
  );

  const next = useCallback(() => goTo(currentIdx + 1, 1), [currentIdx, goTo]);
  const prev = useCallback(() => goTo(currentIdx - 1, -1), [currentIdx, goTo]);
  const toggleFlip = useCallback(() => setFlipped((f) => !f), []);

  // ── Loading state ──
  if (!data?.cards || data.cards.length === 0) {
    return (
      <div
        className="my-4 p-4 rounded-xl border text-xs font-mono"
        style={{
          borderColor: 'rgba(0, 245, 255, 0.2)',
          background: 'rgba(0, 245, 255, 0.04)',
          color: 'rgba(0, 245, 255, 0.6)',
        }}
      >
        Generating flashcards...
      </div>
    );
  }

  const card = data.cards[currentIdx];
  const total = data.cards.length;
  const progress = ((currentIdx + 1) / total) * 100;

  const variants = {
    enter: (dir) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
      rotateY: flipped ? 180 : 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      rotateY: flipped ? 180 : 0,
    },
    exit: (dir) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
      rotateY: flipped ? 180 : 0,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-4 flex flex-col items-center gap-4 flashcard-container"
    >
      {/* ── Header ── */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: 'var(--neon-cyan)' }} />
          <span
            className="text-[10px] font-bold tracking-[0.12em] uppercase"
            style={{ color: 'var(--neon-cyan)' }}
          >
            {data.topic}
          </span>
        </div>
        <span
          className="text-[10px] font-bold tracking-wider tabular-nums"
          style={{ color: 'rgba(255, 255, 255, 0.35)' }}
        >
          {currentIdx + 1}
          <span className="opacity-40">/{total}</span>
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div className="w-full h-[2px] rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--neon-cyan)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* ── Card ── */}
      <div
        className="relative w-full cursor-pointer flashcard-perspective"
        style={{ height: '200px', perspective: '1000px' }}
        onClick={toggleFlip}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIdx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
              rotateY: { duration: 0.5, type: 'spring', stiffness: 260, damping: 20 },
            }}
            className="w-full h-full relative flashcard-inner"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* ── Front ── */}
            <div
              className="flashcard-face flashcard-front absolute inset-0 flex flex-col items-center justify-center p-6 text-center rounded-xl"
              style={{
                backfaceVisibility: 'hidden',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 245, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(0, 245, 255, 0.05)',
              }}
            >
              <p
                className="text-sm font-bold leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--neon-cyan)' }}
              >
                {card.front}
              </p>
              <span className="absolute bottom-3 text-[8px] uppercase tracking-[0.15em] font-semibold" style={{ color: 'rgba(255,255,255,0.15)' }}>
                Tap to reveal
              </span>
            </div>

            {/* ── Back ── */}
            <div
              className="flashcard-face flashcard-back absolute inset-0 flex flex-col items-center justify-center p-6 text-center rounded-xl"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'rgba(57, 255, 20, 0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(57, 255, 20, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(57, 255, 20, 0.05)',
              }}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--neon-green)' }}
              >
                {card.back}
              </p>
              <span className="absolute bottom-3 text-[8px] uppercase tracking-[0.15em] font-semibold" style={{ color: 'rgba(255,255,255,0.15)' }}>
                Tap to flip back
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="flashcard-nav-btn p-2.5 rounded-full border transition-all duration-200 cursor-pointer"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            color: 'rgba(200, 255, 192, 0.5)',
          }}
          title="Previous (←)"
        >
          <ChevronLeft size={16} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); toggleFlip(); }}
          className="flashcard-flip-btn p-2.5 rounded-full border transition-all duration-200 cursor-pointer"
          style={{
            borderColor: 'rgba(0, 245, 255, 0.2)',
            background: 'rgba(0, 245, 255, 0.05)',
            color: 'var(--neon-cyan)',
          }}
          title="Flip (Space)"
        >
          <RotateCcw size={16} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="flashcard-nav-btn p-2.5 rounded-full border transition-all duration-200 cursor-pointer"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            color: 'rgba(200, 255, 192, 0.5)',
          }}
          title="Next (→)"
        >
          <ChevronRight size={16} />
        </motion.button>
      </div>

      {/* ── Dot indicators ── */}
      <div className="flex items-center gap-1.5">
        {data.cards.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx, idx > currentIdx ? 1 : -1)}
            className="flashcard-dot rounded-full transition-all duration-200 cursor-pointer border-none"
            style={{
              width: idx === currentIdx ? '16px' : '6px',
              height: '6px',
              background: idx === currentIdx ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.12)',
              borderRadius: '99px',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
