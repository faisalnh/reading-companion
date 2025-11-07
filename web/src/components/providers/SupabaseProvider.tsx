'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createSupabaseBrowserClient, type SupabaseBrowserClient } from '@/lib/supabase/client';

const SupabaseContext = createContext<SupabaseBrowserClient | null>(null);

export const SupabaseProvider = ({ children }: { children: ReactNode }) => {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session }),
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>;
};

export const useSupabaseBrowser = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabaseBrowser must be used within SupabaseProvider');
  }
  return context;
};
