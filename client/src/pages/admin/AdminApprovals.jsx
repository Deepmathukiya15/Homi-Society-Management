import { useEffect, useState } from 'react';
import { BadgeCheck, Ban, CheckCheck, Clock, Mail, Phone, RefreshCw, UserCheck, UserRound, XCircle } from 'lucide-react';
import { Button, EmptyState, Pill, SectionCard, Select, StatCard } from '../../components/ui.jsx';
import { authApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatMobile } from '../../lib/format.js';

const ROLE_PILL = {
  RESIDENT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
  GUARD: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const when = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function AdminApprovals({ onChanged }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await authApi.pendingUsers();
      setUsers(data.users || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      toast.alert('Approvals Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (user, status) => {
    setBusyId(user._id);
    try {
      const data = await authApi.setApproval(user._id, status);
      toast.success(
        status === 'APPROVED' ? 'Account Approved' : 'Registration Rejected',
        status === 'APPROVED'
          ? `${user.name} can now sign in to the ${user.role.toLowerCase()} portal.`
          : `${user.name}'s registration was rejected.`
      );
      await load();
      onChanged?.();
    } catch (err) {
      toast.alert('Approval Failed', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const visible = users.filter((u) => (filter === 'ALL' ? true : (u.approvalStatus || 'APPROVED') === filter));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting Approval" value={counts.pending} sub="cannot sign in yet" icon={Clock} tone="amber" />
        <StatCard label="Approved Accounts" value={counts.approved} sub="active logins" icon={BadgeCheck} tone="emerald" />
        <StatCard label="Rejected" value={counts.rejected} sub="blocked registrations" icon={Ban} tone="rose" />
        <StatCard
          label="Approval Rule"
          value="Admin decides"
          sub="residents & guards only"
          icon={UserCheck}
          tone="indigo"
        />
      </div>

      <SectionCard
        title="Registration Approval Queue"
        subtitle="New residents and guards are created with PENDING status — they can sign in only after you approve them."
        action={
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="!w-auto !text-[11px] font-semibold !py-2 !px-2.5"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All accounts</option>
            </Select>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        {loading && !users.length ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-50 border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CheckCheck}
            title={filter === 'PENDING' ? 'No registrations waiting for approval' : 'Nothing in this list'}
            message="When a resident or guard signs up, their request appears here for approval."
          />
        ) : (
          <div className="space-y-3">
            {visible.map((u) => {
              const status = u.approvalStatus || 'APPROVED';
              const isPending = status === 'PENDING';
              return (
                <div
                  key={u._id}
                  data-user-email={u.email}
                  data-approval-status={status}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl border transition-colors ${
                    isPending ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <UserRound className="w-5 h-5 text-slate-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{u.name}</span>
                      <Pill className={ROLE_PILL[u.role]}>{u.role}</Pill>
                      {u.flatId && <span className="text-[11px] font-mono font-bold text-slate-600">{u.flatId}</span>}
                      <Pill
                        className={
                          status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }
                      >
                        {status === 'PENDING' ? 'AWAITING APPROVAL' : status}
                      </Pill>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> {u.email}
                      </span>
                      {u.contactNumber && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> {formatMobile(u.contactNumber)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Registered {when(u.createdAt)}
                      </span>
                      {u.approvalStatus !== 'PENDING' && u.approvedBy && (
                        <span className="flex items-center gap-1.5">
                          <BadgeCheck className="w-3 h-3" /> {u.approvalStatus === 'APPROVED' ? 'Approved' : 'Rejected'} by{' '}
                          {u.approvedBy} • {when(u.approvedAt)}
                        </span>
                      )}
                    </div>
                    {u.role === 'RESIDENT' && Array.isArray(u.familyMembers) && u.familyMembers.length > 0 && (
                      <p className="mt-2 text-[11px] text-slate-600">
                        <strong>Household ({u.familyMembers.length}):</strong> {u.familyMembers.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          icon={BadgeCheck}
                          disabled={busyId === u._id}
                          onClick={() => decide(u, 'APPROVED')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={XCircle}
                          disabled={busyId === u._id}
                          onClick={() => decide(u, 'REJECTED')}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Clock}
                        disabled={busyId === u._id}
                        onClick={() => decide(u, 'PENDING')}
                      >
                        {status === 'APPROVED' ? 'Revoke' : 'Reconsider'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
