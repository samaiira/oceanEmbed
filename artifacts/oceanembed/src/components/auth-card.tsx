import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, AlertCircle, Waves, Lock, Mail, User as UserIcon } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '@/lib/supabase';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';

export function AuthCard({ initialMode = 'sign-in' }: { initialMode?: 'sign-in' | 'sign-up' }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { isSignedIn, userId } = useSupabaseAuth();

  // If already signed in, provide quick redirect
  if (isSignedIn) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#133458] px-4 py-10">
        <div className="w-[460px] max-w-full rounded-2xl border border-[#D8D0B3] bg-[#FAF7BB] p-8 text-[#133458] shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-sm bg-[#133458] text-[#FAF7BB]">
              <Waves size={22} />
            </span>
            <div>
              <div className="font-display text-2xl">OceanEmbed</div>
              <div className="font-data text-[10px] text-[#838921]">ALREADY AUTHENTICATED</div>
            </div>
          </div>
          <div className="mt-6 rounded-md bg-[#e5ebd3] p-4 text-xs text-[#536b35]">
            <div className="flex items-center gap-2 font-semibold">
              <Check size={16} /> Signed in successfully
            </div>
            <div className="mt-2 font-mono text-[11px] text-[#133458]">
              User ID: <span className="font-bold">{userId}</span>
            </div>
          </div>
          <button
            onClick={() => setLocation('/dashboard')}
            className="mt-6 flex w-full items-center justify-center gap-2 bg-[#133458] py-3 text-xs font-bold text-[#FAF7BB] hover:bg-[#838921] transition-colors rounded-sm"
          >
            Continue to Mission Control <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // Supabase OAuth redirects the browser automatically
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setErrorMsg(err?.message || 'Failed to initialize Google Sign In');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Please provide both email and password');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'sign-up') {
        const data = await signUpWithEmail(email, password, fullName);
        if (data.session) {
          // Direct login without email confirm
          setLocation('/dashboard');
        } else {
          setSuccessMsg('Account created! If email confirmation is required, please check your inbox, or sign in.');
        }
      } else {
        await signInWithEmail(email, password);
        setLocation('/dashboard');
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      setErrorMsg(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#133458] px-4 py-10">
      <div className="w-[460px] max-w-full rounded-2xl border border-[#D8D0B3] bg-[#FAF7BB] p-8 text-[#133458] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-sm bg-[#133458] text-[#FAF7BB]">
              <Waves size={22} />
            </span>
            <span className="font-display text-2xl">OceanEmbed</span>
          </Link>
          <div className="flex items-center gap-1.5 rounded-full bg-[#e5ebd3] px-2.5 py-1 text-[10px] font-semibold text-[#536b35]">
            <span className="h-2 w-2 rounded-full bg-[#838921]" /> Supabase Live
          </div>
        </div>

        <div className="mt-6">
          <h1 className="font-display text-2xl text-[#133458]">
            {mode === 'sign-in' ? 'Sign in to workspace' : 'Create research account'}
          </h1>
          <p className="mt-1 text-xs text-[#536675]">
            Connected to Supabase PostgreSQL database for profile & reconstruction persistence.
          </p>
        </div>

        {/* Tab switch */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-sm bg-[#e8e2ba] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode('sign-in'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 rounded-sm transition-colors ${mode === 'sign-in' ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675] hover:text-[#133458]'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('sign-up'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 rounded-sm transition-colors ${mode === 'sign-up' ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675] hover:text-[#133458]'}`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 rounded border border-[#9a443d]/30 bg-[#9a443d]/10 p-3 text-xs text-[#9a443d]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded border border-[#536b35]/30 bg-[#e5ebd3] p-3 text-xs text-[#536b35]">
            <Check size={16} className="shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-sm border border-[#D8D0B3] bg-white py-3 px-4 text-xs font-semibold text-[#133458] shadow-sm hover:bg-[#fffdf0] transition-colors disabled:opacity-50"
            data-testid="button-google-login"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
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
            <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#D8D0B3]" />
          </div>
          <span className="relative bg-[#FAF7BB] px-3 font-data text-[10px] uppercase tracking-wider text-[#536675]">
            or use credentials
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'sign-up' && (
            <div>
              <label className="block text-xs font-semibold text-[#133458] mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon size={15} className="absolute left-3 top-3 text-[#536675]" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Maya Patel"
                  className="w-full rounded-sm border border-[#D8D0B3] bg-[#fffdf0] py-2.5 pl-9 pr-3 text-xs text-[#133458] outline-none focus:border-[#838921]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#133458] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-3 text-[#536675]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@oceanembed.org"
                className="w-full rounded-sm border border-[#D8D0B3] bg-[#fffdf0] py-2.5 pl-9 pr-3 text-xs text-[#133458] outline-none focus:border-[#838921]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#133458] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-3 text-[#536675]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-sm border border-[#D8D0B3] bg-[#fffdf0] py-2.5 pl-9 pr-3 text-xs text-[#133458] outline-none focus:border-[#838921]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-[#133458] py-3 text-xs font-bold text-[#FAF7BB] hover:bg-[#838921] transition-colors disabled:opacity-50"
            data-testid="button-email-submit"
          >
            {loading ? 'Authenticating...' : mode === 'sign-in' ? 'Sign In' : 'Create Account'}
            <ArrowRight size={14} />
          </button>

          {mode === 'sign-in' && (
            <button
              type="button"
              onClick={() => {
                setEmail('dr.maya.patel@oceanembed.org');
                setPassword('oceanPassword2026!');
              }}
              className="mt-2 text-center w-full font-data text-[10px] text-[#838921] hover:text-[#133458] underline cursor-pointer"
              data-testid="button-fill-demo-credentials"
            >
              Fill Test Researcher Account (Dr. Maya Patel)
            </button>
          )}
        </form>

        {/* Database info footer */}
        <div className="mt-6 border-t border-[#D8D0B3] pt-4 text-center font-data text-[10px] text-[#536675]">
          PostgreSQL Database: <span className="text-[#133458] font-bold">ysryoqotuyngtplyujqx</span> · RLS Enabled
        </div>
      </div>
    </div>
  );
}
