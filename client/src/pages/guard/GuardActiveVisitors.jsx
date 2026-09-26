import { useEffect, useState } from 'react';
import { Check, Clock, LogOut, Phone, ScanLine, ShieldX, Truck, Users } from 'lucide-react';
import { Button, EmptyState, Pill, SectionCard, Select } from '../../components/ui.jsx';
import { visitorApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { clockTime, formatMobile, formatVehicle, timeAgo, VISITOR_PILL } from '../../lib/format.js';

export default function GuardActiveVisitors({ onChanged }) {
  const toast = useToast();
  const { on } = useSocket();
  const [visitors, setVisitors] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await visitorApi.logs({ status });
      setVisitors(res.visitors);
    } catch (err) {
      toast.alert('Gate Log Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const offs = [
      on('visitor_updated', load),
      on('visitor_checked_out', load),
      on('visitor_request_logged', load),
      on('resident_decision_relay', load),
    ];
    return () => offs.forEach((off) => off());
  }, [on]);

  const checkOut = async (visitor) => {
    setBusy(visitor._id);
    try {
      const res = await visitorApi.checkOut(visitor._id);
      toast.success('Visitor Checked Out', res.message);
      load();
      onChanged?.();
    } catch (err) {
      toast.alert('Check-Out Error', err.message);
    } finally {
      setBusy(null);
    }
  };

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

  const inside = visitors.filter((v) => !v.checkOutTime && ['APPROVED', 'PRE_APPROVED'].includes(v.approvalStatus));

  return (
    <div className="space-y-4">
      <SectionCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${inside.length ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-xs font-bold text-slate-900">
            {inside.length ? `${inside.length} visitor(s) currently inside society` : 'No active visitors currently inside society'}
          </span>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-48 !py-1.5 !text-xs">
          {['ALL', 'PENDING', 'APPROVED', 'PRE_APPROVED', 'DENIED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </SectionCard>

      {loading && !visitors.length ? (
        <div className="h-52 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      ) : visitors.length === 0 ? (
        <SectionCard>
          <EmptyState icon={ScanLine} title="No gate records found" message="New arrivals will appear here in real-time." />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {visitors.map((visitor) => {
            const isInside = !visitor.checkOutTime && ['APPROVED', 'PRE_APPROVED'].includes(visitor.approvalStatus);
            const pending = visitor.approvalStatus === 'PENDING';
            return (
              <div
                key={visitor._id}
                className={`bg-white border p-4 rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in ${
                  pending ? 'border-amber-300' : isInside ? 'border-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                      pending
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : isInside
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                    }`}
                  >
                    {visitor.purpose?.includes('Delivery') ? <Truck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{visitor.guestName}</span>
                      <Pill className={VISITOR_PILL[visitor.approvalStatus]}>{visitor.approvalStatus}</Pill>
                      {isInside && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">INSIDE</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Dest: <strong className="text-slate-800">Flat {visitor.flatId}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <strong className="font-mono text-slate-700">{formatMobile(visitor.phone)}</strong>
                      </span>
                      <span>{visitor.purpose}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> In {clockTime(visitor.checkInTime)} ({timeAgo(visitor.checkInTime)})
                      </span>
                      {visitor.checkOutTime && <span>Out {clockTime(visitor.checkOutTime)}</span>}
                      {visitor.vehicleNo && <span className="font-mono tracking-wide">{formatVehicle(visitor.vehicleNo)}</span>}
                    </div>
                    {pending && (
                      <p className="text-[10px] text-amber-700 font-bold mt-1.5 animate-pulse">
                        DISPATCHING TO RESIDENT… waiting for live approval tap
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pending && (
                    <>
                      <Button variant="outline" size="sm" icon={ShieldX} className="!text-rose-700 !border-rose-300" onClick={() => decide(visitor, 'DENIED')} disabled={busy === visitor._id}>
                        Deny
                      </Button>
                      <Button variant="success" size="sm" icon={Check} onClick={() => decide(visitor, 'APPROVED')} disabled={busy === visitor._id}>
                        Approve
                      </Button>
                    </>
                  )}
                  {isInside && (
                    <Button variant="dark" size="lg" icon={LogOut} onClick={() => checkOut(visitor)} disabled={busy === visitor._id}>
                      {busy === visitor._id ? 'Checking out…' : 'CHECK-OUT (EXIT GATE)'}
                    </Button>
                  )}
                  {visitor.approvalStatus === 'DENIED' && (
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Denied — no entry</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
