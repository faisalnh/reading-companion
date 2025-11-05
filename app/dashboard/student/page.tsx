import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';

export default async function StudentDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  // Get student profile with reading stats
  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      books: {
        include: {
          book: true,
        },
        orderBy: {
          startedAt: 'desc',
        },
      },
      achievements: {
        include: {
          achievement: true,
        },
        orderBy: {
          earnedAt: 'desc',
        },
        take: 3,
      },
      classes: {
        include: {
          class: {
            include: {
              books: {
                include: {
                  book: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!student) {
    return <div>Student profile not found</div>;
  }

  // Get all assigned books from classes
  const assignedBooks = student.classes.flatMap((cs) =>
    cs.class.books.map((cb) => cb.book)
  );

  // Filter out books already in reading list
  const readingBookIds = new Set(student.books.map((sb) => sb.bookId));
  const availableBooks = assignedBooks.filter((book) => !readingBookIds.has(book.id));

  // Calculate stats
  const completedBooks = student.books.filter((sb) => sb.completed).length;
  const inProgressBooks = student.books.filter((sb) => !sb.completed).length;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 rounded-3xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {session.user.name?.split(' ')[0] || 'Reader'}!</h1>
        <p className="text-xl opacity-90">Ready to continue your reading adventure?</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Points</p>
              <p className="text-3xl font-bold text-primary-600">{student.points}</p>
            </div>
            <div className="text-5xl">⭐</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-secondary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Books Completed</p>
              <p className="text-3xl font-bold text-secondary-600">{completedBooks}</p>
            </div>
            <div className="text-5xl">📖</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-accent-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Achievements</p>
              <p className="text-3xl font-bold text-accent-600">{student.achievements.length}</p>
            </div>
            <div className="text-5xl">🏆</div>
          </div>
        </div>
      </div>

      {/* Currently Reading */}
      {inProgressBooks > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📖</span> Currently Reading
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {student.books
              .filter((sb) => !sb.completed)
              .map((studentBook) => (
                <div
                  key={studentBook.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="h-48 bg-gradient-to-br from-primary-200 to-secondary-200 flex items-center justify-center">
                    <span className="text-6xl">📚</span>
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-gray-800 mb-2">{studentBook.book.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">by {studentBook.book.author}</p>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>
                          {studentBook.currentPage} / {studentBook.book.pageCount} pages
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full"
                          style={{
                            width: `${(studentBook.currentPage / (studentBook.book.pageCount || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/student/reader/${studentBook.bookId}`}
                      className="block w-full text-center bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-2 rounded-xl font-semibold hover:from-primary-600 hover:to-secondary-600 transition-all"
                    >
                      Continue Reading
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Available Books */}
      {availableBooks.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📚</span> Available Books
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableBooks.slice(0, 6).map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="h-48 bg-gradient-to-br from-accent-200 to-primary-200 flex items-center justify-center">
                  <span className="text-6xl">📕</span>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{book.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">by {book.author}</p>
                  <p className="text-gray-500 text-xs mb-4 line-clamp-2">{book.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span className="bg-gray-100 px-3 py-1 rounded-full">{book.category}</span>
                    <span>{book.pageCount} pages</span>
                  </div>
                  <Link
                    href={`/dashboard/student/reader/${book.id}`}
                    className="block w-full text-center bg-gradient-to-r from-accent-500 to-primary-500 text-white py-2 rounded-xl font-semibold hover:from-accent-600 hover:to-primary-600 transition-all"
                  >
                    Start Reading
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Achievements */}
      {student.achievements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>🏆</span> Recent Achievements
            </h2>
            <Link
              href="/dashboard/student/achievements"
              className="text-primary-600 hover:text-primary-700 font-semibold text-sm"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {student.achievements.slice(0, 3).map((sa) => (
              <div
                key={sa.id}
                className="bg-white rounded-2xl p-6 shadow-lg text-center hover:shadow-xl transition-shadow"
              >
                <div className="text-6xl mb-4">🏅</div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">{sa.achievement.name}</h3>
                <p className="text-gray-600 text-sm mb-2">{sa.achievement.description}</p>
                <div className="inline-block bg-accent-100 text-accent-700 px-4 py-1 rounded-full text-sm font-semibold">
                  +{sa.achievement.points} points
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {availableBooks.length === 0 && inProgressBooks === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No Books Yet</h3>
          <p className="text-gray-600">Your teacher will assign books to your class soon!</p>
        </div>
      )}
    </div>
  );
}
