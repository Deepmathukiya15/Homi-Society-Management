import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Car,
  CheckCircle2,
  Layers,
  PencilLine,
  Search,
  Users,
} from 'lucide-react';
import {
  Button,
  DataRow,
  EmptyState,
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
  const [flats, setFlats] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [block, setBlock] = useState('ALL');
  const [floor, setFloor] = useState('ALL');
  const [occupancy, setOccupancy] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedFlatId, setSelectedFlatId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFlat, setNewFlat] = useState({ block: 'B', floor: 3, flatId: 'B-301' });
  const [newOwner, setNewOwner] = useState({ ownerName: '', ownerContact: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        flatApi.list({ block, floor, occupancy, search }),
        flatApi.summary(),
      ]);
      setFlats(list.flats);
      setSummary(sum.summary);
    } catch (err) {
      toast.alert('Directory Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, floor, occupancy, search]);

  const selectedFlat = useMemo(
    () => flats.find((f) => f.flatId === selectedFlatId) || null,
    [flats, selectedFlatId]
  );

  const openEditor = (flat) => {
    setEditing(flat);
    setForm({
      isOccupied: flat.isOccupied,
      ownerName: flat.ownerName,
      ownerContact: flat.ownerContact || '',
      residentType: flat.residentType,
      allocatedParking: flat.allocatedParking || '',
      maintenanceRate: flat.maintenanceRate,
    });
  };

  const save = async () => {
    if (form.ownerContact && !isValidMobile(form.ownerContact)) {
      toast.alert('Invalid Mobile Number', 'Owner contact must be exactly 10 digits starting with 6, 7, 8 or 9.');
      return;
    }
    setSaving(true);
    try {
      const res = await flatApi.update(editing.flatId, {
        ...form,
        isOccupied: form.isOccupied === true || form.isOccupied === 'true',
        maintenanceRate: Number(form.maintenanceRate),
      });
      toast.success('Flat Updated', res.message);
      setEditing(null);
      load();
    } catch (err) {
      toast.alert('Update Failed', err.message);
    } finally {
      setSaving(false);
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

  const perFloor = FLOORS.length * 4;
  const avgMaintenance = Math.round(
    (flats.reduce((s, f) => s + Number(f.maintenanceRate || 0), 0) / Math.max(flats.length, 1)) || 0
  );

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
          label="Parking Allocated"
          value={summary?.allocatedParking ?? '—'}
          sub={`Basement bays • ${perFloor} flats per block-floor`}
          icon={Car}
          tone="violet"
        />
        <StatCard label="Avg. Maintenance" value={inr(avgMaintenance)} sub="Base rate per flat / month" icon={Users} tone="amber" />
      </div>

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
                Floor 1 → 101-104 … Floor 5 → 501-504 • tap any flat to manage it
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
          onSelectFlat={(id) => {
            setSelectedFlatId(id);
            const found = flats.find((f) => f.flatId === id);
            if (found) openEditor(found);
            else toast.info('Flat not in current filter', `Clear the filters to manage ${id}.`);
          }}
        />
      </SectionCard>

      {/* ── Filters + flat cards ── */}
      <SectionCard className="p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-500">Block:</span>
          {['ALL', ...BLOCKS].map((b) => (
            <button
              key={b}
              onClick={() => setBlock(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                block === b ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b === 'ALL' ? 'All Blocks' : `Block ${b}`}
            </button>
          ))}
          <span className="text-xs font-semibold text-slate-500 ml-2">Floor:</span>
          <Select value={floor} onChange={(e) => setFloor(e.target.value)} className="!w-32 !py-1.5 !text-xs">
            <option value="ALL">All floors</option>
            {FLOORS.map((f) => (
              <option key={f} value={f}>
                Floor {f}
              </option>
            ))}
          </Select>
          <span className="text-xs font-semibold text-slate-500 ml-2">Status:</span>
          {['ALL', 'OCCUPIED', 'VACANT'].map((item) => (
            <button
              key={item}
              onClick={() => setOccupancy(item)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                occupancy === item ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative w-full xl:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <Input
            className="!pl-10"
            placeholder="Search flat or owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </SectionCard>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">
          {block === 'ALL' ? 'All Flats' : `Block ${block}`}
          {floor !== 'ALL' && ` • Floor ${floor}`} <span className="text-slate-400 font-medium">({flats.length})</span>
        </h3>
        {selectedFlatId && (
          <button onClick={() => setSelectedFlatId(null)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
            Clear selection
          </button>
        )}
      </div>

      {loading && !flats.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : flats.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Building2} title="No flats match these filters" message="Try another block, floor or clear the search box." />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {flats.map((flat) => (
            <div
              key={flat._id}
              className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3.5 animate-fade-in transition-all ${
                selectedFlatId === flat.flatId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-slate-900 font-mono tracking-tight">{flat.flatId}</div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Block {flat.block || flat.wing} • Floor {flat.floor} • Unit {flat.unit} • {flat.area} sq.ft
                  </div>
                </div>
                <Pill
                  className={
                    flat.isOccupied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }
                >
                  {flat.isOccupied ? 'Occupied' : 'Vacant'}
                </Pill>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <DataRow label="Resident/Owner:" value={flat.ownerName} />
                <DataRow label="Contact:" value={flat.ownerContactDisplay || flat.ownerContact || '—'} mono />
                <DataRow label="Resident Type:" value={flat.residentType} />
                <DataRow label="Parking:" value={flat.allocatedParking || 'None'} mono />
                <DataRow label="Base Maintenance:" value={`${inr(flat.maintenanceRate)} / month`} />
              </div>

              <Button variant="outline" size="sm" icon={PencilLine} className="w-full" onClick={() => { setSelectedFlatId(flat.flatId); openEditor(flat); }}>
                Manage Flat
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Manage flat ── */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Manage Flat ${editing?.flatId || ''}`}
        subtitle={
          editing
            ? `Block ${editing.block || editing.wing} • Floor ${editing.floor} • Unit ${editing.unit} — occupancy, resident details and parking`
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
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Allocated Parking">
                <Input
                  value={form.allocatedParking}
                  placeholder="P-A1"
                  onChange={(e) => setForm({ ...form, allocatedParking: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Base Maintenance (₹)">
                <Input
                  type="number"
                  value={form.maintenanceRate}
                  onChange={(e) => setForm({ ...form, maintenanceRate: e.target.value })}
                />
              </Field>
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
