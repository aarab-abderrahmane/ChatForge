import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Layers } from 'lucide-react';
import { radius } from '../../../../lib/design-tokens';

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

  // Keyboard navigation
  useEffect(() => {
    if (!data?.cards) return;

    const handleKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
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
    (newIdx) => {
      if (!data) return;
      setFlipped(false);
      setTimeout(() => {
        setCurrentIdx((newIdx + data.cards.length) % data.cards.length);
      }, 180);
    },
    [data]
  );

  const next = useCallback(() => goTo(currentIdx + 1), [currentIdx, goTo]);
  const prev = useCallback(() => goTo(currentIdx - 1), [currentIdx, goTo]);
  const toggleFlip = useCallback(() => setFlipped((f) => !f), []);

  // Loading state
  if (!data?.cards || data.cards.length === 0) {
    return (
      <div className="my-4 p-4 border-2 border-ink/30 bg-paper text-muted-400 wobbly-sm font-mono text-xs">
        Generating flashcards...
      </div>
    );
  }

  const card = data.cards[currentIdx];
  const total = data.cards.length;
  const progress = ((currentIdx + 1) / total) * 100;

  return (
    <div className="my-4 flex flex-col items-center gap-4 flashcard-container text-ink">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-ink" />
          <span className="text-[10px] font-mono font-bold tracking-[0.12em] uppercase text-ink">
            {data.topic}
          </span>
        </div>
        <span className="text-[10px] font-bold tracking-wider tabular-nums text-muted-400">
          {currentIdx + 1}
          <span className="opacity-40">/{total}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-[3px] bg-muted-100">
        <div
          className="h-full bg-ink"
          style={{
            width: `${progress}%`,
            transition: 'width 0.3s ease-out',
          }}
        />
      </div>

      {/* Card */}
      <div
        className="relative w-full cursor-pointer flashcard-perspective"
        style={{ height: '200px', perspective: '1000px' }}
        onClick={toggleFlip}
      >
        <div
          className="w-full h-full relative flashcard-inner"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s',
          }}
        >
          {/* Front */}
          <div
            className="flashcard-face flashcard-front absolute inset-0 flex flex-col items-center justify-center p-6 text-center border-2 border-ink bg-paper shadow-hard-sm"
            style={{
              backfaceVisibility: 'hidden',
              borderRadius: radius.wobblyMd,
            }}
          >
            <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap text-ink">
              {card.front}
            </p>
            <span className="absolute bottom-3 text-[8px] uppercase tracking-[0.15em] font-semibold text-muted-400">
              Tap to reveal
            </span>
          </div>

          {/* Back */}
          <div
            className="flashcard-face flashcard-back absolute inset-0 flex flex-col items-center justify-center p-6 text-center border-2 border-ink bg-muted-100 shadow-hard-sm"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: radius.wobblyMd,
            }}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
              {card.back}
            </p>
            <span className="absolute bottom-3 text-[8px] uppercase tracking-[0.15em] font-semibold text-muted-400">
              Tap to flip back
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="btn-sketch-icon"
          title="Previous (←)"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); toggleFlip(); }}
          className="btn-sketch-icon"
          title="Flip (Space)"
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="btn-sketch-icon"
          title="Next (→)"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5">
        {data.cards.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={`flashcard-dot transition-all duration-200 cursor-pointer border-none ${idx === currentIdx ? 'bg-ink' : 'bg-muted-200'}`}
            style={{
              width: idx === currentIdx ? '16px' : '6px',
              height: '6px',
            }}
          />
        ))}
      </div>
    </div>
  );
}
