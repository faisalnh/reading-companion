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
      <header className="pop-in rounded-3xl border-4 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-lg">
        <div className="mb-2 inline-block rounded-2xl border-4 border-cyan-300 bg-cyan-400 px-4 py-1">
          <p className="text-sm font-black uppercase tracking-wide text-cyan-900">📚 Book Collection</p>
        </div>
        <h1 className="text-3xl font-black text-blue-900">Library</h1>
        <p className="text-base font-semibold text-blue-700">Explore all the amazing books in Reading Buddy!</p>
      </header>

      {books?.length ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link key={book.id} href={`/dashboard/student/read/${book.id}`}>
              <li className="sticker-card cursor-pointer rounded-3xl border-4 border-purple-300 bg-white p-5 shadow-lg transition hover:border-pink-400 hover:shadow-2xl">
                <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl bg-purple-100 shadow-md">
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-purple-900">{book.title}</h2>
                  <p className="text-base font-bold text-purple-600">by {book.author}</p>
                  {book.description ? (
                    <p className="text-sm font-semibold text-purple-700 line-clamp-3">{book.description}</p>
                  ) : null}
                </div>
              </li>
            </Link>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border-4 border-dashed border-yellow-300 bg-yellow-50 p-8 text-center shadow-lg">
          <div className="mb-3 text-5xl">📚</div>
          <p className="text-lg font-bold text-yellow-700">
            No books yet! Librarians can add the first book from the Librarian dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
