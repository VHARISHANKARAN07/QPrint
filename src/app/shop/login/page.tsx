'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Printer, Eye, EyeOff, Lock, User } from 'lucide-react';

export default function ShopLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/shop/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/shop/dashboard');
    } catch { setError('Network error. Please try again.'); } finally { setLoading(false); }
  };

  const inputClass = "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 pl-11 text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[var(--color-surface)]">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-transparent to-teal-900/10" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Qprint</span>
          </Link>
          <h2 className="text-2xl font-bold text-white">Shop Handler Login</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Xerox Shop Management Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
          <div className="relative">
            <User className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="text" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} required autoComplete="username" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} required autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-[var(--color-text-muted)] hover:text-white">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            ⚠️ Credentials are case-sensitive. Enter username and password exactly as provided.
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            {loading ? 'Logging in...' : 'Login to Shop Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
