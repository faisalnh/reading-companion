import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  // Get teacher profile with classes and students
  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      classes: {
        include: {
          classStudents: {
            include: {
              student: {
                include: {
                  user: true,
                  studentBooks: {
                    where: {
                      completed: true,
                    },
                  },
                },
              },
            },
          },
          classBooks: {
            include: {
              book: true,
            },
          },
        },
      },
    },
  });

  if (!teacher) {
    return <div>Teacher profile not found</div>;
  }

  // Calculate stats
  const totalClasses = teacher.classes.length;
  const totalStudents = teacher.classes.reduce(
    (sum, cls) => sum + cls.classStudents.length,
    0
  );
  const totalBooksAssigned = teacher.classes.reduce(
    (sum, cls) => sum + cls.classBooks.length,
    0
  );

  // Get recent activity (students who completed books recently)
  const recentActivity = teacher.classes
    .flatMap((cls) =>
      cls.classStudents.map((cs) => ({
        studentName: cs.student.user.name || 'Unknown',
        booksCompleted: cs.student.studentBooks.length,
        points: cs.student.points,
        className: cls.name,
      }))
    )
    .filter((activity) => activity.booksCompleted > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 rounded-3xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">
          Welcome, {session.user.name?.split(' ')[0] || 'Teacher'}!
        </h1>
        <p className="text-xl opacity-90">
          Manage your classes and track student progress
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Classes</p>
              <p className="text-3xl font-bold text-primary-600">{totalClasses}</p>
            </div>
            <div className="text-5xl">🏫</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-secondary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Students</p>
              <p className="text-3xl font-bold text-secondary-600">{totalStudents}</p>
            </div>
            <div className="text-5xl">👨‍🎓</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-accent-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Books Assigned</p>
              <p className="text-3xl font-bold text-accent-600">{totalBooksAssigned}</p>
            </div>
            <div className="text-5xl">📚</div>
          </div>
        </div>
      </div>

      {/* My Classes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>🏫</span> My Classes
          </h2>
          <Link
            href="/dashboard/teacher/classes"
            className="text-primary-600 hover:text-primary-700 font-semibold text-sm"
          >
            View All →
          </Link>
        </div>

        {teacher.classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teacher.classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/dashboard/teacher/classes/${cls.id}`}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 mb-1">{cls.name}</h3>
                    <p className="text-sm text-gray-500">Grade {cls.grade}</p>
                  </div>
                  <div className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-semibold">
                    {cls.classStudents.length} students
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Assigned Books</span>
                    <span className="font-semibold text-gray-800">{cls.classBooks.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Active Readers</span>
                    <span className="font-semibold text-gray-800">
                      {cls.classStudents.filter((cs) => cs.student.studentBooks.length > 0).length}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <button className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-2 rounded-xl font-semibold hover:from-primary-600 hover:to-secondary-600 transition-all">
                    View Class
                  </button>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
            <div className="text-6xl mb-4">🏫</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No Classes Yet</h3>
            <p className="text-gray-600 mb-6">Create your first class to get started!</p>
            <Link
              href="/dashboard/teacher/classes"
              className="inline-block bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-primary-600 hover:to-secondary-600 transition-all"
            >
              Create Class
            </Link>
          </div>
        )}
      </div>

      {/* Top Readers */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>⭐</span> Top Readers
          </h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Student</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Class</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Books Completed</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentActivity.map((activity, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          {index > 2 && <span className="text-gray-500 font-semibold">{index + 1}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-800">{activity.studentName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{activity.className}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-800">{activity.booksCompleted}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-primary-600">{activity.points}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            href="/dashboard/teacher/classes"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">➕</div>
            <p className="font-semibold text-gray-800">Create Class</p>
          </Link>
          <Link
            href="/dashboard/teacher/books"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📖</div>
            <p className="font-semibold text-gray-800">Assign Books</p>
          </Link>
          <Link
            href="/dashboard/teacher/students"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">👨‍🎓</div>
            <p className="font-semibold text-gray-800">View Students</p>
          </Link>
          <Link
            href="/dashboard/teacher"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center group"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📊</div>
            <p className="font-semibold text-gray-800">View Reports</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
