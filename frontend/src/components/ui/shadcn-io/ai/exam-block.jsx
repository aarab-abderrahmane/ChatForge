import { useState, useMemo, useCallback } from 'react';
import { Trophy, HelpCircle, CheckCircle2 } from 'lucide-react';

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

export function ExamBlock({ code, onSubmitForCorrection }) {
  const examData = useMemo(() => safeParseJSON(code), [code]);

  const [userAnswers, setUserAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = useCallback((qIdx, oIdx) => {
    if (submitted) return;
    setUserAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  }, [submitted]);

  const handleInputChange = useCallback((qIdx, value) => {
    if (submitted) return;
    setUserAnswers(prev => ({ ...prev, [qIdx]: value }));
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (!examData || submitted) return;

    const questionsWithAnswers = examData.questions.map((q, qIdx) => ({
      id: q.id || qIdx + 1,
      type: q.type,
      q: q.q,
      options: q.options,
      modelAnswer: q.modelAnswer,
      userAnswer: userAnswers[qIdx],
      userAnswerText: q.type === 'multiple-choice'
        ? (q.options?.[userAnswers[qIdx]] || 'Not answered')
        : (userAnswers[qIdx] || 'Not answered'),
    }));

    setSubmitted(true);

    if (onSubmitForCorrection) {
      onSubmitForCorrection(examData.topic, questionsWithAnswers);
    }
  }, [examData, userAnswers, submitted, onSubmitForCorrection]);

  if (!examData?.questions) {
    return (
      <div className="my-4 border border-divider bg-paper">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted-100">
          <HelpCircle size={14} className="text-muted-400" />
          <span className="text-xs font-mono tracking-wider text-muted-400">
            Generating exam questions...
          </span>
        </div>
      </div>
    );
  }

  const total = examData.questions.length;

  const allAnswered = examData.questions.every((q, qIdx) => {
    const val = userAnswers[qIdx];
    if (q.type === 'multiple-choice') return typeof val === 'number';
    return val && val.trim().length > 0;
  });

  return (
    <div className="my-4 border border-divider bg-paper">
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-muted-100">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-red" />
          <h3 className="font-serif text-xs font-bold tracking-[0.15em] uppercase text-ink">
            {examData.topic}
          </h3>
        </div>
        <span className="text-[10px] tracking-[0.12em] uppercase font-mono text-muted-500">
          {total} Questions
        </span>
      </div>

      {!submitted && (
        <div className="h-[2px] bg-muted-100">
          <div
            className="h-full bg-ink transition-all duration-150"
            style={{ width: `${(Object.keys(userAnswers).length / total) * 100}%` }}
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-6">
        {examData.questions.map((q, qIdx) => (
          <div key={qIdx} className="flex flex-col gap-2.5 transition-all duration-150">
            <p className="font-body text-sm leading-relaxed flex items-start gap-2 text-ink">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold mt-0.5 border border-ink bg-muted-100 text-ink">
                {qIdx + 1}
              </span>
              <span>
                {q.q}
                {q.type === 'fill-blank' && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-400 ml-2">
                    [fill in the blank]
                  </span>
                )}
              </span>
            </p>

            <div className="ml-7">
              {q.type === 'multiple-choice' ? (
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = userAnswers[qIdx] === oIdx;

                    let optionClasses = 'text-left px-3 py-2.5 text-xs border transition-all duration-150 flex items-center gap-2';
                    let labelClasses = 'flex-shrink-0 w-5 h-5 flex items-center justify-center text-[9px] font-bold border';

                    if (submitted) {
                      optionClasses += ' opacity-40 text-muted-400 border-divider cursor-default';
                      labelClasses += ' bg-muted-100 border-divider text-muted-400';
                    } else if (isSelected) {
                      optionClasses += ' bg-muted-100 border-ink text-ink';
                      labelClasses += ' bg-muted-100 border-ink text-ink';
                    } else {
                      optionClasses += ' bg-transparent border-divider text-ink hover:bg-muted-100 hover:border-ink cursor-pointer';
                      labelClasses += ' bg-muted-100 border-divider text-muted-400';
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={submitted}
                        onClick={() => handleSelect(qIdx, oIdx)}
                        className={optionClasses}
                      >
                        <span className={labelClasses}>
                          {LETTER_LABELS[oIdx] || oIdx}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  disabled={submitted}
                  value={userAnswers[qIdx] || ''}
                  onChange={e => handleInputChange(qIdx, e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full bg-transparent border-b border-divider px-2 py-2 font-mono text-sm text-ink placeholder:text-muted-400 outline-none focus:border-ink transition-colors disabled:opacity-40"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center px-4 py-3 border-t border-divider bg-muted-100">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-400 transition-all duration-150">
          {Object.keys(userAnswers).length} / {total} answered
        </span>

        <div className="flex items-center gap-2">
          {submitted ? (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 text-green">
              <CheckCircle2 size={12} /> Submitted for AI Correction
            </span>
          ) : (
            <button
              disabled={!allAnswered}
              onClick={handleSubmit}
              className="font-mono text-[10px] px-4 py-1.5 font-bold uppercase tracking-[0.1em] transition-all duration-150 border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Submit for AI Correction
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
