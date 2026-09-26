export { formatMobile, formatVehicle, groupMobile, isValidMobile, isValidVehicle, digitsOnly } from './validation.js';

export const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export const compactInr = (value) => {
  const n = Number(value || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

export const dateShort = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export const dateTimeShort = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const clockTime = (value) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

export const timeAgo = (value) => {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/** Safe display for legacy rows that stored a 10-digit number without grouping. */
export const phoneDisplay = (value, formatter) => {
  if (!value || value === '—') return '—';
  return formatter ? formatter(value) : String(value);
};

export const initials = (name = 'User') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export const BILL_PILL = {
  PAID: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  OVERDUE: 'bg-rose-50 text-rose-700 border border-rose-200',
};

export const VISITOR_PILL = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  PRE_APPROVED: 'bg-sky-50 text-sky-700 border border-sky-200',
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse',
  DENIED: 'bg-rose-50 text-rose-700 border border-rose-200',
};

export const TICKET_PILL = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-sky-50 text-sky-700 border border-sky-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

export const PRIORITY_PILL = {
  LOW: 'bg-slate-100 text-slate-600 border border-slate-200',
  MEDIUM: 'bg-sky-50 text-sky-700 border border-sky-200',
  HIGH: 'bg-amber-50 text-amber-700 border border-amber-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border border-rose-200',
};

export const NOTICE_PILL = {
  GENERAL: 'bg-slate-100 text-slate-700 border border-slate-200',
  MAINTENANCE: 'bg-amber-50 text-amber-700 border border-amber-200',
  SECURITY: 'bg-rose-50 text-rose-700 border border-rose-200',
  EVENT: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
