'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Printer, Eye, EyeOff, Phone, Lock, User, BookOpen, Hash, Building } from 'lucide-react';

export default function StudentSignup() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', mobile: '', department: '', section: '', rollNumber: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/student/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      router.push('/student/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 pl-11 text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[var(--color-surface)]">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-emerald-900/10" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Qprint</span>
          </Link>
          <h2 className="text-2xl font-bold text-white">Student Registration</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Create your account to start printing</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          <div className="relative">
            <User className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="text" placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required />
          </div>

          <div className="relative">
            <Phone className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="tel" placeholder="10-digit Mobile Number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} maxLength={10} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Building className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
              <input type="text" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inputClass} required />
            </div>
            <div className="relative">
              <BookOpen className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
              <input type="text" placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={inputClass} required />
            </div>
          </div>

          <div className="relative">
            <Hash className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="text" placeholder="Roll Number" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} className={inputClass} required />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-[var(--color-text-muted)] hover:text-white">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type={showPassword ? 'text' : 'password'} placeholder="Confirm Password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className={inputClass} required />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-[var(--color-text-muted)]">
            Already have an account?{' '}
            <Link href="/student/login" className="text-[var(--color-primary-light)] hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
