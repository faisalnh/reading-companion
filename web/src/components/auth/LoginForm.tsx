'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseBrowser();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        throw signInError;
      }

      const redirectTarget = searchParams.get('redirectedFrom') ?? '/dashboard';
      router.replace(redirectTarget);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const origin = window.location.origin;
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="pop-in w-full max-w-md rounded-3xl border-4 border-white/30 bg-white/90 p-8 shadow-2xl backdrop-blur">
      <div className="mb-8 space-y-3 text-center">
        <div className="text-6xl">📚✨</div>
        <h1 className="text-4xl font-black text-purple-600">Welcome Back!</h1>
        <p className="text-lg font-semibold text-purple-500">Let's continue your reading adventure!</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-base font-bold text-purple-700">
            📧 Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-2xl border-4 border-purple-300 bg-white px-5 py-3 text-lg font-semibold text-purple-900 transition-all placeholder:text-purple-300"
            placeholder="your.email@school.org"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-base font-bold text-purple-700">
            🔒 Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-2xl border-4 border-purple-300 bg-white px-5 py-3 text-lg font-semibold text-purple-900 transition-all placeholder:text-purple-300"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border-4 border-red-300 bg-red-50 px-4 py-3">
            <p className="text-center text-base font-bold text-red-600">⚠️ {error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-3d btn-squish w-full rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4 text-xl font-black text-white transition hover:from-purple-600 hover:to-pink-600 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? '🎈 Signing in…' : '🚀 Let\'s Go!'}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-purple-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white/90 px-4 text-base font-bold text-purple-400">OR</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="btn-3d btn-squish flex w-full items-center justify-center gap-3 rounded-2xl border-4 border-blue-300 bg-white px-6 py-4 text-xl font-black text-blue-600 transition hover:bg-blue-50 disabled:pointer-events-none disabled:opacity-50"
        >
          {isGoogleLoading ? '🌟 Redirecting…' : '🎨 Continue with Google'}
        </button>
      </div>
    </div>
  );
};
