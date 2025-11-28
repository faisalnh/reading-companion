'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="w-full max-w-md border border-white/10 bg-white/5 backdrop-blur">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold text-white">Choose a new password</CardTitle>
        <CardDescription className="text-sm text-white/70">
          You successfully verified your email.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-white">
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              className="border-white/20 bg-black/20 text-white placeholder:text-white/50 focus:border-white"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-white">
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              className="border-white/20 bg-black/20 text-white placeholder:text-white/50 focus:border-white"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {info ? <p className="text-sm text-green-200">{info}</p> : null}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white/90 font-semibold text-black hover:bg-white"
          >
            {isLoading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
