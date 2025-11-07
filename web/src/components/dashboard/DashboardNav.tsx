'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/library', label: 'Library' },
  { href: '/dashboard/librarian', label: 'Librarian' },
  { href: '/dashboard/student', label: 'Student' },
  { href: '/dashboard/teacher', label: 'Teacher' },
  { href: '/dashboard/admin', label: 'Admin' },
];

export const DashboardNav = () => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {navLinks.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};
