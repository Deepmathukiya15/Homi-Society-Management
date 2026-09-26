import { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, UserPlus, UserRoundMinus, Users } from 'lucide-react';
import { EmptyState, Input, SectionCard } from '../../components/ui.jsx';
import { authApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminCommittee() {
  const toast = useToast();
  const [residents, setResidents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await authApi.pendingUsers({ role: 'RESIDENT', approvalStatus: 'APPROVED' });
      setResidents(data.users || []);
    } catch (err) {
      toast.alert('Committee List Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return residents;
    return residents.filter((resident) =>
      [resident.name, resident.email, resident.flatId].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [residents, search]);

  const toggle = async (resident) => {
    const next = !resident.isCommitteeMember;
    setUpdatingId(resident._id);
    try {
      const result = await authApi.setCommitteeMembership(resident._id, next);
      setResidents((current) => current.map((item) => item._id === resident._id ? result.user : item));
      toast.success('Committee Updated', result.message);
    } catch (err) {
      toast.alert('Could Not Update Committee', err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const assigned = residents.filter((resident) => resident.isCommitteeMember).length;

  return (
    <div className="space-y-5">
      <SectionCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Committee access</h2>
            <p className="text-xs text-slate-500">{assigned} committee member{assigned === 1 ? '' : 's'} • approved resident accounts only</p>
          </div>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <Input className="!pl-9" placeholder="Search name, email, or flat" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </SectionCard>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900 leading-relaxed">
        Committee members sign in with their existing resident account. Their separate Committee Panel is limited to
        publishing notices and scheduling or managing meetings; your Admin Panel and its billing controls remain admin-only.
      </div>

      {loading ? (
        <SectionCard className="p-6 text-center text-sm text-slate-500">Loading approved residents…</SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard><EmptyState icon={Users} title="No matching residents" message="Try another search, or approve resident registrations first." /></SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((resident) => (
            <div key={resident._id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{resident.name}</h3>
                  {resident.isCommitteeMember && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3" /> Committee</span>}
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">{resident.email}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Flat <span className="font-mono font-bold">{resident.flatId || '—'}</span></p>
              </div>
              <button
                type="button"
                onClick={() => toggle(resident)}
                disabled={updatingId === resident._id}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 ${resident.isCommitteeMember ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}
              >
                {resident.isCommitteeMember ? <UserRoundMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {updatingId === resident._id ? 'Saving…' : resident.isCommitteeMember ? 'Remove' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
