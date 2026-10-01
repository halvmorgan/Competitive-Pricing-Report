import React, { useState } from 'react';
import { Lock, Key, ArrowRight } from 'lucide-react';
import { AuthSession } from '../types.ts';

interface AuthGateProps {
  onAuthenticated: (session: AuthSession) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [accessPass, setAccessPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessPass }),
      });

      const data = await res.json();
      if (!res.ok || !data.authorized) {
        throw new Error(data.message || 'Invalid email or access passcode.');
      }

      const session: AuthSession = {
        isAuthenticated: true,
        email: data.user.email,
        accessPass: accessPass || undefined,
        role: data.user.role || 'guest',
        authenticatedAt: data.user.authenticatedAt || new Date().toISOString(),
      };

      localStorage.setItem('competitor_intel_auth', JSON.stringify(session));
      onAuthenticated(session);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif-heading font-semibold text-slate-100 tracking-tight">
            Competitive Pricing Analysis
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Private team tool · Ecentra Concierge
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
            <span className="text-rose-400 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Your name or email (optional)
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="So we know who ran the search"
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Access Passcode
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                autoComplete="current-password"
                value={accessPass}
                onChange={(e) => setAccessPass(e.target.value)}
                placeholder="Enter your passcode"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 font-mono transition-all"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-[0.99] text-slate-950 font-semibold text-sm rounded-lg shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Enter Intelligence Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 pt-6 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
          Need access? Contact Ecentra Concierge for a passcode.
        </p>
      </div>
    </div>
  );
};
