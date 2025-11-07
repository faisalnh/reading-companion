'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const submitQuizAttempt = async (input: { quizId: number; answers: number[]; score: number }) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in to submit a quiz.');
  }

  const { error } = await supabase.from('quiz_attempts').insert({
    quiz_id: input.quizId,
    student_id: user.id,
    answers: input.answers,
    score: input.score,
  });

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/student');
};
