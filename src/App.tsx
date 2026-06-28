import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AssessmentProvider, useAssessment } from './context/AssessmentContext';
import { Sidebar } from './components/Sidebar';
import { AuthScreens } from './components/AuthScreens';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { AssessmentInterface } from './components/AssessmentInterface';
import { Settings } from './components/Settings';
import { ResultsView } from './components/ResultsView';
import { RecruiterDashboard } from './components/RecruiterDashboard';
import { RecruiterOnboarding } from './components/RecruiterOnboarding';
import { Menu, X, ShieldAlert } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { activeCategory, loading: assessmentLoading, startCategory } = useAssessment();
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [isRecruiterOnboarded, setIsRecruiterOnboarded] = useState(() => {
    // will be re-evaluated per-user when we know the uid
    return false;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Reset tab on logout; load per-user recruiter onboarding flag from localStorage
  useEffect(() => {
    if (!user) {
      setActiveTab('dashboard');
      setIsRecruiterOnboarded(false);
    } else {
      const done = localStorage.getItem(`proassess_recruiter_onboarded_${user.uid}`) === 'true';
      setIsRecruiterOnboarded(done);
    }
  }, [user?.uid]);

  // Auto-redirect recruiters away from the candidate dashboard
  useEffect(() => {
    if (profile?.role === 'recruiter' && activeTab === 'dashboard') {
      setActiveTab('recruiter');
    } else if (profile && profile.role !== 'recruiter' && activeTab === 'recruiter') {
      setActiveTab('dashboard');
    }
  }, [profile?.role, activeTab]);

  // Update browser tab title per active view
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard — ProAssess',
      settings: 'My Profile — ProAssess',
      results: 'My Results — ProAssess',
      recruiter: 'Candidate Pipeline — ProAssess',
    };
    document.title = titles[activeTab] ?? 'ProAssess';
  }, [activeTab]);

  // Show a professional slate loading skeleton during auth or database loads
  if (authLoading || assessmentLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-[#002366] flex items-center justify-center shadow-lg">
          <span className="text-white text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>P</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-40 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#002366] rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-xs text-slate-400 tracking-widest uppercase font-medium">Loading ProAssess</p>
        </div>
      </div>
    );
  }

  // 1. If not logged in, show AuthScreens
  if (!user) {
    return <AuthScreens />;
  }

  // 2a. Recruiter onboarding — shown once per user (persisted in localStorage)
  if (profile?.role === 'recruiter' && !isRecruiterOnboarded) {
    return (
      <RecruiterOnboarding onComplete={() => {
        if (user?.uid) localStorage.setItem(`proassess_recruiter_onboarded_${user.uid}`, 'true');
        setIsRecruiterOnboarded(true);
        setActiveTab('recruiter');
      }} />
    );
  }

  // 2b. Candidate onboarding
  if (profile?.status === 'Not Started' && !isOnboardingCompleted && profile?.role !== 'recruiter') {
    return (
      <div className="min-h-screen bg-slate-50 py-10">
        <Onboarding onComplete={() => {
          setIsOnboardingCompleted(true);
        }} />
      </div>
    );
  }

  // 3. Main Assessment Mode Layout (Strips sidebars and menu items for ultimate concentration and anti-cheating)
  if (activeCategory) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Anti-distraction Focus Bar */}
        <header className="bg-[#002366] text-white py-3 px-6 shadow border-b border-[#001a4d] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-200">
              SECURE ASSESSMENT FLOW ACTIVE
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-300">
            Candidate: {profile?.displayName || 'Beatrice'}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <AssessmentInterface />
        </main>
      </div>
    );
  }

  // 4. Standard Dashboard and Navigation Layout (Desktop sidebar + responsive mobile layout)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header bar */}
      <div className="md:hidden bg-[#002366] text-white p-4 flex items-center justify-between shadow border-b border-[#001a4d]">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#002366] font-bold text-md shadow">
            P
          </div>
          <span className="font-bold text-sm tracking-tight">ProAssess</span>
        </div>
        
        <button
          onClick={() => setIsMobileSidebarOpen(prev => !prev)}
          className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
        >
          {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Desktop Sidebar (Left side panel) */}
      <div className="hidden md:flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          ></div>
          
          <div className="relative flex flex-col w-64 h-full bg-[#002366] shadow-xl animate-slide-in">
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setIsMobileSidebarOpen(false);
              }} 
            />
          </div>
        </div>
      )}

      {/* Main content viewport */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            onStartCategory={(cat) => {
              startCategory(cat);
            }} 
            onNavigateToResults={() => {
              setActiveTab('results');
            }}
          />
        )}

        {activeTab === 'settings' && <Settings />}

        {activeTab === 'results' && <ResultsView />}

        {activeTab === 'recruiter' && <RecruiterDashboard />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AssessmentProvider>
        <MainAppContent />
      </AssessmentProvider>
    </AuthProvider>
  );
}
