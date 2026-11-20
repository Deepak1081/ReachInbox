import React, { useState, useEffect } from 'react';
import { Mail, Shield, Zap, Clock, Activity, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';

export const Login: React.FC = () => {
  const { loginWithGoogle, devLogin, isLoading } = useAuth();
  const [devEmail, setDevEmail] = useState('lead@reachinbox.ai');
  const [devName, setDevName] = useState('ReachInbox Lead');
  const [isSubmittingDev, setIsSubmittingDev] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err === 'google_credentials_missing') {
      setAuthError('GOOGLE_CLIENT_ID in .env is currently a placeholder. Add your Google Cloud credentials to .env, or use Developer Login below to test immediately!');
    } else if (err === 'oauth_failed') {
      setAuthError('Google OAuth authentication failed. Please check your credentials or redirect URI.');
    }
  }, []);

  const handleDevSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDev(true);
    try {
      await devLogin(devEmail, devName);
      window.location.href = '/dashboard';
    } finally {
      setIsSubmittingDev(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col justify-center items-center p-6 text-slate-100">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 items-center justify-center text-white shadow-lg shadow-indigo-500/25 mb-2">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            ReachInbox Scheduler
          </h1>
          <p className="text-xs text-slate-400">
            High-concurrency email scheduling with BullMQ, Redis, PostgreSQL & Slack OAuth
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl space-y-6">
          {authError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Real Google OAuth Button */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-98"
          >
            {/* Google G SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider relative">
              Or Instant Developer Login
            </span>
          </div>

          {/* Dev Login Form */}
          <form onSubmit={handleDevSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Developer Name
              </label>
              <input
                type="text"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Developer Email
              </label>
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingDev || isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm shadow-indigo-600/30 disabled:opacity-60"
            >
              {isSubmittingDev ? (
                <span>Logging In...</span>
              ) : (
                <>
                  <span>Enter Dashboard as Developer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Feature Highlights */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>BullMQ Redis-backed delayed jobs (survives restarts)</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Atomic 200 emails/hour limit with inter-email throttling</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Real Ethereal SMTP delivery with live email preview URLs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
