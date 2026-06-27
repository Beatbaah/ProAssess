import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, UserPlus, BarChart3, GitCompare,
  ShieldCheck, Briefcase, CheckCircle2, ChevronRight,
  Users, FileDown, StickyNote, Bell
} from 'lucide-react';

interface RecruiterOnboardingProps {
  onComplete: () => void;
}

const FEATURES = [
  {
    icon: UserPlus,
    title: 'Invite Candidates',
    description: 'Send personalised assessment links by email. Each link is unique, expires in 7 days, and can be tied to a specific job position.',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
  },
  {
    icon: BarChart3,
    title: 'Pipeline Management',
    description: 'Move candidates through stages — New, Under Review, Shortlisted, Rejected — with recruiter notes attached to each profile.',
    color: 'text-violet-600 bg-violet-50 border-violet-100',
  },
  {
    icon: GitCompare,
    title: 'Side-by-Side Comparison',
    description: 'Select 2–4 completed candidates and compare their domain scores in Numerical, Verbal, Logical, and Spatial reasoning.',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance & Export',
    description: 'Export candidate data to CSV at any time. Erase individual candidate records on request, in line with GDPR right-to-erasure.',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
  },
];

const STEPS = [
  {
    n: '1',
    icon: Briefcase,
    title: 'Create a Position',
    body: `Head to the Positions tab and define the role you're hiring for — e.g. "Data Analyst · Analytics". Positions group candidates and carry through to invitations.`,
  },
  {
    n: '2',
    icon: UserPlus,
    title: 'Invite Candidates',
    body: `Click "Invite Candidates" and enter email addresses. Each candidate gets a unique link that pre-fills their registration and tags them to the role.`,
  },
  {
    n: '3',
    icon: BarChart3,
    title: 'Review & Decide',
    body: `Once candidates complete their assessment, scores appear in your pipeline automatically. Open their profile, add notes, move them to the right stage.`,
  },
];

export const RecruiterOnboarding: React.FC<RecruiterOnboardingProps> = ({ onComplete }) => {
  const { profile } = useAuth();
  const [step, setStep] = useState<'welcome' | 'features' | 'howto'>('welcome');

  const firstName = profile?.displayName?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top bar */}
      <header className="bg-[#002366] px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
          <span className="text-[#002366] text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>P</span>
        </div>
        <span className="text-white font-semibold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>ProAssess</span>
        <span className="ml-auto text-xs text-white/50">Recruiter Setup</span>
      </header>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-8 pb-2">
        {(['welcome', 'features', 'howto'] as const).map((s, i) => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
            s === step ? 'w-8 bg-[#002366]' : i < ['welcome','features','howto'].indexOf(step) ? 'w-4 bg-[#002366]/40' : 'w-4 bg-slate-200'
          }`} />
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">

        {/* ── Step 1: Welcome ── */}
        {step === 'welcome' && (
          <div className="max-w-2xl w-full space-y-8 animate-fade-in">

            {/* Hero card */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-[#002366] px-8 py-10">
                <span className="inline-block text-xs font-medium text-white/60 uppercase tracking-widest mb-4">Recruiter Console</span>
                <h1 className="text-3xl font-semibold text-white leading-snug mb-3">
                  Welcome, {firstName}.
                </h1>
                <p className="text-slate-300 text-sm leading-relaxed max-w-lg">
                  You now have access to ProAssess — a cognitive assessment platform that lets you evaluate candidates at scale with structured reasoning tests across four domains.
                </p>
              </div>
              <div className="px-8 py-6 bg-slate-50/60 border-t border-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: Users,    label: 'Candidates',  sub: 'Unlimited' },
                    { icon: Briefcase, label: 'Positions',  sub: 'Unlimited' },
                    { icon: Bell,      label: 'Notifications', sub: 'Real-time' },
                    { icon: FileDown,  label: 'CSV Export', sub: 'Any time' },
                  ].map(({ icon: Icon, label, sub }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#002366]/8 text-[#002366] flex items-center justify-center shrink-0">
                        <Icon size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-700">{label}</p>
                        <p className="text-[11px] text-slate-400">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* What candidates experience */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">What Candidates Experience</p>
              <div className="space-y-3">
                {[
                  'They receive a unique invite link by email and register with it — no separate account creation needed.',
                  'They complete up to 4 reasoning modules (Numerical · Verbal · Logical · Spatial), 25 questions each.',
                  'AI generates an executive summary and domain breakdown that appears in your pipeline the moment they submit.',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep('features')}
                className="flex items-center gap-2 px-6 py-3 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-xl transition-colors cursor-pointer shadow-sm">
                See What You Can Do <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Features ── */}
        {step === 'features' && (
          <div className="max-w-3xl w-full space-y-6 animate-fade-in">
            <div className="text-center">
              <p className="text-xs font-medium text-[#002366] uppercase tracking-widest mb-2">Recruiter Toolkit</p>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Everything in your console</h2>
              <p className="text-sm text-slate-500">Four core capabilities designed for modern recruiting teams.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map(({ icon: Icon, title, description, color }) => (
                <div key={title} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-sm transition-shadow">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${color}`}>
                    <Icon size={19} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>

            {/* Assessment domains reference */}
            <div className="bg-slate-900 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Assessment Domains Measured</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Numerical', sub: '25 questions', bar: 'bg-blue-500' },
                  { label: 'Verbal',    sub: '25 questions', bar: 'bg-violet-500' },
                  { label: 'Logical',   sub: '25 questions', bar: 'bg-emerald-500' },
                  { label: 'Spatial',   sub: '25 questions', bar: 'bg-amber-500' },
                ].map(({ label, sub, bar }) => (
                  <div key={label} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                    <div className={`w-5 h-1 rounded-full ${bar} mb-2`} />
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-[11px] text-slate-400">{sub}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('welcome')}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors cursor-pointer">
                Back
              </button>
              <button onClick={() => setStep('howto')}
                className="flex items-center gap-2 px-6 py-3 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-xl transition-colors cursor-pointer shadow-sm">
                How to Get Started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: How-to ── */}
        {step === 'howto' && (
          <div className="max-w-2xl w-full space-y-6 animate-fade-in">
            <div className="text-center">
              <p className="text-xs font-medium text-[#002366] uppercase tracking-widest mb-2">Quick Start</p>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Three steps to your first hire</h2>
              <p className="text-sm text-slate-500">You can complete all of these in under five minutes.</p>
            </div>

            <div className="space-y-3">
              {STEPS.map(({ n, icon: Icon, title, body }) => (
                <div key={n} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#002366] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {n}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon size={14} className="text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-2.5">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
                <StickyNote size={13} /> Recruiter Tips
              </p>
              {[
                'Use the Pipeline tab to filter by stage — click any stage card to show only those candidates.',
                'Select multiple completed candidates and hit "Compare" to open a side-by-side score breakdown.',
                'The notification bell badge shows new assessment completions since your last visit.',
              ].map((tip, i) => (
                <p key={i} className="text-xs text-blue-700 leading-relaxed pl-5 border-l-2 border-blue-200">{tip}</p>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('features')}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors cursor-pointer">
                Back
              </button>
              <button onClick={onComplete}
                className="flex items-center gap-2 px-8 py-3 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer shadow-sm btn-primary">
                Open My Dashboard <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
