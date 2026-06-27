import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';
import { User, Phone, CheckCircle2, AlertCircle, Save, ShieldAlert, Download, Trash2, Loader2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const { profile, updateProfileInfo, logout, user } = useAuth() as any;
  const { resetAssessment } = useAssessment();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [contactNumber, setContactNumber] = useState(profile?.contactNumber || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!displayName.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfileInfo(displayName.trim(), contactNumber.trim());
      setSuccessMsg('Profile updated successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-colors';

  const handleExportData = async () => {
    if (!user?.uid) return;
    setExportingData(true);
    try {
      const res = await fetch(`/api/candidate/export?uid=${user.uid}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `proassess-data-${new Date().toISOString().split('T')[0]}.json`,
        style: 'visibility:hidden',
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg('Export failed. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;
    if (!confirm('This will permanently delete your profile, all assessment results, and draft progress. This cannot be undone. Continue?')) return;
    setDeletingAccount(true);
    try {
      await fetch(`/api/candidate/${user.uid}/data`, { method: 'DELETE' });
      alert('Your data has been erased. You will now be signed out.');
      logout();
    } catch {
      setErrorMsg('Deletion failed. Please contact support.');
      setDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-0 space-y-6">

      {/* Profile form */}
      <div className="bg-white rounded-xl border border-slate-200 p-7">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Candidate Profile</h2>
        <p className="text-sm text-slate-500 mb-6">Update your contact details. These are attached to your scoring submissions.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" id="input-settings-name" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass} placeholder="Jane Doe" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">Contact Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" id="input-settings-phone" value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className={inputClass} placeholder="+1 (555) 012-3456" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">
              Email Address <span className="normal-case text-slate-400">(read-only)</span>
            </label>
            <input type="text" disabled value={profile?.email || ''}
              className="block w-full px-4 py-2.5 border border-slate-100 rounded-lg text-sm text-slate-400 bg-slate-50 font-mono cursor-not-allowed" />
            <p className="text-[11px] text-slate-400 mt-1.5">Email cannot be changed during an active assessment pipeline.</p>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-700">
              <AlertCircle size={16} className="text-rose-500 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button type="submit" id="btn-save-settings" disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors shadow-sm btn-primary cursor-pointer disabled:opacity-60">
              <Save size={15} />
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Privacy & data export */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">Your Data</h4>
          <p className="text-sm text-slate-500">Download a copy of your profile and assessment results, or request permanent erasure under GDPR / right-to-erasure.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportData} disabled={exportingData}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50">
            {exportingData ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Download My Data
          </button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          ProAssess stores your profile, contact details, and assessment scores. Data is held securely and only shared with recruiting organisations using this platform.
        </p>
      </div>

      {/* Danger zone */}
      <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Danger Zone</h4>
            <p className="text-sm text-slate-500 mt-1">Permanently wipes all answers, scores, and draft progress. These actions cannot be undone.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button id="btn-admin-reset-assessment"
            onClick={() => { if (confirm('This will permanently delete all answers and scores. Are you sure?')) resetAssessment(); }}
            className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium rounded-lg transition-colors cursor-pointer">
            Reset Assessment
          </button>
          <button onClick={handleDeleteAccount} disabled={deletingAccount}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50">
            {deletingAccount ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Erase All My Data
          </button>
        </div>
      </div>
    </div>
  );
};
