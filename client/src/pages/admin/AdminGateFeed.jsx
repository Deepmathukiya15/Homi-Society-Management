import { useCallback, useEffect, useState } from 'react';
import { Check, DoorOpen, LogOut, Phone, ScanLine, ShieldX, Truck, Users, Video } from 'lucide-react';
import { Button, EmptyState, LiveDot, Pill, SectionCard, Select, StatCard } from '../../components/ui.jsx';
import { visitorApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { clockTime, formatMobile, formatVehicle, timeAgo, VISITOR_PILL } from '../../lib/format.js';

export default function AdminGateFeed() {
  const toast = useToast();
  const { on, connected } = useSocket();
  const [data, setData] = useState({ visitors: [], activeVisitorsInside: 0, pending: 0, count: 0 });
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [logs, s] = await Promise.all([visitorApi.logs({ status }), visitorApi.stats()]);
      setData(logs);
      setStats(s.stats);
    } catch (err) {
      toast.alert('Gate Feed Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const offs = [
      on('visitor_request_logged', load),
      on('visitor_updated', load),
      on('visitor_checked_out', load),
      on('gate_pass_issued', load),
      on('resident_decision_relay', load),
    ];
    return () => offs.forEach((off) => off());
  }, [on, load]);

  const act = async (visitor, action) => {
    try {
      if (action === 'checkout') {
        const res = await visitorApi.checkOut(visitor._id);
        toast.info('Visitor Checked Out', res.message);
      } else {
        const res = await visitorApi.decide(visitor._id, action === 'approve' ? 'APPROVED' : 'DENIED');
        action === 'approve' ? toast.success('Entry Approved', res.message) : toast.alert('Entry Denied', res.message);
      }
      load();
    } catch (err) {
      toast.alert('Action Failed', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Visitors Inside" value={stats?.activeVisitorsInside ?? 0} sub="Currently inside society premises" icon={DoorOpen} tone="emerald" />
        <StatCard label="Logged Today" value={stats?.todayTotal ?? 0} sub="Gate-1 entries in the last 24h" icon={ScanLine} tone="indigo" />
        <StatCard label="Pending Approvals" value={stats?.pendingApprovals ?? 0} sub="Awaiting resident sanction" icon={Users} tone="amber" />
        <StatCard label="Denied Entries" value={stats?.denied ?? 0} sub="Refused by residents" icon={ShieldX} tone="rose" />
      </div>

      <SectionCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <LiveDot
          label={connected ? 'Live Socket.io Gate Telemetry Active' : 'Reconnecting to Socket.io…'}
          tone={connected ? 'emerald' : 'amber'}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter:</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-44 !py-1.5 !text-xs">
            {['ALL', 'PENDING', 'APPROVED', 'PRE_APPROVED', 'DENIED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </SectionCard>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Gate Activity Log</h3>
          <span className="text-xs text-slate-500 font-medium">
            {data.count} record(s) • Active inside: <strong className="text-emerald-700">{data.activeVisitorsInside}</strong>
          </span>
        </div>

        {loading && !data.visitors.length ? (
          <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        ) : data.visitors.length === 0 ? (
          <SectionCard>
            <EmptyState icon={ScanLine} title="No gate records" message="New arrivals will appear here in real-time." />
          </SectionCard>
        ) : (
          data.visitors.map((visitor) => {
            const inside = !visitor.checkOutTime;
            return (
              <div
                key={visitor._id}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                    {visitor.purpose?.includes('Delivery') ? <Truck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{visitor.guestName}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {visitor.purpose}
                      </span>
                      <Pill className={VISITOR_PILL[visitor.approvalStatus]}>{visitor.approvalStatus}</Pill>
                      {inside && ['APPROVED', 'PRE_APPROVED'].includes(visitor.approvalStatus) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">INSIDE</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Destination:{' '}
                        <strong className="text-slate-800">
                          Flat {visitor.flatId} <span className="font-normal text-slate-500">(Block {visitor.flatId?.[0]})</span>
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <strong className="font-mono text-slate-700">{formatMobile(visitor.phone)}</strong>
                      </span>
                      {visitor.vehicleNo && (
                        <span>
                          Vehicle: <strong className="font-mono text-slate-700 tracking-wide">{formatVehicle(visitor.vehicleNo)}</strong>
                        </span>
                      )}
                      <span>
                        In: <strong className="text-slate-700">{clockTime(visitor.checkInTime)}</strong> ({timeAgo(visitor.checkInTime)})
                      </span>
                      {visitor.checkOutTime && (
                        <span>
                          Out: <strong className="text-slate-700">{clockTime(visitor.checkOutTime)}</strong>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1">
                      Logged by {visitor.loggedBy || 'Gate Security'}
                      {visitor.approvedBy ? ` • Action by ${visitor.approvedBy}` : ''}
                      {visitor.guardNote ? ` • Note: ${visitor.guardNote}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {visitor.approvalStatus === 'PENDING' && (
                    <>
                      <Button variant="outline" size="sm" icon={ShieldX} className="!text-rose-700 !border-rose-300" onClick={() => act(visitor, 'deny')}>
                        Deny
                      </Button>
                      <Button variant="success" size="sm" icon={Check} onClick={() => act(visitor, 'approve')}>
                        Approve
                      </Button>
                    </>
                  )}
                  {inside && ['APPROVED', 'PRE_APPROVED'].includes(visitor.approvalStatus) && (
                    <Button variant="dark" size="sm" icon={LogOut} onClick={() => act(visitor, 'checkout')}>
                      Check-Out
                    </Button>
                  )}
                  {visitor.approvalStatus === 'DENIED' && (
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide flex items-center gap-1">
                      <Video className="w-3 h-3" /> Denied at gate
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
