import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "TEACHER") {
    redirect("/auth/signin");
  }

  // Get teacher data
  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      classes: {
        include: {
          students: {
            include: {
              student: {
                include: {
                  user: true,
                  books: {
                    where: { completed: true },
                  },
                },
              },
            },
          },
          books: {
            include: { book: true },
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
    (sum, c) => sum + c.students.length,
    0
  );
  const totalAssignedBooks = teacher.classes.reduce(
    (sum, c) => sum + c.books.length,
    0
  );

  // Get recent student activity
  const allStudents = teacher.classes.flatMap((c) =>
    c.students.map((cs) => cs.student)
  );
  const topReaders = allStudents
    .sort((a, b) => b.books.length - a.books.length)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">
          Welcome, {session.user.name}!
        </h1>
        <p className="text-xl opacity-90">
          Track your students' reading progress and manage your classes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Classes</p>
              <p className="text-3xl font-bold text-primary-600">
                {totalClasses}
              </p>
            </div>
            <div className="text-5xl">🎓</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Students</p>
              <p className="text-3xl font-bold text-success-600">
                {totalStudents}
              </p>
            </div>
            <div className="text-5xl">👥</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-accent-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">
                Assigned Books
              </p>
              <p className="text-3xl font-bold text-accent-600">
                {totalAssignedBooks}
              </p>
            </div>
            <div className="text-5xl">📚</div>
          </div>
        </div>
      </div>

      {/* Classes Overview */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">My Classes</h2>
          <Link
            href="/dashboard/teacher/classes"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            View All
          </Link>
        </div>
        {teacher.classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacher.classes.map((classItem) => (
              <div
                key={classItem.id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <h3 className="font-semibold text-lg mb-2">
                  {classItem.name}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  Grade: {classItem.grade}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  {classItem.students.length} students
                </p>
                <Link
                  href={`/dashboard/teacher/classes/${classItem.id}`}
                  className="block w-full bg-primary-600 text-white text-center py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  View Class
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">You haven't created any classes yet.</p>
            <Link
              href="/dashboard/teacher/classes/new"
              className="inline-block bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all"
            >
              Create Your First Class
            </Link>
          </div>
        )}
      </div>

      {/* Top Readers */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Top Readers</h2>
          <Link
            href="/dashboard/teacher/students"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            View All Students
          </Link>
        </div>
        {topReaders.length > 0 ? (
          <div className="space-y-3">
            {topReaders.map((student, index) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{student.user.name}</p>
                    <p className="text-sm text-gray-600">
                      Grade: {student.grade}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary-600">
                    {student.books.length}
                  </p>
                  <p className="text-xs text-gray-600">books completed</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            No student reading data available yet.
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/teacher/classes/new"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="text-4xl mr-4">➕</div>
            <div>
              <p className="font-semibold text-gray-800 group-hover:text-primary-600">
                Create New Class
              </p>
              <p className="text-sm text-gray-600">
                Set up a new class for your students
              </p>
            </div>
          </Link>
          <Link
            href="/dashboard/teacher/library"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="text-4xl mr-4">📚</div>
            <div>
              <p className="font-semibold text-gray-800 group-hover:text-primary-600">
                Browse Library
              </p>
              <p className="text-sm text-gray-600">
                Assign books to your classes
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
