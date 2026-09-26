/**
 * Shared Indian data-format validators used by every controller and mirrored
 * in the client (client/src/lib/validation.js) so both tiers agree.
 */

/** Mobile: exactly 10 digits, first digit 6-9 (Indian mobile numbering plan). */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;

/** Vehicle: state(2 letters) - district(1-2 digits) - series(1-2 letters) - number(4 digits) e.g. GJ-11-EC-2929 */
export const VEHICLE_REGEX = /^[A-Z]{2}-\d{1,2}-[A-Z]{1,2}-\d{4}$/;

export const MOBILE_MESSAGE = 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9';
export const VEHICLE_MESSAGE = 'Use the format GJ-11-EC-2929 (state, district, series, number)';

/** Strips +91 / 0 prefixes and spaces → 10-digit local number, or null. */
export function normalizeMobile(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  let local = digits;
  if (digits.length > 10) {
    if (digits.startsWith('91')) local = digits.slice(-10);
    else if (digits.startsWith('0')) local = digits.slice(-10);
  }
  return MOBILE_REGEX.test(local) ? local : null;
}

/** '+91 98765 43210' for display. */
export function formatMobile(input) {
  const local = normalizeMobile(input);
  if (!local) return String(input ?? '').trim() || '—';
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

/** Uppercases and inserts the separators → 'GJ-11-EC-2929', or null when unparseable. */
export function normalizeVehicle(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  const match = raw.match(/^([A-Z]{1,2})(\d{1,2})([A-Z]{1,2})(\d{1,4})$/);
  if (!match) return null;
  const [, state, district, series, number] = match;
  return `${state}-${district}-${series}-${number}`;
}

export const isValidVehicle = (input) => VEHICLE_REGEX.test(String(input ?? '').toUpperCase());

export const isValidMobile = (input) => normalizeMobile(input) !== null;

/** Express-friendly guard: validates and returns { ok, value, message }. */
export function validateMobileField(input, { required = true, field = 'Mobile number' } = {}) {
  const value = String(input ?? '').trim();
  if (!value || value === '—') {
    return required ? { ok: false, message: `${field} is required` } : { ok: true, value: '' };
  }
  const local = normalizeMobile(value);
  if (!local) return { ok: false, message: `${field}: ${MOBILE_MESSAGE}` };
  return { ok: true, value: local };
}

export function validateVehicleField(input, { required = false, field = 'Vehicle number' } = {}) {
  const value = String(input ?? '').trim();
  if (!value) return required ? { ok: false, message: `${field} is required` } : { ok: true, value: '' };
  if (/^no vehicle$/i.test(value)) return { ok: true, value: '' };
  const plate = normalizeVehicle(value);
  if (!plate || !isValidVehicle(plate)) return { ok: false, message: `${field}: ${VEHICLE_MESSAGE}` };
  return { ok: true, value: plate };
}
