'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const updateUserRole = async (input: { userId: string; role: 'STUDENT' | 'TEACHER' | 'LIBRARIAN' | 'ADMIN' }) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in to update roles.');
  }

  const { error } = await supabase.from('profiles').update({ role: input.role }).eq('id', input.userId);

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/admin');
};
