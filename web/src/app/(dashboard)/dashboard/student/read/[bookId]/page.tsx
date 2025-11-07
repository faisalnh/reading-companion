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
      <div>
        <p className="text-sm uppercase tracking-wide text-white/60">Reading</p>
        <h1 className="text-3xl font-semibold text-white">{book.title}</h1>
        <p className="text-white/70">{book.author}</p>
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
