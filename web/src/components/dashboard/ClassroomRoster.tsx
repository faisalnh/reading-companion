'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { addStudentToClass, removeStudentFromClass } from '@/app/(dashboard)/dashboard/teacher/actions';

type Student = {
  id: string;
  full_name: string;
};

type ClassroomRosterProps = {
  classId: number;
  students: Student[];
  allStudents: Student[];
  onRosterChange?: () => Promise<void> | void;
};

export const ClassroomRoster = ({ classId, students, allStudents, onRosterChange }: ClassroomRosterProps) => {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const triggerRefresh = async () => {
    if (onRosterChange) {
      await onRosterChange();
    } else {
      router.refresh();
    }
  };

  const handleAddStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsAdding(true);

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const studentName = String(formData.get('studentName') ?? '').trim();
    const selectedStudent = availableStudents.find(student => (student.full_name ?? '').toLowerCase() === studentName.toLowerCase());
    const studentId = selectedStudent?.id ?? '';

    if (!studentId) {
      setError('Please select a student to add.');
      setIsAdding(false);
      return;
    }

    try {
      await addStudentToClass({ classId, studentId });
      formElement.reset();
      await triggerRefresh();
      setIsFormOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to add student.';
      setError(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      await removeStudentFromClass({ classId, studentId });
      await triggerRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to remove student.';
      setError(message);
    }
  };

  const availableStudents = allStudents.filter(s => !students.some(cs => cs.id === s.id));
  const datalistId = `roster-students-${classId}`;

  useEffect(() => {
    if (availableStudents.length === 0 && isFormOpen) {
      setIsFormOpen(false);
    }
  }, [availableStudents.length, isFormOpen]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-indigo-100 bg-white/95 p-6 shadow-[0_25px_65px_rgba(79,70,229,0.18)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-black text-indigo-900">Class Roster</h3>
            <p className="text-sm font-medium text-indigo-500">Current explorers in this class.</p>
          </div>
          <button
            type="button"
            onClick={() => availableStudents.length > 0 && setIsFormOpen((value) => !value)}
            disabled={availableStudents.length === 0}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-[0_12px_30px_rgba(16,185,129,0.4)] transition hover:shadow-[0_16px_35px_rgba(16,185,129,0.45)] disabled:opacity-40"
            aria-label="Add student to roster"
          >
            +
          </button>
        </div>
        {isFormOpen && (
          <form onSubmit={handleAddStudent} className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              name="studentName"
              list={datalistId}
              required
              placeholder={
                availableStudents.length === 0 ? 'No available students' : 'Start typing a name...'
              }
              className="w-full rounded-2xl border border-teal-200 bg-white/90 px-4 py-3 text-slate-900 shadow-[0_12px_30px_rgba(94,234,212,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:opacity-50"
              disabled={availableStudents.length === 0}
            />
            <datalist id={datalistId}>
              {availableStudents.map(student => (
                <option key={student.id} value={student.full_name ?? ''} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={isAdding || availableStudents.length === 0}
              className="rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 px-6 py-3 font-semibold text-white shadow-[0_15px_35px_rgba(16,185,129,0.4)] transition hover:shadow-[0_20px_40px_rgba(16,185,129,0.5)] disabled:opacity-50"
            >
              {isAdding ? 'Adding...' : 'Add Student'}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}
        <div className="mt-4 space-y-4">
          {students.map(student => (
            <div
              key={student.id}
              className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-[0_16px_40px_rgba(79,70,229,0.18)] md:flex-row md:items-center md:justify-between"
            >
              <p className="text-base font-semibold text-indigo-900">{student.full_name}</p>
              <button
                onClick={() => handleRemoveStudent(student.id)}
                className="rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(244,114,182,0.35)] transition hover:shadow-[0_14px_32px_rgba(244,114,182,0.45)]"
              >
                Remove
              </button>
            </div>
          ))}
          {students.length === 0 && (
            <p className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 p-6 text-center text-indigo-400">
              This class has no students yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
