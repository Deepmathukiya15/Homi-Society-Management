/**
 * Client-side mirrors of the server validators (server/src/utils/validators.js).
 * Every form validates here for instant feedback; the API validates again so a
 * crafted request can never bypass the rules.
 */

/** Mobile: exactly 10 digits, first digit 6-9. */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const MOBILE_HINT = '10 digits, starting with 6/7/8/9 — e.g. 98765 43210';
export const MOBILE_MESSAGE = 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9';

/** Vehicle: GJ-11-EC-2929 → state(2) - district(1-2) - series(1-2) - number(4) */
export const VEHICLE_REGEX = /^[A-Z]{2}-\d{1,2}-[A-Z]{1,2}-\d{4}$/;
export const VEHICLE_HINT = 'Format GJ-11-EC-2929';
export const VEHICLE_MESSAGE = 'Vehicle number must follow the format GJ-11-EC-2929';

/** Digits only, capped at 10 — perfect for a tel input. */
export const digitsOnly = (value, max = 10) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/** Strips +91 / leading 0 → local 10-digit number, or null when invalid. */
export function normalizeMobile(input) {
  const digits = digitsOnly(input, 15);
  let local = digits;
  if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) local = digits.slice(-10);
  return MOBILE_REGEX.test(local) ? local : null;
}

export const isValidMobile = (input) => normalizeMobile(input) !== null;

/** Live "98765 43210" grouping while the user types. */
export const groupMobile = (input) => {
  const digits = digitsOnly(input);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

/** "+91 98765 43210" for display. */
export function formatMobile(input) {
  const local = normalizeMobile(input);
  if (!local) return String(input ?? '').trim() || '—';
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

/** Auto-formats a plate as the guard types: gj11ec2929 → GJ-11-EC-2929 */
export function formatVehicle(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  const m = raw.match(/^([A-Z]{0,2})(\d{0,2})([A-Z]{0,2})(\d{0,4})/);
  if (!m) return raw;
  const [, state, district, series, number] = m;
  return [state, district, series, number].filter(Boolean).join('-');
}

export const isValidVehicle = (input) => VEHICLE_REGEX.test(String(input ?? '').toUpperCase());

export const fieldError = (value, { required = false, type = 'mobile' } = {}) => {
  const raw = String(value ?? '').trim();
  if (!required && !raw) return '';
  if (required && !raw) return type === 'mobile' ? 'Mobile number is required' : 'This field is required';
  if (type === 'mobile') return isValidMobile(raw) ? '' : MOBILE_MESSAGE;
  if (type === 'vehicle') return isValidVehicle(raw) ? '' : VEHICLE_MESSAGE;
  return '';
};
