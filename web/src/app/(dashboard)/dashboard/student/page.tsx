import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assignments } = await supabase
    .from("student_books")
    .select("book_id, current_page, books(*)")
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false });

  const assignedBookIds =
    assignments?.map((assignment) => assignment.book_id) ?? [];

  let quizzes: Array<{
    id: number;
    book_id: number;
    books: { title: string } | null;
  }> = [];
  if (assignedBookIds.length) {
    const { data } = await supabase
      .from("quizzes")
      .select("id, book_id, books(title)")
      .in("book_id", assignedBookIds)
      .order("created_at", { ascending: false });
    // Transform the data to match the expected type
    quizzes = (data ?? []).map((item: any) => ({
      id: item.id,
      book_id: item.book_id,
      books:
        Array.isArray(item.books) && item.books.length > 0
          ? item.books[0]
          : null,
    }));
  }

  const { data: achievements } = await supabase
    .from("student_achievements")
    .select("earned_at, achievements(name, description, badge_url)")
    .eq("student_id", user.id)
    .order("earned_at", { ascending: false });

  return (
    <div className="space-y-8">
      <header className="space-y-2 rounded-[32px] border border-white/60 bg-white/85 p-6 text-indigo-950 shadow-[0_25px_70px_rgba(147,118,255,0.25)]">
        <p className="text-xs uppercase tracking-[0.3em] text-rose-400">
          Student zone
        </p>
        <h1 className="text-3xl font-black">My readings</h1>
        <p className="text-sm text-indigo-500">Pick up where you left off.</p>
      </header>

      {assignments?.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {assignments.map((assignment) => {
            // Extract first book from array if it exists
            const bookData =
              Array.isArray(assignment.books) && assignment.books.length > 0
                ? assignment.books[0]
                : assignment.books;
            const book = bookData as {
              id: number;
              title: string;
              author: string;
              cover_url: string;
            } | null;
            return (
              <li
                key={assignment.book_id}
                className="rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-pink-50 to-amber-50 p-5 text-indigo-900 shadow-[0_15px_50px_rgba(255,158,197,0.3)]"
              >
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-rose-400">
                    Assigned reading
                  </p>
                  <h2 className="text-xl font-black text-indigo-950">
                    {book?.title ?? "Unknown title"}
                  </h2>
                  <p className="text-sm text-indigo-500">{book?.author}</p>
                  <p className="text-xs text-indigo-400">
                    Current page: {assignment.current_page ?? 1}
                  </p>
                  <Link
                    href={`/dashboard/student/read/${assignment.book_id}`}
                    className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-indigo-400 to-sky-400 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:scale-105"
                  >
                    Continue reading →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-[28px] border border-dashed border-indigo-200 bg-white/80 p-8 text-center text-indigo-500">
          No assignments yet. Ask your teacher to assign a book from the class
          dashboard.
        </div>
      )}

      <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/85 p-6 text-indigo-950 shadow-[0_20px_60px_rgba(147,118,255,0.18)]">
        <div>
          <h2 className="text-xl font-black">Achievements</h2>
          <p className="text-sm text-indigo-500">
            Badges unlocked from finished readings.
          </p>
        </div>
        {achievements?.length ? (
          <ul className="space-y-3">
            {achievements.map((achievement, index) => {
              // Extract first achievement from array if it exists
              const achievementData =
                Array.isArray(achievement.achievements) &&
                achievement.achievements.length > 0
                  ? achievement.achievements[0]
                  : achievement.achievements;
              const data = achievementData as {
                name: string;
                description: string;
              } | null;
              return (
                <li
                  key={`${data?.name ?? "achievement"}-${index}`}
                  className="rounded-2xl border border-indigo-100 bg-white/70 p-4 text-sm text-indigo-900"
                >
                  <p className="font-semibold">
                    {data?.name ?? "Unlocked badge"}
                  </p>
                  <p className="text-indigo-500">{data?.description}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-indigo-400">
            No badges yet. Finish books to unlock awards.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/85 p-6 text-indigo-950 shadow-[0_20px_60px_rgba(147,118,255,0.18)]">
        <div>
          <h2 className="text-xl font-black">Available quizzes</h2>
          <p className="text-sm text-indigo-500">
            Test your knowledge on completed readings.
          </p>
        </div>
        {quizzes.length ? (
          <ul className="space-y-3">
            {quizzes.map((quiz) => (
              <li
                key={quiz.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-white/70 p-4 text-indigo-900"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-indigo-400">
                    Book
                  </p>
                  <p className="text-base font-semibold">
                    {quiz.books?.title ?? "Untitled"}
                  </p>
                </div>
                <Link
                  href={`/dashboard/student/quiz/${quiz.id}`}
                  className="rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:scale-105"
                >
                  Take quiz
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-indigo-400">
            No quizzes yet. Librarians or teachers can generate them anytime.
          </p>
        )}
      </section>
    </div>
  );
}
