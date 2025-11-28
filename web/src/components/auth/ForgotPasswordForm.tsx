'use client';

import { useState, type FormEvent } from 'react';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="w-full max-w-md border border-white/10 bg-white/5 backdrop-blur">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold text-white">Reset password</CardTitle>
        <CardDescription className="text-sm text-white/70">
          Enter your email to receive a secure reset link.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-white">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="border-white/20 bg-black/20 text-white placeholder:text-white/50 focus:border-white"
              placeholder="name@school.org"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {info ? <p className="text-sm text-green-200">{info}</p> : null}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white/90 font-semibold text-black hover:bg-white"
          >
            {isLoading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
