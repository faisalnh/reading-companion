import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';

export default async function LibrarianDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  // Get all books and statistics
  const books = await db.book.findMany({
    include: {
      students: {
        include: {
          student: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Calculate stats
  const totalBooks = books.length;
  const totalReaders = new Set(books.flatMap((b) => b.students.map((sb) => sb.studentId)))
    .size;
  const totalAssignments = await db.classBook.count();
  const totalReads = books.reduce((sum, book) => sum + book.students.length, 0);

  // Get category distribution
  const categoryStats = books.reduce((acc, book) => {
    const category = book.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get most popular books
  const popularBooks = books
    .map((book) => ({
      ...book,
      readerCount: book.students.length,
    }))
    .sort((a, b) => b.readerCount - a.readerCount)
    .slice(0, 5);

  // Get recently added books
  const recentBooks = books.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 rounded-3xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">
          Welcome, {session.user.name?.split(' ')[0] || 'Librarian'}!
        </h1>
        <p className="text-xl opacity-90">
          Manage the school's digital library
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Books</p>
              <p className="text-3xl font-bold text-primary-600">{totalBooks}</p>
            </div>
            <div className="text-5xl">📚</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-secondary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Active Readers</p>
              <p className="text-3xl font-bold text-secondary-600">{totalReaders}</p>
            </div>
            <div className="text-5xl">👨‍🎓</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-accent-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Book Assignments</p>
              <p className="text-3xl font-bold text-accent-600">{totalAssignments}</p>
            </div>
            <div className="text-5xl">📖</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Reads</p>
              <p className="text-3xl font-bold text-success-600">{totalReads}</p>
            </div>
            <div className="text-5xl">📊</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>⚡</span> Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/dashboard/librarian/upload"
            className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📤</div>
            <p className="font-semibold">Upload Book</p>
          </Link>
          <Link
            href="/dashboard/librarian/books"
            className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📚</div>
            <p className="font-semibold">View Collection</p>
          </Link>
          <Link
            href="/dashboard/librarian/categories"
            className="bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🏷️</div>
            <p className="font-semibold">Manage Categories</p>
          </Link>
          <Link
            href="/dashboard/librarian"
            className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📊</div>
            <p className="font-semibold">View Analytics</p>
          </Link>
        </div>
      </div>

      {/* Popular Books */}
      {popularBooks.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>⭐</span> Most Popular Books
          </h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Title</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Author</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Category</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Readers</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {popularBooks.map((book, index) => (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          {index > 2 && <span className="text-gray-500 font-semibold">{index + 1}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-800">{book.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600">{book.author}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {book.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-secondary-600">{book.readerCount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600">{book.grade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Category Distribution */}
      {topCategories.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>🏷️</span> Category Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topCategories.map(([category, count]) => (
              <div key={category} className="bg-white rounded-xl p-6 shadow-lg text-center">
                <p className="text-3xl font-bold text-primary-600">{count}</p>
                <p className="text-gray-600 text-sm mt-2">{category}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Added Books */}
      {recentBooks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>📚</span> Recently Added
            </h2>
            <Link
              href="/dashboard/librarian/books"
              className="text-primary-600 hover:text-primary-700 font-semibold text-sm"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="h-48 bg-gradient-to-br from-primary-200 to-secondary-200 flex items-center justify-center">
                  <span className="text-6xl">📕</span>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{book.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">by {book.author}</p>
                  <p className="text-gray-500 text-xs mb-4 line-clamp-2">{book.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="bg-gray-100 px-3 py-1 rounded-full">{book.category}</span>
                    <span>{book.pageCount} pages</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalBooks === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No Books in Library</h3>
          <p className="text-gray-600 mb-6">Start building your digital library by uploading books!</p>
          <Link
            href="/dashboard/librarian/upload"
            className="inline-block bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-primary-600 hover:to-secondary-600 transition-all"
          >
            Upload First Book
          </Link>
        </div>
      )}
    </div>
  );
}
