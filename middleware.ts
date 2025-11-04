import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If user is authenticated and on auth pages, redirect to their dashboard
    if (token && (path === "/auth/signin" || path === "/auth/error")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // If user is on /dashboard, redirect to role-specific dashboard
    if (token && path === "/dashboard") {
      const role = token.role as string;
      switch (role) {
        case "STUDENT":
          return NextResponse.redirect(new URL("/dashboard/student", req.url));
        case "TEACHER":
          return NextResponse.redirect(new URL("/dashboard/teacher", req.url));
        case "LIBRARIAN":
          return NextResponse.redirect(new URL("/dashboard/librarian", req.url));
        case "ADMIN":
          return NextResponse.redirect(new URL("/dashboard/admin", req.url));
        default:
          return NextResponse.redirect(new URL("/auth/signin", req.url));
      }
    }

    // Check role-based access to dashboard routes
    if (token && path.startsWith("/dashboard/")) {
      const role = token.role as string;

      // Extract the role from the path (e.g., /dashboard/student -> student)
      const pathRole = path.split("/")[2]?.toUpperCase();

      // If trying to access a different role's dashboard, redirect to own dashboard
      if (pathRole && pathRole !== role) {
        switch (role) {
          case "STUDENT":
            return NextResponse.redirect(new URL("/dashboard/student", req.url));
          case "TEACHER":
            return NextResponse.redirect(new URL("/dashboard/teacher", req.url));
          case "LIBRARIAN":
            return NextResponse.redirect(new URL("/dashboard/librarian", req.url));
          case "ADMIN":
            return NextResponse.redirect(new URL("/dashboard/admin", req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages without token
        if (req.nextUrl.pathname.startsWith("/auth/")) {
          return true;
        }
        // Require token for dashboard routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
