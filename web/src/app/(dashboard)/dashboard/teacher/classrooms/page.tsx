import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/roleCheck';
import { ClassroomManager } from '@/components/dashboard/ClassroomManager';

export default async function ClassroomManagementPage() {
  const { user, role } = await requireRole(['TEACHER', 'ADMIN']);

  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = getSupabaseAdminClient();

  let query = supabaseAdmin.from('classes').select('id, name');

  if (role === 'TEACHER') {
    query = query.eq('teacher_id', user.id);
  }

  const { data: classroomsData, error: classroomsError } = await query;

  if (classroomsError) {
    console.error(classroomsError);
    // Handle error appropriately
  }

  const classrooms =
    classroomsData
      ? await Promise.all(
        classroomsData.map(async (c) => {
          const { count } = await supabaseAdmin
            .from('class_students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', c.id);

          return {
            id: c.id,
            name: c.name,
            student_count: count ?? 0,
          };
        }),
      )
      : [];

  const { data: allTeachersData, error: allTeachersError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'TEACHER');

  if (allTeachersError) {
    console.error(allTeachersError);
    // Handle error appropriately
  }

  const allTeachers =
    allTeachersData?.map((t) => ({
      id: t.id,
      full_name: t.full_name ?? '',
    })) ?? [];

  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_25px_70px_rgba(93,80,255,0.18)]">
        <div className="mb-3 inline-flex items-center gap-3 rounded-full bg-indigo-100/80 px-4 py-2">
          <span className="text-lg">🧑‍🏫</span>
          <p className="text-sm font-black uppercase tracking-wide text-indigo-600">Classrooms</p>
        </div>
        <h1 className="text-3xl font-black text-indigo-950">Classroom Management</h1>
        <p className="text-base font-semibold text-indigo-500">Create classes, then jump in to manage each one.</p>
      </header>

      <ClassroomManager classrooms={classrooms} allTeachers={allTeachers} userRole={role} />
    </div>
  );
}
