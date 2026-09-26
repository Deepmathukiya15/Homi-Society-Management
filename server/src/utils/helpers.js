import crypto from 'node:crypto';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthName = (index) => MONTHS[((index % 12) + 12) % 12];

export const randomPassCode = () => String(crypto.randomInt(1000000000, 9999999999));

export const displayCodeFor = (flatId) =>
  `HOMI-${String(flatId).replace('-', '').toUpperCase()}-${crypto.randomInt(1000, 9999)}`;

export const money = (n) => Number(n || 0);

/** Deterministic maintenance calculator used by the cron generator + seeders. */
export const buildBillAmounts = (flat) => {
  const baseMaintenance = money(flat.maintenanceRate || 2500);
  const parkingCharge = flat.allocatedParking ? 400 : 0;
  const waterCharge = 150;
  const securityCharge = 250;
  return {
    baseMaintenance,
    parkingCharge,
    waterCharge,
    securityCharge,
    amount: baseMaintenance + parkingCharge + waterCharge + securityCharge,
  };
};

export const dueDateFor = (year, monthIndex) => new Date(Date.UTC(year, monthIndex, 10));

export const relativeTime = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/** ── Society building structure ──────────────────────────────────────────
 * 3 blocks (A, B, C) × 5 floors × 4 flats per floor = 60 flats.
 * Flat numbering: A-101, A-102, A-103, A-104, A-201 … A-504.
 */
export const BLOCKS = ['A', 'B', 'C'];
export const FLOORS = [1, 2, 3, 4, 5];
export const UNITS_PER_FLOOR = [1, 2, 3, 4];

export const flatIdFor = (block, floor, unit) =>
  `${String(block).toUpperCase()}-${floor}0${unit}`;

export const flatNumberFor = (floor, unit) => `${floor}0${unit}`;

export const parseFlatId = (flatId) => {
  const match = String(flatId || '').toUpperCase().match(/^([A-Z])-(\d)(\d{2})$/);
  if (!match) return null;
  return { block: match[1], floor: Number(match[2]), unit: Number(match[3]) };
};

export const isSupportedBlock = (block) => BLOCKS.includes(String(block || '').toUpperCase());
