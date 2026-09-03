'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Sign in to GeoLock</h1>
        <p className="mb-6 text-sm text-slate-500">Access your verification dashboard</p>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="label">Email</label>
        <input
          className="input mb-4"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="label">Password</label>
        <input
          className="input mb-6"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          No account?{' '}
          <Link href="/register" className="text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
