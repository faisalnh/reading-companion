import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Redirect authenticated users to their dashboard
  if (session?.user) {
    const role = session.user.role.toLowerCase();
    redirect(`/dashboard/${role}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 via-secondary-400 to-accent-400">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4 animate-bounce-slow">
          📚 Reading Buddy
        </h1>
        <p className="text-2xl text-white mb-8">
          Your fun e-library adventure starts here!
        </p>
        <div className="space-x-4">
          <Link
            href="/auth/signin"
            className="inline-block bg-white text-primary-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-primary-50 transition-all hover:scale-105"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
