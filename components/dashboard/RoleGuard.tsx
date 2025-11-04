import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export default async function RoleGuard({
  allowedRoles,
  children,
}: RoleGuardProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!allowedRoles.includes(session.user.role)) {
    // Redirect to correct dashboard for user's role
    const userRole = session.user.role.toLowerCase();
    redirect(`/dashboard/${userRole}`);
  }

  return <>{children}</>;
}
