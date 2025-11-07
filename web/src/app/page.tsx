import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#2e3192,_#1b1d3a)] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-24">
        <header className="space-y-6 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.4em] text-white/70">Reading Buddy</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
            A hybrid e-library for <span className="text-emerald-300">K-12 schools</span>
          </h1>
          <p className="text-lg text-white/80 md:max-w-2xl">
            Self-host large files with MinIO, handle auth and data through Supabase, and let Gemini build AI quizzes from
            your book summaries. Everything students, teachers, librarians, and admins need in one secure platform.
          </p>
          <div className="flex flex-col gap-4 text-base font-semibold text-slate-900 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-white px-8 py-3 text-center text-base font-semibold text-slate-900 transition hover:bg-white/90"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/50 px-8 py-3 text-center text-base font-semibold text-white transition hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Supabase-first',
              description: 'Auth, database, and RLS-ready APIs with supabase-js clients.',
            },
            {
              title: 'MinIO storage',
              description: 'Self-host PDFs, covers, and badges while keeping costs predictable.',
            },
            {
              title: 'AI-native',
              description: 'Generate quizzes with Google Gemini using secure server actions.',
            },
          ].map((card) => (
            <article key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">{card.title}</h2>
              <p className="text-sm text-white/70">{card.description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
