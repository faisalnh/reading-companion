import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Add user role and id to session
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Auto-create Student profile for new users
      if (account && profile) {
        const existingUser = await db.user.findUnique({
          where: { email: user.email! },
          include: { student: true, teacher: true, librarian: true, admin: true },
        });

        if (existingUser && !existingUser.student && !existingUser.teacher && !existingUser.librarian && !existingUser.admin) {
          // Create Student profile by default for new users
          await db.student.create({
            data: {
              userId: existingUser.id,
            },
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database",
  },
  debug: process.env.NODE_ENV === "development",
};
