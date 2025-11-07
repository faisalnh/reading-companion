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
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm text-white">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((user) => (
              <tr key={user.id} className="bg-white/5">
                <td className="px-4 py-3">{user.full_name ?? 'No name'}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-white/20 bg-black/20 px-3 py-1 text-white outline-none focus:border-white/40"
                    defaultValue={user.role}
                    onChange={(event) => handleChangeRole(user.id, event.target.value as UserRecord['role'])}
                    disabled={pendingId === user.id}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role} className="bg-slate-900 text-white">
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
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
};
