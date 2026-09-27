import { useEffect, useMemo, useState } from 'react';
import { Bike, Car, ParkingSquare } from 'lucide-react';
import { Button, Field, Modal, Pill, SectionCard, Select, StatCard } from '../../components/ui.jsx';
import { flatApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminParking() {
  const toast = useToast();
  const [flats, setFlats] = useState([]);
  const [assigningSlot, setAssigningSlot] = useState(null);
  const [residentFlatId, setResidentFlatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await flatApi.list();
      setFlats(result.flats || []);
    } catch (error) {
      toast.alert('Parking Directory Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotCount = flats.length || 60;
  const bikeField = 'allocatedBikeParking';
  const carField = 'allocatedCarParking';
  const bikeBySlot = useMemo(() => new Map(flats.filter((flat) => flat[bikeField]).map((flat) => [flat[bikeField], flat])), [flats]);
  const carBySlot = useMemo(() => new Map(flats.filter((flat) => flat[carField]).map((flat) => [flat[carField], flat])), [flats]);
  const bikeAssigned = bikeBySlot.size;
  const carAssigned = carBySlot.size;

  const currentSlotMap = assigningSlot?.kind === 'bike' ? bikeBySlot : carBySlot;
  const currentAssignedFlat = assigningSlot ? currentSlotMap.get(assigningSlot.slot) : null;
  const residentsEligibleForSlot = assigningSlot
    ? flats.filter((flat) => flat.isOccupied && (
        flat.flatId === currentAssignedFlat?.flatId ||
        !(assigningSlot.kind === 'bike' ? flat.allocatedBikeParking : flat.allocatedCarParking)
      ))
    : [];

  const startAssigning = (kind, slot, assignedFlat) => {
    setAssigningSlot({ kind, slot });
    setResidentFlatId(assignedFlat?.flatId || '');
  };

  const removeSlotAssignment = async () => {
    if (!assigningSlot || !currentAssignedFlat) return;
    const field = assigningSlot.kind === 'bike' ? bikeField : carField;
    setSaving(true);
    try {
      await flatApi.update(currentAssignedFlat.flatId, { [field]: '' });
      toast.success('Parking Removed', `${assigningSlot.slot} removed from ${currentAssignedFlat.flatId} and is now available.`);
      setAssigningSlot(null);
      setResidentFlatId('');
      await load();
    } catch (error) {
      toast.alert('Could Not Remove Parking', error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSlotAssignment = async () => {
    if (!assigningSlot) return;
    const field = assigningSlot.kind === 'bike' ? bikeField : carField;
    const slotMap = assigningSlot.kind === 'bike' ? bikeBySlot : carBySlot;
    const currentFlat = slotMap.get(assigningSlot.slot);
    const nextFlat = flats.find((flat) => flat.flatId === residentFlatId);
    if (currentFlat) {
      toast.info('Slot Already Assigned', `${assigningSlot.slot} is already allocated to ${currentFlat.flatId}.`);
      setAssigningSlot(null);
      return;
    }
    if (!nextFlat) {
      toast.info('Choose a Resident', 'Select an occupied resident flat to assign this parking slot.');
      return;
    }

    setSaving(true);
    try {
      await flatApi.update(nextFlat.flatId, { [field]: assigningSlot.slot });
      toast.success('Parking Assigned', `${assigningSlot.slot} assigned to ${nextFlat.flatId} · ${nextFlat.ownerName}`);
      setAssigningSlot(null);
      setResidentFlatId('');
      await load();
    } catch (error) {
      toast.alert('Could Not Assign Parking', error.message);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const renderParkingGrid = (kind, prefix, title, Icon, assignedSlots) => (
    <SectionCard className="p-4 sm:p-5">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{prefix}1 to {prefix}{slotCount} · {assignedSlots.size} assigned · {slotCount - assignedSlots.size} available · assigned bays show resident and flat</p>
          </div>
        </div>
        <Pill className="w-fit bg-violet-50 text-violet-700 border border-violet-200">{prefix}1–{prefix}{slotCount}</Pill>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-10 gap-2">
        {Array.from({ length: slotCount }, (_, index) => {
          const slot = `${prefix}${index + 1}`;
          const flat = assignedSlots.get(slot);
          const active = assigningSlot?.kind === kind && assigningSlot?.slot === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => startAssigning(kind, slot, flat)}
              title={flat ? `${slot} · ${flat.flatId} · ${flat.ownerName}` : `${slot} · Available — click to assign`}
              className={`min-h-[68px] rounded-xl border p-2 text-left transition-all ${
                active
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                  : flat
                    ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-400'
                    : 'border-dashed border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <div className={`font-mono text-xs font-black ${flat ? 'text-slate-900' : 'text-slate-500'}`}>{slot}</div>
              <div className={`mt-1 truncate text-[10px] font-bold ${flat ? 'text-emerald-700' : 'text-slate-400'}`}>
                {flat ? flat.flatId : 'Available'}
              </div>
              {flat && <div className="mt-0.5 min-h-[20px] line-clamp-2 break-words text-[9px] leading-tight font-semibold text-slate-600">{flat.ownerName || 'Name not listed'}</div>}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Flats" value={flats.length || '—'} sub="Parking slots per vehicle type" icon={ParkingSquare} tone="indigo" />
        <StatCard label="Bike Parking" value={`${bikeAssigned} / ${flats.length || 0}`} sub={`PB1–PB${slotCount}`} icon={Bike} tone="violet" />
        <StatCard label="Car Parking" value={`${carAssigned} / ${flats.length || 0}`} sub={`PC1–PC${slotCount}`} icon={Car} tone="amber" />
      </div>

      <Modal
        open={Boolean(assigningSlot)}
        onClose={() => { if (!saving) setAssigningSlot(null); }}
        title={assigningSlot ? (currentAssignedFlat ? `${assigningSlot.slot} is assigned` : `Assign ${assigningSlot.slot}`) : 'Assign Parking'}
        subtitle="Only occupied resident flats can receive parking"
        icon={assigningSlot?.kind === 'bike' ? Bike : Car}
        footer={(
          <div className="flex justify-end gap-2">
            {currentAssignedFlat ? (
              <>
                <Button variant="outline" onClick={() => setAssigningSlot(null)} disabled={saving}>Close</Button>
                <Button variant="danger" onClick={removeSlotAssignment} disabled={saving}>{saving ? 'Removing…' : 'Remove Parking'}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAssigningSlot(null)} disabled={saving}>Cancel</Button>
                <Button variant="success" onClick={saveSlotAssignment} disabled={saving || !residentFlatId}>
                  {saving ? 'Saving…' : `Assign ${assigningSlot?.slot || ''}`}
                </Button>
              </>
            )}
          </div>
        )}
      >
        {assigningSlot && currentAssignedFlat ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-mono text-sm font-black text-emerald-800">{assigningSlot.slot}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{currentAssignedFlat.flatId} · {currentAssignedFlat.ownerName}</p>
            <p className="mt-2 text-xs text-emerald-800">This slot is assigned. Remove the allocation here to make the slot available again in both directories.</p>
          </div>
        ) : assigningSlot && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">Each occupied flat can receive at most one bike slot and one car slot. An assigned slot cannot be double-booked; remove its current assignment before reusing it.</p>
            <Field label="Resident flat">
              <Select value={residentFlatId} onChange={(event) => setResidentFlatId(event.target.value)} disabled={saving}>
                <option value="">Select an occupied resident flat</option>
                {residentsEligibleForSlot.map((flat) => (
                  <option key={flat.flatId} value={flat.flatId}>{flat.flatId} · {flat.ownerName}</option>
                ))}
              </Select>
            </Field>
            {!residentsEligibleForSlot.length && <p className="text-[11px] text-amber-700">No occupied resident flat is currently available for this slot.</p>}
          </div>
        )}
      </Modal>

      {loading && !flats.length ? (
        <SectionCard className="p-8 text-center text-sm text-slate-500">Loading parking directory…</SectionCard>
      ) : (
        <div className="flex flex-col gap-5">
          {renderParkingGrid('bike', 'PB', 'Bike Parking', Bike, bikeBySlot)}
          {renderParkingGrid('car', 'PC', 'Car Parking', Car, carBySlot)}
        </div>
      )}
    </div>
  );
}
