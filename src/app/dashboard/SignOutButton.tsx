'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
    >
      Sign out
    </button>
  );
}
