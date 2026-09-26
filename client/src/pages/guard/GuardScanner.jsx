import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Keyboard, QrCode, RefreshCw, ScanLine, ShieldCheck, Ticket, XCircle } from 'lucide-react';
import { Button, DataRow, SectionCard, SectionHeader, Input } from '../../components/ui.jsx';
import { visitorApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { dateTimeShort, formatMobile, formatVehicle, timeAgo } from '../../lib/format.js';
import { playScan } from '../../lib/sound.js';

const DEMO_CODES = ['4421987654'];

export default function GuardScanner() {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [passes, setPasses] = useState([]);
  const timerRef = useRef(null);

  const loadPasses = async () => {
    try {
      const res = await visitorApi.myPasses();
      setPasses(res.passes);
    } catch {
      /* optional */
    }
  };

  useEffect(() => {
    loadPasses();
    return () => clearTimeout(timerRef.current);
  }, []);

  const validate = async (rawCode) => {
    const value = String(rawCode || code).trim();
    if (!value) {
      toast.warning('No Pass Code', 'Scan a QR matrix or enter the 10-digit pass code.');
      return;
    }
    setError('');
    setResult(null);
    try {
      const res = await visitorApi.validatePass(value);
      setResult(res);
      playScan();
      toast.success('QR Pass Accepted', res.message);
      setCode('');
      loadPasses();
    } catch (err) {
      setError(err.message);
      setResult(null);
      toast.alert('QR Error', err.message);
    }
  };

  const simulateCameraScan = () => {
    setScanning(true);
    setResult(null);
    setError('');
    timerRef.current = setTimeout(() => {
      setScanning(false);
      validate(DEMO_CODES[0]);
    }, 1700);
  };

  const activePasses = passes.filter((p) => p.status === 'ACTIVE' && !p.isExpired);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <SectionCard className="p-5">
        <SectionHeader
          title="QR Code & Pass Scanner"
          subtitle="Point the tablet camera at the guest's QR pass, or key in the console code"
          action={
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
              Gate 1 Scanner
            </span>
          }
        />

        <div className="mt-5 relative rounded-2xl border-2 border-dashed border-slate-300 bg-slate-900 aspect-[4/3] overflow-hidden flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18),transparent_65%)]" />
          {scanning && <div className="absolute left-4 right-4 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)] animate-scan" />}

          <div className="relative w-40 h-40 border-2 border-white/40 rounded-2xl flex items-center justify-center">
            {scanning ? (
              <div className="text-center">
                <ScanLine className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-300 mt-2 uppercase tracking-wider">
                  Decoding optical QR matrix…
                </p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">Awaiting QR</p>
              </div>
            )}
          </div>

          <div className="relative mt-5 flex flex-col sm:flex-row gap-2">
            <Button variant="primary" icon={Camera} onClick={simulateCameraScan} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Simulate Camera Scan'}
            </Button>
            <Button
              variant="dark"
              icon={RefreshCw}
              onClick={() => {
                setResult(null);
                setError('');
                loadPasses();
              }}
            >
              Refresh Feed
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <SectionHeader title="Or Enter 10-Digit Pass Code" subtitle="Fallback for guests with a printed pass" />
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <Input
                className="!pl-10 font-mono tracking-[0.2em]"
                placeholder="4421987654"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                onKeyDown={(e) => e.key === 'Enter' && validate()}
              />
            </div>
            <Button icon={ShieldCheck} onClick={() => validate()} disabled={scanning}>
              Validate Pass
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-5 bg-emerald-50 border border-emerald-300 rounded-2xl p-4 animate-rise">
            <div className="flex items-center gap-2.5">
              <BadgeCheck className="w-6 h-6 text-emerald-600" />
              <div>
                <div className="text-sm font-black text-emerald-900 uppercase tracking-tight">Valid QR Pass Verified!</div>
                <p className="text-[11px] text-emerald-800">
                  Welcome {result.visitor.guestName} to Flat {result.visitor.flatId} — access granted.
                </p>
              </div>
            </div>
            <div className="mt-3 bg-white/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
              <DataRow label="Pass Reference" value={result.pass.displayCode} mono />
              <DataRow label="Guest" value={result.visitor.guestName} />
              <DataRow
                label="Destination Flat"
                value={`${result.visitor.flatId} (Block ${result.visitor.flatId?.[0]})`}
                mono
              />
              <DataRow label="Guest Mobile" value={formatMobile(result.visitor.phone)} mono />
              {result.visitor.vehicleNo && (
                <DataRow label="Vehicle" value={formatVehicle(result.visitor.vehicleNo)} mono />
              )}
              <DataRow label="Purpose" value={result.visitor.purpose} />
              <DataRow label="Entry Status" value={result.visitor.approvalStatus} mono />
              <DataRow label="Checked In" value={dateTimeShort(result.visitor.checkInTime)} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5 bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-rose-900 uppercase tracking-tight">Invalid or Expired QR Pass Code</div>
              <p className="text-[11px] text-rose-800 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="space-y-5">
        <SectionCard className="p-5">
          <SectionHeader
            title="Pre-Approved Passes On File"
            subtitle={`${activePasses.length} active pass(es) issued by residents`}
          />
          <div className="mt-4 space-y-2.5">
            {activePasses.length === 0 && <p className="text-xs text-slate-500">No active passes at the moment.</p>}
            {activePasses.map((pass) => (
              <div key={pass._id} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">{pass.guestName}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                    ACTIVE
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  <DataRow label="Destination" value={pass.flatId} mono />
                  <DataRow label="Valid Till" value={dateTimeShort(pass.validUntil)} />
                  <DataRow label="Pass Code" value={pass.passCode} mono />
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[10px] text-slate-500 font-mono">{pass.displayCode}</span>
                  <button
                    onClick={() => validate(pass.passCode)}
                    className="text-[10px] font-bold text-violet-700 hover:text-violet-900 uppercase tracking-wide"
                  >
                    Scan Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="p-5">
          <SectionHeader title="Scan Audit Trail" subtitle="Recent pass usage" />
          <div className="mt-4 space-y-2.5">
            {passes
              .filter((p) => p.status === 'USED')
              .slice(0, 5)
              .map((pass) => (
                <div key={pass._id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{pass.guestName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {pass.displayCode} • Flat {pass.flatId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Used</div>
                    <div className="text-[10px] text-slate-400 font-medium">{timeAgo(pass.usedAt || pass.updatedAt)}</div>
                  </div>
                </div>
              ))}
            {!passes.some((p) => p.status === 'USED') && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-slate-400" /> No passes scanned in this shift yet.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
