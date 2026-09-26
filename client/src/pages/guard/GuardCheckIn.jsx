import { useState } from 'react';
import { Car, Send, UserPlus, Users } from 'lucide-react';
import {
  Button,
  Field,
  FlatPicker,
  FormNote,
  Input,
  MobileInput,
  SectionCard,
  SectionHeader,
  Select,
  TextArea,
  VehicleInput,
} from '../../components/ui.jsx';
import { visitorApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { VISITOR_PURPOSES, flatIdFor } from '../../lib/constants.js';
import { isValidMobile, isValidVehicle } from '../../lib/validation.js';

export default function GuardCheckIn({ onChanged }) {
  const toast = useToast();
  const [form, setForm] = useState({
    guestName: '',
    phone: '',
    block: 'A',
    floor: 1,
    flatId: flatIdFor('A', 1, 1),
    purpose: 'Guest',
    vehicleNo: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.guestName.trim() || !form.flatId.trim()) {
      toast.warning('Incomplete Details', 'Guest name and destination flat are mandatory at the gate.');
      return;
    }
    if (!isValidMobile(form.phone)) {
      toast.alert('Invalid Mobile Number', 'Guest mobile must be exactly 10 digits starting with 6, 7, 8 or 9.');
      return;
    }
    if (form.vehicleNo && !isValidVehicle(form.vehicleNo)) {
      toast.alert('Invalid Vehicle Number', 'Plate must follow GJ-11-EC-2929 (state-district-series-number).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await visitorApi.checkIn(form);
      toast.success(res.autoApproved ? 'Pre-Approved Entry' : 'Approval Request Dispatched', res.message);
      setForm({ ...form, guestName: '', phone: '', vehicleNo: '', notes: '' });
      onChanged?.();
    } catch (err) {
      toast.alert('Check-In Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <SectionCard className="p-5 xl:col-span-2">
        <SectionHeader
          title="Log Walk-In Visitor"
          subtitle="Dispatch a live entry approval request to the resident's device"
          action={
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
              Gate 1 • Main Entrance
            </span>
          }
        />

        <form onSubmit={submit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Guest / Visitor Name" className="sm:col-span-2">
            <Input
              placeholder="e.g. Ravi Kumar"
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            />
          </Field>
          <Field label="Guest Mobile Number">
            <MobileInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} required />
          </Field>
          <div className="sm:col-span-2">
            <FlatPicker
              block={form.block}
              floor={form.floor}
              flatId={form.flatId}
              onChange={(next) => setForm({ ...form, ...next })}
              hint="A-101 … C-504"
            />
          </div>
          <Field label="Entry Purpose">
            <Select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {VISITOR_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle Registration">
            <VehicleInput value={form.vehicleNo} onChange={(vehicleNo) => setForm({ ...form, vehicleNo })} />
          </Field>
          <Field label="Security Notes (Optional)" className="sm:col-span-2">
            <TextArea
              rows={3}
              placeholder="e.g. Heavy parcel, escort needed to Block A"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <FormNote>
              Dispatch to <strong className="font-mono">{form.flatId}</strong> (Block {form.block}, Floor {form.floor}) •
              10-digit mobile required • plate format <strong className="font-mono">GJ-11-EC-2929</strong>
            </FormNote>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="xl" icon={Send} className="w-full" disabled={submitting}>
              {submitting ? 'Dispatching to resident…' : 'DISPATCH ENTRY APPROVAL TO FLAT'}
            </Button>
          </div>
        </form>
      </SectionCard>

      <div className="space-y-5">
        <SectionCard className="p-5">
          <SectionHeader title="Gate Protocol" subtitle="Standard operating procedure" />
          <ol className="mt-4 space-y-3">
            {[
              'Verify the guest name and destination flat on the intercom.',
              'Log the walk-in entry using this form (purpose + vehicle number).',
              'Wait for the resident approval popup — chime plays automatically when they tap Approve.',
              'If denied, politely refuse entry; the denial is logged against the flat.',
              'On exit, use CHECK-OUT on the Active Inside panel to close the gate log.',
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-xs text-slate-600 leading-relaxed">
                <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard className="p-5">
          <SectionHeader title="Visitor Categories" subtitle="Tap counts at this gate today" />
          <div className="mt-4 space-y-2.5">
            {VISITOR_PURPOSES.map((purpose) => (
              <div key={purpose} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  {purpose}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Logged</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-medium flex items-center gap-1.5">
            <UserPlus className="w-3 h-3" /> Every entry triggers a socket event to the resident's isolated flat room.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
