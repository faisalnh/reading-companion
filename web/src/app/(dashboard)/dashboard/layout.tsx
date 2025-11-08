import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { SignOutButton } from '@/components/dashboard/SignOutButton';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const roleLabel =
    profile?.role === 'ADMIN'
      ? '⚙️ Admin'
      : profile?.role === 'TEACHER'
        ? '👨‍🏫 Teacher'
        : profile?.role === 'LIBRARIAN'
          ? '👩‍💼 Librarian'
          : profile?.role === 'STUDENT'
            ? '🎒 Student'
            : '📖 Reader';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 text-purple-900">
      <header className="border-b border-purple-200 bg-gradient-to-r from-purple-50 via-pink-50 to-yellow-50 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-200 bg-white/80 px-3 py-1 text-sm font-black uppercase tracking-wide text-yellow-700">
              📚 Reading Buddy
            </div>
            <p className="text-xs font-semibold uppercase text-purple-500">{roleLabel}</p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <DashboardNav userRole={profile?.role as 'ADMIN' | 'LIBRARIAN' | 'TEACHER' | 'STUDENT' | null} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="page-transition mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
