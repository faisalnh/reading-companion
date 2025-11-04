import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "STUDENT") {
    redirect("/auth/signin");
  }

  // Get student data
  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      books: {
        include: { book: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      },
      achievements: {
        include: { achievement: true },
        orderBy: { earnedAt: "desc" },
        take: 3,
      },
      classes: {
        include: {
          class: {
            include: {
              books: {
                include: { book: true },
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

  // Get assigned books from classes
  const assignedBooks = student.classes.flatMap((cs) =>
    cs.class.books.map((cb) => cb.book)
  );

  // Calculate reading stats
  const totalBooksRead = student.books.filter((b) => b.completed).length;
  const booksInProgress = student.books.filter((b) => !b.completed).length;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">
          Welcome back, {session.user.name}!
        </h1>
        <p className="text-xl opacity-90">
          Ready for your next reading adventure?
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Points</p>
              <p className="text-3xl font-bold text-primary-600">{student.points}</p>
            </div>
            <div className="text-5xl">⭐</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Books Completed</p>
              <p className="text-3xl font-bold text-success-600">{totalBooksRead}</p>
            </div>
            <div className="text-5xl">📚</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-accent-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">In Progress</p>
              <p className="text-3xl font-bold text-accent-600">{booksInProgress}</p>
            </div>
            <div className="text-5xl">📖</div>
          </div>
        </div>
      </div>

      {/* Continue Reading Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Continue Reading
        </h2>
        {student.books.filter((b) => !b.completed).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {student.books
              .filter((b) => !b.completed)
              .map((studentBook) => (
                <div
                  key={studentBook.id}
                  className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <h3 className="font-semibold text-lg mb-2">
                    {studentBook.book.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    By {studentBook.book.author}
                  </p>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>
                        {studentBook.currentPage} / {studentBook.book.pageCount}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full"
                        style={{
                          width: `${
                            (studentBook.currentPage /
                              (studentBook.book.pageCount || 1)) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/student/reader/${studentBook.book.id}`}
                    className="block w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white text-center py-2 rounded-lg font-medium hover:shadow-md transition-all"
                  >
                    Continue Reading
                  </Link>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500">
            No books in progress. Start reading a new book!
          </p>
        )}
      </div>

      {/* Assigned Books */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Assigned Books
        </h2>
        {assignedBooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {assignedBooks.map((book) => (
              <div
                key={book.id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[3/4] bg-gradient-to-br from-primary-200 to-secondary-200 rounded-lg mb-3 flex items-center justify-center text-6xl">
                  📚
                </div>
                <h3 className="font-semibold mb-1 text-sm">{book.title}</h3>
                <p className="text-xs text-gray-600 mb-2">By {book.author}</p>
                <Link
                  href={`/dashboard/student/reader/${book.id}`}
                  className="block w-full bg-primary-600 text-white text-center py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Start Reading
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No books assigned yet.</p>
        )}
      </div>

      {/* Recent Achievements */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Recent Achievements
          </h2>
          <Link
            href="/dashboard/student/achievements"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            View All
          </Link>
        </div>
        {student.achievements.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {student.achievements.map((sa) => (
              <div
                key={sa.id}
                className="border rounded-lg p-4 text-center hover:shadow-lg transition-shadow"
              >
                <div className="text-6xl mb-2">🏆</div>
                <h3 className="font-semibold mb-1">
                  {sa.achievement.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {sa.achievement.description}
                </p>
                <p className="text-xs text-gray-500">
                  +{sa.achievement.points} points
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            No achievements yet. Keep reading to earn badges!
          </p>
        )}
      </div>
    </div>
  );
}
