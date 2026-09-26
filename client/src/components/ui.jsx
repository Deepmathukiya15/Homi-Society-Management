import { Building2, CheckCircle2, Info, X } from 'lucide-react';
import { ALL_FLAT_IDS, BLOCKS, FLOORS, UNITS_PER_FLOOR, flatIdFor } from '../lib/constants.js';
import {
  MOBILE_HINT,
  VEHICLE_HINT,
  digitsOnly,
  formatVehicle,
  groupMobile,
  isValidMobile,
  isValidVehicle,
} from '../lib/validation.js';

/** ── Layout primitives ─────────────────────────────────────────────────── */
export function SectionCard({ children, title, subtitle, action, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'indigo', badge }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
  };
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-black text-slate-900 tracking-tight font-mono">{value}</span>
        {badge}
      </div>
      {sub && <p className="text-[11px] text-slate-500 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

export function Pill({ children, className = '' }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function Button({ children, variant = 'primary', size = 'md', icon: Icon, className = '', ...props }) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs',
    dark: 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
    subtle: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-[11px]',
    md: 'px-3.5 py-2 text-xs',
    lg: 'px-4 py-2.5 text-sm',
    xl: 'px-5 py-3 text-sm',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={size === 'xl' ? 'w-4.5 h-4.5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 font-medium">{hint}</span>}
    </label>
  );
}

const controlClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all';

export function Input({ className = '', ...props }) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

const SELECT_ARROW =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23647569%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E")';

export function Select({ className = '', children, style, ...props }) {
  return (
    <select
      className={`${controlClass} appearance-none bg-no-repeat !pr-10 ${className}`}
      style={{
        backgroundImage: SELECT_ARROW,
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '1rem 1rem',
        paddingRight: '2.5rem',
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`${controlClass} resize-none ${className}`} {...props} />;
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      {message && <p className="text-xs text-slate-500 mt-1 max-w-sm font-medium">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, icon: Icon, children, footer, maxWidth = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-xl w-full ${maxWidth} my-6 text-slate-800 animate-rise`}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function DataRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function TableShell({ head, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px]">
            <tr>
              {head.map((th) => (
                <th key={th} className="py-3.5 px-4 whitespace-nowrap">
                  {th}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function LiveDot({ label, tone = 'emerald' }) {
  const tones = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', slate: 'bg-slate-400' };
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${tones[tone]} animate-pulse`} />
      {label && <span className="text-xs font-bold text-slate-900">{label}</span>}
    </div>
  );
}

/** ── Data-format inputs (shared by every portal) ───────────────────────── */

/**
 * MobileInput — digits only, capped at 10, grouped as "98765 43210", with
 * inline validity feedback. `value` is always the raw 10-digit string.
 */
export function MobileInput({ value, onChange, name, className = '', showHint = true, ...props }) {
  const digits = digitsOnly(value);
  const valid = isValidMobile(digits);
  const complete = digits.length === 10;

  return (
    <div className={className}>
      <div className="relative">
        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500 select-none">+91</span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          name={name}
          value={groupMobile(digits)}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
          placeholder="Enter 10-digit mobile"
          maxLength={11}
          aria-invalid={complete && !valid}
          className={`${controlClass} !pl-12 font-mono tracking-wide ${
            complete && !valid ? '!border-rose-300 !ring-rose-100' : valid ? '!border-emerald-300' : ''
          }`}
          {...props}
        />
        {valid && (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3.5 top-3" aria-hidden="true" />
        )}
      </div>
      {showHint && (
        <span className={`block text-[10px] mt-1 font-medium ${complete && !valid ? 'text-rose-600' : 'text-slate-400'}`}>
          {complete && !valid ? 'Must be exactly 10 digits starting with 6, 7, 8 or 9' : MOBILE_HINT}
        </span>
      )}
    </div>
  );
}

/**
 * VehicleInput — auto-formats Indian plates to GJ-11-EC-2929 while typing.
 * Optional: leaving it blank means "no vehicle".
 */
export function VehicleInput({ value, onChange, className = '', showHint = true, ...props }) {
  const valid = isValidVehicle(value);
  const filled = Boolean(String(value ?? '').replace(/[^A-Z0-9]/gi, ''));

  return (
    <div className={className}>
      <input
        type="text"
        value={formatVehicle(value)}
        onChange={(e) => onChange(formatVehicle(e.target.value))}
        placeholder="GJ-11-EC-2929"
        maxLength={14}
        aria-invalid={filled && !valid}
        className={`${controlClass} font-mono tracking-wider uppercase ${
          filled && !valid ? '!border-rose-300' : valid ? '!border-emerald-300' : ''
        }`}
        {...props}
      />
      {showHint && (
        <span className={`block text-[10px] mt-1 font-medium ${filled && !valid ? 'text-rose-600' : 'text-slate-400'}`}>
          {filled && !valid ? 'Incomplete plate — use GJ-11-EC-2929' : `${VEHICLE_HINT} (optional)`}
        </span>
      )}
    </div>
  );
}

/**
 * FlatPicker — cascading Block → Floor → Flat selector built from the society
 * structure (A/B/C × 5 floors × 4 flats). Falls back to a text input when
 * `mode="text"`.
 */
export function FlatPicker({ block, floor, flatId, onChange, mode = 'picker', hint, disabled = false, available = null }) {
  if (mode === 'text') {
    return (
      <Field label="Destination Flat" hint={hint || 'Block-Floor-Unit — e.g. B-305 (A-101 … C-504)'}>
        <div className="relative">
          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            value={flatId || ''}
            onChange={(e) => onChange({ flatId: e.target.value.toUpperCase() })}
            placeholder="B-305"
            disabled={disabled}
            className={`${controlClass} !pl-10 font-mono uppercase`}
          />
        </div>
      </Field>
    );
  }

  // `available` (optional) = flat ids still free to register. Blocks, floors and
  // flats that are already claimed are filtered out so they can never be picked.
  const blockOptions = available ? BLOCKS.filter((b) => available.some((id) => id.startsWith(`${b}-`))) : BLOCKS;
  const safeBlock = blockOptions.includes(block) ? block : blockOptions[0];
  const floorOptions = available
    ? FLOORS.filter((f) => available.some((id) => id.startsWith(`${safeBlock}-${f}`)))
    : FLOORS;
  const safeFloor = floorOptions.includes(Number(floor)) ? Number(floor) : floorOptions[0];
  const unitOptions = available
    ? available.filter((id) => id.startsWith(`${safeBlock}-${safeFloor}`))
    : UNITS_PER_FLOOR.map((unit) => flatIdFor(safeBlock, safeFloor, unit));
  const safeFlat = unitOptions.includes(flatId) ? flatId : unitOptions[0];

  if (available && !available.length) {
    return (
      <Field label="Flat" hint={hint}>
        <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
          Every flat in the society already has a registered account. Please contact the society office to
          transfer a flat before creating a new login.
        </div>
      </Field>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Field label="Block">
        <Select
          value={safeBlock}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (available) {
              const nextFloor = FLOORS.find((f) => available.some((id) => id.startsWith(`${next}-${f}`)));
              const nextFlat = available.find((id) => id.startsWith(`${next}-${nextFloor}`));
              onChange({ block: next, floor: nextFloor, flatId: nextFlat });
            } else {
              onChange({ block: next, floor: safeFloor, flatId: flatIdFor(next, safeFloor, 1) });
            }
          }}
        >
          {blockOptions.map((b) => (
            <option key={b} value={b}>
              Block {b}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Floor">
        <Select
          value={safeFloor}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (available) {
              onChange({
                block: safeBlock,
                floor: next,
                flatId: available.find((id) => id.startsWith(`${safeBlock}-${next}`)),
              });
            } else {
              onChange({ block: safeBlock, floor: next, flatId: flatIdFor(safeBlock, next, 1) });
            }
          }}
        >
          {floorOptions.map((f) => (
            <option key={f} value={f}>
              Floor {f}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Flat" hint={hint}>
        <Select
          value={safeFlat}
          disabled={disabled}
          onChange={(e) =>
            onChange({ block: safeBlock, floor: Number(e.target.value[2]), flatId: e.target.value })
          }
        >
          {unitOptions.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** Small read-only chip showing a validated mobile number. */
export function MobileChip({ value, className = '' }) {
  const local = digitsOnly(value);
  const valid = isValidMobile(local);
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${className}`}>
      <span className="text-slate-400">+91</span>
      <span className="font-semibold text-slate-700">
        {valid ? `${local.slice(0, 5)} ${local.slice(5)}` : local || '—'}
      </span>
      {valid && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
    </span>
  );
}

/** Inline validation banner used above form footers. */
export function FormNote({ tone = 'info', children }) {
  const tones = {
    info: 'bg-slate-50 border-slate-200 text-slate-600',
    error: 'bg-rose-50 border-rose-200 text-rose-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  const Icon = tone === 'error' ? Info : Info;
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-[11px] font-medium flex items-start gap-2 leading-relaxed ${tones[tone]}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
      <div>{children}</div>
    </div>
  );
}

/** Structure legend: 3 blocks × 5 floors × 4 flats. */
export function StructureChips({ compact = false }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {BLOCKS.map((b) => (
        <span
          key={b}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700"
        >
          <Building2 className="w-3 h-3 text-indigo-500" /> Block {b}
          {!compact && <span className="text-slate-400 font-medium">· {FLOORS.length} floors · {UNITS_PER_FLOOR.length} flats</span>}
        </span>
      ))}
      {!compact && (
        <span className="text-[10px] font-semibold text-slate-500 px-1">
          {ALL_FLAT_IDS.length} flats in total (A-101 … C-504)
        </span>
      )}
    </div>
  );
}
