'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationName, name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Unable to create account');
      setLoading(false);
      return;
    }

    const signInRes = await signIn('credentials', { redirect: false, email, password });
    setLoading(false);
    if (signInRes?.error) {
      router.push('/login');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Create your GeoLock account</h1>
        <p className="mb-6 text-sm text-slate-500">This creates your organization and an owner account.</p>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="label">Organization name</label>
        <input
          className="input mb-4"
          required
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
        />
        <label className="label">Your name</label>
        <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">Email</label>
        <input
          className="input mb-4"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="label">Password (min. 10 characters)</label>
        <input
          className="input mb-6"
          type="password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
