import React from 'react';
import { useAssessment } from '../context/AssessmentContext';
import { useAuth } from '../context/AuthContext';
import { Award, BookOpen, AlertCircle, Calendar, CheckCircle2, User, TrendingUp } from 'lucide-react';

const scoreBand = (score: number) => {
  if (score >= 80) return { label: 'Distinguished', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (score >= 60) return { label: 'High Proficiency', color: 'bg-blue-50 text-blue-800 border-blue-200' };
  if (score >= 40) return { label: 'Proficient', color: 'bg-slate-50 text-slate-800 border-slate-200' };
  return { label: 'Developing', color: 'bg-amber-50 text-amber-800 border-amber-200' };
};

const barColor = (pct: number) =>
  pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct >= 35 ? 'bg-amber-500' : 'bg-rose-500';

export const ResultsView: React.FC = () => {
  const { profile } = useAuth();
  const { result, loading, resetAssessment } = useAssessment();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <svg className="animate-spin h-7 w-7 text-[#002366]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm text-slate-500">Loading your graded evaluation…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-md mx-auto my-16 text-center bg-white border border-slate-200 rounded-2xl p-10">
        <AlertCircle size={32} className="text-amber-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Report Pending</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Complete all four cognitive sections and submit from the dashboard to generate your graded profile.
        </p>
      </div>
    );
  }

  const band = scoreBand(result.totalScore);
  const submittedDate = new Date(result.submittedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-0 space-y-6">

      {/* Hero header */}
      <div className="bg-[#002366] rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-block text-[10px] uppercase font-medium tracking-widest text-slate-400 bg-white/10 px-3 py-1 rounded-full mb-4">
            Evaluation Complete
          </span>
          <h2 className="text-2xl font-semibold text-white mb-3">ProAssess Executive Profile</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
            <span className="flex items-center gap-1.5"><User size={13} className="text-slate-400" />{result.userDisplayName}</span>
            <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" />{submittedDate}</span>
          </div>
        </div>

        <div className="shrink-0 w-28 h-28 rounded-full border-2 border-white/20 bg-white/5 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none mb-1">Score</span>
          <span className="text-4xl font-semibold text-white leading-none">{result.totalScore}</span>
          <span className="text-xs text-slate-400 mt-1">/ 100</span>
        </div>
      </div>

      {/* Band */}
      <div className={`flex items-center justify-between px-5 py-3.5 rounded-xl border text-sm font-medium ${band.color}`}>
        <span className="flex items-center gap-2"><Award size={16} /> Cognitive Tier: {band.label}</span>
        <span className="text-xs font-mono">Top {Math.max(1, 100 - result.totalScore)}th percentile</span>
      </div>

      {/* Breakdown + strengths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-[#002366]" />
            <h3 className="text-sm font-semibold text-slate-900">Sector Performance</h3>
          </div>
          <div className="space-y-5">
            {(Object.entries(result.scores) as [string, number][]).map(([cat, score]) => {
              const pct = result.categoryPercentages[cat as any] || 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between items-baseline text-sm mb-1.5">
                    <span className="font-medium text-slate-800">{cat}</span>
                    <span className="font-mono text-xs text-slate-500">{score}/25 · {pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`${barColor(pct)} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-[#002366]" />
              <h3 className="text-sm font-semibold text-slate-900">Strength Index</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Domains where you scored in the 70th percentile or above.
            </p>
            <div className="space-y-2.5">
              {(Object.entries(result.categoryPercentages) as [string, number][]).map(([cat, pct]) => (
                <div key={cat} className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-xs ${
                  pct >= 70 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}>
                  <span className="font-medium">{cat}</span>
                  <span className="font-semibold">{pct >= 70 ? 'Strength' : 'Balanced'}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 pt-5 border-t border-slate-100 mt-5 leading-relaxed">
            Scoring is computed server-side using a tamper-proof grading engine.
          </p>
        </div>
      </div>

      {/* AI summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-7">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-[#002366]" />
          <h3 className="text-sm font-semibold text-slate-900">AI-Assisted Executive Summary</h3>
        </div>
        <blockquote className="border-l-2 border-[#002366] pl-5 text-sm text-slate-700 leading-relaxed italic mb-5">
          "{result.feedback}"
        </blockquote>
        <p className="text-xs text-slate-400 leading-relaxed">
          This profile is compiled using secure, multi-dimensional scoring and reviewed as supplementary guidance alongside live interviews and portfolio achievements.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button id="btn-print-results" onClick={() => window.print()}
          className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer">
          Print / Download
        </button>
        <button id="btn-retake-full-assessment"
          onClick={() => { if (confirm('This will permanently reset all answers and scores. Continue?')) resetAssessment(); }}
          className="px-5 py-2.5 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer btn-primary">
          Retake Assessment
        </button>
      </div>
    </div>
  );
};
