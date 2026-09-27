import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  Car,
  CalendarClock,
  RefreshCw,
  ReceiptText,
  ScanLine,
  Gauge,
  Wrench,
  Loader2,
  UserCheck,
  Users,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import PortalModuleGrid from '../../components/PortalModuleGrid.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authApi, maintenanceApi } from '../../lib/api.js';
import { ADMIN_TABS, ADMIN_TITLES } from '../../lib/constants.js';
import AdminOverview from './AdminOverview.jsx';
import AdminFlats from './AdminFlats.jsx';
import AdminParking from './AdminParking.jsx';
import AdminMaintenance from './AdminMaintenance.jsx';
import AdminApprovals from './AdminApprovals.jsx';
import AdminGateFeed from './AdminGateFeed.jsx';
import AdminNotices from './AdminNotices.jsx';
import AdminComplaints from './AdminComplaints.jsx';
import AdminCommittee from './AdminCommittee.jsx';
import AdminPayroll from './AdminPayroll.jsx';

const ICONS = {
  MODULES: LayoutGrid,
  OVERVIEW: Gauge,
  APPROVALS: UserCheck,
  FLATS: Building2,
  PARKING: Car,
  MAINTENANCE: ReceiptText,
  GATE_LOGS: ScanLine,
  NOTICES: Bell,
  COMMITTEE: Users,
  COMPLAINTS: Wrench,
  STAFF_PAYROLL: Sparkles,
};

const MODULE_INFO = {
  OVERVIEW: ['Society occupancy, dues and activity at a glance', 'indigo'],
  FLATS: ['View homes, residents, occupancy and resident details', 'emerald'],
  PARKING: ['Browse PB bike and PC car parking and manage assignments', 'violet'],
  APPROVALS: ['Review resident and guard registration requests', 'amber'],
  MAINTENANCE: ['Manage society maintenance billing and payments', 'rose'],
  GATE_LOGS: ['Monitor live visitor and gate activity', 'sky'],
  NOTICES: ['Create and publish society notices', 'amber'],
  COMMITTEE: ['Manage approved committee members and meetings', 'indigo'],
  COMPLAINTS: ['Review and resolve resident helpdesk tickets', 'rose'],
  STAFF_PAYROLL: ['Manage cleaning staff salary records', 'emerald'],
};

export default function AdminPortal() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { on } = useSocket();
  const requestedTab = params.get('tab');
  const tab = requestedTab === 'MODULES' || ADMIN_TABS.some((t) => t.id === requestedTab) ? requestedTab : 'MODULES';
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
        setRefreshKey((k) => k + 1);
        toast.info('New Registration', payload?.message || 'A new account is waiting for your approval.');
      }),
    [on, toast]
  );

  // Approval events refresh the flat cards and occupancy totals for all open admin sessions.
  useEffect(
    () => on('user:approval', (payload) => {
      setRefreshKey((k) => k + 1);
      loadPendingCount();
      if (payload?.user?.role === 'RESIDENT' && payload.status === 'APPROVED') {
        toast.success('Flat Directory Updated', `${payload.user.name} is now shown in Flat ${payload.user.flatId}.`);
      }
    }),
    [on, loadPendingCount, toast]
  );

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  const refreshAll = useCallback(
    (silent = false) => {
      setRefreshKey((k) => k + 1);
      if (!silent) toast.info('Data Refreshed', 'Latest society ledger and gate telemetry pulled from the API.');
    },
    [toast]
  );

  // Live telemetry nudges the admin dashboard without a manual refresh
  useEffect(() => {
    const offs = [
      on('flat_updated', () => setRefreshKey((k) => k + 1)),
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
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-800">


      <main className="p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-[1400px] w-full mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="md"
              icon={RefreshCw}
              onClick={() => refreshAll(true)}
              title="Refresh data"
              aria-label="Refresh data"
            />
            {tab !== 'MODULES' && (
              <Button variant="outline" icon={LayoutGrid} onClick={() => setTab('MODULES')}>Modules</Button>
            )}
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

        {tab === 'MODULES' && (
          <PortalModuleGrid
            title="Management Modules"
            subtitle="Select a card to open that module."
            modules={ADMIN_TABS.filter((item) => item.id !== 'MODULES').map((item) => ({
              id: item.id,
              label: item.label,
              icon: ICONS[item.id],
              description: MODULE_INFO[item.id]?.[0],
              tone: MODULE_INFO[item.id]?.[1],
              badge: item.id === 'APPROVALS' ? pendingCount : 0,
            }))}
            onOpen={setTab}
          />
        )}
        {tab === 'OVERVIEW' && <AdminOverview key={refreshKey} onOpenTab={setTab} />}
        {tab === 'FLATS' && <AdminFlats key={refreshKey} />}
        {tab === 'PARKING' && <AdminParking key={refreshKey} />}
        {tab === 'APPROVALS' && <AdminApprovals key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
        {tab === 'MAINTENANCE' && <AdminMaintenance key={`${refreshKey}-${maintenanceSignal}`} onRunCron={runCron} cronRunning={cronRunning} />}
        {tab === 'GATE_LOGS' && <AdminGateFeed key={refreshKey} />}
        {tab === 'NOTICES' && <AdminNotices key={refreshKey} openSignal={noticeSignal} />}
        {tab === 'COMMITTEE' && <AdminCommittee key={refreshKey} />}
        {tab === 'COMPLAINTS' && <AdminComplaints key={refreshKey} />}
        {tab === 'STAFF_PAYROLL' && <AdminPayroll key={refreshKey} />}

        <footer className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
          <span>Integrated Home &amp; Community Management Solutions</span>
          <span>HOMI © {new Date().getFullYear()}</span>
        </footer>
      </main>

    </div>
  );
}
