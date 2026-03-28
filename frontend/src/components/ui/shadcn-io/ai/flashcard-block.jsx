import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

export function FlashcardBlock({ code }) {
    const data = useMemo(() => {
        if (!code) return null;
        try {
            const match = code.match(/\{[\s\S]*\}/);
            const toParse = match ? match[0] : code;
            return JSON.parse(toParse);
        } catch (e) {
            return null;
        }
    }, [code]);

    const [currentIdx, setCurrentIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);

    if (!data || !data.cards || data.cards.length === 0) {
        return (
            <div className="text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 p-4 rounded text-sm font-mono my-2 animate-pulse">
                Generating flashcards...
            </div>
        );
    }

    const card = data.cards[currentIdx];

    const next = () => {
        setFlipped(false);
        setTimeout(() => setCurrentIdx((p) => (p + 1) % data.cards.length), 150);
    };

    const prev = () => {
        setFlipped(false);
        setTimeout(() => setCurrentIdx((p) => (p - 1 + data.cards.length) % data.cards.length), 150);
    };

    return (
        <div className="my-4 flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between px-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--neon-cyan)]">🎴 Flashcards: {data.topic}</span>
                <span className="text-[9px] text-white/40 uppercase tracking-tighter">{currentIdx + 1} / {data.cards.length}</span>
            </div>

            <div
                className="relative w-full h-48 cursor-pointer perspective-1000"
                onClick={() => setFlipped(!flipped)}
            >
                <motion.div
                    className="w-full h-full relative preserve-3d"
                    initial={false}
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden glass-panel border border-[var(--neon-cyan-dim)] flex items-center justify-center p-6 text-center rounded-xl shadow-2xl">
                        <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--neon-cyan)' }}>
                            {card.front}
                        </p>
                        <div className="absolute bottom-2 right-3 text-[8px] uppercase tracking-widest text-white/20">Click to flip</div>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 glass-panel border border-[var(--neon-green-dim)] flex items-center justify-center p-6 text-center rounded-xl shadow-2xl bg-[var(--neon-green-dim)]/5">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--neon-green)' }}>
                            {card.back}
                        </p>
                        <div className="absolute bottom-2 right-3 text-[8px] uppercase tracking-widest text-white/20">Click to flip</div>
                    </div>
                </motion.div>
            </div>

            <div className="flex items-center gap-4">
                <button onClick={prev} className="p-2 rounded-full border border-white/10 hover:bg-white/5 active:scale-90 transition-all">
                    <ChevronLeft size={16} />
                </button>
                <button onClick={() => setFlipped(!flipped)} className="p-2 rounded-full border border-white/10 hover:bg-white/5 active:scale-90 transition-all" title="Flip">
                    <RotateCcw size={16} />
                </button>
                <button onClick={next} className="p-2 rounded-full border border-white/10 hover:bg-white/5 active:scale-90 transition-all">
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
