'use client';

import Link from 'next/link';
import { Printer, Users, ShieldCheck, Clock, Zap, ArrowRight, Smartphone, FileText, CreditCard, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-[var(--color-surface)] to-emerald-900/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-3xl" />

        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Qprint</h1>
              <p className="text-[10px] text-[var(--color-text-muted)] -mt-0.5">By HEMALESH</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/student/login" className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors">
              Student Login
            </Link>
            <Link href="/teacher/login" className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors">
              Teacher Login
            </Link>
            <Link href="/shop/login" className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all">
              Shop Handler
            </Link>
          </div>
        </nav>

        <div className={`relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm mb-8">
            <Zap className="w-4 h-4" />
            Real-Time College Printing Management
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Skip the Queue,<br />
            <span className="gradient-text">Print Smarter</span>
          </h2>

          <p className="text-lg md:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto mb-10">
            Place printing orders remotely, pay online, track your order in real-time,
            and collect your print when it&apos;s ready. No more waiting in line.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/student/signup"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white rounded-2xl hover:shadow-xl hover:shadow-purple-500/25 transition-all hover:scale-[1.02]"
            >
              Get Started as Student
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/teacher/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold bg-[var(--color-surface-card)] text-white border border-[var(--color-border)] rounded-2xl hover:bg-[var(--color-surface-hover)] transition-all"
            >
              Teacher / Staff Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">How Qprint Works</h3>
            <p className="text-[var(--color-text-muted)] text-lg">Simple, fast, and transparent printing workflow</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: <Smartphone className="w-7 h-7" />,
                title: 'Place Order',
                desc: 'Enter your page count and see the price instantly. No surprises.',
                color: 'from-purple-500 to-indigo-500',
              },
              {
                icon: <CreditCard className="w-7 h-7" />,
                title: 'Pay Online',
                desc: 'Scan the shop QR code, pay the exact amount, and submit proof.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: <Clock className="w-7 h-7" />,
                title: 'Track in Real-Time',
                desc: 'Watch your queue position and estimated time update live.',
                color: 'from-emerald-500 to-teal-500',
              },
              {
                icon: <Bell className="w-7 h-7" />,
                title: 'Collect When Ready',
                desc: 'Get notified the moment your print is ready for pickup.',
                color: 'from-amber-500 to-orange-500',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-border)] hover:border-purple-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/5"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Everyone Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-transparent to-purple-900/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Users className="w-8 h-8" />,
                title: 'Students',
                desc: 'Place print orders from anywhere on campus. Track your queue position in real-time and come only when ready.',
                link: '/student/signup',
                btnText: 'Student Sign Up',
                color: 'border-purple-500/30 hover:border-purple-500/60',
                btnColor: 'bg-purple-600 hover:bg-purple-500',
              },
              {
                icon: <FileText className="w-8 h-8" />,
                title: 'Teachers & Staff',
                desc: 'Skip the student queue. Submit printing orders digitally with priority tracking and spending history.',
                link: '/teacher/signup',
                btnText: 'Teacher Sign Up',
                color: 'border-blue-500/30 hover:border-blue-500/60',
                btnColor: 'bg-blue-600 hover:bg-blue-500',
              },
              {
                icon: <ShieldCheck className="w-8 h-8" />,
                title: 'Shop Handler',
                desc: 'Manage orders efficiently. Verify payments, track earnings, control pricing, and process prints seamlessly.',
                link: '/shop/login',
                btnText: 'Shop Login',
                color: 'border-emerald-500/30 hover:border-emerald-500/60',
                btnColor: 'bg-emerald-600 hover:bg-emerald-500',
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`p-8 rounded-2xl bg-[var(--color-surface-card)] border ${card.color} transition-all hover:-translate-y-1`}
              >
                <div className="text-white mb-5">{card.icon}</div>
                <h4 className="text-2xl font-bold text-white mb-3">{card.title}</h4>
                <p className="text-[var(--color-text-muted)] mb-6 leading-relaxed">{card.desc}</p>
                <Link
                  href={card.link}
                  className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-xl ${card.btnColor} transition-all`}
                >
                  {card.btnText}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile navigation for small screens */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass p-4 z-50">
        <div className="flex gap-3">
          <Link href="/student/login" className="flex-1 py-3 text-center text-sm font-medium bg-[var(--color-primary)] text-white rounded-xl">
            Student
          </Link>
          <Link href="/teacher/login" className="flex-1 py-3 text-center text-sm font-medium bg-blue-600 text-white rounded-xl">
            Teacher
          </Link>
          <Link href="/shop/login" className="flex-1 py-3 text-center text-sm font-medium bg-emerald-600 text-white rounded-xl">
            Shop
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[var(--color-primary)]" />
            <span className="font-bold text-white">Qprint</span>
            <span className="text-[var(--color-text-muted)] text-sm">by HEMALESH</span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Fast Printing • No Long Waiting • Real-Time Order Tracking
          </p>
        </div>
      </footer>
    </div>
  );
}
