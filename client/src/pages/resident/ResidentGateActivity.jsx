import { useEffect, useState } from 'react';
import { Check, Clock, LogIn, LogOut, Phone, ScanLine, ShieldX, Truck, Users } from 'lucide-react';
import { Button, EmptyState, LiveDot, Pill, SectionCard, Select, StatCard } from '../../components/ui.jsx';
import { visitorApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { clockTime, formatMobile, formatVehicle, timeAgo, VISITOR_PILL } from '../../lib/format.js';

export default function ResidentGateActivity({ onChanged }) {
  const toast = useToast();
  const { on, connected } = useSocket();
  const [visitors, setVisitors] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      // Resident logs are already scoped to their flat; society-wide stats are admin/guard only.
      const logs = await visitorApi.logs({});
      setVisitors(logs.visitors || []);
    } catch (err) {
      toast.alert('Gate Activity Error', err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const offs = [
      on('visitor_updated', load),
      on('new_visitor_request', load),
      on('visitor_checked_out', load),
      on('visitor_decision_local', load),
    ];
    return () => offs.forEach((off) => off());
  }, [on]);

  const decide = async (visitor, decision) => {
    setBusy(visitor._id);
    try {
      const res = await visitorApi.decide(visitor._id, decision);
      decision === 'APPROVED' ? toast.success('Entry Approved', res.message) : toast.alert('Entry Denied', res.message);
      load();
      onChanged?.();
    } catch (err) {
      toast.alert('Action Failed', err.message);
    } finally {
      setBusy(null);
    }
  };

  const filtered = status === 'ALL' ? visitors : visitors.filter((v) => v.approvalStatus === status);
  const pending = visitors.filter((v) => v.approvalStatus === 'PENDING');
  const activeInside = visitors.filter((v) => !v.checkOutTime && ['APPROVED', 'PRE_APPROVED'].includes(v.approvalStatus));
  const denied = visitors.filter((v) => v.approvalStatus === 'DENIED');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Gate Entries" value={visitors.length} sub="All-time log for your flat" icon={LogIn} tone="indigo" />
        <StatCard label="Active Visitors Inside" value={activeInside.length} sub="Currently inside society" icon={Users} tone="emerald" />
        <StatCard label="Awaiting Approval" value={pending.length} sub="Tap approve to admit" icon={Clock} tone="amber" />
        <StatCard label="Denied at Gate" value={denied.length} sub="Refused entries" icon={ShieldX} tone="rose" />
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900">Visitor Request Pending at Gate!</div>
              <p className="text-xs text-amber-800">
                {pending[0].guestName} ({pending[0].purpose}) is waiting at the security checkpoint.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="!text-rose-700 !border-rose-300" onClick={() => decide(pending[0], 'DENIED')} disabled={busy === pending[0]._id}>
              Deny
            </Button>
            <Button variant="success" size="sm" icon={Check} onClick={() => decide(pending[0], 'APPROVED')} disabled={busy === pending[0]._id}>
              Approve Entry
            </Button>
          </div>
        </div>
      )}

      <SectionCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <LiveDot label={connected ? 'Live gate updates active' : 'Reconnecting…'} tone={connected ? 'emerald' : 'amber'} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-48 !py-1.5 !text-xs">
          {['ALL', 'PENDING', 'APPROVED', 'PRE_APPROVED', 'DENIED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </SectionCard>

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState icon={ScanLine} title="No gate activity for your flat" message="Visitor entries and QR pass usage will appear here." />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((visitor) => {
            const inside = !visitor.checkOutTime && ['APPROVED', 'PRE_APPROVED'].includes(visitor.approvalStatus);
            return (
              <div key={visitor._id} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    {visitor.purpose?.includes('Delivery') ? <Truck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{visitor.guestName}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {visitor.purpose}
                      </span>
                      <Pill className={VISITOR_PILL[visitor.approvalStatus]}>{visitor.approvalStatus}</Pill>
                      {inside && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">INSIDE</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <strong className="font-mono text-slate-700">{formatMobile(visitor.phone)}</strong>
                      </span>
                      <span>
                        In: <strong className="text-slate-700">{clockTime(visitor.checkInTime)}</strong> ({timeAgo(visitor.checkInTime)})
                      </span>
                      {visitor.checkOutTime && (
                        <span className="flex items-center gap-1">
                          <LogOut className="w-3 h-3" />
                          Out: <strong className="text-slate-700">{clockTime(visitor.checkOutTime)}</strong>
                        </span>
                      )}
                      {visitor.vehicleNo && <span className="font-mono tracking-wide">{formatVehicle(visitor.vehicleNo)}</span>}
                    </div>
                  </div>
                </div>
                {visitor.approvalStatus === 'PENDING' && (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="!text-rose-700 !border-rose-300" onClick={() => decide(visitor, 'DENIED')} disabled={busy === visitor._id}>
                      Deny Entry
                    </Button>
                    <Button variant="success" size="sm" icon={Check} onClick={() => decide(visitor, 'APPROVED')} disabled={busy === visitor._id}>
                      Approve Entry
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
