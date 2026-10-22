'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/services/api/auth';
import { ApiClientError } from '@/services/api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to request password reset. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-16 sm:py-24">
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 font-bold text-white shadow-lg shadow-sky-500/25">
            EL
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">Reset Password</h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="mt-6 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-center">
            <p className="text-xs text-sky-200 leading-relaxed">
              If an account exists for <span className="font-semibold text-white">{email}</span>,
              password reset instructions have been sent. Please check your inbox.
            </p>
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Sending instructions...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              Remember your password?{' '}
              <Link
                href="/login"
                className="font-semibold text-sky-400 hover:text-sky-300 transition"
              >
                Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
