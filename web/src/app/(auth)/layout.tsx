import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1e1f4b,_#0c0d24)] px-4 py-12 text-white">
      {children}
    </div>
  );
}
