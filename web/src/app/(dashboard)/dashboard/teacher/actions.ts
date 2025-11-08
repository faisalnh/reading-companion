'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/roleCheck';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertCanManageClass } from '@/lib/classrooms/permissions';

const revalidateClassroom = (classId: number) => {
  revalidatePath('/dashboard/teacher');
  revalidatePath(`/dashboard/teacher/classrooms/${classId}`);
};

export const createClassroom = async (input: { name: string; teacherId?: string | null }) => {
  const { user, role } = await requireRole(['TEACHER', 'ADMIN']);
  const supabase = getSupabaseAdminClient();

  let teacher_id: string | null = null;
  if (role === 'TEACHER') {
    teacher_id = user.id;
  } else if (role === 'ADMIN') {
    teacher_id = input.teacherId ?? null;
  }

  if (!teacher_id) {
    throw new Error('A teacher must be assigned to the class.');
  }

  const { error } = await supabase.from('classes').insert({
    name: input.name,
    teacher_id,
  });

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/teacher');
};

export const addStudentToClass = async (input: { classId: number; studentId: string }) => {
  const { user, role } = await requireRole(['TEACHER', 'ADMIN']);
  const supabase = getSupabaseAdminClient();

  await assertCanManageClass(input.classId, user.id, role);

  const { error } = await supabase.from('class_students').insert({
    class_id: input.classId,
    student_id: input.studentId,
  });

  if (error) {
    throw error;
  }

  revalidateClassroom(input.classId);
};

export const removeStudentFromClass = async (input: { classId: number; studentId: string }) => {
  const { user, role } = await requireRole(['TEACHER', 'ADMIN']);
  const supabase = getSupabaseAdminClient();

  await assertCanManageClass(input.classId, user.id, role);

  const { error } = await supabase
    .from('class_students')
    .delete()
    .eq('class_id', input.classId)
    .eq('student_id', input.studentId);

  if (error) {
    throw error;
  }

  revalidateClassroom(input.classId);
};

export const assignBookToClass = async (input: { classId: number; bookId: number }) => {
  const { user, role } = await requireRole(['TEACHER', 'ADMIN']);
  const supabase = getSupabaseAdminClient();

  await assertCanManageClass(input.classId, user.id, role);

  const { error } = await supabase
    .from('class_books')
    .upsert({ class_id: input.classId, book_id: input.bookId }, { onConflict: 'class_id,book_id' });

  if (error) {
    throw error;
  }

  revalidateClassroom(input.classId);
};

export const removeBookFromClass = async (input: { classId: number; bookId: number }) => {
  const { user, role } = await requireRole(['TEACHER', 'ADMIN']);
  const supabase = getSupabaseAdminClient();

  await assertCanManageClass(input.classId, user.id, role);

  const { error } = await supabase
    .from('class_books')
    .delete()
    .eq('class_id', input.classId)
    .eq('book_id', input.bookId);

  if (error) {
    throw error;
  }

  revalidateClassroom(input.classId);
};
