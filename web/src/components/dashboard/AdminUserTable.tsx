'use client';

import { useState } from 'react';
import { updateUserRole } from '@/app/(dashboard)/dashboard/admin/actions';

type UserRecord = {
  id: string;
  full_name: string | null;
  role: 'STUDENT' | 'TEACHER' | 'LIBRARIAN' | 'ADMIN';
};

const ROLES: UserRecord['role'][] = ['STUDENT', 'TEACHER', 'LIBRARIAN', 'ADMIN'];

export const AdminUserTable = ({ users }: { users: UserRecord[] }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangeRole = async (userId: string, role: UserRecord['role']) => {
    setPendingId(userId);
    setMessage(null);
    setError(null);
    try {
      await updateUserRole({ userId, role });
      setMessage('Role updated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update role.';
      setError(msg);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-[32px] border border-white/60 bg-white/85 p-6 text-indigo-950 shadow-[0_20px_60px_rgba(147,118,255,0.18)] backdrop-blur-xl">
      <div className="overflow-x-auto rounded-3xl border border-white/70 bg-white/75 shadow-inner">
        <table className="min-w-full divide-y divide-indigo-50 text-sm text-indigo-900">
          <thead className="bg-gradient-to-r from-violet-50 to-pink-50 text-xs uppercase tracking-wide text-indigo-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50">
            {users.map((user) => (
              <tr key={user.id} className="bg-transparent hover:bg-indigo-50/60">
                <td className="px-4 py-3 font-semibold">{user.full_name ?? 'No name'}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-full border border-indigo-200 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    defaultValue={user.role}
                    onChange={(event) => handleChangeRole(user.id, event.target.value as UserRecord['role'])}
                    disabled={pendingId === user.id}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role} className="bg-white text-indigo-900">
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className="text-sm font-semibold text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-rose-500">{error}</p> : null}
    </div>
  );
};
