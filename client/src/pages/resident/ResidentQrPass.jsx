import { useEffect, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Copy, Download, QrCode, ShieldCheck, Ticket, Timer, Users } from 'lucide-react';
import {
  Button,
  DataRow,
  EmptyState,
  Field,
  FlatPicker,
  Input,
  MobileInput,
  Pill,
  SectionCard,
  SectionHeader,
  Select,
  VehicleInput,
} from '../../components/ui.jsx';
import { isValidMobile, isValidVehicle } from '../../lib/validation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { visitorApi } from '../../lib/api.js';
import { dateTimeShort, timeAgo } from '../../lib/format.js';
import { VISITOR_PURPOSES } from '../../lib/constants.js';

export default function ResidentQrPass() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    guestName: '',
    phone: '',
    purpose: 'Guest',
    vehicleNo: '',
    validHours: 24,
    block: user?.flatId?.[0] || 'A',
    floor: Number(user?.flatId?.[2] || 1),
  });
  const [pass, setPass] = useState(null);
  const [payload, setPayload] = useState('');
  const [passes, setPasses] = useState([]);
  const [creating, setCreating] = useState(false);

  const loadPasses = async () => {
    try {
      const res = await visitorApi.myPasses();
      setPasses(res.passes);
    } catch (err) {
      console.error('Failed to load passes', err);
    }
  };

  useEffect(() => {
    loadPasses();
  }, []);

  const generate = async (event) => {
    event.preventDefault();
    if (!form.guestName.trim()) {
      toast.warning('Guest Name Required', 'Fill the guest details to generate a secure entry QR pass.');
      return;
    }
    if (!isValidMobile(form.phone)) {
      toast.alert('Invalid Mobile Number', 'Guest mobile must be exactly 10 digits starting with 6, 7, 8 or 9.');
      return;
    }
    if (form.vehicleNo && !isValidVehicle(form.vehicleNo)) {
      toast.alert('Invalid Vehicle Number', 'Use the format GJ-11-EC-2929 (state-district-series-number).');
      return;
    }
    setCreating(true);
    try {
      const res = await visitorApi.preApprove({ ...form, validHours: Number(form.validHours) });
      setPass(res.pass);
      setPayload(res.qrPayload);
      toast.success('QR Pass Issued', res.message);
      setForm({ ...form, guestName: '', phone: '', vehicleNo: '' });
      loadPasses();
    } catch (err) {
      toast.alert('Pass Generation Failed', err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyCode = async () => {
    if (!pass) return;
    try {
      await navigator.clipboard.writeText(pass.passCode);
      toast.success('Pass Code Copied', '10-digit console code copied to clipboard.');
    } catch {
      toast.warning('Copy Failed', 'Clipboard permission denied.');
    }
  };

  const downloadQr = () => {
    const canvas = document.getElementById('homi-qr-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${pass?.displayCode || 'homi-gate-pass'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR Saved', 'Gate pass saved to device gallery.');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <SectionCard className="p-5 xl:col-span-2">
        <SectionHeader
          title="QR Gate Pass Generator"
          subtitle="Pre-approve a visitor for instant contactless entry at the gate"
          action={
            <Pill className="bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Flat {user?.flatId}
              </span>
            </Pill>
          }
        />

        <form onSubmit={generate} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Guest / Visitor Name" className="sm:col-span-2">
            <Input
              placeholder="e.g. Neha Singh"
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            />
          </Field>
          <Field label="Guest Mobile Number">
            <MobileInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} required />
          </Field>
          <Field label="Entry Purpose">
            <Select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {VISITOR_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle No. (Optional)">
            <VehicleInput value={form.vehicleNo} onChange={(vehicleNo) => setForm({ ...form, vehicleNo })} />
          </Field>
          <Field label="Pass Validity">
            <Select value={form.validHours} onChange={(e) => setForm({ ...form, validHours: e.target.value })}>
              {[6, 12, 24, 72].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pass issued for</div>
              <div className="text-sm font-black text-slate-900 font-mono">
                {user?.flatId} <span className="text-slate-400 font-semibold">• Block {user?.flatId?.[0]} • Floor {Number(user?.flatId?.[2] || 1)}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Building structure: 3 blocks × 5 floors × 4 flats
            </div>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" size="lg" icon={QrCode} className="w-full" disabled={creating}>
              {creating ? 'Generating secure pass…' : 'Generate Dynamic QR Pass'}
            </Button>
          </div>
        </form>

        {pass && (
          <div className="mt-6 bg-slate-900 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5 animate-rise">
            <div className="bg-white p-3 rounded-2xl shrink-0">
              <QRCodeSVG value={payload} size={148} level="M" id="homi-qr-pass" />
              <div className="hidden">
                <QRCodeCanvas value={payload} size={512} id="homi-qr-canvas" level="M" marginSize={4} />
              </div>
            </div>
            <div className="flex-1 w-full min-w-0 space-y-2.5">
              <div className="flex items-center gap-2">
                <Pill className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Pre-Approved Pass</Pill>
                <span className="text-[10px] font-mono text-slate-400">Valid till {dateTimeShort(pass.validUntil)}</span>
              </div>
              <div className="text-lg font-black text-white truncate">{pass.guestName}</div>
              <div className="font-mono text-2xl font-black text-indigo-300 tracking-[0.14em]">{pass.passCode}</div>
              <div className="text-[11px] text-slate-400 font-mono">{pass.displayCode}</div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="primary" icon={Copy} onClick={copyCode}>
                  Share Pass
                </Button>
                <Button size="sm" variant="dark" icon={Download} onClick={downloadQr}>
                  Save QR
                </Button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="space-y-5">
        <SectionCard className="p-5">
          <SectionHeader title="How it works" subtitle="Contactless entry at Gate 1" />
          <ol className="mt-4 space-y-3">
            {[
              'Generate the QR pass — the server mints a signed pass code for your flat.',
              'Share it with your guest over WhatsApp or print it.',
              'The guard scans the QR (or types the 10-digit code) at the gate.',
              'The pass is validated, marked USED and a PRE_APPROVED visitor entry is logged instantly.',
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-xs text-slate-600 leading-relaxed">
                <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard className="p-5">
          <SectionHeader
            title="Issued Gate Passes"
            subtitle={`${passes.length} pass(es) issued from Flat ${user?.flatId}`}
          />
          <div className="mt-4 space-y-2.5">
            {passes.length === 0 ? (
              <EmptyState icon={Ticket} title="No passes issued yet" message="Generate your first QR gate pass for a guest." />
            ) : (
              passes.slice(0, 6).map((item) => (
                <div key={item._id} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">{item.guestName}</span>
                    <Pill
                      className={
                        item.status === 'ACTIVE' && !item.isExpired
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'USED'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }
                    >
                      {item.isExpired && item.status !== 'USED' ? 'EXPIRED' : item.status}
                    </Pill>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center justify-between">
                    <span>{item.displayCode}</span>
                    <span className="flex items-center gap-1">
                      <Timer className="w-3 h-3" /> {timeAgo(item.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <DataRow label="Code" value={item.passCode} mono />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-[10px] text-slate-500 font-medium">
            <Users className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
            Guards can also log walk-in visitors, which triggers a live approval request on your device.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
