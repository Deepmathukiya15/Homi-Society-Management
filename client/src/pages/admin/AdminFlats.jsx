import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Car,
  CheckCircle2,
  Layers,
  PencilLine,
  Users,
} from 'lucide-react';
import {
  Button,
  Field,
  FlatPicker,
  Input,
  Modal,
  MobileInput,
  Pill,
  SectionCard,
  Select,
  StatCard,
} from '../../components/ui.jsx';
import BuildingDirectory from '../../components/BuildingDirectory.jsx';
import { flatApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { BLOCKS, FLOORS } from '../../lib/constants.js';
import { inr } from '../../lib/format.js';
import { isValidMobile } from '../../lib/validation.js';

export default function AdminFlats() {
  const toast = useToast();
  const [allFlats, setAllFlats] = useState([]);
  const [summary, setSummary] = useState(null);
  const [block, setBlock] = useState('ALL');
  const [selectedFlatId, setSelectedFlatId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [parkingAction, setParkingAction] = useState(null);
  const [maintenanceRateDraft, setMaintenanceRateDraft] = useState('');
  const [societyMaintenanceRate, setSocietyMaintenanceRate] = useState(null);
  const [applyingMaintenanceRate, setApplyingMaintenanceRate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFlat, setNewFlat] = useState({ block: 'B', floor: 3, flatId: 'B-301' });
  const [newOwner, setNewOwner] = useState({ ownerName: '', ownerContact: '' });

  const load = async () => {
    try {
      const [sum, rate, directory] = await Promise.all([
        flatApi.summary(),
        flatApi.maintenanceRate(),
        flatApi.list(),
      ]);
      setAllFlats(directory.flats);
      setSummary(sum.summary);
      setSocietyMaintenanceRate(rate.maintenanceRate ?? null);
      setMaintenanceRateDraft(rate.maintenanceRate == null ? '' : String(rate.maintenanceRate));
    } catch (err) {
      toast.alert('Directory Error', err.message);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedFlat = useMemo(
    () => allFlats.find((f) => f.flatId === selectedFlatId) || null,
    [allFlats, selectedFlatId]
  );

  const openEditor = (flat) => {
    setEditing(flat);
    setForm({
      isOccupied: flat.isOccupied,
      ownerName: flat.ownerName,
      ownerContact: flat.ownerContact || '',
      residentType: flat.residentType,
      allocatedBikeParking: flat.allocatedBikeParking || '',
      allocatedCarParking: flat.allocatedCarParking || '',
    });
  };

  const save = async () => {
    if (form.ownerContact && !isValidMobile(form.ownerContact)) {
      toast.alert('Invalid Mobile Number', 'Owner contact must be exactly 10 digits starting with 6, 7, 8 or 9.');
      return;
    }
    setSaving(true);
    try {
      const isOccupied = form.isOccupied === true || form.isOccupied === 'true';
      const res = await flatApi.update(editing.flatId, {
        ...form,
        isOccupied,
        allocatedBikeParking: isOccupied ? form.allocatedBikeParking : '',
        allocatedCarParking: isOccupied ? form.allocatedCarParking : '',
      });
      toast.success('Flat Updated', res.message);
      await load();
      setEditing(null);
    } catch (err) {
      toast.alert('Update Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeParking = async (flat, vehicle) => {
    const field = vehicle === 'bike' ? 'allocatedBikeParking' : 'allocatedCarParking';
    if (!flat?.[field]) return;
    const actionKey = `${flat.flatId}:${vehicle}`;
    setParkingAction(actionKey);
    try {
      await flatApi.update(flat.flatId, { [field]: '' });
      toast.success('Parking Removed', `${flat[field]} removed from ${flat.flatId}.`);
      await load();
    } catch (error) {
      toast.alert('Could Not Remove Parking', error.message);
    } finally {
      setParkingAction(null);
    }
  };

  const applyMaintenanceRate = async () => {
    const amount = Number(maintenanceRateDraft);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.alert('Invalid Maintenance Rate', 'Enter a monthly rate greater than ₹0.');
      return;
    }
    setApplyingMaintenanceRate(true);
    try {
      const result = await flatApi.setMaintenanceRate(amount);
      setSocietyMaintenanceRate(result.maintenanceRate);
      setMaintenanceRateDraft(String(result.maintenanceRate));
      toast.success('Society Maintenance Updated', result.message);
      await load();
    } catch (error) {
      toast.alert('Could Not Apply Maintenance Rate', error.message);
    } finally {
      setApplyingMaintenanceRate(false);
    }
  };

  const createFlat = async () => {
    setSaving(true);
    try {
      const res = await flatApi.create({
        block: newFlat.block,
        floor: newFlat.floor,
        unit: Number(newFlat.flatId?.slice(-1)) || 1,
        flatId: newFlat.flatId,
        ...newOwner,
      });
      toast.success('Flat Added', res.message);
      setCreating(false);
      setNewOwner({ ownerName: '', ownerContact: '' });
      load();
    } catch (err) {
      toast.alert('Could Not Add Flat', err.message);
    } finally {
      setSaving(false);
    }
  };

  const avgMaintenance = Math.round(
    (allFlats.reduce((s, f) => s + Number(f.maintenanceRate || 0), 0) / Math.max(allFlats.length, 1)) || 0
  );
  const parkingOptions = (vehicle, flatId, currentSlot = '') => {
    const field = vehicle === 'bike' ? 'allocatedBikeParking' : 'allocatedCarParking';
    const flat = allFlats.find((item) => item.flatId === flatId);
    const existing = flat?.[field] || '';
    if (existing) return [existing];
    const usedByOthers = new Set(allFlats.filter((item) => item.flatId !== flatId).map((item) => item[field]).filter(Boolean));
    const prefix = vehicle === 'bike' ? 'PB' : 'PC';
    const capacity = allFlats.length || 60;
    return Array.from({ length: capacity }, (_, index) => `${prefix}${index + 1}`)
      .filter((slot) => !usedByOthers.has(slot) || slot === currentSlot);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Flats"
          value={summary?.totalFlats ?? '—'}
          sub={summary?.structure ? summary.structure.label : `${BLOCKS.length} blocks × ${FLOORS.length} floors × 4`}
          icon={Building2}
          tone="indigo"
        />
        <StatCard
          label="Occupied / Vacant"
          value={`${summary?.occupied ?? '—'} / ${summary?.vacant ?? '—'}`}
          sub={`${summary?.occupants ?? 0} owners • ${summary?.tenants ?? 0} tenants`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Parking Flats"
          value={summary?.allocatedParking ?? '—'}
          sub={`Bike slots: ${summary?.allocatedBikeParking ?? 0} • Car slots: ${summary?.allocatedCarParking ?? 0}`}
          icon={Car}
          tone="violet"
        />
        <StatCard label="Avg. Maintenance" value={inr(avgMaintenance)} sub="Base rate per flat / month" icon={Users} tone="amber" />
      </div>

      <SectionCard className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Common Maintenance for All Flats</h3>
            <p className="text-xs text-slate-500">Set once here to apply the same monthly rate to all flats and future flats. Bills already issued will not be changed.</p>
            <p className="text-xs font-semibold text-indigo-700">
              {societyMaintenanceRate != null
                ? `Current society-wide rate: ${inr(societyMaintenanceRate)} / month`
                : 'No common rate saved yet; applying one will make all flat rates the same.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <Field label="Monthly rate per flat (₹)">
              <Input type="number" min="1" step="50" className="sm:!w-48" value={maintenanceRateDraft} onChange={(event) => setMaintenanceRateDraft(event.target.value)} placeholder="e.g. 2500" />
            </Field>
            <Button variant="success" onClick={applyMaintenanceRate} disabled={applyingMaintenanceRate || !maintenanceRateDraft}>
              {applyingMaintenanceRate ? 'Applying to all flats…' : 'Apply to All Flats'}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Use the Parking Directory tab below Flats Directory in the sidebar to assign PB bike and PC car slots.</p>
      </SectionCard>

      {/* ── Live building directory: Block A/B/C → 5 floors → 4 flats ── */}
      <SectionCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Building Directory — Blocks A / B / C</h3>
              <p className="text-xs text-slate-500 font-medium">
                Floor 1 → 101-104 … Floor 5 → 501-504 • tap a flat to see resident and PB / PC details below
              </p>
            </div>
          </div>
          <Button variant="outline" icon={Building2} onClick={() => setCreating(true)}>
            Add Flat
          </Button>
        </div>
        <BuildingDirectory
          summary={summary}
          selectedBlock={block}
          selectedFlatId={selectedFlatId}
          onSelectBlock={(b) => setBlock(b)}
          onSelectFlat={(id) => setSelectedFlatId(id)}
        />
        {selectedFlat && (
          <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Selected flat details</p>
                <h4 className="mt-1 font-mono text-lg font-black text-slate-900">{selectedFlat.flatId}</h4>
                <p className="text-xs text-slate-500">Block {selectedFlat.block} · Floor {selectedFlat.floor} · Unit {selectedFlat.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill className={selectedFlat.isOccupied ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}>
                  {selectedFlat.isOccupied ? 'Occupied' : 'Vacant'}
                </Pill>
                <Button variant="outline" size="sm" icon={PencilLine} onClick={() => openEditor(selectedFlat)}>Manage Flat</Button>
                <button className="px-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800" onClick={() => setSelectedFlatId(null)}>Clear</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Resident living here</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{selectedFlat.isOccupied ? selectedFlat.ownerName : 'No resident assigned'}</p>
                <p className="mt-1 text-[11px] text-slate-500">{selectedFlat.isOccupied ? `${selectedFlat.residentType || 'Resident'} · ${selectedFlat.ownerContactDisplay || selectedFlat.ownerContact || 'Contact not listed'}` : 'This flat is currently vacant.'}</p>
              </div>
              <div className="rounded-xl border border-white bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bike parking · PB</p>
                  <Button variant="outline" size="sm" className="!px-2 !py-1 text-[10px]" disabled={Boolean(parkingAction)}
                    onClick={() => selectedFlat.allocatedBikeParking ? removeParking(selectedFlat, 'bike') : openEditor(selectedFlat)}>
                    {parkingAction === `${selectedFlat.flatId}:bike` ? 'Removing…' : selectedFlat.allocatedBikeParking ? 'Remove' : 'Assign'}
                  </Button>
                </div>
                <p className="mt-2 font-mono text-sm font-black text-slate-900">{selectedFlat.allocatedBikeParking || 'Not assigned'}</p>
              </div>
              <div className="rounded-xl border border-white bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Car parking · PC</p>
                  <Button variant="outline" size="sm" className="!px-2 !py-1 text-[10px]" disabled={Boolean(parkingAction)}
                    onClick={() => selectedFlat.allocatedCarParking ? removeParking(selectedFlat, 'car') : openEditor(selectedFlat)}>
                    {parkingAction === `${selectedFlat.flatId}:car` ? 'Removing…' : selectedFlat.allocatedCarParking ? 'Remove' : 'Assign'}
                  </Button>
                </div>
                <p className="mt-2 font-mono text-sm font-black text-slate-900">{selectedFlat.allocatedCarParking || 'Not assigned'}</p>
              </div>
              <div className="rounded-xl border border-white bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Monthly maintenance</p>
                <p className="mt-1 text-sm font-black text-slate-900">{inr(selectedFlat.maintenanceRate)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Per month</p>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Manage flat ── */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Manage Flat ${editing?.flatId || ''}`}
        subtitle={
          editing
            ? `Block ${editing.block || editing.wing} • Floor ${editing.floor} • Unit ${editing.unit} — occupancy and resident details`
            : ''
        }
        icon={Building2}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3.5">
            <Field label="Occupancy Status">
              <Select value={String(form.isOccupied)} onChange={(e) => setForm({ ...form, isOccupied: e.target.value })}>
                <option value="true">Occupied</option>
                <option value="false">Vacant</option>
              </Select>
            </Field>
            <Field label="Resident / Owner Name">
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Contact Number">
                <MobileInput value={form.ownerContact} onChange={(ownerContact) => setForm({ ...form, ownerContact })} />
              </Field>
              <Field label="Resident Type">
                <Select value={form.residentType} onChange={(e) => setForm({ ...form, residentType: e.target.value })}>
                  {['Owner', 'Tenant', 'Vacant'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-violet-900">Parking Assignment</h4>
                <p className="mt-0.5 text-[10px] text-violet-700">Changes sync automatically with the Parking Directory. Use “Not assigned” to remove a slot.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bike parking · PB">
                  <Select
                    value={form.allocatedBikeParking || ''}
                    disabled={form.isOccupied !== true && form.isOccupied !== 'true'}
                    onChange={(event) => setForm({ ...form, allocatedBikeParking: event.target.value })}
                  >
                    <option value="">Not assigned</option>
                    {parkingOptions('bike', editing.flatId, form.allocatedBikeParking).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </Select>
                </Field>
                <Field label="Car parking · PC">
                  <Select
                    value={form.allocatedCarParking || ''}
                    disabled={form.isOccupied !== true && form.isOccupied !== 'true'}
                    onChange={(event) => setForm({ ...form, allocatedCarParking: event.target.value })}
                  >
                    <option value="">Not assigned</option>
                    {parkingOptions('car', editing.flatId, form.allocatedCarParking).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </Select>
                </Field>
              </div>
              {(form.isOccupied !== true && form.isOccupied !== 'true') && <p className="text-[10px] text-amber-700">Parking slots are released when this flat is marked vacant.</p>}
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[11px] text-indigo-800">
              Monthly maintenance is controlled by the common society-wide rate setting and is the same for every flat.
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 font-medium leading-relaxed">
              Flat numbering follows the society layout — Block {editing.block || editing.wing}, Floor {editing.floor},
              Unit {editing.unit} → <strong className="font-mono">{editing.flatId}</strong>. Contact numbers must be valid
              10-digit mobiles.
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add flat (block / floor / unit) ── */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add Flat to Directory"
        subtitle="Pick the block, floor and flat number — the id is generated automatically"
        icon={Building2}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={createFlat} disabled={saving}>
              {saving ? 'Adding…' : 'Add Flat'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <FlatPicker
            block={newFlat.block}
            floor={newFlat.floor}
            flatId={newFlat.flatId}
            onChange={(next) => setNewFlat({ ...newFlat, ...next })}
            hint="A-101 … C-504"
          />
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Owner Name (Optional)">
              <Input
                value={newOwner.ownerName}
                placeholder="Unassigned"
                onChange={(e) => setNewOwner({ ...newOwner, ownerName: e.target.value })}
              />
            </Field>
            <Field label="Owner Contact (Optional)">
              <MobileInput value={newOwner.ownerContact} onChange={(ownerContact) => setNewOwner({ ...newOwner, ownerContact })} />
            </Field>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-[11px] text-indigo-900 font-medium">
            Creating <strong className="font-mono">{newFlat.flatId}</strong> → Block {newFlat.block}, Floor {newFlat.floor},
            Unit {Number(String(newFlat.flatId).slice(-1)) || 1}
          </div>
        </div>
      </Modal>
    </div>
  );
}
