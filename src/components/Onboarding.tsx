import React, { useState } from 'react';
import { BookOpen, Clock, AlertCircle, CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { profile } = useAuth();
  const [checked, setChecked] = useState({ quietSpace: false, internet: false, scratchpad: false, time: false });
  const toggle = (k: keyof typeof checked) => setChecked(p => ({ ...p, [k]: !p[k] }));
  const allChecked = Object.values(checked).every(Boolean);

  const checklistItems = [
    { key: 'quietSpace' as const, label: 'I am in a quiet environment free from interruptions.', sub: 'Distractions significantly impact performance on timed reasoning tasks.' },
    { key: 'internet' as const, label: 'I have a stable internet connection.', sub: 'Required for real-time answer syncing and draft backup.' },
    { key: 'scratchpad' as const, label: 'I have pen and paper available.', sub: 'Recommended for numerical sequences and geometric problems.' },
    { key: 'time' as const, label: 'I have up to 80 minutes of uninterrupted time.', sub: 'Four 20-minute sections. Each can be taken in separate sittings.' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <span className="inline-block text-xs font-medium text-[#002366] bg-[#002366]/8 px-3 py-1 rounded-full uppercase tracking-wide mb-5">
          {profile?.role === 'recruiter' ? 'Recruiter Portal' : 'Candidate Onboarding'}
        </span>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-3">
              Welcome, {profile?.displayName || 'Candidate'}
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
              You've been invited to complete a professional cognitive evaluation. This assessment measures four critical reasoning dimensions used to gauge analytical agility and problem-solving readiness.
            </p>
          </div>
          {profile?.role === 'recruiter' && (
            <button id="btn-recruiter-home" onClick={onComplete}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
              Go to Dashboard <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="w-10 h-10 bg-[#002366]/8 rounded-lg flex items-center justify-center text-[#002366] mb-4">
            <BookOpen size={20} />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Assessment Structure</h3>
          <p className="text-sm text-slate-500 mb-4">Four sections of 25 questions each — 100 questions total:</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {[
              ['Numerical Reasoning', 'Arithmetic, percentages, data tables'],
              ['Verbal Reasoning', 'Vocabulary, analogies, syntax logic'],
              ['Logical Deduction', 'Syllogisms, sequence puzzles, patterns'],
              ['Spatial Visualization', '3D rotations, geometric layouts'],
            ].map(([title, sub]) => (
              <li key={title} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#002366] shrink-0" />
                <span><strong className="font-medium text-slate-800">{title}:</strong> {sub}.</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 mb-4">
              <Clock size={20} />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">Time Constraints</h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              Each section has an independent <strong className="text-slate-700">20-minute countdown</strong>.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex items-start gap-3 text-sm text-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <p className="leading-relaxed">
                Once started, timers run continuously. Logging out or closing the tab will <strong>not pause</strong> the active section timer.
              </p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2.5 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
            Anti-cheating protocols and answer verification are active server-side.
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-slate-900 rounded-2xl p-7">
        <div className="flex items-center gap-2.5 mb-2">
          <CheckCircle size={18} className="text-blue-400" />
          <h3 className="text-base font-semibold text-white">Pre-flight Readiness Checklist</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6 ml-7">
          Confirm you meet these conditions before beginning.
        </p>

        <div className="space-y-4">
          {checklistItems.map(({ key, label, sub }) => (
            <label key={key} className="flex items-start gap-3.5 cursor-pointer group">
              <input type="checkbox" checked={checked[key]} onChange={() => toggle(key)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#002366] focus:ring-[#002366] shrink-0" />
              <div>
                <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {profile?.role === 'recruiter' && (
          <button id="btn-recruiter-home-bottom" onClick={onComplete}
            className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-colors cursor-pointer">
            Skip Onboarding
          </button>
        )}
        <button id="btn-onboarding-complete" disabled={!allChecked} onClick={onComplete}
          className={`ml-auto flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-medium transition-all ${
            allChecked
              ? 'bg-[#002366] hover:bg-[#00308f] text-white cursor-pointer btn-primary'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}>
          {allChecked ? <>Proceed to Dashboard <ArrowRight size={15} /></> : 'Complete Checklist to Continue'}
        </button>
      </div>
    </div>
  );
};
