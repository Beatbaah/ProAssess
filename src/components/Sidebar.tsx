import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';
import { LayoutDashboard, Settings, LogOut, Award, BarChart3 } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { profile, logout } = useAuth();
  const { activeCategory } = useAssessment();

  const menuItems = profile?.role === 'recruiter'
    ? [
        { id: 'recruiter', label: 'Candidate Pipeline', icon: BarChart3 },
        { id: 'settings', label: 'My Profile', icon: Settings },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'settings', label: 'My Profile', icon: Settings },
        ...(profile?.status === 'Completed' ? [{ id: 'results', label: 'Assessment Results', icon: Award }] : []),
      ];

  const navigate = (id: string) => {
    if (activeCategory) {
      if (confirm('You have an active assessment session. Leaving will not pause your timer. Continue?')) {
        setActiveTab(id);
      }
    } else {
      setActiveTab(id);
    }
  };

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <aside id="app-sidebar" className="w-60 bg-[#002366] flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 pt-7 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
            <span className="text-[#002366] text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>P</span>
          </div>
          <span className="text-white font-semibold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>ProAssess</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {menuItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`sidebar-tab-${id}`}
              onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/5 font-normal'
              }`}
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-5 border-t border-white/10 pt-4 space-y-3">
        <div className="flex items-center gap-3 px-3">
          <div className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">{profile?.displayName || 'User'}</p>
            <p className="text-white/40 text-[11px] font-mono truncate mt-0.5">{profile?.email || ''}</p>
          </div>
        </div>

        <button
          id="btn-sidebar-logout"
          onClick={() => {
            if (activeCategory) {
              if (confirm('Logging out during an active session will submit your current answers. Continue?')) logout();
            } else {
              logout();
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
