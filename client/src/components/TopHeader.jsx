import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Radio,
  RefreshCw,
  ShieldAlert,
  Siren,
  UserCog,
  Users,
} from 'lucide-react';
import Logo, { LogoBadge } from './Logo.jsx';
import { Button, Field, Modal, Select, TextArea } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ROLE_META, SOS_CATEGORIES } from '../lib/constants.js';
import { initials } from '../lib/format.js';
import { visitorApi } from '../lib/api.js';

const HOME_BY_ROLE = { ADMIN: '/admin', RESIDENT: '/resident', GUARD: '/guard' };

export default function TopHeader() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, demoLogin, logout, loading } = useAuth();
  const { statusLabel, connected } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCategory, setSosCategory] = useState(SOS_CATEGORIES[1]);
  const [sosNote, setSosNote] = useState('');
  const [sending, setSending] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const meta = ROLE_META[user?.role] || ROLE_META.RESIDENT;

  const switchRole = async (role) => {
    setMenuOpen(false);
    if (role === user?.role) {
      navigate(HOME_BY_ROLE[role] || '/');
      return;
    }
    try {
      await demoLogin(role);
      navigate(HOME_BY_ROLE[role] || '/');
    } catch (err) {
      toast.alert('Switcher Failed', err.message);
    }
  };

  const broadcastSos = async () => {
    setSending(true);
    try {
      const res = await visitorApi.sos({ category: sosCategory, note: sosNote });
      toast.alert(`SOS • ${sosCategory}`, res.message);
      setSosOpen(false);
      setSosNote('');
    } catch (err) {
      toast.alert('SOS Failed', err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-3">
        <button onClick={() => navigate(HOME_BY_ROLE[user?.role] || '/')} className="flex items-center gap-3 min-w-0">
          <LogoBadge className="w-10 h-10 shrink-0" />
          <div className="hidden sm:block text-left min-w-0">
            <div className="text-sm font-black tracking-tight text-slate-900 leading-none">
              HOMI <span className="text-slate-300">|</span>{' '}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {meta.title}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
              Khodaldham Society • Ahmedabad
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
              connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
            title={statusLabel}
          >
            {connected ? <Radio className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span className="max-w-[210px] truncate">{statusLabel}</span>
          </div>

          <button
            onClick={() => setSosOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all active:scale-95 animate-siren"
            title="Broadcast Emergency SOS to all guards and admin"
          >
            <Siren className="w-4 h-4" />
            <span className="hidden sm:inline">SOS Panic</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-xs ${meta.chip}`}
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {initials(user?.name)}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-bold text-slate-900 text-[12px] truncate max-w-[110px] sm:max-w-[150px]">
                  {user?.name}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {user?.role === 'RESIDENT' ? `Flat ${user.flatId}` : meta.title}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-fade-in text-slate-800">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Demo Switcher (Viva)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Switch role to test different portals:</div>
                </div>
                <div className="space-y-1">
                  {[
                    { role: 'ADMIN', label: 'Admin / Secretary', sub: 'Financials, Flats, Notices', icon: UserCog, tone: 'text-violet-600' },
                    { role: 'RESIDENT', label: 'Society Member', sub: 'Bills, QR Pass, Approvals', icon: Users, tone: 'text-indigo-600' },
                    { role: 'GUARD', label: 'Gate Security Guard', sub: 'Tablet Touch UI & QR Scanner', icon: ShieldAlert, tone: 'text-emerald-600' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = user?.role === item.role;
                    return (
                      <button
                        key={item.role}
                        onClick={() => switchRole(item.role)}
                        disabled={loading}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-left transition-colors ${
                          active
                            ? item.role === 'GUARD'
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold'
                              : item.role === 'ADMIN'
                                ? 'bg-violet-50 text-violet-900 border border-violet-200 font-semibold'
                                : 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${item.tone}`} />
                          <div>
                            <div className="font-bold text-slate-900">{item.label}</div>
                            <div className="text-[10px] text-slate-500">{item.sub}</div>
                          </div>
                        </div>
                        {active && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-slate-100 mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(HOME_BY_ROLE[user?.role] || '/');
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-slate-500" /> Go to my dashboard
                  </button>
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        title="Broadcast Emergency SOS"
        subtitle={`Instant alert to guards & society admins • Flat ${user?.flatId || 'Gate 1'}`}
        icon={Siren}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 font-medium">
              Socket channels: <code className="font-mono text-indigo-700">guard_feed</code> +{' '}
              <code className="font-mono text-indigo-700">admin_feed</code>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSosOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" icon={Siren} onClick={broadcastSos} disabled={sending}>
                {sending ? 'Broadcasting…' : 'Broadcast SOS'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Select Emergency Category">
            <Select value={sosCategory} onChange={(e) => setSosCategory(e.target.value)}>
              {SOS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Additional Details / Location (Optional)">
            <TextArea
              rows={3}
              value={sosNote}
              onChange={(e) => setSosNote(e.target.value)}
              placeholder="e.g. Water overflow on Floor 2 staircase, Block A"
            />
          </Field>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 font-medium leading-relaxed">
            This broadcasts a live siren alert to every guard tablet and the admin command center through Socket.io. Use
            only for genuine emergencies.
          </div>
        </div>
      </Modal>
    </header>
  );
}
