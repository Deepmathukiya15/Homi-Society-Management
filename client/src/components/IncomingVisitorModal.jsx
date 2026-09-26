import { useEffect, useRef, useState } from 'react';
import { BellRing, Check, Clock, Phone, ShieldX, Truck, UserCheck, X } from 'lucide-react';
import { Button, DataRow } from './ui.jsx';
import { formatMobile } from '../lib/format.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { timeAgo } from '../lib/format.js';

export default function IncomingVisitorModal() {
  const { incomingVisitor, clearIncoming, approveIncoming, denyIncoming } = useSocket();
  const { flat, user } = useAuth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [seconds, setSeconds] = useState(60);

  // Keep the latest clearIncoming without re-triggering the countdown effect
  // (the socket context value is rebuilt whenever a toast appears).
  const clearRef = useRef(clearIncoming);
  clearRef.current = clearIncoming;

  useEffect(() => {
    if (!incomingVisitor) return undefined;
    setSeconds(60);
    setNote('');
    // 60s auto-close, as advertised in the UI header.
    let remaining = 60;
    const timer = setInterval(() => {
      remaining -= 1;
      setSeconds(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(timer);
        clearRef.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [incomingVisitor]);

  if (!incomingVisitor) return null;
  const { visitor } = incomingVisitor;

  const act = async (status) => {
    setBusy(status);
    try {
      await (status === 'APPROVED' ? approveIncoming(note) : denyIncoming(note));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden text-slate-800 animate-rise">
        <div className="bg-amber-50/80 p-5 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center animate-pulse shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">Visitor at Main Gate</h3>
              <p className="text-[11px] text-amber-800 font-medium">
                Live request → Flat {visitor.flatId} • {timeAgo(visitor.checkInTime)}
              </p>
            </div>
          </div>
          <button
            onClick={clearIncoming}
            className="text-amber-700 hover:text-amber-900 p-1.5 rounded-lg hover:bg-amber-100 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black text-slate-900">{visitor.guestName}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {visitor.purpose}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{(user?.flatId || flat?.flatId) && `Flat ${visitor.flatId}`}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <Clock className="w-3 h-3" /> Auto-close
              </div>
              <div
                className={`text-xl font-black font-mono ${
                  seconds <= 15 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                0:{String(seconds).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <DataRow label="Guest Mobile Phone" value={formatMobile(visitor.phone)} mono />
            <DataRow
              label="Destination Flat"
              value={`${visitor.flatId} (Block ${visitor.flatId?.[0]}, Floor ${Number(visitor.flatId?.[2] || 1)})`}
              mono
            />
            <DataRow label="Gate Entry Purpose" value={visitor.purpose} />
            <DataRow
              label="Vehicle Registration"
              value={visitor.vehicleNo || 'No Vehicle'}
              mono={Boolean(visitor.vehicleNo)}
            />
            <DataRow label="Logged by Gate Security" value={visitor.loggedBy || 'Gate 1'} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Security Notes (Optional)
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Allow courier, leave parcel at door"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              icon={ShieldX}
              className="!text-rose-700 !border-rose-300 hover:!bg-rose-50"
              onClick={() => act('DENIED')}
              disabled={Boolean(busy)}
            >
              {busy === 'DENIED' ? 'Denying…' : 'Deny Entry'}
            </Button>
            <Button variant="success" size="lg" icon={Check} onClick={() => act('APPROVED')} disabled={Boolean(busy)}>
              {busy === 'APPROVED' ? 'Approving…' : 'Approve Entry'}
            </Button>
          </div>

          <p className="text-[10px] text-slate-400 text-center font-medium flex items-center justify-center gap-1.5">
            <UserCheck className="w-3 h-3" /> Decision is relayed to the guard tablet in under 50ms over Socket.io
          </p>
        </div>
      </div>
    </div>
  );
}

export function VisitTypeIcon({ purpose = '' }) {
  if (purpose.includes('Delivery')) return <Truck className="w-5 h-5" />;
  return <UserCheck className="w-5 h-5" />;
}
