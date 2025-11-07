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
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
      <div className="mb-6 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Welcome Back</h1>
        <p className="text-sm text-white/70">Sign in to access your Reading Buddy dashboard.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-white">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white outline-none transition focus:border-white"
            placeholder="name@school.org"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-white">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white outline-none transition focus:border-white"
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-white/90 px-4 py-2 font-semibold text-black transition hover:bg-white disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/30 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
        >
          {isGoogleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
};
