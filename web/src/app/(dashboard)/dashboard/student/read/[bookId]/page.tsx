import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BookReader } from '@/components/dashboard/BookReader';

type PageProps = {
  params: { bookId: string };
};

export default async function StudentReadPage({ params }: PageProps) {
  const awaitedParams = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const bookId = Number(awaitedParams.bookId);
  if (Number.isNaN(bookId)) {
    notFound();
  }

  const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
  if (!book) {
    notFound();
  }

  const { data: progress } = await supabase
    .from('student_books')
    .select('current_page')
    .eq('student_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border-4 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-lg">
        <div className="mb-2 inline-block rounded-2xl border-4 border-cyan-300 bg-cyan-400 px-4 py-1">
          <p className="text-sm font-black uppercase tracking-wide text-cyan-900">📖 Now Reading</p>
        </div>
        <h1 className="text-4xl font-black text-blue-900">{book.title}</h1>
        <p className="mt-2 text-xl font-bold text-blue-700">by {book.author}</p>
      </div>
      <BookReader
        bookId={book.id}
        pdfUrl={book.pdf_url}
        initialPage={progress?.current_page ?? 1}
        expectedPages={book.page_count}
      />
    </div>
  );
}
