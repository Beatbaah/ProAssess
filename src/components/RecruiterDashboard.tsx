import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users, CheckCircle, TrendingUp, Search, X, Award,
  Phone, Mail, Calendar, AlertCircle, BarChart3, RefreshCw,
  Download, FileText, StickyNote, Loader2,
  UserPlus, Link, Clock, Send, Bell, GitCompare,
  Briefcase, Plus, Trash2, Building2, ShieldAlert
} from 'lucide-react';
import { InviteModal } from './InviteModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type AssessmentStatus = 'Not Started' | 'In Progress' | 'Completed';
type PipelineStatus = 'new' | 'under_review' | 'shortlisted' | 'rejected';

interface IntegritySummary {
  blurCount: number;
  copyAttempts: number;
  fullscreenExits: number;
  speedFlags: Record<string, boolean>;
  flagged: boolean;
}

interface CandidateProfile {
  uid: string;
  email: string;
  displayName: string;
  contactNumber?: string;
  createdAt: string;
  status: AssessmentStatus;
  aggregateScore?: number;
  lastSubmittedAt?: string;
  pipelineStatus?: PipelineStatus | null;
  recruiterNotes?: string;
  pipelineUpdatedAt?: string;
  positionName?: string;
  integrity?: IntegritySummary;
}

interface CandidateResult {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  scores: { Numerical: number; Verbal: number; Logical: number; Spatial: number };
  totalScore: number;
  categoryPercentages: { Numerical: number; Verbal: number; Logical: number; Spatial: number };
  submittedAt: string;
  feedback: string;
}

interface InvitationRecord {
  token: string;
  email: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'registered';
  personalMessage?: string | null;
}

interface Position {
  id: string;
  name: string;
  department?: string | null;
  createdAt: string;
}

// ─── Pipeline config ──────────────────────────────────────────────────────────

