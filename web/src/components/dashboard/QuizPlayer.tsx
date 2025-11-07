'use client';

import { useState } from 'react';
import { submitQuizAttempt } from '@/app/(dashboard)/dashboard/student/quiz/actions';

type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

type QuizData = {
  title?: string;
  questions: QuizQuestion[];
};

type QuizPlayerProps = {
  quizId: number;
  quizData: QuizData;
};

export const QuizPlayer = ({ quizId, quizData }: QuizPlayerProps) => {
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(
    quizData.questions.map(() => null)
  );
  const [status, setStatus] = useState<'idle' | 'submitting' | 'completed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const handleSelect = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers((prev) => prev.map((value, idx) => (idx === questionIndex ? optionIndex : value)));
  };

  const handleSubmit = async () => {
    if (selectedAnswers.some((answer) => answer === null)) {
      setError('Answer every question before submitting.');
      return;
    }

    setStatus('submitting');
    setError(null);

    const correctAnswers = quizData.questions.reduce((total, question, index) => {
      return total + (question.answerIndex === selectedAnswers[index] ? 1 : 0);
    }, 0);

    const computedScore = Math.round((correctAnswers / quizData.questions.length) * 100);

    try {
      await submitQuizAttempt({
        quizId,
        answers: selectedAnswers.map((answer) => Number(answer)),
        score: computedScore,
      });
      setScore(computedScore);
      setStatus('completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit quiz.';
      setError(message);
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      {quizData.questions.map((question, questionIndex) => (
        <div key={questionIndex} className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-wider text-white/60">Question {questionIndex + 1}</p>
          <h2 className="mt-2 text-lg font-semibold text-white">{question.question}</h2>

          <div className="mt-4 grid gap-3">
            {question.options.map((option, optionIndex) => {
              const isSelected = selectedAnswers[questionIndex] === optionIndex;
              const isCorrect = status === 'completed' && question.answerIndex === optionIndex;
              const isWrong =
                status === 'completed' && isSelected && question.answerIndex !== optionIndex;

              return (
                <button
                  key={optionIndex}
                  type="button"
                  onClick={() => handleSelect(questionIndex, optionIndex)}
                  disabled={status === 'completed'}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    isSelected ? 'border-white bg-white/10 text-white' : 'border-white/20 text-white/80'
                  } ${isCorrect ? 'border-emerald-300 bg-emerald-300/10' : ''} ${
                    isWrong ? 'border-red-300 bg-red-300/10' : ''
                  } disabled:cursor-default`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {status === 'completed' && question.explanation ? (
            <p className="mt-3 text-sm text-white/70">💡 {question.explanation}</p>
          ) : null}
        </div>
      ))}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {status === 'completed' && score !== null ? (
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-4 text-white">
          Final score: <span className="text-2xl font-semibold">{score}%</span>
        </div>
      ) : null}

      {status !== 'completed' ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status === 'submitting'}
          className="rounded-2xl bg-white/90 px-6 py-3 text-lg font-semibold text-slate-900 transition hover:bg-white disabled:pointer-events-none disabled:opacity-50"
        >
          {status === 'submitting' ? 'Submitting…' : 'Submit quiz'}
        </button>
      ) : null}
    </div>
  );
};
