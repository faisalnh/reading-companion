import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: books, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Library</h1>
        <p className="text-sm text-slate-400">Books available to every student in Reading Buddy.</p>
      </header>

      {books?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link key={book.id} href={`/dashboard/student/read/${book.id}`}>
              <li className="cursor-pointer rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 transition-colors hover:border-slate-700/80 hover:bg-slate-900/60">
                <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl bg-slate-900">
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">{book.title}</h2>
                  <p className="text-sm text-slate-400">{book.author}</p>
                  {book.description ? (
                    <p className="text-sm text-slate-300 line-clamp-3">{book.description}</p>
                  ) : null}
                </div>
              </li>
            </Link>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-950/20 p-8 text-center text-slate-400">
          No books yet. Librarians can add the first title from the Librarian dashboard.
        </div>
      )}
    </div>
  );
}
