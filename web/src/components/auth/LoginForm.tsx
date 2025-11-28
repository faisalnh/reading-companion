"use client";

import { useState } from "react";
import { useSupabaseBrowser } from "@/components/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const LoginForm = () => {
  const supabase = useSupabaseBrowser();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const origin = window.location.origin;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            hd: "millennia21.id", // Restrict to millennia21.id workspace
          },
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="pop-in w-full max-w-md border-4 border-white/30 bg-white/90 shadow-2xl backdrop-blur">
      <CardHeader className="mb-2 space-y-2 text-center md:mb-4 md:space-y-3">
        <div className="text-5xl md:text-6xl">📚✨</div>
        <CardTitle className="text-3xl font-black text-purple-600 md:text-4xl">
          Welcome to Reading Buddy!
        </CardTitle>
        <CardDescription className="text-base font-semibold text-purple-500 md:text-lg">
          Sign in with your Millennia21 Google account
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-2xl border-4 border-red-300 bg-red-50 px-4 py-3">
            <p className="text-center text-sm font-bold text-red-600 md:text-base">
              ⚠️ {error}
            </p>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="btn-3d btn-squish min-h-[56px] w-full rounded-2xl border-4 border-blue-300 bg-white text-lg font-black text-blue-600 hover:bg-blue-50 active:scale-95 md:text-xl"
          variant="outline"
          size="lg"
        >
          {isGoogleLoading ? "🌟 Redirecting…" : "🎨 Sign In with Google"}
        </Button>

        <div className="rounded-2xl border-4 border-yellow-300 bg-yellow-50 px-4 py-3">
          <p className="text-center text-xs font-bold text-yellow-800 md:text-sm">
            🏫 Only @millennia21.id accounts are allowed
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
