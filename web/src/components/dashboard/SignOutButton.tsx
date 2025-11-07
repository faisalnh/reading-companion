'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseBrowser } from '@/components/providers/SupabaseProvider';

export const SignOutButton = () => {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
    >
      {isLoading ? 'Signing out…' : 'Sign out'}
    </button>
  );
};
