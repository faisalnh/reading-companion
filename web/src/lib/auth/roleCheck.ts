import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type UserRole = 'ADMIN' | 'LIBRARIAN' | 'TEACHER' | 'STUDENT';

/**
 * Check if the current user has one of the required roles
 * Redirects to /dashboard with an error if unauthorized
 */
export type SessionUser = {
  id: string;
  email?: string;
};

export type RequireRoleResult = {
  user: SessionUser;
  role: UserRole;
};

export async function requireRole(allowedRoles: UserRole[]): Promise<RequireRoleResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = profile?.role as UserRole | undefined;

  if (!userRole || !allowedRoles.includes(userRole)) {
    // Redirect to dashboard with unauthorized message
    redirect('/dashboard?error=unauthorized');
  }

  return { user: { id: user.id, email: user.email ?? undefined }, role: userRole };
}
