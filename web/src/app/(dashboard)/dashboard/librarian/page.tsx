import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BookUploadForm } from '@/components/dashboard/BookUploadForm';
import { QuizGenerator } from '@/components/dashboard/QuizGenerator';
import { RoleChecker } from '@/components/dashboard/RoleChecker';

export default async function LibrarianPage() {
  const supabase = await createSupabaseServerClient();
  const { data: books } = await supabase
    .from('books')
    .select('id, title, description')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <RoleChecker />
      <BookUploadForm />
      <QuizGenerator books={books ?? []} />
      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Next steps</h2>
        <p className="mt-2">
          Uploaded books will appear in the shared library once they are saved in Supabase. From there, students can start
          reading and teachers can assign them to classes.
        </p>
      </section>
    </div>
  );
}
