'use client';

import { useState } from 'react';
import Link from 'next/link';
import { generateQuizForBook } from '@/app/(dashboard)/dashboard/librarian/actions';

type QuizGeneratorProps = {
  books: Array<{ id: number; title: string; description: string | null }>;
};

export const QuizGenerator = ({ books }: QuizGeneratorProps) => {
  const [bookId, setBookId] = useState<number | null>(books[0]?.id ?? null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quizLink, setQuizLink] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!bookId) {
      setError('Select a book first.');
      return;
    }

    setStatus('loading');
    setError(null);
    setQuizLink(null);

    try {
      const result = await generateQuizForBook({ bookId });
      setQuizLink(`/dashboard/student/quiz/${result.quizId}`);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate quiz.';
      setError(message);
      setStatus('idle');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">AI Quiz Generator</h2>
        <p className="text-sm text-white/70">Select a book summary and let Gemini craft a multiple-choice quiz.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Book</label>
        <select
          className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white outline-none focus:border-white/40"
          value={bookId ?? ''}
          onChange={(event) => setBookId(Number(event.target.value))}
        >
          {books.length ? (
            books.map((book) => (
              <option key={book.id} value={book.id} className="bg-slate-900 text-white">
                {book.title}
              </option>
            ))
          ) : (
            <option value="" disabled>
              Upload a book first
            </option>
          )}
        </select>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={status === 'loading' || !bookId}
        className="rounded-lg bg-white/90 px-4 py-2 font-semibold text-slate-900 transition hover:bg-white disabled:pointer-events-none disabled:opacity-50"
      >
        {status === 'loading' ? 'Generating…' : 'Generate quiz'}
      </button>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {quizLink ? (
        <p className="text-sm text-emerald-300">
          Quiz saved.{' '}
          <Link href={quizLink} className="underline-offset-4 hover:underline">
            View it as a student
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
};
