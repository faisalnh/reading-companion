import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminUserTable } from '@/components/dashboard/AdminUserTable';

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase.from('profiles').select('id, full_name, role').order('updated_at', {
    ascending: true,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Admin Control</h1>
        <p className="text-sm text-white/60">Manage user roles and ensure the right access for every adult.</p>
      </header>

      <AdminUserTable users={users ?? []} />
    </div>
  );
}
