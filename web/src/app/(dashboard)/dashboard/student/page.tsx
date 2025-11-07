import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: assignments } = await supabase
    .from('student_books')
    .select('book_id, current_page, books(*)')
    .eq('student_id', user.id)
    .order('updated_at', { ascending: false });

  const assignedBookIds = assignments?.map((assignment) => assignment.book_id) ?? [];

  let quizzes: Array<{ id: number; book_id: number; books: { title: string } | null }> = [];
  if (assignedBookIds.length) {
    const { data } = await supabase
      .from('quizzes')
      .select('id, book_id, books(title)')
      .in('book_id', assignedBookIds)
      .order('created_at', { ascending: false });
    quizzes = data ?? [];
  }

  const { data: achievements } = await supabase
    .from('student_achievements')
    .select('earned_at, achievements(name, description, badge_url)')
    .eq('student_id', user.id)
    .order('earned_at', { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">My readings</h1>
        <p className="text-sm text-slate-400">Pick up where you left off.</p>
      </header>

      {assignments?.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => {
            const book = assignment.books as {
              id: number;
              title: string;
              author: string;
              cover_url: string;
            };
            return (
              <li key={assignment.book_id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-2">
                  <p className="text-sm uppercase tracking-wide text-white/60">Assigned reading</p>
                  <h2 className="text-lg font-semibold text-white">{book?.title ?? 'Unknown title'}</h2>
                  <p className="text-sm text-white/70">{book?.author}</p>
                  <p className="text-xs text-white/60">Current page: {assignment.current_page ?? 1}</p>
                  <Link
                    href={`/dashboard/student/read/${assignment.book_id}`}
                    className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
                  >
                    Continue reading →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-white/70">
          No assignments yet. Ask your teacher to assign a book from the class dashboard.
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Achievements</h2>
          <p className="text-sm text-white/60">Badges unlocked from finished readings.</p>
        </div>
        {achievements?.length ? (
          <ul className="space-y-3">
            {achievements.map((achievement, index) => {
              const data = achievement.achievements as { name: string; description: string };
              return (
                <li
                  key={`${data?.name ?? 'achievement'}-${index}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white"
                >
                  <p className="font-semibold">{data?.name ?? 'Unlocked badge'}</p>
                  <p className="text-white/70">{data?.description}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/60">No badges yet. Finish books to unlock awards.</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Available quizzes</h2>
          <p className="text-sm text-white/60">Test your knowledge on completed readings.</p>
        </div>
        {quizzes.length ? (
          <ul className="space-y-3">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
                <div>
                  <p className="text-sm uppercase tracking-wider text-white/60">Book</p>
                  <p className="text-base font-semibold text-white">{quiz.books?.title ?? 'Untitled'}</p>
                </div>
                <Link
                  href={`/dashboard/student/quiz/${quiz.id}`}
                  className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Take quiz
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/60">No quizzes yet. Librarians or teachers can generate them anytime.</p>
        )}
      </section>
    </div>
  );
}
