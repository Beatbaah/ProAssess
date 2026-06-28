import React, { useState, useEffect } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { Mail, Lock, User as UserIcon, Phone, AlertCircle, ShieldCheck, PartyPopper } from 'lucide-react';

export const AuthScreens: React.FC = () => {
  const { login, signup, error, clearError } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Invite token state
  const [inviteToken, setInviteToken]           = useState<string | null>(null);
  const [inviteRecruiter, setInviteRecruiter]   = useState<string | null>(null);
  const [inviteLoading, setInviteLoading]       = useState(false);
  const [inviteError, setInviteError]           = useState<string | null>(null);

  // Detect ?invite=TOKEN in the URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;

    setInviteLoading(true);
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          setInviteError(data.error || 'This invite link is invalid or has expired.');
          return;
        }
        setInviteToken(token);
        setEmail(data.email);
        setInviteRecruiter(data.recruiterName);
        setIsLogin(false);
        setRole('candidate');
      })
      .catch(() => setInviteError('Could not resolve invite link.'))
      .finally(() => setInviteLoading(false));
  }, []);

  const toggleMode = () => {
    if (inviteToken) return;
    setIsLogin(prev => !prev);
    setValidationError(null);
    setResetSent(false);
    clearError();
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setValidationError('Enter your email address above, then click "Forgot password".');
      return;
    }
    setValidationError(null);
    clearError();
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch {
      setValidationError('Could not send reset email. Check the address and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (targetRole: 'candidate' | 'recruiter' = 'candidate') => {
    setIsSubmitting(true);
    setValidationError(null);
    const demoEmail    = targetRole === 'candidate' ? 'demo.candidate@proassess.com' : 'demo.recruiter@proassess.com';
    const demoPassword = targetRole === 'candidate' ? 'demoCandidate123!' : 'demoRecruiter123!';
    const demoName     = targetRole === 'candidate' ? 'Demo Candidate' : 'Demo Recruiter';
    const demoPhone    = targetRole === 'candidate' ? '+1 (555) 019-2834' : '+1 (555) 987-6543';
    try {
      await login(demoEmail, demoPassword);
    } catch {
      try {
        await signup(demoEmail, demoPassword, demoName, demoPhone, targetRole);
      } catch {
        setValidationError(`Could not auto-provision the ${targetRole} demo account. Please register below.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!email.trim() || !password.trim()) {
      setValidationError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }
    if (!isLogin && !displayName.trim()) {
      setValidationError('Full name is required for registration.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, displayName.trim(), contactNumber.trim(), role);
        // Mark invite as accepted if we have a token
        if (inviteToken) {
          const uid = auth.currentUser?.uid;
          await fetch(`/api/invite/${inviteToken}/accept`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid }),
          }).catch(() => {});
        }
      }
    } catch {
      // handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-colors';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex w-[420px] shrink-0 bg-[#002366] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <span className="text-[#002366] text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>P</span>
          </div>
          <span className="text-white text-lg font-semibold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>ProAssess</span>
        </div>

        <div>
          <h1 className="text-3xl font-semibold text-white leading-snug mb-4">
            Professional cognitive evaluation, built for modern hiring.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Four scientifically structured reasoning modules. AI-assisted profiling. Secure, tamper-proof grading.
          </p>
        </div>

        <p className="text-xs text-slate-500">© {new Date().getFullYear()} ProAssess Platform</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-[#002366] flex items-center justify-center">
              <span className="text-white text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>P</span>
            </div>
            <span className="text-slate-900 text-lg font-semibold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>ProAssess</span>
          </div>

          {/* Invite banner */}
          {inviteLoading ? (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700 text-center animate-pulse">
              Resolving your invitation…
            </div>
          ) : inviteError ? (
            <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50 p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{inviteError}</p>
            </div>
          ) : inviteRecruiter && (
            <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
              <PartyPopper size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">You've been invited!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  <strong>{inviteRecruiter}</strong> has invited you to complete a ProAssess cognitive assessment. Register below to get started.
                </p>
              </div>
            </div>
          )}

          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            {isLogin ? 'Sign in to your account' : inviteToken ? 'Create your candidate profile' : 'Create a candidate profile'}
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            {isLogin ? 'Access your cognitive assessment dashboard.' : 'Register to begin your professional evaluation.'}
          </p>

          {/* Demo launchers */}
          {isLogin && !inviteToken && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-[#002366]" />
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Demo Environment</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="btn-demo-candidate-login"
                  onClick={() => handleDemoLogin('candidate')}
                  disabled={isSubmitting}
                  className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-lg bg-[#002366] text-white text-xs font-medium hover:bg-[#00308f] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span>Candidate Demo</span>
                  <span className="text-[10px] opacity-70 font-normal">Take Assessment</span>
                </button>
                <button
                  type="button"
                  id="btn-demo-recruiter-login"
                  onClick={() => handleDemoLogin('recruiter')}
                  disabled={isSubmitting}
                  className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span>Recruiter Demo</span>
                  <span className="text-[10px] text-slate-400 font-normal">Evaluate Candidates</span>
                </button>
              </div>
            </div>
          )}

          {isLogin && !inviteToken && (
            <div className="relative flex items-center mb-6">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-xs text-slate-400 font-medium">or sign in manually</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && !inviteToken && (
              <div>
                <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">Account Type</label>
                <select
                  id="select-signup-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'candidate' | 'recruiter')}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-colors"
                >
                  <option value="candidate">Candidate — takes the assessment</option>
                  <option value="recruiter">Recruiter — evaluates candidates</option>
                </select>
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" id="input-signup-name" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass} placeholder="Jane Doe" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" id="input-auth-email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={!!inviteToken}
                  className={`${inputClass} ${inviteToken ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="you@company.com" />
              </div>
              {inviteToken && (
                <p className="text-[11px] text-slate-400 mt-1">Email is pre-filled from your invitation and cannot be changed.</p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">
                  Contact Number <span className="normal-case text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" id="input-signup-phone" value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className={inputClass} placeholder="+1 (555) 012-3456" />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide">Password</label>
                {isLogin && !inviteToken && (
                  <button type="button" onClick={handleForgotPassword}
                    className="text-xs text-[#002366] hover:underline cursor-pointer">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" id="input-auth-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass} placeholder="••••••••" />
              </div>
            </div>

            {resetSent && (
              <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 leading-relaxed">
                <ShieldCheck size={15} className="shrink-0 mt-0.5" />
                <span>Password reset email sent. Check your inbox and follow the link to set a new password.</span>
              </div>
            )}

            {(validationError || error) && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 leading-relaxed">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{validationError || error}</span>
              </div>
            )}

            <button
              type="submit"
              id="btn-auth-submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-[#002366] hover:bg-[#00308f] transition-colors shadow-sm btn-primary disabled:opacity-60 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing…
                </span>
              ) : isLogin ? 'Sign In' : inviteToken ? 'Complete Registration' : 'Create Account'}
            </button>
          </form>

          {!inviteToken && (
            <p className="mt-6 text-center text-xs text-slate-500">
              {isLogin ? "Don't have an account? " : "Already registered? "}
              <button type="button" id="btn-toggle-auth-mode" onClick={toggleMode}
                className="font-semibold text-[#002366] hover:underline cursor-pointer">
                {isLogin ? 'Register now' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
