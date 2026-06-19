'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/orgs/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: fd.get('orgName'),
        email: fd.get('email'),
        password: fd.get('password'),
        name: fd.get('name'),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Registration failed');
    } else {
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-white">Create Organisation</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'orgName', label: 'Organisation name', type: 'text' },
            { name: 'name', label: 'Your name', type: 'text' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'password', label: 'Password (min 8 chars)', type: 'password' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
              <input
                name={f.name}
                type={f.type}
                required
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
      </div>
    </div>
  );
}
