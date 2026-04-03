import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Trophy, HelpCircle } from 'lucide-react';

function safeParseJSON(code) {
  if (!code) return null;
  try {
    const match = code.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : code);
  } catch {
    return null;
  }
}

const LETTER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function QuizBlock({ code }) {
  const quizData = useMemo(() => safeParseJSON(code), [code]);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);

  const handleSelect = useCallback((qIdx, oIdx) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));
  }, [isSubmitted]);

  const handleSubmit = useCallback(() => {
    if (!quizData) return;
    setIsSubmitted(true);
  }, [quizData]);

  const handleReset = useCallback(() => {
    setSelectedAnswers({});
    setIsSubmitted(false);
  }, []);

  // ── Loading state ──
  if (!quizData?.questions) {
    return (
      <div className="quiz-loading my-4 border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(0, 245, 255, 0.2)' }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(0, 245, 255, 0.04)' }}>
          <HelpCircle size={14} style={{ color: 'var(--neon-cyan)' }} />
          <span className="text-xs font-mono tracking-wider" style={{ color: 'rgba(0, 245, 255, 0.7)' }}>
            Generating quiz questions...
          </span>
        </div>
      </div>
    );
  }

  const score = Object.keys(selectedAnswers).reduce((acc, qIdxStr) => {
    const qIdx = parseInt(qIdxStr);
    return selectedAnswers[qIdx] === quizData.questions[qIdx]?.answer ? acc + 1 : acc;
  }, 0);

  const total = quizData.questions.length;
  const allAnswered = Object.keys(selectedAnswers).length === total;
  const perfectScore = score === total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="my-4 quiz-container rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--border-green)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        boxShadow: 'var(--glow-panel)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="quiz-header flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: '1px solid rgba(57, 255, 20, 0.15)',
          background: 'rgba(57, 255, 20, 0.03)',
        }}
      >
        <div className="flex items-center gap-2">
          <Trophy size={14} style={{ color: 'var(--neon-green)' }} />
          <h3
            className="text-xs font-bold tracking-[0.15em] uppercase"
            style={{ color: 'var(--neon-green)' }}
          >
            {quizData.topic}
          </h3>
        </div>
        <span
          className="text-[10px] tracking-[0.12em] uppercase font-semibold"
          style={{ color: 'rgba(0, 245, 255, 0.6)' }}
        >
          {total} Questions
        </span>
      </div>

      {/* ── Progress bar ── */}
      {!isSubmitted && (
        <div className="h-[2px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            className="h-full"
            style={{ background: 'var(--neon-green)' }}
            initial={{ width: 0 }}
            animate={{ width: `${(Object.keys(selectedAnswers).length / total) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* ── Questions ── */}
      <div className="p-4 flex flex-col gap-6">
        {quizData.questions.map((q, qIdx) => (
          <motion.div
            key={qIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: qIdx * 0.05, duration: 0.25 }}
            className="quiz-question flex flex-col gap-2.5"
          >
            {/* Question text */}
            <p className="text-sm font-semibold leading-relaxed flex items-start gap-2" style={{ color: 'rgba(220, 255, 210, 0.92)' }}>
              <span
                className="quiz-q-number flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold mt-0.5"
                style={{
                  background: 'rgba(57, 255, 20, 0.1)',
                  color: 'var(--neon-green)',
                  border: '1px solid rgba(57, 255, 20, 0.2)',
                }}
              >
                {qIdx + 1}
              </span>
              {q.q}
            </p>

            {/* Options */}
            <div className="flex flex-col gap-1.5 ml-7">
              {q.options.map((opt, oIdx) => {
                const isSelected = selectedAnswers[qIdx] === oIdx;
                const isCorrect = q.answer === oIdx;

                let optionClasses = 'quiz-option';
                let optionStyle = {};

                if (isSubmitted) {
                  if (isCorrect) {
                    optionClasses += ' quiz-option-correct';
                    optionStyle = {
                      background: 'rgba(57, 255, 20, 0.12)',
                      borderColor: 'rgba(57, 255, 20, 0.6)',
                      color: '#39ff14',
                    };
                  } else if (isSelected && !isCorrect) {
                    optionClasses += ' quiz-option-wrong';
                    optionStyle = {
                      background: 'rgba(255, 45, 120, 0.1)',
                      borderColor: 'rgba(255, 45, 120, 0.5)',
                      color: '#ff2d78',
                      textDecoration: 'line-through',
                    };
                  } else {
                    optionStyle.opacity = 0.4;
                  }
                } else if (isSelected) {
                  optionClasses += ' quiz-option-selected';
                  optionStyle = {
                    background: 'rgba(57, 255, 20, 0.08)',
                    borderColor: 'rgba(57, 255, 20, 0.4)',
                    color: '#39ff14',
                  };
                } else if (hoveredOption === `${qIdx}-${oIdx}`) {
                  optionStyle = {
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    color: 'rgba(220, 255, 210, 0.85)',
                  };
                } else {
                  optionStyle = {
                    background: 'transparent',
                    borderColor: 'rgba(255, 255, 255, 0.07)',
                    color: 'rgba(200, 255, 192, 0.65)',
                  };
                }

                return (
                  <motion.button
                    key={oIdx}
                    disabled={isSubmitted}
                    onClick={() => handleSelect(qIdx, oIdx)}
                    onMouseEnter={() => setHoveredOption(`${qIdx}-${oIdx}`)}
                    onMouseLeave={() => setHoveredOption(null)}
                    whileTap={!isSubmitted ? { scale: 0.98 } : {}}
                    className={`quiz-option text-left px-3 py-2.5 text-xs rounded-lg border transition-all duration-200 ${optionClasses}`}
                    style={optionStyle}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="quiz-option-label flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: isSelected
                            ? 'rgba(57, 255, 20, 0.15)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#39ff14' : 'rgba(200, 255, 192, 0.5)',
                          border: `1px solid ${isSelected ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {LETTER_LABELS[oIdx] || oIdx}
                      </span>
                      {opt}
                      {isSubmitted && isCorrect && (
                        <CheckCircle2 size={14} className="ml-auto flex-shrink-0" />
                      )}
                      {isSubmitted && isSelected && !isCorrect && (
                        <XCircle size={14} className="ml-auto flex-shrink-0" />
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div
        className="quiz-footer flex justify-between items-center px-4 py-3"
        style={{
          borderTop: '1px solid rgba(57, 255, 20, 0.12)',
          background: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <AnimatePresence mode="wait">
          {isSubmitted ? (
            <motion.div
              key="score"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs font-bold tracking-[0.1em]" style={{ color: perfectScore ? '#39ff14' : 'var(--neon-cyan)' }}>
                {perfectScore ? 'PERFECT!' : 'SCORE:'}
              </span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: perfectScore ? '#39ff14' : '#ff2d78' }}
              >
                {score}
                <span className="text-[10px] font-normal opacity-60">/{total}</span>
              </span>
            </motion.div>
          ) : (
            <motion.span
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] uppercase tracking-[0.12em] font-semibold"
              style={{ color: 'rgba(200, 255, 192, 0.35)' }}
            >
              {Object.keys(selectedAnswers).length} / {total} answered
            </motion.span>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          {isSubmitted && (
            <button
              onClick={handleReset}
              className="text-[10px] px-3 py-1.5 rounded-lg font-semibold uppercase tracking-[0.08em] transition-all duration-200 cursor-pointer border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 hover:bg-white/5"
            >
              Retry
            </button>
          )}
          <button
            disabled={isSubmitted || !allAnswered}
            onClick={handleSubmit}
            className="btn-neon text-[10px] px-4 py-1.5 rounded-lg font-bold uppercase tracking-[0.1em] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSubmitted ? 'Completed' : 'Submit'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