const PIPELINE: Record<PipelineStatus, { label: string; chip: string; dot: string }> = {
  new:          { label: 'New',          chip: 'bg-slate-100 text-slate-600 border-slate-200',     dot: 'bg-slate-400' },
  under_review: { label: 'Under Review', chip: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-500' },
  shortlisted:  { label: 'Shortlisted',  chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rejected:     { label: 'Rejected',     chip: 'bg-rose-50 text-rose-600 border-rose-200',          dot: 'bg-rose-500' },
};

const PIPELINE_ORDER: PipelineStatus[] = ['new', 'under_review', 'shortlisted', 'rejected'];

function PipelineChip({ status }: { status?: PipelineStatus | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const cfg = PIPELINE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RecruiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();

  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [results, setResults]       = useState<CandidateResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm]           = useState('');
  const [assessmentFilter, setAssessmentFilter] = useState<AssessmentStatus | 'all'>('all');
  const [pipelineFilter, setPipelineFilter]   = useState<PipelineStatus | 'all'>('all');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Drawer
  const [openId, setOpenId]             = useState<string | null>(null);
  const [drawerStage, setDrawerStage]   = useState<PipelineStatus>('new');
  const [drawerNotes, setDrawerNotes]   = useState('');
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [drawerSaved, setDrawerSaved]   = useState(false);

  // Invite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab]             = useState<'pipeline' | 'invitations' | 'positions'>('pipeline');
  const [invitations, setInvitations]         = useState<InvitationRecord[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  // Positions
  const [positions, setPositions]               = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [newPosName, setNewPosName]             = useState('');
  const [newPosDept, setNewPosDept]             = useState('');
  const [positionFilter, setPositionFilter]     = useState<string>('all');
  const [creatingPos, setCreatingPos]           = useState(false);

  // Notifications (localStorage-based)
  const notifKey = user ? `proassess_lastseen_${user.uid}` : null;
  const lastSeen = notifKey ? (localStorage.getItem(notifKey) || '1970-01-01') : '1970-01-01';
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Comparison
  const [showCompare, setShowCompare] = useState(false);

  // Drawer: candidate delete
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  // Drawer: position name editing
  const [drawerPosition, setDrawerPosition] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recruiter/candidates?requesterId=${user.uid}`);
      if (!res.ok) throw new Error(res.status === 403 ? 'Unauthorized: recruiter access required' : 'Failed to load candidates');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Server error');
      setCandidates(data.candidates || []);
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const fetchInvitations = async () => {
    if (!user) return;
    setInvitationsLoading(true);
    try {
      const res = await fetch(`/api/recruiter/invitations?requesterId=${user.uid}`);
      const data = await res.json();
      if (data.success) setInvitations(data.invitations || []);
    } finally {
      setInvitationsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invitations') fetchInvitations();
    if (activeTab === 'positions') fetchPositions();
  }, [activeTab, user]);

  const fetchPositions = async () => {
    if (!user) return;
    setPositionsLoading(true);
    try {
      const res = await fetch(`/api/recruiter/positions?requesterId=${user.uid}`);
      const data = await res.json();
      if (data.success) setPositions(data.positions || []);
    } finally {
      setPositionsLoading(false);
    }
  };

  const createPosition = async () => {
    if (!newPosName.trim() || !user) return;
    setCreatingPos(true);
    try {
      const res = await fetch('/api/recruiter/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user.uid, name: newPosName.trim(), department: newPosDept.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setPositions(p => [...p, data.position]);
        setNewPosName(''); setNewPosDept('');
      }
    } finally {
      setCreatingPos(false);
    }
  };

  const deletePosition = async (id: string) => {
    if (!user || !confirm('Delete this position? Existing candidates linked to it will keep their position label.')) return;
    await fetch(`/api/recruiter/positions/${id}?requesterId=${user.uid}`, { method: 'DELETE' });
    setPositions(p => p.filter(x => x.id !== id));
  };

  const deleteCandidate = async (uid: string) => {
    if (!user || !confirm('Permanently erase this candidate\'s profile and all assessment data? This cannot be undone.')) return;
    setDeletingCandidate(true);
    try {
      await fetch(`/api/recruiter/candidate/${uid}/data`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user.uid }),
      });
      setCandidates(p => p.filter(c => c.uid !== uid));
      setResults(p => p.filter(r => r.userId !== uid));
      setOpenId(null);
    } finally {
      setDeletingCandidate(false);
    }
  };

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Pipeline mutations ─────────────────────────────────────────────────────

  const savePipeline = async (uid: string, pipelineStatus: PipelineStatus, recruiterNotes: string, positionName: string) => {
    setSavingDrawer(true);
    try {
      const res = await fetch(`/api/recruiter/candidate/${uid}/pipeline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user!.uid, pipelineStatus, recruiterNotes, positionName: positionName.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Update failed');
      setCandidates(prev => prev.map(c =>
        c.uid === uid
          ? { ...c, pipelineStatus, recruiterNotes, positionName: positionName.trim() || c.positionName, pipelineUpdatedAt: new Date().toISOString() }
          : c
      ));
      setDrawerSaved(true);
      setTimeout(() => setDrawerSaved(false), 2500);
    } finally {
      setSavingDrawer(false);
    }
  };

  const bulkSetStage = async (pipelineStatus: PipelineStatus) => {
    if (selectedIds.size === 0 || !user) return;
    setBulkUpdating(true);
    try {
      const res = await fetch('/api/recruiter/candidates/bulk-pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user.uid, uids: [...selectedIds], pipelineStatus }),
      });
      if (!res.ok) throw new Error('Bulk update failed');
      const now = new Date().toISOString();
      setCandidates(prev => prev.map(c =>
        selectedIds.has(c.uid) ? { ...c, pipelineStatus, pipelineUpdatedAt: now } : c
      ));
      setSelectedIds(new Set());
    } finally {
      setBulkUpdating(false);
    }
  };

  // ── Open drawer ────────────────────────────────────────────────────────────

  const openDrawer = (uid: string) => {
    const c = candidates.find(x => x.uid === uid);
    setDrawerStage(c?.pipelineStatus || 'new');
    setDrawerNotes(c?.recruiterNotes || '');
    setDrawerPosition(c?.positionName || '');
    setDrawerSaved(false);
    setOpenId(uid);
  };

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (profile?.role !== 'recruiter') {
    return (
      <div className="max-w-md mx-auto my-16 bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-5">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Recruiter Access Required</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          This view contains sensitive candidate evaluation data. Your profile does not have recruiter permissions.
        </p>
      </div>
    );
  }

  // ── Derived metrics ────────────────────────────────────────────────────────

  const totalApplicants      = candidates.length;
  const completedCandidates  = candidates.filter(c => c.status === 'Completed');
  const completedCount       = completedCandidates.length;
  const completedScores      = completedCandidates.filter(c => c.aggregateScore != null).map(c => c.aggregateScore!);
  const averageScore         = completedScores.length > 0
    ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length) : 0;

  // Pipeline stage counts (completed candidates only)
  const stageCounts = useMemo(() => {
    const counts: Record<PipelineStatus, number> = { new: 0, under_review: 0, shortlisted: 0, rejected: 0 };
    completedCandidates.forEach(c => {
      const s = c.pipelineStatus || 'new';
      counts[s]++;
    });
    return counts;
  }, [candidates]);

  // Chart data
  const scoreRanges = useMemo(() => {
    const ranges = [
      { name: '0–20',   count: 0, color: '#f43f5e' },
      { name: '21–40',  count: 0, color: '#f59e0b' },
      { name: '41–60',  count: 0, color: '#3b82f6' },
      { name: '61–80',  count: 0, color: '#10b981' },
      { name: '81–100', count: 0, color: '#047857' },
    ];
    completedCandidates.forEach(c => {
      const s = c.aggregateScore ?? 0;
      if (s <= 20) ranges[0].count++;
      else if (s <= 40) ranges[1].count++;
      else if (s <= 60) ranges[2].count++;
      else if (s <= 80) ranges[3].count++;
      else ranges[4].count++;
    });
    return ranges;
  }, [candidates]);

  const categoryAverages = useMemo(() => {
    const sums = { Numerical: 0, Verbal: 0, Logical: 0, Spatial: 0 };
    results.forEach(r => {
      sums.Numerical += r.scores.Numerical || 0;
      sums.Verbal    += r.scores.Verbal    || 0;
      sums.Logical   += r.scores.Logical   || 0;
      sums.Spatial   += r.scores.Spatial   || 0;
    });
    const n = results.length || 1;
    return ['Numerical', 'Verbal', 'Logical', 'Spatial'].map((name, i) => ({
      name,
      average: Math.round((sums[name as keyof typeof sums] / n / 25) * 100),
      fill: i % 2 === 0 ? '#002366' : '#3b82f6',
    }));
  }, [results]);

  // Notifications: new completions since last seen
  const newCompletions = useMemo(() =>
    completedCandidates.filter(c => c.lastSubmittedAt && c.lastSubmittedAt > lastSeen),
    [completedCandidates, lastSeen]
  );

  const markAllSeen = () => {
    if (notifKey) localStorage.setItem(notifKey, new Date().toISOString());
    setNotifOpen(false);
    // force re-render by re-setting candidates (triggers useMemo)
    setCandidates(p => [...p]);
  };

  // Comparison candidates
  const compareList = useMemo(() =>
    candidates.filter(c => selectedIds.has(c.uid) && c.status === 'Completed'),
    [candidates, selectedIds]
  );

  // Filtering
  const filteredCandidates = useMemo(() => candidates.filter(c => {
    const matchSearch    = c.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAssess    = assessmentFilter === 'all' || c.status === assessmentFilter;
    const effectiveStage = c.pipelineStatus || 'new';
    const matchPipeline  = pipelineFilter === 'all' || effectiveStage === pipelineFilter;
    const matchPosition  = positionFilter === 'all' || (c.positionName || '') === positionFilter;
    return matchSearch && matchAssess && matchPipeline && matchPosition;
  }), [candidates, searchTerm, assessmentFilter, pipelineFilter, positionFilter]);

  // Unique position names for filter dropdown
  const positionNames = useMemo(() => {
    const names = new Set(candidates.map(c => c.positionName).filter(Boolean) as string[]);
    return [...names].sort();
  }, [candidates]);

  // Bulk selection helpers
  const allVisibleSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.uid));
  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const n = new Set(prev); filteredCandidates.forEach(c => n.delete(c.uid)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); filteredCandidates.forEach(c => n.add(c.uid)); return n; });
    }
  };
  const toggleOne = (uid: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  };

  // CSV export
  const handleExportCSV = () => {
    const headers = ['Name','Email','Phone','Assessment Status','Pipeline Stage','Score (/100)',
      'Numerical (/25)','Verbal (/25)','Logical (/25)','Spatial (/25)',
      'Registered','Completed','Recruiter Notes',
      'Integrity Flagged','Focus Losses','Copy Attempts','Fullscreen Exits',
      'AI Summary'];
    const rows = filteredCandidates.map(c => {
      const r = results.find(x => x.userId === c.uid);
      return [
        c.displayName, c.email, c.contactNumber || 'N/A', c.status,
        c.pipelineStatus ? PIPELINE[c.pipelineStatus].label : 'New',
        c.aggregateScore != null ? `${c.aggregateScore}` : 'N/A',
        r?.scores.Numerical != null ? `${r.scores.Numerical}` : 'N/A',
        r?.scores.Verbal    != null ? `${r.scores.Verbal}`    : 'N/A',
        r?.scores.Logical   != null ? `${r.scores.Logical}`   : 'N/A',
        r?.scores.Spatial   != null ? `${r.scores.Spatial}`   : 'N/A',
        new Date(c.createdAt).toLocaleDateString(),
        c.lastSubmittedAt ? new Date(c.lastSubmittedAt).toLocaleDateString() : 'N/A',
        c.recruiterNotes || '',
        c.integrity?.flagged ? 'Yes' : 'No',
        c.integrity?.blurCount ?? 'N/A',
        c.integrity?.copyAttempts ?? 'N/A',
        c.integrity?.fullscreenExits ?? 'N/A',
        r?.feedback ? r.feedback.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ') : 'N/A',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `proassess_${new Date().toISOString().split('T')[0]}.csv`,
      style: 'visibility:hidden',
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Drawer data
  const drawerCandidate = candidates.find(c => c.uid === openId);
  const drawerResult    = results.find(r => r.userId === openId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div id="recruiter-dashboard" className="space-y-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Recruiter Console</p>
          <h1 className="text-2xl font-semibold text-slate-900">Candidate Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Manage candidate stages, review scores, and add recruiter notes.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(v => !v)}
              className="relative p-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors cursor-pointer">
              <Bell size={16} />
              {newCompletions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {newCompletions.length > 9 ? '9+' : newCompletions.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-11 z-40 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Recent Completions</p>
                  {newCompletions.length > 0 && (
                    <button onClick={markAllSeen} className="text-xs text-[#002366] hover:underline cursor-pointer">Mark all seen</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                  {newCompletions.length === 0 ? (
                    <p className="px-4 py-5 text-xs text-slate-400 text-center">No new completions since your last visit.</p>
                  ) : newCompletions.map(c => (
                    <div key={c.uid} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                      <p className="text-sm font-medium text-slate-800">{c.displayName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Submitted {c.lastSubmittedAt ? new Date(c.lastSubmittedAt).toLocaleString() : '—'}
                        {c.positionName && ` · ${c.positionName}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 border border-[#002366] text-[#002366] hover:bg-[#002366] hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            <UserPlus size={15} /> Invite Candidates
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 bg-[#002366] hover:bg-[#00308f] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mb-2">
        {([
          { id: 'pipeline',    label: 'Pipeline' },
          { id: 'invitations', label: 'Invitations' },
          { id: 'positions',   label: 'Positions' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#002366] text-[#002366]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'pipeline' && (loading && candidates.length === 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />)}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 h-80 animate-pulse" />
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-xl text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-rose-500" />
          <p className="text-sm font-semibold text-rose-800">{error}</p>
          <button onClick={fetchData}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors cursor-pointer">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Applicants', value: totalApplicants,  icon: Users,        cls: 'text-blue-600 bg-blue-50' },
              { label: 'Completed',        value: `${completedCount} (${totalApplicants > 0 ? Math.round(completedCount/totalApplicants*100) : 0}%)`,
                icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Average Score',    value: `${averageScore}/100`, icon: TrendingUp, cls: 'text-violet-600 bg-violet-50' },
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cls}`}><Icon size={20} /></div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-xl font-semibold text-slate-900 mt-0.5 font-mono">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline stage summary */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Pipeline Overview — completed candidates</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PIPELINE_ORDER.map(stage => {
                const cfg   = PIPELINE[stage];
                const count = stageCounts[stage];
                const active = pipelineFilter === stage;
                return (
                  <button key={stage} onClick={() => setPipelineFilter(active ? 'all' : stage)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all cursor-pointer text-left ${
                      active ? `${cfg.chip} ring-2 ring-offset-1 ring-current` : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}>
                    <div>
                      <p className="text-xs font-medium text-slate-500">{cfg.label}</p>
                      <p className="text-2xl font-semibold text-slate-900 mt-0.5 font-mono">{count}</p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Score Distribution</h3>
              </div>
              {completedCount === 0 ? (
                <div className="h-52 flex items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-xs">
                  No completed assessments yet
                </div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreRanges} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,35,102,0.03)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="count" radius={[4,4,0,0]} maxBarSize={40}>
                        {scoreRanges.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Domain Averages</h3>
              </div>
              {completedCount === 0 ? (
                <div className="h-52 flex items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-xs">
                  No results to analyse yet
                </div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryAverages} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0,100]} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => [`${v}%`, 'Avg']} />
                      <Bar dataKey="average" radius={[4,4,0,0]} maxBarSize={40}>
                        {categoryAverages.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Candidate table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

            {/* Table toolbar */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search by name or email…" value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select value={assessmentFilter} onChange={e => setAssessmentFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002366] cursor-pointer">
                  <option value="all">All Assessment Stages</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>

                <select value={pipelineFilter} onChange={e => setPipelineFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002366] cursor-pointer">
                  <option value="all">All Pipeline Stages</option>
                  {PIPELINE_ORDER.map(s => <option key={s} value={s}>{PIPELINE[s].label}</option>)}
                </select>

                {positionNames.length > 0 && (
                  <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002366] cursor-pointer">
                    <option value="all">All Positions</option>
                    {positionNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}

                <button onClick={handleExportCSV} disabled={filteredCandidates.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#002366] hover:bg-[#00308f] disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed">
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="px-4 py-2.5 bg-[#002366]/5 border-b border-[#002366]/10 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-medium text-[#002366]">{selectedIds.size} selected</span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-500">Move to:</span>
                {PIPELINE_ORDER.map(stage => (
                  <button key={stage} disabled={bulkUpdating} onClick={() => bulkSetStage(stage)}
                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${PIPELINE[stage].chip}`}>
                    {bulkUpdating ? <Loader2 size={11} className="animate-spin" /> : PIPELINE[stage].label}
                  </button>
                ))}
                {compareList.length >= 2 && compareList.length <= 4 && (
                  <>
                    <span className="text-slate-300 text-xs">·</span>
                    <button onClick={() => setShowCompare(true)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-full text-xs font-medium transition-colors cursor-pointer">
                      <GitCompare size={12} /> Compare {compareList.length}
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                  Clear selection
                </button>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}
                        className="rounded border-slate-300 text-[#002366] focus:ring-[#002366] cursor-pointer" />
                    </th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Position</th>
                    <th className="py-3 px-4">Assessment</th>
                    <th className="py-3 px-4">Pipeline Stage</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Registered</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <Users size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">No candidates match your filters.</p>
                      </td>
                    </tr>
                  ) : filteredCandidates.map(c => {
                    const isSelected = selectedIds.has(c.uid);
                    const pStage = c.pipelineStatus || 'new';
                    return (
                      <tr key={c.uid} className={`transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}>
                        <td className="pl-4 pr-2 py-3.5">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleOne(c.uid)}
                            className="rounded border-slate-300 text-[#002366] focus:ring-[#002366] cursor-pointer" />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-900">{c.displayName}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{c.email}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          {c.positionName
                            ? <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full"><Briefcase size={10} />{c.positionName}</span>
                            : <span className="text-xs text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            c.status === 'Completed'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            c.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {c.status === 'Completed'
                            ? <PipelineChip status={pStage} />
                            : <span className="text-xs text-slate-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3.5">
                          {c.status === 'Completed' && c.aggregateScore != null ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold font-mono px-2 py-0.5 rounded ${
                                c.aggregateScore >= 80 ? 'bg-emerald-50 text-emerald-700' :
                                c.aggregateScore >= 50 ? 'bg-blue-50 text-blue-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>{c.aggregateScore}/100</span>
                              <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${
                                  c.aggregateScore >= 80 ? 'bg-emerald-500' :
                                  c.aggregateScore >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                }`} style={{ width: `${c.aggregateScore}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                          {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {c.integrity?.flagged && (
                              <span title="Integrity flag — open profile for details"
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                                ⚑ Flagged
                              </span>
                            )}
                            <button onClick={() => openDrawer(c.uid)}
                              className="px-3 py-1.5 border border-slate-200 hover:border-[#002366] hover:bg-[#002366] hover:text-white text-slate-600 rounded-lg text-xs font-medium transition-all cursor-pointer">
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer count */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">
                Showing {filteredCandidates.length} of {candidates.length} candidates
                {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
              </p>
            </div>
          </div>
        </>
      ))}

      {/* ── Invitations Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'invitations' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Candidates you've invited to take the ProAssess assessment.</p>
            <button onClick={fetchInvitations} disabled={invitationsLoading}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
              <RefreshCw size={13} className={invitationsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {invitationsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />)}
            </div>
          ) : invitations.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-14 text-center">
              <Send size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600 mb-1">No invitations sent yet</p>
              <p className="text-xs text-slate-400 mb-5">Invite candidates to complete their cognitive assessment.</p>
              <button onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
                <UserPlus size={14} /> Invite Candidates
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="py-3 px-5">Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invited</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map(inv => {
                    const expired = new Date(inv.expiresAt) < new Date();
                    const inviteUrl = `${window.location.origin}?invite=${inv.token}`;
                    const daysLeft = Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / 86400000));
                    return (
                      <tr key={inv.token} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-slate-800">{inv.email}</td>
                        <td className="px-4 py-3.5">
                          {inv.status === 'registered' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Registered
                            </span>
                          ) : expired ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-rose-50 text-rose-600 border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                              <Clock size={10} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                          {new Date(inv.invitedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                          {expired ? <span className="text-rose-400">Expired</span> : `${daysLeft}d left`}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => { navigator.clipboard.writeText(inviteUrl); }}
                            title="Copy invite link"
                            className="p-1.5 text-slate-400 hover:text-[#002366] transition-colors cursor-pointer inline-flex items-center gap-1 text-xs">
                            <Link size={13} /> Copy
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400">{invitations.length} invitation{invitations.length !== 1 ? 's' : ''} sent</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Positions Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'positions' && (
        <div className="space-y-5">
          {/* Create position form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Briefcase size={15} className="text-slate-400" /> Create a Position</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                value={newPosName} onChange={e => setNewPosName(e.target.value)}
                placeholder="Position title (e.g. Data Analyst)"
                className="flex-1 min-w-48 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
                onKeyDown={e => { if (e.key === 'Enter') createPosition(); }}
              />
              <input
                value={newPosDept} onChange={e => setNewPosDept(e.target.value)}
                placeholder="Department (optional)"
                className="flex-1 min-w-36 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
                onKeyDown={e => { if (e.key === 'Enter') createPosition(); }}
              />
              <button onClick={createPosition} disabled={!newPosName.trim() || creatingPos}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                {creatingPos ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </button>
            </div>
          </div>

          {/* Positions list */}
          {positionsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
          ) : positions.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-14 text-center">
              <Building2 size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600 mb-1">No positions yet</p>
              <p className="text-xs text-slate-400">Create positions above to tag candidates and invitations with the role they're being evaluated for.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="py-3 px-5">Position</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Candidates</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.map(pos => {
                    const count = candidates.filter(c => c.positionName === pos.name).length;
                    return (
                      <tr key={pos.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-medium text-slate-800">{pos.name}</td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">{pos.department || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{count}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">
                          {new Date(pos.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button onClick={() => deletePosition(pos.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer" title="Delete position">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400">{positions.length} position{positions.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Comparison Modal ──────────────────────────────────────────────────── */}
      {showCompare && compareList.length >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Candidate Comparison</h2>
                <p className="text-xs text-slate-500 mt-0.5">Side-by-side domain scores for {compareList.length} selected candidates.</p>
              </div>
              <button onClick={() => setShowCompare(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X size={17} /></button>
            </div>
            <div className="overflow-auto flex-1 p-6">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compareList.length}, minmax(200px, 1fr))` }}>
                {compareList.map(c => {
                  const r = results.find(x => x.userId === c.uid);
                  const pCfg = c.pipelineStatus ? PIPELINE[c.pipelineStatus] : PIPELINE.new;
                  return (
                    <div key={c.uid} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                      {/* Candidate header */}
                      <div className="text-center space-y-2">
                        <div className="w-11 h-11 rounded-full bg-[#002366]/10 border-2 border-[#002366]/20 flex items-center justify-center text-[#002366] font-semibold text-sm mx-auto">
                          {c.displayName.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{c.displayName}</p>
                          {c.positionName && <p className="text-[11px] text-slate-400 mt-0.5">{c.positionName}</p>}
                        </div>
                        {/* Overall score */}
                        <div className="text-3xl font-bold font-mono text-[#002366]">{c.aggregateScore ?? '—'}<span className="text-sm font-normal text-slate-400">/100</span></div>
                        <PipelineChip status={c.pipelineStatus} />
                      </div>
                      {/* Domain bars */}
                      {r && (
                        <div className="space-y-3">
                          {(Object.entries(r.scores) as [string, number][]).map(([domain, score]) => {
                            const pct = Math.round((score / 25) * 100);
                            return (
                              <div key={domain}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-600">{domain}</span>
                                  <span className="font-mono text-slate-700 font-medium">{score}/25</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                    style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button onClick={() => setShowCompare(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ─────────────────────────────────────────────────────── */}
      {showInviteModal && user && (
        <InviteModal
          recruiterId={user.uid}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            if (activeTab === 'invitations') fetchInvitations();
          }}
        />
      )}

      {/* ── Candidate Profile Drawer ─────────────────────────────────────────── */}
      {openId && drawerCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setOpenId(null)} />

          <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-slide-in overflow-y-auto">

            {/* Drawer header */}
            <div className="px-6 py-5 border-b border-slate-200 bg-[#002366] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white text-sm font-semibold">
                  {drawerCandidate.displayName.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{drawerCandidate.displayName}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{drawerCandidate.email}</p>
                </div>
              </div>
              <button onClick={() => setOpenId(null)} className="p-2 hover:bg-white/10 rounded-lg text-white cursor-pointer">
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ── Pipeline Decision ── */}
              {drawerCandidate.status === 'Completed' && (
                <section className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pipeline Decision</h3>

                  {/* Stage selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {PIPELINE_ORDER.map(stage => {
                      const cfg = PIPELINE[stage];
                      const active = drawerStage === stage;
                      return (
                        <button key={stage} onClick={() => setDrawerStage(stage)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                            active ? `${cfg.chip} ring-2 ring-offset-1 ring-current` : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${active ? cfg.dot : 'bg-slate-300'}`} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <Briefcase size={12} /> Job Position
                    </label>
                    <div className="relative">
                      <select value={drawerPosition} onChange={e => setDrawerPosition(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] cursor-pointer appearance-none">
                        <option value="">— Not assigned —</option>
                        {positions.map(p => <option key={p.id} value={p.name}>{p.name}{p.department ? ` · ${p.department}` : ''}</option>)}
                        {drawerPosition && !positions.find(p => p.name === drawerPosition) && (
                          <option value={drawerPosition}>{drawerPosition}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <StickyNote size={12} /> Recruiter Notes
                    </label>
                    <textarea rows={4} value={drawerNotes} onChange={e => setDrawerNotes(e.target.value)}
                      placeholder="Add internal notes about this candidate — visible only to recruiters…"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] resize-none transition-colors" />
                  </div>

                  {/* Save row */}
                  <div className="flex items-center justify-between">
                    {drawerCandidate.pipelineUpdatedAt ? (
                      <p className="text-[11px] text-slate-400">
                        Last updated {new Date(drawerCandidate.pipelineUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    ) : <span />}
                    <button onClick={() => savePipeline(openId, drawerStage, drawerNotes, drawerPosition)} disabled={savingDrawer}
                      className="flex items-center gap-2 px-4 py-2 bg-[#002366] hover:bg-[#00308f] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-60">
                      {savingDrawer
                        ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                        : drawerSaved
                        ? <><CheckCircle size={13} /> Saved</>
                        : 'Save Decision'}
                    </button>
                  </div>
                </section>
              )}

              {/* ── Contact info ── */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contact</h4>
                  {[
                    { icon: Mail,     text: drawerCandidate.email },
                    { icon: Phone,    text: drawerCandidate.contactNumber || 'Not provided' },
                    { icon: Calendar, text: `Registered ${new Date(drawerCandidate.createdAt).toLocaleDateString()}` },
                  ].map(({ icon: Icon, text }) => (
                    <p key={text} className="flex items-center gap-2 text-xs text-slate-600">
                      <Icon size={13} className="text-slate-400 shrink-0" /> {text}
                    </p>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assessment Status</h4>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${
                    drawerCandidate.status === 'Completed'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    drawerCandidate.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>{drawerCandidate.status}</span>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {drawerCandidate.lastSubmittedAt
                      ? `Submitted ${new Date(drawerCandidate.lastSubmittedAt).toLocaleString()}`
                      : 'Not yet submitted'}
                  </p>
                </div>
              </section>

              {/* ── Score breakdown ── */}
              {drawerCandidate.status === 'Completed' && drawerResult ? (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Award size={13} /> Cognitive Scores
                      </h3>
                      <span className="text-sm font-semibold font-mono text-[#002366] bg-blue-50 px-3 py-0.5 rounded border border-blue-100">
                        {drawerResult.totalScore}/100
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(drawerResult.scores).map(([cat, score]) => {
                        const pct = Math.round((Number(score) / 25) * 100);
                        return (
                          <div key={cat} className="bg-white rounded-lg border border-slate-100 p-3.5 space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-700">{cat}</span>
                              <span className="font-mono text-slate-500">{score}/25 · {pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <FileText size={13} /> AI Executive Summary
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed italic">
                      "{drawerResult.feedback}"
                    </div>
                  </section>
                </>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <AlertCircle size={24} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-600 mb-1">Assessment not yet submitted</p>
                  <p className="text-xs text-slate-400">Scores and AI summary will appear here once the candidate completes all sections.</p>
                </div>
              )}
            </div>

            {/* ── Integrity Report ── */}
            {drawerCandidate.integrity && (
              <div className="px-5 pb-4">
                <div className={`rounded-xl border p-4 ${drawerCandidate.integrity.flagged ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5 ${drawerCandidate.integrity.flagged ? 'text-amber-700' : 'text-slate-500'}`}>
                    {drawerCandidate.integrity.flagged ? '⚑ Integrity Flags Detected' : '✓ No Integrity Issues'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[
                      { label: 'Focus Losses', val: drawerCandidate.integrity.blurCount, warn: drawerCandidate.integrity.blurCount > 3 },
                      { label: 'Copy Attempts', val: drawerCandidate.integrity.copyAttempts, warn: drawerCandidate.integrity.copyAttempts > 0 },
                      { label: 'Fullscreen Exits', val: drawerCandidate.integrity.fullscreenExits, warn: false },
                    ].map(({ label, val, warn }) => (
                      <div key={label} className={`rounded-lg p-2 border ${warn ? 'bg-amber-100 border-amber-300' : 'bg-white border-slate-200'}`}>
                        <p className={`text-lg font-bold font-mono ${warn ? 'text-amber-700' : 'text-slate-700'}`}>{val}</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                  {Object.entries(drawerCandidate.integrity.speedFlags).some(([, v]) => v) && (
                    <p className="text-[11px] text-amber-700 font-medium">
                      Speed flag: {Object.entries(drawerCandidate.integrity.speedFlags).filter(([,v]) => v).map(([k]) => k).join(', ')} completed in under 3 minutes.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Drawer footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
              <button onClick={() => deleteCandidate(drawerCandidate.uid)} disabled={deletingCandidate}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                {deletingCandidate ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                Erase Data
              </button>
              <button onClick={() => setOpenId(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
