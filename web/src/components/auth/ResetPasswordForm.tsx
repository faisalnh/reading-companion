'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';

export const ResetPasswordForm = () => {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setInfo('Password updated. Redirecting to dashboard…');
      setTimeout(() => router.replace('/dashboard'), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reset password.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
      <div className="mb-6 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Choose a new password</h1>
        <p className="text-sm text-white/70">You successfully verified your email.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-white">
            New password
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

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-white">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
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
          {isLoading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
};
