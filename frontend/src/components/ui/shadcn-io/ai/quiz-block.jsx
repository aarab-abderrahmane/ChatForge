import { useState, useMemo } from "react";

export function QuizBlock({ code }) {
    const quizData = useMemo(() => {
        if (!code) return null;
        try {
            const match = code.match(/\{[\s\S]*\}/);
            const toParse = match ? match[0] : code;
            return JSON.parse(toParse);
        } catch (e) {
            return null;
        }
    }, [code]);

    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    if (!quizData || !quizData.questions) {
        return (
            <div className="text-red-400 border border-red-500/30 bg-red-500/10 p-4 rounded text-sm font-mono my-2 animate-pulse">
                Generating quiz...
            </div>
        );
    }

    const score = Object.keys(selectedAnswers).reduce((acc, qIdxStr) => {
        const qIdx = parseInt(qIdxStr);
        if (selectedAnswers[qIdx] === quizData.questions[qIdx].answer) {
            return acc + 1;
        }
        return acc;
    }, 0);

    return (
        <div className="my-4 border rounded-lg overflow-hidden glass-panel" style={{ borderColor: 'var(--border-green)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(57,255,20,0.2)', background: 'rgba(57,255,20,0.05)' }}>
                <h3 className="text-[var(--neon-green)] font-bold tracking-widest uppercase text-xs flex items-center gap-2">
                    🎯 Quiz: {quizData.topic}
                </h3>
                <span className="text-[10px] text-[var(--neon-cyan)] uppercase tracking-wider">{quizData.questions.length} Questions</span>
            </div>
            <div className="p-4 flex flex-col gap-6">
                {quizData.questions.map((q, qIdx) => (
                    <div key={qIdx} className="flex flex-col gap-2">
                        <p className="text-sm font-semibold leading-relaxed" style={{ color: 'rgba(200,255,192,0.9)' }}>
                            {qIdx + 1}. {q.q}
                        </p>
                        <div className="flex flex-col gap-2">
                            {q.options.map((opt, oIdx) => {
                                const isSelected = selectedAnswers[qIdx] === oIdx;
                                const isCorrect = q.answer === oIdx;

                                let optionStyle = {
                                    background: isSelected ? 'rgba(57,255,20,0.1)' : 'transparent',
                                    borderColor: isSelected ? 'var(--neon-green)' : 'rgba(255,255,255,0.1)',
                                    color: isSelected ? 'var(--neon-green)' : 'rgba(200,255,192,0.7)',
                                };

                                if (isSubmitted) {
                                    if (isCorrect) {
                                        optionStyle = { background: 'rgba(57,255,20,0.2)', borderColor: '#39ff14', color: '#39ff14', fontWeight: 'bold' };
                                    } else if (isSelected && !isCorrect) {
                                        optionStyle = { background: 'rgba(255,45,120,0.2)', borderColor: '#ff2d78', color: '#ff2d78', textDecoration: 'line-through' };
                                    } else {
                                        optionStyle.opacity = 0.5;
                                    }
                                }

                                return (
                                    <button
                                        key={oIdx}
                                        disabled={isSubmitted}
                                        onClick={() => setSelectedAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                                        className="text-left px-3 py-2 text-xs rounded border transition-all hover:bg-white/5 active:scale-[0.99]"
                                        style={optionStyle}
                                    >
                                        {String.fromCharCode(65 + oIdx)}. {opt}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            <div className="px-4 py-3 border-t flex justify-between items-center" style={{ borderColor: 'rgba(57,255,20,0.2)', background: 'rgba(0,0,0,0.3)' }}>
                {isSubmitted ? (
                    <span className="text-sm font-bold tracking-wider" style={{ color: 'var(--neon-cyan)' }}>
                        SCORE: <span style={{ color: score === quizData.questions.length ? '#39ff14' : '#ff2d78' }}>{score}</span> / {quizData.questions.length}
                    </span>
                ) : (
                    <span className="text-[10px] uppercase tracking-widest text-[rgba(200,255,192,0.4)]">
                        {Object.keys(selectedAnswers).length} / {quizData.questions.length} Answered
                    </span>
                )}
                <button
                    disabled={isSubmitted || Object.keys(selectedAnswers).length !== quizData.questions.length}
                    onClick={() => setIsSubmitted(true)}
                    className="btn-neon disabled:opacity-50 disabled:cursor-not-allowed text-[11px] px-3 py-1.5"
                >
                    {isSubmitted ? "Completed" : "Submit Answers"}
                </button>
            </div>
        </div>
    );
}
