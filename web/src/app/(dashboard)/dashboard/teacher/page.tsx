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
      'score, submitted_at, profiles!quiz_attempts_student_id_fkey(full_name), quizzes(id, books(title))'
    )
    .order('submitted_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Reading progress</h2>
          <p className="text-sm text-white/60">Latest updates from your students.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm text-white">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Book</th>
                <th className="px-4 py-3 text-left">Current page</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(readings as ReadingEntry[] | null)?.map((entry) => (
                <tr key={`${entry.student_id}-${entry.books?.title ?? 'book'}`} className="bg-white/5">
                  <td className="px-4 py-3">{entry.profiles?.full_name ?? 'Unknown student'}</td>
                  <td className="px-4 py-3">{entry.books?.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    {entry.current_page ?? 0} / {entry.books?.page_count ?? '—'}
                  </td>
                  <td className="px-4 py-3">{formatDate(entry.updated_at)}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-white/60">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Recent quiz attempts</h2>
          <p className="text-sm text-white/60">Track comprehension at a glance.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm text-white">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Book</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(quizAttempts as QuizEntry[] | null)?.map((attempt, index) => (
                <tr key={index} className="bg-white/5">
                  <td className="px-4 py-3">{attempt.profiles?.full_name ?? 'Unknown student'}</td>
                  <td className="px-4 py-3">{attempt.quizzes?.books?.title ?? '—'}</td>
                  <td className="px-4 py-3">{attempt.score}%</td>
                  <td className="px-4 py-3">{formatDate(attempt.submitted_at)}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-white/60">
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
