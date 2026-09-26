import { Building2, ChevronRight, Home, Layers, Percent, Users } from 'lucide-react';
import { Pill } from './ui.jsx';
import { BLOCKS, FLOORS, UNITS_PER_FLOOR, flatIdFor } from '../lib/constants.js';

/**
 * Visual society directory — the actual building: 3 blocks × 5 floors × 4 homes.
 * Floors are drawn top-down (Floor 5 first) like a real elevation, each floor
 * row showing its 4 flats with live occupancy tones.
 */
const TONES = {
  occupied: {
    box: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100',
    id: 'text-emerald-900',
    meta: 'text-emerald-700/80',
    dot: 'bg-emerald-500',
  },
  vacant: {
    box: 'bg-slate-50 border-dashed border-slate-300 hover:border-slate-400',
    id: 'text-slate-500',
    meta: 'text-slate-400',
    dot: 'bg-slate-300',
  },
  focused: {
    box: 'bg-indigo-600 border-indigo-700 text-white shadow-lg ring-2 ring-indigo-200',
    id: 'text-white',
    meta: 'text-indigo-100',
    dot: 'bg-white',
  },
};

export default function BuildingDirectory({ summary, selectedBlock, onSelectBlock, selectedFlatId, onSelectFlat }) {
  const structure = summary?.structure;
  const blocks = summary?.byBlock?.length
    ? summary.byBlock
    : BLOCKS.map((block) => ({
        block,
        total: FLOORS.length * UNITS_PER_FLOOR.length,
        occupied: 0,
        vacant: FLOORS.length * UNITS_PER_FLOOR.length,
        floors: FLOORS.map((floor) => ({
          floor,
          flatIds: UNITS_PER_FLOOR.map((unit) => flatIdFor(block, floor, unit)),
        })),
      }));

  const flatLookup = {};
  blocks.forEach((b) =>
    (b.floors || []).forEach((f) =>
      (f.flatIds || []).forEach((id) => {
        flatLookup[id] = { ...(f.flatDetails?.[id] || {}), occupied: f.occupiedIds?.includes(id) };
      })
    )
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {blocks.map((blockData) => {
          const active = selectedBlock === blockData.block;
          const occupancyPct = blockData.total ? Math.round((blockData.occupied / blockData.total) * 100) : 0;

          return (
            <div
              key={blockData.block}
              className={`bg-white border rounded-2xl shadow-xs overflow-hidden transition-all ${
                active ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
              }`}
            >
              {/* Block header */}
              <div className="p-4 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white tracking-tight">Block {blockData.block}</div>
                    <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                      {FLOORS.length} floors • {UNITS_PER_FLOOR.length} flats / floor
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-white font-mono leading-none">{occupancyPct}%</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Occupied</div>
                </div>
              </div>

              {/* Occupancy bar */}
              <div className="h-1.5 bg-slate-100">
                <div
                  className={`h-full transition-all ${occupancyPct === 100 ? 'bg-emerald-500' : occupancyPct >= 60 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>

              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> {blockData.occupied} occupied
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Home className="w-3 h-3" /> {blockData.vacant} vacant
                  </span>
                </div>

                {/* Floors drawn top-down like an elevation */}
                <div className="space-y-2">
                  {[...(blockData.floors || [])].reverse().map((floor) => {
                    const flatIds = floor.flatIds || UNITS_PER_FLOOR.map((u) => flatIdFor(blockData.block, floor.floor, u));
                    const details = floor.flatDetails || {};
                    return (
                      <div key={floor.floor} className="flex items-stretch gap-2">
                        <div className="w-12 shrink-0 flex flex-col items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-black text-slate-600">F{floor.floor}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 flex-1">
                          {flatIds.map((id) => {
                            const info = details[id] || {};
                            const occupied = typeof info.isOccupied === 'boolean' ? info.isOccupied : undefined;
                            const focused = selectedFlatId === id;
                            const tone = focused ? TONES.focused : occupied ? TONES.occupied : TONES.vacant;
                            return (
                              <button
                                key={id}
                                onClick={() => onSelectFlat?.(id)}
                                title={`${id}${occupied === undefined ? '' : occupied ? ' • Occupied' : ' • Vacant'}`}
                                className={`rounded-lg border px-1.5 py-2 text-center transition-all active:scale-95 ${tone.box}`}
                              >
                                <div className={`text-[11px] font-black font-mono leading-none ${tone.id}`}>{id}</div>
                                <div className={`mt-1 flex items-center justify-center gap-1 ${tone.meta}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                                  <span className="text-[8px] font-bold uppercase tracking-wide truncate max-w-[38px]">
                                    {occupied === undefined ? '—' : occupied ? (info.residentType || 'Occupied') : 'Vacant'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => onSelectBlock?.(active ? 'ALL' : blockData.block)}
                  className={`w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {active ? 'Showing only this block' : `Focus Block ${blockData.block}`}
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {structure && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
          <Pill className="bg-indigo-50 text-indigo-700 border border-indigo-200">{structure.label}</Pill>
          <Pill className="bg-emerald-50 text-emerald-700 border border-emerald-200">{summary.occupied} occupied</Pill>
          <Pill className="bg-slate-100 text-slate-600 border border-slate-200">{summary.vacant} vacant</Pill>
          <span className="flex items-center gap-1">
            <Percent className="w-3 h-3" /> Numbering: A-101, A-102, A-103, A-104 → A-201 … A-504 (same for Blocks B &amp; C)
          </span>
        </div>
      )}
    </div>
  );
}
