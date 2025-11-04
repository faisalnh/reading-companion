"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  STUDENT: [
    { href: "/dashboard/student", label: "My Books", icon: "📚" },
    { href: "/dashboard/student/achievements", label: "Achievements", icon: "🏆" },
    { href: "/dashboard/student/progress", label: "My Progress", icon: "📊" },
  ],
  TEACHER: [
    { href: "/dashboard/teacher", label: "Dashboard", icon: "🏠" },
    { href: "/dashboard/teacher/classes", label: "My Classes", icon: "🎓" },
    { href: "/dashboard/teacher/students", label: "Students", icon: "👥" },
    { href: "/dashboard/teacher/library", label: "Library", icon: "📚" },
  ],
  LIBRARIAN: [
    { href: "/dashboard/librarian", label: "Dashboard", icon: "🏠" },
    { href: "/dashboard/librarian/books", label: "Manage Books", icon: "📚" },
    { href: "/dashboard/librarian/categories", label: "Categories", icon: "🗂️" },
    { href: "/dashboard/librarian/analytics", label: "Analytics", icon: "📊" },
  ],
  ADMIN: [
    { href: "/dashboard/admin", label: "Dashboard", icon: "🏠" },
    { href: "/dashboard/admin/users", label: "Users", icon: "👥" },
    { href: "/dashboard/admin/analytics", label: "Analytics", icon: "📊" },
    { href: "/dashboard/admin/settings", label: "Settings", icon: "⚙️" },
  ],
};

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session?.user) return null;

  const navItems = roleNavItems[session.user.role] || [];

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              📚 Reading Buddy
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex space-x-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{session.user.role.toLowerCase()}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded-lg font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-primary-600 to-secondary-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
