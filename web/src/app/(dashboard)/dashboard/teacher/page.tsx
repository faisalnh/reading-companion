import { createSupabaseServerClient } from '@/lib/supabase/server';

type ReadingEntry = {
  student_id: string;
  current_page: number | null;
  updated_at: string | null;
  profiles: { full_name: string | null } | null;
  books: { title: string; page_count: number | null } | null;
};

type QuizEntry = {
  score: number;
  submitted_at: string | null;
  profiles: { full_name: string | null } | null;
  quizzes: { books: { title: string | null } | null } | null;
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const cardClass =
  'space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-6 text-indigo-950 shadow-[0_20px_60px_rgba(147,118,255,0.18)] backdrop-blur-xl';

const tableWrapperClass = 'overflow-x-auto rounded-3xl border border-white/70 bg-white/75 shadow-inner';
const tableClass = 'min-w-full divide-y divide-indigo-50 text-sm text-indigo-900';
const headClass = 'bg-gradient-to-r from-indigo-50 to-pink-50 text-xs uppercase tracking-wide text-indigo-500';
const cellClass = 'px-4 py-3';

export default async function TeacherDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data: readings } = await supabase
    .from('student_books')
    .select('student_id, current_page, updated_at, profiles!student_books_student_id_fkey(full_name), books(title, page_count)')
    .order('updated_at', { ascending: false })
    .limit(10);

  const { data: quizAttempts } = await supabase
    .from('quiz_attempts')
    .select(
      'score, submitted_at, profiles!quiz_attempts_student_id_fkey(full_name), quizzes(id, books(title))',
    )
    .order('submitted_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <section className={cardClass}>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-rose-400">Teacher Lounge</p>
          <h2 className="text-2xl font-black text-indigo-950">Reading progress</h2>
          <p className="text-sm text-indigo-500">Latest updates from your students.</p>
        </div>
        <div className={tableWrapperClass}>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <th className={cellClass}>Student</th>
                <th className={cellClass}>Book</th>
                <th className={cellClass}>Current page</th>
                <th className={cellClass}>Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {(readings as ReadingEntry[] | null)?.map((entry) => (
                <tr key={`${entry.student_id}-${entry.books?.title ?? 'book'}`} className="bg-transparent hover:bg-indigo-50/60">
                  <td className={cellClass}>{entry.profiles?.full_name ?? 'Unknown student'}</td>
                  <td className={cellClass}>{entry.books?.title ?? '—'}</td>
                  <td className={cellClass}>
                    {entry.current_page ?? 0} / {entry.books?.page_count ?? '—'}
                  </td>
                  <td className={cellClass}>{formatDate(entry.updated_at)}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4} className={`${cellClass} text-center text-indigo-400`}>
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Quiz tracker</p>
          <h2 className="text-2xl font-black text-indigo-950">Recent quiz attempts</h2>
          <p className="text-sm text-indigo-500">Track comprehension at a glance.</p>
        </div>
        <div className={tableWrapperClass}>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <th className={cellClass}>Student</th>
                <th className={cellClass}>Book</th>
                <th className={cellClass}>Score</th>
                <th className={cellClass}>Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {(quizAttempts as QuizEntry[] | null)?.map((attempt, index) => (
                <tr key={index} className="bg-transparent hover:bg-indigo-50/60">
                  <td className={cellClass}>{attempt.profiles?.full_name ?? 'Unknown student'}</td>
                  <td className={cellClass}>{attempt.quizzes?.books?.title ?? '—'}</td>
                  <td className={cellClass}>{attempt.score}%</td>
                  <td className={cellClass}>{formatDate(attempt.submitted_at)}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4} className={`${cellClass} text-center text-indigo-400`}>
                    No attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
