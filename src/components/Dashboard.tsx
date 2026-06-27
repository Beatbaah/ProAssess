import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';
import { Category } from '../types';
import {
  TrendingUp, AlignLeft, Brain, Box,
  Play, CheckCircle, Clock, AlertCircle, ArrowRight, Sparkles
} from 'lucide-react';

interface DashboardProps {
  onStartCategory: (category: Category) => void;
  onNavigateToResults: () => void;
}

const categories: { id: Category; name: string; desc: string; icon: any; accent: string; prefix: string }[] = [
  {
    id: 'Numerical', name: 'Numerical Reasoning', prefix: 'num_',
    desc: 'Financial analysis, percentage variance, and numerical sequence logic.',
    icon: TrendingUp, accent: 'text-blue-600 bg-blue-50',
  },
  {
    id: 'Verbal', name: 'Verbal Reasoning', prefix: 'ver_',
    desc: 'Logical arguments, synonym pairings, and reading comprehension.',
    icon: AlignLeft, accent: 'text-violet-600 bg-violet-50',
  },
  {
    id: 'Logical', name: 'Logical Deduction', prefix: 'log_',
    desc: 'Pattern deduction, spatial-logical flow, and conditional rule sets.',
    icon: Brain, accent: 'text-amber-600 bg-amber-50',
  },
  {
    id: 'Spatial', name: 'Spatial Visualization', prefix: 'spa_',
    desc: '3D rotations, origami folding, cross-sections, and geometric grids.',
    icon: Box, accent: 'text-teal-600 bg-teal-50',
  },
];

export const Dashboard: React.FC<DashboardProps> = ({ onStartCategory, onNavigateToResults }) => {
  const { profile } = useAuth();
  const { completedCategories, activeCategory, answers, submitFullAssessment, isSubmitting, result, resetAssessment } = useAssessment();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalAnswered = Object.keys(answers).length;
  const allDone = completedCategories.length === 4;

  const handleFinalSubmit = async () => {
    setErrorMsg(null);
    try {
      await submitFullAssessment();
      onNavigateToResults();
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed. Please check your connection and retry.');
    }
  };

  const stats = [
    { label: 'Sections Complete', value: `${completedCategories.length} / 4`, icon: CheckCircle, iconClass: 'text-emerald-600 bg-emerald-50' },
    { label: 'Answers Logged', value: `${totalAnswered} / 100`, icon: TrendingUp, iconClass: 'text-blue-600 bg-blue-50' },
    { label: 'Time per Section', value: '20 min', icon: Clock, iconClass: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4 sm:px-0">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">ProAssess Platform</p>
          <h1 className="text-2xl font-semibold text-slate-900">Cognitive Evaluation Hub</h1>
          <p className="text-sm text-slate-500 mt-1">Complete all four reasoning modules, then submit for AI-graded review.</p>
        </div>
        {profile?.status === 'Completed' && (
          <button id="btn-dashboard-view-scores" onClick={onNavigateToResults}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors shadow-sm btn-primary cursor-pointer shrink-0">
            <Sparkles size={15} />
            View Graded Report
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, iconClass }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-xl font-semibold text-slate-900 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* All-complete submission banner */}
      {allDone && profile?.status !== 'Completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={17} className="text-emerald-600 shrink-0" />
                <h3 className="text-sm font-semibold text-emerald-900">All sections finished — ready to submit</h3>
              </div>
              <p className="text-sm text-emerald-700 ml-6">
                Submit to trigger server-side grading and generate your AI cognitive profile.
              </p>
            </div>
            <button id="btn-submit-all-review" onClick={handleFinalSubmit} disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shrink-0 cursor-pointer disabled:opacity-60">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Grading…
                </>
              ) : (
                <>Submit for Review <ArrowRight size={15} /></>
              )}
            </button>
          </div>
          {errorMsg && (
            <div className="mt-3 flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Completed + result banner */}
      {profile?.status === 'Completed' && result && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={17} className="text-[#002366] shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900">Assessment complete — score: {result.totalScore}/100</h3>
            </div>
            <p className="text-sm text-slate-500 ml-6">Your cognitive profile has been generated and shared with your recruiter.</p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button id="btn-reset-assessment-test"
              onClick={() => { if (confirm('Reset will permanently clear all answers. Are you sure?')) resetAssessment(); }}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
              Retake
            </button>
            <button id="btn-goto-report" onClick={onNavigateToResults}
              className="px-4 py-2 text-xs font-medium text-white bg-[#002366] hover:bg-[#00308f] rounded-lg transition-colors cursor-pointer">
              View Report
            </button>
          </div>
        </div>
      )}

      {/* Category grid */}
      <div>
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Assessment Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isCompleted = completedCategories.includes(cat.id);
            const isActive = activeCategory === cat.id;
            const answeredInCat = Object.keys(answers).filter(id => id.startsWith(cat.prefix)).length;

            return (
              <div key={cat.id}
                className={`rounded-xl border bg-white p-5 flex flex-col justify-between transition-all ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/30'
                  : isActive ? 'border-[#002366] ring-1 ring-[#002366]/10'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}>

                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cat.accent}`}>
                    <Icon size={20} />
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                    isCompleted ? 'bg-emerald-100 text-emerald-700'
                    : isActive ? 'bg-[#002366] text-white animate-pulse'
                    : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                  </span>
                </div>

                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">{cat.name}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{cat.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock size={13} /> 20 min</span>
                    <span className="font-mono">{answeredInCat} / 25 answered</span>
                  </div>

                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle size={14} /> Done
                    </span>
                  ) : (
                    <button
                      id={`btn-start-${cat.id.toLowerCase()}`}
                      onClick={() => onStartCategory(cat.id)}
                      disabled={activeCategory !== null && !isActive}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isActive ? 'bg-[#002366] text-white hover:bg-[#00308f]'
                        : activeCategory !== null ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-slate-700'
                      }`}
                    >
                      <Play size={10} fill="currentColor" />
                      {isActive ? 'Resume' : 'Start'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
