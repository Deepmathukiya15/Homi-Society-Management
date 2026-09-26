import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DoorOpen, QrCode, RefreshCw, ScanLine, ShieldCheck, UserPlus, Users } from 'lucide-react';
import Logo, { LogoBadge } from '../../components/Logo.jsx';
import { Button, Pill } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { visitorApi } from '../../lib/api.js';
import GuardCheckIn from './GuardCheckIn.jsx';
import GuardScanner from './GuardScanner.jsx';
import GuardActiveVisitors from './GuardActiveVisitors.jsx';

const ACTIONS = [
  { id: 'ACTIVE_VISITORS', label: 'Active Inside', icon: DoorOpen, tone: 'emerald' },
  { id: 'NEW_CHECKIN', label: '+ Walk-in Entry', icon: UserPlus, tone: 'indigo' },
  { id: 'QR_SCANNER', label: 'QR Scanner', icon: QrCode, tone: 'violet' },
];

export default function GuardPortal() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { on, connected, statusLabel } = useSocket();
  const [stats, setStats] = useState({ activeVisitorsInside: 0, todayTotal: 0, pendingApprovals: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const action = ACTIONS.some((a) => a.id === params.get('action')) ? params.get('action') : 'ACTIVE_VISITORS';

  const setAction = (id) => {
    const next = new URLSearchParams(params);
    next.set('action', id);
    setParams(next, { replace: true });
  };

  const loadStats = async () => {
    try {
      const res = await visitorApi.stats();
      setStats(res.stats);
    } catch {
      /* telemetry is best-effort */
    }
  };

  useEffect(() => {
    loadStats();
  }, [refreshKey]);

  useEffect(() => {
    const offs = [
      on('visitor_updated', () => setRefreshKey((k) => k + 1)),
      on('visitor_checked_out', () => setRefreshKey((k) => k + 1)),
      on('new_visitor_request', () => setRefreshKey((k) => k + 1)),
      on('visitor_request_logged', () => setRefreshKey((k) => k + 1)),
    ];
    return () => offs.forEach((off) => off());
  }, [on]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-800 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <LogoBadge className="w-12 h-12 shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Gate 1 • Security Terminal
              </h1>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                Active Guard: {user?.name || 'Devendra Singh'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              HOMI Gatekeeping Telemetry • Main Entrance Barrier Gate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold ${
              connected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="max-w-[190px] truncate">{statusLabel}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {ACTIONS.map((item) => {
          const Icon = item.icon;
          const active = action === item.id;
          const count = item.id === 'ACTIVE_VISITORS' ? stats.activeVisitorsInside : 0;
          const tones = {
            emerald: 'bg-emerald-600 border-emerald-700',
            indigo: 'bg-indigo-600 border-indigo-700',
            violet: 'bg-violet-600 border-violet-700',
          };
          return (
            <button
              key={item.id}
              onClick={() => setAction(item.id)}
              className={`flex flex-col items-center justify-center gap-1.5 py-3.5 sm:py-4 rounded-2xl border transition-all active:scale-95 ${
                active
                  ? `${tones[item.tone]} text-white shadow-lg`
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide text-center leading-tight">
                {item.label}
                {count > 0 ? ` (${count})` : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <Users className="w-4 h-4 text-emerald-600" />
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Visitors Inside</div>
            <div className="text-lg font-black text-slate-900 font-mono">{stats.activeVisitorsInside}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <ScanLine className="w-4 h-4 text-indigo-600" />
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Today Total Entries</div>
            <div className="text-lg font-black text-slate-900 font-mono">{stats.todayTotal}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Awaiting Approval</div>
            <div className="text-lg font-black text-slate-900 font-mono">{stats.pendingApprovals}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Shift Status</div>
            <div className="text-sm font-black text-slate-900 uppercase">On Duty</div>
          </div>
        </div>
      </div>

      {stats.pendingApprovals > 0 && action !== 'ACTIVE_VISITORS' && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Pill className="bg-amber-100 text-amber-800 border border-amber-300">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> {stats.pendingApprovals} pending
              </span>
            </Pill>
            <p className="text-xs text-amber-900 font-medium">
              Resident approval requests are still awaiting action — track them on the Active Inside panel.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAction('ACTIVE_VISITORS')}>
            Open Panel
          </Button>
        </div>
      )}

      {action === 'ACTIVE_VISITORS' && <GuardActiveVisitors key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {action === 'NEW_CHECKIN' && <GuardCheckIn key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {action === 'QR_SCANNER' && <GuardScanner key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}

      <footer className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
        <span className="flex items-center gap-2">
          <Logo variant="icon" className="w-4 h-4" /> HOMI Gate Terminal
        </span>
      </footer>

    </div>
  );
}
