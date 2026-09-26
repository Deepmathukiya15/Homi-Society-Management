import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CreditCard, QrCode, ScanLine, ShieldCheck, Wrench } from 'lucide-react';
import { Button, Pill } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { complaintApi, maintenanceApi, noticeApi, visitorApi } from '../../lib/api.js';
import { RESIDENT_TABS, UNITS_PER_FLOOR, FLOORS } from '../../lib/constants.js';
import { formatMobile } from '../../lib/format.js';
import ResidentBills from './ResidentBills.jsx';
import ResidentQrPass from './ResidentQrPass.jsx';
import ResidentGateActivity from './ResidentGateActivity.jsx';
import ResidentNotices from './ResidentNotices.jsx';
import ResidentComplaints from './ResidentComplaints.jsx';

const ICONS = { BILLS: CreditCard, QR_PASS: QrCode, GATE_ACTIVITY: ScanLine, NOTICES: Bell, COMPLAINTS: Wrench };

export default function ResidentPortal() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { on } = useSocket();
  const tab = RESIDENT_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'BILLS';
  const [bills, setBills] = useState([]);
  const [notices, setNotices] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  const loadHeader = async () => {
    try {
      const [b, n, c, v] = await Promise.all([
        maintenanceApi.bills({}).catch(() => ({ bills: [] })),
        noticeApi.list().catch(() => ({ notices: [] })),
        complaintApi.list({}).catch(() => ({ complaints: [] })),
        visitorApi.logs({}).catch(() => ({ visitors: [] })),
      ]);
      setBills(b.bills);
      setNotices(n.notices);
      setComplaints(c.complaints);
      setVisitors(v.visitors);
    } catch {
      /* header counters are best-effort */
    }
  };

  useEffect(() => {
    loadHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const offs = [
      on('visitor_updated', () => setRefreshKey((k) => k + 1)),
      on('new_visitor_request', () => setRefreshKey((k) => k + 1)),
      on('visitor_checked_out', () => setRefreshKey((k) => k + 1)),
      on('bill_generated', () => setRefreshKey((k) => k + 1)),
      on('bill_paid', () => setRefreshKey((k) => k + 1)),
      on('notice_published', () => setRefreshKey((k) => k + 1)),
      on('complaint_updated', () => setRefreshKey((k) => k + 1)),
    ];
    return () => offs.forEach((off) => off());
  }, [on]);

  const unpaid = bills.filter((b) => b.status !== 'PAID');
  const pendingVisitors = visitors.filter((v) => v.approvalStatus === 'PENDING');
  const badges = {
    BILLS: unpaid.length,
    NOTICES: notices.length,
    COMPLAINTS: complaints.filter((c) => c.status !== 'RESOLVED').length,
    GATE_ACTIVITY: visitors.length,
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-800 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Flat {user?.flatId || 'A-101'}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Block {(user?.flatId || 'A-101').split('-')[0]}
              </span>
              <Pill className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                {unpaid.length ? `${unpaid.length} bill(s) due` : 'Dues Cleared'}
              </Pill>
              <Pill className="bg-slate-100 text-slate-600 border border-slate-200">
                Block {user?.flatId?.[0]} • Floor {Number(user?.flatId?.[2] || 1)}
              </Pill>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Resident: <strong className="text-slate-800">{user?.name}</strong> • Contact:{' '}
              <strong className="text-slate-800 font-mono">{formatMobile(user?.contactNumber)}</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={QrCode} onClick={() => setTab('QR_PASS')}>
            Create QR Gate Pass
          </Button>
        </div>
      </div>

      {pendingVisitors.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl shadow-xs animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <ScanLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Visitor Request Pending at Gate!</h3>
              <p className="text-xs text-amber-800">
                {pendingVisitors[0].guestName} ({pendingVisitors[0].purpose}) is waiting at the security checkpoint.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="!text-rose-700 !border-rose-300" onClick={() => setTab('GATE_ACTIVITY')}>
              Review Request
            </Button>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1 no-scrollbar">
        {RESIDENT_TABS.map((item) => {
          const Icon = ICONS[item.id];
          const active = tab === item.id;
          const badge = badges[item.id];
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                active ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-500'}`} />
              <span>{item.label}</span>
              {badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    active ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'BILLS' && <ResidentBills key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {tab === 'QR_PASS' && <ResidentQrPass key={refreshKey} />}
      {tab === 'GATE_ACTIVITY' && <ResidentGateActivity key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {tab === 'NOTICES' && <ResidentNotices key={refreshKey} />}
      {tab === 'COMPLAINTS' && <ResidentComplaints key={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}

      <footer className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
        <span>HOMI Resident Portal • Real-time gate approvals via Socket.io</span>
        <span>Khodaldham Society, Ahmedabad • FY {new Date().getFullYear()}</span>
      </footer>

    </div>
  );
}
