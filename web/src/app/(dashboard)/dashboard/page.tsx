import Link from 'next/link';

const quickLinks = [
  { href: '/dashboard/library', title: 'Library', description: 'Browse all uploaded books.' },
  { href: '/dashboard/librarian', title: 'Librarian', description: 'Upload PDFs and covers.' },
  { href: '/dashboard/student', title: 'Student', description: 'See assigned readings and progress.' },
  { href: '/dashboard/teacher', title: 'Teacher', description: 'Track classroom performance.' },
  { href: '/dashboard/admin', title: 'Admin', description: 'Manage roles and access.' },
];

export default function DashboardHomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/70">Reading Buddy</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Welcome to your hybrid library</h1>
        <p className="mt-2 max-w-2xl text-white/80">
          Manage books, track student progress, and build AI-powered quizzes from one control room.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/30 hover:bg-white/10"
          >
            <h2 className="text-lg font-semibold text-white">{card.title}</h2>
            <p className="text-sm text-white/70">{card.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
