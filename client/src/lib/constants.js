export const ROLES = ['RESIDENT', 'ADMIN', 'GUARD'];

export const ROLE_META = {
  RESIDENT: {
    label: 'Resident',
    title: 'Society Member',
    accent: 'indigo',
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    blurb: 'Bills, QR gate passes, notices & helpdesk',
  },
  ADMIN: {
    label: 'Admin',
    title: 'Admin / Secretary',
    accent: 'violet',
    chip: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    blurb: 'Financials, flats, notices & gate telemetry',
  },
  GUARD: {
    label: 'Guard',
    title: 'Gate Security Guard',
    accent: 'emerald',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    blurb: 'Tablet touch UI & QR scanner terminal',
  },
};

export const VISITOR_PURPOSES = [
  'Guest',
  'Delivery / Courier',
  'Cab / Taxi',
  'Home Service',
  'Other / Meeting',
];

export const COMPLAINT_CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'LIFT', 'CLEANING', 'SECURITY', 'GENERAL'];
export const COMPLAINT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const TICKET_STATUSES = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

export const NOTICE_CATEGORIES = ['GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT'];

export const SOS_CATEGORIES = [
  'Fire Emergency',
  'Medical Emergency',
  'Security Threat',
  'Lift Stuck / Malfunction',
  'Noise / Disturbance',
  'Other / Meeting',
];

export const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI / QR', hint: 'GPay, PhonePe, Paytm, BHIM' },
  { id: 'CARD', label: 'Card', hint: 'Visa / Mastercard / RuPay' },
  { id: 'NETBANKING', label: 'Net Banking', hint: 'All major Indian banks' },
];

export const ADMIN_TABS = [
  { id: 'OVERVIEW', label: 'Overview & KPIs' },
  { id: 'FLATS', label: 'Flats Directory' },
  { id: 'APPROVALS', label: 'User Approvals' },
  { id: 'MAINTENANCE', label: 'Maintenance & Billing' },
  { id: 'GATE_LOGS', label: 'Live Gate Feed' },
  { id: 'NOTICES', label: 'Digital Notices' },
  { id: 'COMMITTEE', label: 'Committee Members' },
  { id: 'COMPLAINTS', label: 'Helpdesk Tickets' },
];

export const ADMIN_TITLES = {
  OVERVIEW: ['Society Command Center & Analytics', 'Khodaldham Society • Admin Control Panel'],
  FLATS: ['Society Building & Flats Directory', 'Blocks A / B / C • 5 floors × 4 flats each'],
  APPROVALS: ['New Registration Approvals', 'Approve residents & guards before they can sign in'],
  MAINTENANCE: ['Maintenance Accounts & Revenue Ledger', 'Khodaldham Society • Admin Control Panel'],
  GATE_LOGS: ['Real-Time Security Gate Pass Log Feed', 'Khodaldham Society • Admin Control Panel'],
  NOTICES: ['Digital Notice Board Management', 'Khodaldham Society • Admin Control Panel'],
  COMMITTEE: ['Society Committee Members', 'Choose approved residents who can manage notices and meetings'],
  COMPLAINTS: ['Resident Helpdesk & Grievance Tickets', 'Khodaldham Society • Admin Control Panel'],
};

export const RESIDENT_TABS = [
  { id: 'BILLS', label: 'Maintenance Bills' },
  { id: 'QR_PASS', label: 'QR Gate Pass Generator' },
  { id: 'GATE_ACTIVITY', label: 'Gate Activity Log' },
  { id: 'NOTICES', label: 'Notice Board' },
  { id: 'COMPLAINTS', label: 'Helpdesk Tickets' },
];

export const SOCIETY_NAME = 'Khodaldham Society';

/** ── Building structure: 3 blocks (A, B, C) × 5 floors × 4 flats = 60 flats ── */
export const BLOCKS = ['A', 'B', 'C'];
export const FLOORS = [1, 2, 3, 4, 5];
export const UNITS_PER_FLOOR = [1, 2, 3, 4];
export const BUILDING_LABEL = '3 blocks × 5 floors × 4 flats = 60 homes';

export const flatIdFor = (block, floor, unit) => `${String(block).toUpperCase()}-${floor}0${unit}`;

/** All 60 flat ids in directory order: A-101 … A-504, B-101 … C-504 */
export const ALL_FLAT_IDS = BLOCKS.flatMap((block) =>
  FLOORS.flatMap((floor) => UNITS_PER_FLOOR.map((unit) => flatIdFor(block, floor, unit)))
);

export const floorsOfBlock = (block) =>
  FLOORS.map((floor) => ({
    floor,
    label: `Floor ${floor}`,
    flatIds: UNITS_PER_FLOOR.map((unit) => flatIdFor(block, floor, unit)),
  }));

/** Maps a floor number to its occupancy tone for the building visual. */
export const occupancyTone = (occupied, total) => {
  if (occupied === total) return 'emerald';
  if (occupied === 0) return 'slate';
  return 'amber';
};
