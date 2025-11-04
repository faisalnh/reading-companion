import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  // Get comprehensive school-wide statistics
  const [
    totalStudents,
    totalTeachers,
    totalLibrarians,
    totalBooks,
    totalClasses,
    completedBooks,
    totalQuizAttempts,
    totalAchievements,
  ] = await Promise.all([
    db.student.count(),
    db.teacher.count(),
    db.librarian.count(),
    db.book.count(),
    db.class.count(),
    db.studentBook.count({ where: { completed: true } }),
    db.quizAttempt.count(),
    db.studentAchievement.count(),
  ]);

  // Get active readers (students who have started at least one book)
  const activeReaders = await db.student.count({
    where: {
      studentBooks: {
        some: {},
      },
    },
  });

  // Get recent activities
  const recentCompletions = await db.studentBook.findMany({
    where: {
      completed: true,
      completedAt: { not: null },
    },
    include: {
      student: {
        include: {
          user: true,
        },
      },
      book: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
    take: 5,
  });

  // Get top students
  const topStudents = await db.student.findMany({
    include: {
      user: true,
      studentBooks: {
        where: { completed: true },
      },
    },
    orderBy: {
      points: 'desc',
    },
    take: 5,
  });

  // Get class distribution
  const classGrades = await db.class.groupBy({
    by: ['grade'],
    _count: {
      grade: true,
    },
  });

  // Get book category distribution
  const bookCategories = await db.book.groupBy({
    by: ['category'],
    _count: {
      category: true,
    },
  });

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 rounded-3xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">
          Admin Dashboard
        </h1>
        <p className="text-xl opacity-90">
          School-wide analytics and management
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Students</p>
              <p className="text-3xl font-bold text-primary-600">{totalStudents}</p>
              <p className="text-xs text-gray-500 mt-1">{activeReaders} active readers</p>
            </div>
            <div className="text-5xl">👨‍🎓</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-secondary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Teachers</p>
              <p className="text-3xl font-bold text-secondary-600">{totalTeachers}</p>
              <p className="text-xs text-gray-500 mt-1">{totalClasses} classes total</p>
            </div>
            <div className="text-5xl">👨‍🏫</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-accent-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Books in Library</p>
              <p className="text-3xl font-bold text-accent-600">{totalBooks}</p>
              <p className="text-xs text-gray-500 mt-1">{bookCategories.length} categories</p>
            </div>
            <div className="text-5xl">📚</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Books Completed</p>
              <p className="text-3xl font-bold text-success-600">{completedBooks}</p>
              <p className="text-xs text-gray-500 mt-1">{totalQuizAttempts} quiz attempts</p>
            </div>
            <div className="text-5xl">✅</div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Librarians</p>
              <p className="text-3xl font-bold text-gray-800">{totalLibrarians}</p>
            </div>
            <div className="text-4xl">📖</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Classes</p>
              <p className="text-3xl font-bold text-gray-800">{totalClasses}</p>
            </div>
            <div className="text-4xl">🏫</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Achievements Earned</p>
              <p className="text-3xl font-bold text-gray-800">{totalAchievements}</p>
            </div>
            <div className="text-4xl">🏆</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Students */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>⭐</span> Top Students
          </h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {topStudents.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {topStudents.map((student, index) => (
                  <div key={student.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && <span className="text-gray-500 font-semibold">{index + 1}</span>}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{student.user.name}</p>
                        <p className="text-sm text-gray-500">
                          {student.studentBooks.length} books completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-600">{student.points}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No student data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Completions */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📖</span> Recent Completions
          </h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {recentCompletions.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentCompletions.map((completion) => (
                  <div key={completion.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{completion.student.user.name}</p>
                        <p className="text-sm text-gray-600 mt-1">{completion.book.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {completion.completedAt && new Date(completion.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-2xl">✅</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No completions yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grade Distribution */}
      {classGrades.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📊</span> Class Distribution by Grade
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {classGrades.map((gradeData) => (
              <div key={gradeData.grade} className="bg-white rounded-xl p-6 shadow-lg text-center">
                <p className="text-3xl font-bold text-primary-600">{gradeData._count.grade}</p>
                <p className="text-gray-600 text-sm mt-2">Grade {gradeData.grade}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>⚡</span> Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/admin/users"
            className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">👥</div>
            <p className="font-semibold">Manage Users</p>
          </Link>
          <Link
            href="/dashboard/admin/analytics"
            className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📈</div>
            <p className="font-semibold">View Analytics</p>
          </Link>
          <Link
            href="/dashboard/admin/reports"
            className="bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📄</div>
            <p className="font-semibold">Generate Reports</p>
          </Link>
          <Link
            href="/dashboard/admin/settings"
            className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group text-white"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">⚙️</div>
            <p className="font-semibold">System Settings</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
