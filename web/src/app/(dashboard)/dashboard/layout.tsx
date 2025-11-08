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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 text-purple-900">
      <header className="border-b-4 border-purple-300 bg-gradient-to-r from-purple-100 via-pink-100 to-yellow-100 px-6 py-6 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-block rounded-2xl border-4 border-yellow-300 bg-yellow-400 px-4 py-1">
              <p className="text-sm font-black uppercase tracking-wide text-yellow-900">📚 Reading Buddy</p>
            </div>
            <h1 className="text-4xl font-black text-purple-700">
              👋 Hello, {profile?.full_name ?? 'Reader'}!
            </h1>
            <div className="mt-2 inline-block rounded-2xl border-2 border-purple-300 bg-purple-200 px-4 py-1">
              <p className="text-base font-black uppercase text-purple-700">
                {profile?.role === 'ADMIN' && '⚙️ Admin'}
                {profile?.role === 'TEACHER' && '👨‍🏫 Teacher'}
                {profile?.role === 'LIBRARIAN' && '👩‍💼 Librarian'}
                {profile?.role === 'STUDENT' && '🎒 Student'}
                {!profile?.role && '📖 Reader'}
              </p>
            </div>
          </div>
          <SignOutButton />
        </div>
        <div className="mt-6">
          <DashboardNav userRole={profile?.role as 'ADMIN' | 'LIBRARIAN' | 'TEACHER' | 'STUDENT' | null} />
        </div>
      </header>

      <main className="page-transition mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
