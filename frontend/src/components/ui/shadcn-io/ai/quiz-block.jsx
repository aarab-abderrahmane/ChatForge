import { useState, useMemo, useCallback } from 'react';
import { CheckCircle2, XCircle, Trophy, HelpCircle } from 'lucide-react';
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
      <div className="quiz-loading my-4 border border-divider bg-paper">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted-100">
          <HelpCircle size={14} className="text-muted-400" />
          <span className="text-xs font-mono tracking-wider text-muted-400">
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
    <div className="my-4 border-2 border-ink bg-paper wobbly-sm shadow-hard-sm">
      {/* ── Header ── */}
      <div className="quiz-header flex items-center justify-between px-4 py-3 border-b border-divider bg-muted-100 wobbly-sm" style={{ borderRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-red" />
          <h3 className="font-serif text-xs font-bold tracking-[0.15em] uppercase text-ink">
            {quizData.topic}
          </h3>
        </div>
        <span className="text-[10px] tracking-[0.12em] uppercase font-mono text-muted-500">
          {total} Questions
        </span>
      </div>

      {/* ── Progress bar ── */}
      {!isSubmitted && (
        <div className="h-[2px] bg-muted-100">
          <div
            className="h-full bg-ink transition-all duration-150"
            style={{ width: `${(Object.keys(selectedAnswers).length / total) * 100}%` }}
          />
        </div>
      )}

      {/* ── Questions ── */}
      <div className="p-4 flex flex-col gap-6">
        {quizData.questions.map((q, qIdx) => (
          <div key={qIdx} className="quiz-question flex flex-col gap-2.5 transition-all duration-150">
            {/* Question text */}
            <p className="font-body text-sm leading-relaxed flex items-start gap-2 text-ink">
              <span className="quiz-q-number flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold mt-0.5 border-2 border-ink bg-muted-100 text-ink" style={{ borderRadius: radius.wobblySm }}>
                {qIdx + 1}
              </span>
              {q.q}
            </p>

            {/* Options */}
            <div className="flex flex-col gap-1.5 ml-7">
              {q.options.map((opt, oIdx) => {
                const isSelected = selectedAnswers[qIdx] === oIdx;
                const isCorrect = q.answer === oIdx;

                let optionClasses = 'quiz-option text-left px-3 py-2.5 text-xs border-2 transition-all duration-150 flex items-center gap-2 wobbly-sm';
                let labelClasses = 'flex-shrink-0 w-5 h-5 flex items-center justify-center text-[9px] font-bold border-2';
                let iconEl = null;

                if (isSubmitted) {
                  if (isCorrect) {
                    optionClasses += ' bg-red/10 border-red text-red';
                    labelClasses += ' bg-red/10 border-red text-red';
                    iconEl = <CheckCircle2 size={14} className="ml-auto flex-shrink-0 text-red" />;
                  } else if (isSelected) {
                    optionClasses += ' line-through text-muted-400 border-divider';
                    labelClasses += ' bg-muted-100 border-divider text-muted-400';
                    iconEl = <XCircle size={14} className="ml-auto flex-shrink-0 text-muted-400" />;
                  } else {
                    optionClasses += ' text-muted-400 border-divider opacity-40';
                    labelClasses += ' bg-muted-100 border-divider text-muted-400';
                  }
                } else if (isSelected) {
                  optionClasses += ' bg-muted-100 border-ink text-ink';
                  labelClasses += ' bg-muted-100 border-ink text-ink';
                } else if (hoveredOption === `${qIdx}-${oIdx}`) {
                  optionClasses += ' bg-muted-100 border-divider text-ink';
                  labelClasses += ' bg-muted-100 border-divider text-muted-400';
                } else {
                  optionClasses += ' bg-transparent border-divider text-ink';
                  labelClasses += ' bg-muted-100 border-divider text-muted-400';
                }

                return (
                  <button
                    key={oIdx}
                    disabled={isSubmitted}
                    onClick={() => handleSelect(qIdx, oIdx)}
                    onMouseEnter={() => setHoveredOption(`${qIdx}-${oIdx}`)}
                    onMouseLeave={() => setHoveredOption(null)}
                    className={optionClasses}
                  >
                    <span className={labelClasses}>
                      {LETTER_LABELS[oIdx] || oIdx}
                    </span>
                    {opt}
                    {iconEl}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="quiz-footer flex justify-between items-center px-4 py-3 border-t border-divider bg-muted-100">
        {isSubmitted ? (
          <div className="flex items-center gap-2 transition-all duration-150">
            <span className="font-mono text-xs font-bold tracking-[0.1em] text-ink">
              {perfectScore ? 'PERFECT!' : 'SCORE:'}
            </span>
            <span className={`font-mono text-sm font-bold tabular-nums ${perfectScore ? 'text-red' : 'text-ink'}`}>
              {score}
              <span className="text-[10px] font-normal text-muted-400">/{total}</span>
            </span>
          </div>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-400 transition-all duration-150">
            {Object.keys(selectedAnswers).length} / {total} answered
          </span>
        )}

        <div className="flex items-center gap-2">
          {isSubmitted && (
            <button
              onClick={handleReset}
              className="btn-sketch-sm font-mono text-[10px]"
            >
              Retry
            </button>
          )}
          <button
            disabled={isSubmitted || !allAnswered}
            onClick={handleSubmit}
            className="btn-sketch-sm font-mono text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSubmitted ? 'Completed' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
