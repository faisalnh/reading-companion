'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';

export const SignupForm = () => {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      setInfo('Check your inbox to confirm your email, then sign in.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign up.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const origin = window.location.origin;
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/auth/callback` },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-up failed.';
      setError(message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
      <div className="mb-6 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Create Account</h1>
        <p className="text-sm text-white/70">Join the Reading Buddy community.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium text-white">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white outline-none transition focus:border-white"
            placeholder="Ada Lovelace"
          />
        </div>

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
            minLength={8}
            required
            className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white outline-none transition focus:border-white"
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {info ? <p className="text-sm text-green-200">{info}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-white/90 px-4 py-2 font-semibold text-black transition hover:bg-white disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={isGoogleLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/30 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
        >
          {isGoogleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
};
