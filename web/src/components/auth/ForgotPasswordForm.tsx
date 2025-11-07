'use client';

import { useState, type FormEvent } from 'react';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';

export const ForgotPasswordForm = () => {
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
    const email = String(formData.get('email') ?? '').trim();

    try {
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?type=recovery`,
      });

      if (resetError) {
        throw resetError;
      }

      setInfo('If that email exists, a reset link is on its way.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send reset link.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
      <div className="mb-6 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Reset password</h1>
        <p className="text-sm text-white/70">Enter your email to receive a secure reset link.</p>
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

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {info ? <p className="text-sm text-green-200">{info}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-white/90 px-4 py-2 font-semibold text-black transition hover:bg-white disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </div>
  );
};
