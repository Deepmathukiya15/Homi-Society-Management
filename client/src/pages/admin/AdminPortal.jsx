import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  CalendarClock,
  RefreshCw,
  ReceiptText,
  ScanLine,
  Server,
  Gauge,
  Wrench,
  Loader2,
  UserCheck,
  Users,
} from 'lucide-react';
import { LogoBadge } from '../../components/Logo.jsx';
import { Button } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authApi, maintenanceApi } from '../../lib/api.js';
import { ADMIN_TABS, ADMIN_TITLES } from '../../lib/constants.js';
import AdminOverview from './AdminOverview.jsx';
import AdminFlats from './AdminFlats.jsx';
import AdminMaintenance from './AdminMaintenance.jsx';
import AdminApprovals from './AdminApprovals.jsx';
import AdminGateFeed from './AdminGateFeed.jsx';
import AdminNotices from './AdminNotices.jsx';
import AdminComplaints from './AdminComplaints.jsx';
import AdminCommittee from './AdminCommittee.jsx';

const ICONS = {
  OVERVIEW: Gauge,
  APPROVALS: UserCheck,
  FLATS: Building2,
  MAINTENANCE: ReceiptText,
  GATE_LOGS: ScanLine,
  NOTICES: Bell,
  COMMITTEE: Users,
  COMPLAINTS: Wrench,
};

export default function AdminPortal() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const { status, connected, on } = useSocket();
  const tab = ADMIN_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'OVERVIEW';
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [noticeSignal, setNoticeSignal] = useState(0);
  const [cronRunning, setCronRunning] = useState(false);
  const [maintenanceSignal, setMaintenanceSignal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    try {
      const data = await authApi.pendingUsers();
      setPendingCount(data.counts?.pending ?? 0);
    } catch {
      /* badge is best-effort — never block the portal */
    }
  }, []);

  useEffect(() => {
    loadPendingCount();
    const timer = setInterval(loadPendingCount, 20000);
    return () => clearInterval(timer);
  }, [loadPendingCount]);

  // A brand-new registration lands here instantly over Socket.io
  useEffect(
    () =>
      on('registration:pending', (payload) => {
        setPendingCount((c) => c + 1);
        toast.info('New Registration', payload?.message || 'A new account is waiting for your approval.');
      }),
    [on, toast]
  );


  const setTab = (id) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  const refreshAll = useCallback(
    (silent = false) => {
      setRefreshing(true);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setRefreshing(false), 700);
      if (!silent) toast.info('Data Refreshed', 'Latest society ledger and gate telemetry pulled from the API.');
    },
    [toast]
  );

  // Live telemetry nudges the admin dashboard without a manual refresh
  useEffect(() => {
    const offs = [
      on('visitor_updated', () => setRefreshKey((k) => k + 1)),
      on('new_visitor_request', () => setRefreshKey((k) => k + 1)),
      on('visitor_checked_out', () => setRefreshKey((k) => k + 1)),
      on('bill_paid', () => setRefreshKey((k) => k + 1)),
      on('complaint_raised', () => setRefreshKey((k) => k + 1)),
      on('notice_published', () => setRefreshKey((k) => k + 1)),
      on('gate_pass_issued', () => setRefreshKey((k) => k + 1)),
      on('sos_broadcast', () => refreshAll(true)),
    ];
    return () => offs.forEach((off) => off());
  }, [on, refreshAll]);

  const runCron = async () => {
    setCronRunning(true);
    try {
      const res = await maintenanceApi.runCron();
      toast.success('Cron Generator Executed', res.message);
      setMaintenanceSignal((s) => s + 1);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.alert('Cron Error', err.message);
    } finally {
      setCronRunning(false);
    }
  };

  const [title, subtitle] = ADMIN_TITLES[tab];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-[#0f172a] border-r border-slate-800 p-4 shrink-0 flex md:flex-col justify-between text-slate-300 shadow-xs md:sticky md:top-16 md:h-[calc(100vh-4rem)]">
        <div className="space-y-6 w-full">
          <div className="hidden md:block pb-2 border-b border-slate-800/80">
            <div className="mb-3 flex items-center gap-2.5">
              <LogoBadge className="w-10 h-10 shrink-0" />
              <div>
                <div className="text-sm font-black text-white tracking-tight leading-none">HOMI</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Blocks A / B / C
                </div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Management Modules</div>
          </div>

          <nav className="flex md:flex-col gap-1.5 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {ADMIN_TABS.map((item) => {
              const Icon = ICONS[item.id];
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    active ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.id === 'APPROVALS' && pendingCount > 0 && (
                    <span
                      className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        active ? 'bg-white/25 text-white' : 'bg-amber-400 text-slate-900'
                      }`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:block pt-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-slate-400 truncate">{status}</span>
          </div>
          <button
            onClick={() => refreshAll()}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <div className="px-1 pt-1 text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
            <Server className="w-3 h-3" /> Admin: {user?.name}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-[1400px] w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {tab === 'NOTICES' && (
              <Button icon={Bell} onClick={() => setNoticeSignal((s) => s + 1)}>
                Publish Notice
              </Button>
            )}
            {tab === 'MAINTENANCE' && (
              <Button
                variant="success"
                icon={cronRunning ? Loader2 : CalendarClock}
                onClick={runCron}
                disabled={cronRunning}
                title="Execute monthly maintenance bill batch generator"
                className={cronRunning ? '[&>svg]:animate-spin' : ''}
              >
                {cronRunning ? 'Running Cron…' : 'Run Monthly Cron Bill'}
              </Button>
            )}
          </div>
        </div>

        {tab === 'OVERVIEW' && <AdminOverview key={refreshKey} onOpenTab={setTab} />}
        {tab === 'FLATS' && <AdminFlats key={refreshKey} />}
        {tab === 'APPROVALS' && <AdminApprovals key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
        {tab === 'MAINTENANCE' && <AdminMaintenance key={`${refreshKey}-${maintenanceSignal}`} onRunCron={runCron} cronRunning={cronRunning} />}
        {tab === 'GATE_LOGS' && <AdminGateFeed key={refreshKey} />}
        {tab === 'NOTICES' && <AdminNotices key={refreshKey} openSignal={noticeSignal} />}
        {tab === 'COMMITTEE' && <AdminCommittee key={refreshKey} />}
        {tab === 'COMPLAINTS' && <AdminComplaints key={refreshKey} />}

        <footer className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
          <span>Integrated Home &amp; Community Management Solutions</span>
          <span>HOMI © {new Date().getFullYear()}</span>
        </footer>
      </main>

    </div>
  );
}
