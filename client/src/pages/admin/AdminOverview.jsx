import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, IndianRupee, ScanLine, Users, Wrench } from 'lucide-react';
import { LiveDot, Pill, SectionCard, SectionHeader, StatCard, TableShell } from '../../components/ui.jsx';
import { complaintApi, flatApi, maintenanceApi, visitorApi } from '../../lib/api.js';
import { BILL_PILL, compactInr, dateTimeShort, inr, timeAgo, VISITOR_PILL } from '../../lib/format.js';
import { useSocket } from '../../context/SocketContext.jsx';

const CATEGORY_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6'];

export default function AdminOverview({ onOpenTab }) {
  const { connected } = useSocket();
  const [stats, setStats] = useState(null);
  const [directory, setDirectory] = useState(null);
  const [gate, setGate] = useState(null);
  const [gateFeed, setGateFeed] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [bills, setBills] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, d, g, feed, c, def, ledger] = await Promise.all([
          maintenanceApi.stats(),
          flatApi.summary(),
          visitorApi.stats(),
          visitorApi.logs({}),
          complaintApi.list({}),
          maintenanceApi.defaulters(),
          maintenanceApi.bills({}),
        ]);
        if (!alive) return;
        setStats(m.stats);
        setDirectory(d.summary);
        setGate(g.stats);
        setGateFeed(feed.visitors.slice(0, 5));
        setComplaints(c.complaints);
        setDefaulters(def.defaulters.slice(0, 5));
        setBills(ledger.bills.slice(0, 6));
      } catch (err) {
        console.error('Failed to load admin data:', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!stats || !directory) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const openComplaints = complaints.filter((c) => c.status !== 'RESOLVED');
  const categoryData = Object.entries(
    complaints.reduce((acc, c) => ({ ...acc, [c.category]: (acc[c.category] || 0) + 1 }), {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Collected (FY)"
          value={compactInr(stats.totalCollected)}
          sub={`${stats.paidCount} invoices settled • ${stats.collectionRate}% collection rate`}
          icon={IndianRupee}
          tone="emerald"
        />
        <StatCard
          label="Outstanding Dues"
          value={compactInr(stats.outstanding)}
          sub={`Pending from ${stats.pendingFlats} flats • ${stats.overdueCount} overdue`}
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard
          label="Active Visitors Inside"
          value={gate?.activeVisitorsInside ?? 0}
          sub={`${gate?.todayTotal ?? 0} logged today • ${gate?.pendingApprovals ?? 0} awaiting approval`}
          icon={ScanLine}
          tone="indigo"
        />
        <StatCard
          label="Open Helpdesk Tickets"
          value={openComplaints.length}
          sub={`${complaints.length} raised in total • ${complaints.filter((c) => c.status === 'RESOLVED').length} resolved`}
          icon={Wrench}
          tone="rose"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <SectionCard className="xl:col-span-2 p-5">
          <SectionHeader
            title={`Monthly Collection vs Outstanding Dues (${stats.year})`}
            subtitle="Live ledger aggregation served by GET /api/maintenance/stats"
            action={
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Collected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Outstanding
                </span>
              </div>
            }
          />
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlySeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="outstanding" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <Tooltip
                  formatter={(value, name) => [inr(value), name === 'collected' ? 'Collected' : 'Outstanding']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="collected" stroke="#6366f1" strokeWidth={2.5} fill="url(#collected)" />
                <Area type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={2.5} fill="url(#outstanding)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard className="p-5">
            <SectionHeader title="Block-Wise Occupancy" subtitle="Blocks A / B / C × 5 floors" />
            <div className="h-44 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={directory.byBlock || directory.byWing} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="block" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="occupied" name="Occupied" fill="#6366f1" radius={[6, 6, 0, 0]} stackId="a" />
                  <Bar dataKey="vacant" name="Vacant" fill="#cbd5e1" radius={[6, 6, 0, 0]} stackId="a" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <SectionHeader title="Complaint Categories" subtitle="Helpdesk distribution" />
            <div className="h-44 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3}>
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard className="lg:col-span-2 overflow-hidden">
          <div className="p-5">
            <SectionHeader
              title="Live Gate Telemetry"
              subtitle="Most recent visitor movements at Gate 1"
              action={
                <button
                  onClick={() => onOpenTab('GATE_LOGS')}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              }
            />
          </div>
          {gateFeed.length === 0 ? (
            <div className="px-5 pb-6 text-xs text-slate-500 font-medium">No gate activity recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {gateFeed.map((v) => (
                <div key={v._id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{v.guestName}</div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Flat {v.flatId} • {v.purpose} • {timeAgo(v.checkInTime)}
                      </div>
                    </div>
                  </div>
                  <Pill className={VISITOR_PILL[v.approvalStatus]}>{v.approvalStatus}</Pill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard className="p-5">
          <SectionHeader title="Top Defaulters" subtitle="Highest outstanding maintenance dues" />
          <div className="mt-4 space-y-2.5">
            {defaulters.map((d) => (
              <div key={d.flatId} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-900 font-mono">{d.flatId}</div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {d.residentName} • {d.months.length} month(s)
                  </div>
                </div>
                <span className="text-xs font-black text-rose-600 font-mono">{inr(d.due)}</span>
              </div>
            ))}
            {!defaulters.length && <p className="text-xs text-slate-500">No outstanding dues. Perfect collection!</p>}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <LiveDot label={connected ? 'Socket.io Gate Telemetry Active' : 'Socket.io reconnecting'} tone={connected ? 'emerald' : 'amber'} />
            <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed">
              Every gate event streams into rooms <code className="font-mono text-indigo-700">guard_feed</code> and{' '}
              <code className="font-mono text-indigo-700">admin_feed</code> in real time.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="overflow-hidden">
        <div className="p-5">
          <SectionHeader
            title="Recent Maintenance Ledger"
            subtitle="Latest invoices raised across all wings"
            action={
              <button
                onClick={() => onOpenTab('MAINTENANCE')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Open Billing Module <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />
        </div>
        <TableShell head={['Flat ID', 'Resident', 'Billing Period', 'Amount', 'Due Date', 'Status', 'Txn Reference']}>
          {bills.map((bill) => (
            <tr key={bill._id} className="hover:bg-slate-50/80 transition-colors">
              <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">{bill.flatId}</td>
              <td className="py-3.5 px-4">{bill.residentName}</td>
              <td className="py-3.5 px-4">
                {bill.month} {bill.year}
              </td>
              <td className="py-3.5 px-4 font-bold text-slate-900">{inr(bill.amount)}</td>
              <td className="py-3.5 px-4 text-slate-500">{dateTimeShort(bill.dueDate)}</td>
              <td className="py-3.5 px-4">
                <Pill className={BILL_PILL[bill.status]}>{bill.status}</Pill>
              </td>
              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{bill.paymentTxnid || '—'}</td>
            </tr>
          ))}
        </TableShell>
      </SectionCard>
    </div>
  );
}
