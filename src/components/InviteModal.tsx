import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Mail, Send, Copy, Check, AlertCircle, Loader2, ExternalLink, Briefcase } from 'lucide-react';

interface InviteResult {
  email: string;
  token: string;
  inviteUrl: string;
  emailSent: boolean;
}

interface Position {
  id: string;
  name: string;
  department?: string | null;
}

interface InviteModalProps {
  recruiterId: string;
  onClose: () => void;
  onInvited: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ recruiterId, onClose, onInvited }) => {
  const [emails, setEmails]             = useState<string[]>(['']);
  const [message, setMessage]           = useState('');
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [results, setResults]           = useState<InviteResult[] | null>(null);
  const [copiedToken, setCopiedToken]   = useState<string | null>(null);

  // Position
  const [positions, setPositions]       = useState<Position[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');

  useEffect(() => {
    fetch(`/api/recruiter/positions?requesterId=${recruiterId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setPositions(d.positions); })
      .catch(() => {});
  }, [recruiterId]);

  const addEmail    = () => setEmails(p => [...p, '']);
  const removeEmail = (i: number) => setEmails(p => p.filter((_, idx) => idx !== i));
  const setEmail    = (i: number, v: string) => setEmails(p => p.map((e, idx) => idx === i ? v : e));

  const validEmails = emails.map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const selectedPosition = positions.find(p => p.id === selectedPositionId);

  const handleSend = async () => {
    if (validEmails.length === 0) { setError('Enter at least one valid email address.'); return; }
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/recruiter/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: recruiterId,
          emails: validEmails,
          personalMessage: message.trim() || undefined,
          positionId: selectedPositionId || undefined,
          positionName: selectedPosition?.name || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Invite failed');
      setResults(data.invited);
      onInvited();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const copyLink = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Invite Candidates</h2>
            <p className="text-xs text-slate-500 mt-0.5">Send personalised assessment invitations by email.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer">
            <X size={17} />
          </button>
        </div>

        {!results ? (
          <>
            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

              {/* Position selector */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Job Position <span className="normal-case text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select value={selectedPositionId} onChange={e => setSelectedPositionId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] cursor-pointer appearance-none">
                    <option value="">No specific position</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.department ? ` · ${p.department}` : ''}</option>
                    ))}
                  </select>
                </div>
                {positions.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">Create positions in the Positions tab to link invites to a role.</p>
                )}
              </div>

              {/* Email inputs */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Candidate Email Addresses
                </label>
                {emails.map((email, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(i, e.target.value)}
                        placeholder="candidate@company.com"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-colors"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                      />
                    </div>
                    {emails.length > 1 && (
                      <button onClick={() => removeEmail(i)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addEmail}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#002366] hover:text-[#00308f] transition-colors cursor-pointer mt-1">
                  <Plus size={14} /> Add another email
                </button>
              </div>

              {/* Personal message */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Personal Message <span className="normal-case text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Add a short note that will appear in the invitation email…"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] resize-none transition-colors"
                />
              </div>

              {/* Info box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-500 leading-relaxed space-y-1">
                <p>Each candidate receives a unique link valid for <strong className="text-slate-700">7 days</strong>.</p>
                <p>If SMTP is not configured, links are still generated and shown below so you can share them manually.</p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {validEmails.length > 0 ? `${validEmails.length} valid address${validEmails.length > 1 ? 'es' : ''}` : 'No valid addresses yet'}
              </span>
              <div className="flex gap-2.5">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleSend} disabled={sending || validEmails.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Invitations</>}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Results screen */
          <>
            <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-600">
                {results.filter(r => r.emailSent).length} of {results.length} email{results.length > 1 ? 's' : ''} sent successfully.
                {results.some(r => !r.emailSent) && ' Copy the links below for the remaining candidates.'}
              </p>

              {results.map(r => (
                <div key={r.token} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.email}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{r.inviteUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.emailSent
                      ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check size={13} /> Sent</span>
                      : <span className="text-xs text-amber-600 font-medium">Not sent</span>
                    }
                    <button onClick={() => copyLink(r.inviteUrl, r.token)}
                      className="p-1.5 text-slate-400 hover:text-[#002366] transition-colors cursor-pointer" title="Copy invite link">
                      {copiedToken === r.token ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                    <a href={r.inviteUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-[#002366] transition-colors cursor-pointer" title="Preview link">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={onClose} className="px-5 py-2 bg-[#002366] hover:bg-[#00308f] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
