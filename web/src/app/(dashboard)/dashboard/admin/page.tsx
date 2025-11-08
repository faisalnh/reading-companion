import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminUserTable } from '@/components/dashboard/AdminUserTable';
import { requireRole } from '@/lib/auth/roleCheck';

export default async function AdminDashboardPage() {
  // Only ADMIN users can access this page
  await requireRole(['ADMIN']);

  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase.from('profiles').select('id, full_name, role').order('updated_at', {
    ascending: true,
  });

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border-4 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-lg">
        <div className="mb-2 inline-block rounded-2xl border-4 border-purple-300 bg-purple-400 px-4 py-1">
          <p className="text-sm font-black uppercase tracking-wide text-purple-900">⚙️ Admin Panel</p>
        </div>
        <h1 className="text-3xl font-black text-violet-900">Admin Control</h1>
        <p className="text-base font-semibold text-violet-700">Manage user roles and control access for everyone.</p>
      </header>

      <AdminUserTable users={users ?? []} />
    </div>
  );
}
