/**
 * Society master data — Khodaldham Society
 *
 * Building structure:  3 blocks (A, B, C) × 5 floors × 4 flats = 60 flats
 *   Floor 1 → A-101, A-102, A-103, A-104
 *   Floor 2 → A-201 … A-204   …   Floor 5 → A-501 … A-504   (same for B and C)
 *
 * Occupancy: only the two demo homes are occupied — A-101 (resident account) and
 * A-201 (admin account). Every other flat is vacant/cleared, so it carries no
 * owner, no contact, no parking and no bills, and it stays available for New
 * Registration until somebody claims it.
 *
 * All mobile numbers are stored as 10-digit locals (e.g. 9876543210) and all
 * vehicle numbers follow the GJ-11-EC-2929 plate format.
 */
import { BLOCKS, FLOORS, UNITS_PER_FLOOR, flatIdFor, flatNumberFor } from '../utils/helpers.js';

export const SOCIETY = {
  name: 'Khodaldham Society',
  city: 'Ahmedabad, Gujarat',
  blocks: BLOCKS,
  floorsPerBlock: FLOORS.length,
  flatsPerFloor: UNITS_PER_FLOOR.length,
};

/**
 * The ONLY occupied flats in the society.
 *   A-101 → the demo RESIDENT account (resident@homi.com)
 *   A-201 → the demo ADMIN account (admin@homi.com)
 * Every other flat of the 60 is vacant/cleared.
 */
const OCCUPIED_FLATS = {
  'A-101': {
    ownerName: 'Aarav Patel',
    residentType: 'Owner',
    ownerContact: '9876543210',
    email: 'resident@homi.com',
  },
  'A-201': {
    ownerName: 'Rajesh Trivedi',
    residentType: 'Owner',
    ownerContact: '9099911111',
    email: 'admin@homi.com',
  },
};

const AREA_BY_FLOOR = { 1: 1180, 2: 1240, 3: 1300, 4: 1360, 5: 1450 };

/** Builds the full 60-flat directory deterministically. */
function buildFlats() {
  const flats = [];

  BLOCKS.forEach((block) => {
    FLOORS.forEach((floor) => {
      UNITS_PER_FLOOR.forEach((unit) => {
        const flatId = flatIdFor(block, floor, unit);
        const person = OCCUPIED_FLATS[flatId];
        const isOccupied = Boolean(person);
        const area = AREA_BY_FLOOR[floor] + (unit - 1) * 25;
        const parkingIndex = isOccupied ? Object.keys(OCCUPIED_FLATS).indexOf(flatId) + 1 : 0;

        flats.push({
          flatId,
          block,
          wing: block, // `wing` retained for API compatibility with the earlier schema
          flatNumber: flatNumberFor(floor, unit),
          floor,
          unit,
          area,
          isOccupied,
          ownerName: isOccupied ? person.ownerName : 'Unassigned',
          residentType: isOccupied ? person.residentType : 'Vacant',
          ownerContact: isOccupied ? person.ownerContact : '', // 10-digit local
          allocatedParking: isOccupied ? `PC${parkingIndex}` : '',
          allocatedBikeParking: '',
          allocatedCarParking: isOccupied ? `PC${parkingIndex}` : '',
          // ₹2.10 / sq.ft rounded to the nearest 10 → area-based maintenance
          maintenanceRate: Math.round((area * 2.1) / 10) * 10,
          email: isOccupied ? person.email : undefined,
        });
      });
    });
  });

  return flats;
}

function finalizeFlats() {
  const flats = buildFlats();
  const indexByFlat = {};

  flats.forEach((flat) => {
    if (!flat.isOccupied) {
      flat.ownerContact = '';
      return;
    }
    indexByFlat[flat.flatId] = flat.ownerContact;
  });

  return { flats, indexByFlat };
}

const finalized = finalizeFlats();
export const FLATS = finalized.flats;
export const FLAT_MOBILE_INDEX = finalized.indexByFlat;

export const FLAT_LOOKUP = Object.fromEntries(FLATS.map((f) => [f.flatId, f]));

/**
 * Demo accounts — the admin account is also the resident of A-201 (owner on
 * record there), so both occupied flats are covered by one login each.
 */
export const USERS = [
  {
    name: 'Aarav Patel',
    email: 'resident@homi.com',
    password: 'resident123',
    role: 'RESIDENT',
    flatId: 'A-101',
    contactNumber: '9876543210',
  },
  {
    name: 'Rajesh Trivedi',
    email: 'admin@homi.com',
    password: 'admin123',
    role: 'ADMIN',
    flatId: 'A-201',
    contactNumber: '9099911111',
    staffId: 'ADM-001',
  },
  {
    name: 'Devendra Singh',
    email: 'guard@homi.com',
    password: 'guard123',
    role: 'GUARD',
    contactNumber: '9099922222',
    staffId: 'SEC-001',
  },
  {
    name: 'Meena Parmar',
    email: 'cleaner@homi.com',
    password: 'cleaner123',
    role: 'CLEANER',
    contactNumber: '9876543215',
    staffId: 'CLN-001',
    monthlySalary: 24000,
  },
];

/** Flats that carry unpaid dues in the seeded ledger */
export const OVERDUE_MAP = {
  'A-101': ['July', 'August'], // keeps the defaulters view populated
  'A-201': [], // the admin's own home stays fully paid
};

export const NOTICES = [
  {
    title: 'Water Supply Interruption on 18 September',
    content:
      'The Ahmedabad Municipal Corporation will replace the main inlet valve of the overhead tank between 9:00 AM and 2:00 PM on 18 September 2026. Kindly store drinking water in advance. The tanker service will be available at Gate 2 from 3:00 PM.',
    category: 'MAINTENANCE',
    priority: 'HIGH',
    isPinned: true,
    postedBy: 'Rajesh Trivedi (Secretary)',
  },
  {
    title: 'Lift Modernisation — Blocks B & C',
    content:
      'Annual lift modernisation and safety certification for Blocks B and C is scheduled from 20 to 22 September. One lift will remain operational at all times. Please plan your movement accordingly.',
    category: 'MAINTENANCE',
    priority: 'NORMAL',
    isPinned: false,
    postedBy: 'Rajesh Trivedi (Secretary)',
  },
  {
    title: 'Visitor Gate Policy — QR Pass Mandatory After 10 PM',
    content:
      'Effective 1 October 2026, all visitors arriving after 10:00 PM must be issued a pre-approved QR gate pass from the resident portal. Walk-in visitors will require live resident approval through the HOMI app.',
    category: 'SECURITY',
    priority: 'CRITICAL',
    isPinned: true,
    postedBy: 'Society Security Committee',
  },
  {
    title: 'Navratri Garba Night — 25 September',
    content:
      'Join us at the central lawn on 25 September from 7:30 PM for the society Garba night. Cultural programmes, live dhol and dinner for all residents across blocks A, B and C. Registration at the society office or via the helpdesk module.',
    category: 'EVENT',
    priority: 'NORMAL',
    isPinned: false,
    postedBy: 'Cultural Committee',
  },
  {
    title: 'Monthly Maintenance Due on the 10th',
    content:
      'Maintenance invoices for the current month are auto-generated on the 1st and are payable by the 10th through the resident portal (UPI / Card / Net Banking). A late fee of ₹100 applies thereafter as per society bye-laws.',
    category: 'GENERAL',
    priority: 'NORMAL',
    isPinned: false,
    postedBy: 'Society Management Committee',
  },
];

export const COMPLAINTS = [
  {
    ticketNo: 'TKT-100241', flatId: 'A-101', residentName: 'Aarav Patel', category: 'PLUMBING',
    title: 'Bathroom tap leakage in master bedroom',
    description: 'Continuous drip from the master bedroom bathroom tap since last Friday. Water wastage is significant and the wall paint has started to swell.',
    priority: 'HIGH', status: 'PENDING',
  },
  {
    ticketNo: 'TKT-100240', flatId: 'A-201', residentName: 'Rajesh Trivedi', category: 'LIFT',
    title: 'Lift stuck between 2nd and 3rd floor',
    description: 'Block A Lift 2 halted between floors for 4 minutes with two residents inside. Emergency alarm bell did not sound.',
    priority: 'CRITICAL', status: 'IN_PROGRESS',
  },
  {
    ticketNo: 'TKT-100238', flatId: 'A-101', residentName: 'Aarav Patel', category: 'ELECTRICAL',
    title: 'Corridor tube light flickering on 1st floor',
    description: 'The corridor light outside A-103 flickers continuously at night. Please replace the choke / fitting.',
    priority: 'MEDIUM', status: 'PENDING',
  },
  {
    ticketNo: 'TKT-100235', flatId: 'A-201', residentName: 'Rajesh Trivedi', category: 'CLEANING',
    title: 'Garbage not collected for two days at Block A chute',
    description: 'Wet waste has piled up at the Block A disposal chute and is causing a smell on the landing.',
    priority: 'HIGH', status: 'RESOLVED',
    adminRemarks: 'Housekeeping supervisor reassigned the Block A route. Chute sanitised with phenyl.',
  },
  {
    ticketNo: 'TKT-100230', flatId: 'A-101', residentName: 'Aarav Patel', category: 'SECURITY',
    title: 'Gate 2 boom barrier left open at night',
    description: 'Boom barrier at Gate 2 was found open at 11:40 PM. Request regular night-round audit.',
    priority: 'HIGH', status: 'RESOLVED',
    adminRemarks: 'Night shift briefing completed. Guard roster and patrol log updated.',
  },
];

export const GATE_PASSES = [
  {
    displayCode: 'HOMI-A101-9982',
    passCode: '4421987654',
    flatId: 'A-101',
    residentName: 'Aarav Patel',
    guestName: 'Neha Singh',
    phone: '9988766554', // 10-digit mobile
    purpose: 'Guest',
    vehicleNo: 'GJ-01-AB-1234',
    validHours: 24,
  },
];

/** Gate telemetry seeded so the guard terminal and live feed look alive */
export const VISITORS = [
  {
    guestName: 'Ravi Kumar', phone: '9925011223', flatId: 'A-101', purpose: 'Delivery / Courier',
    vehicleNo: 'GJ-11-EC-2929', approvalStatus: 'PENDING', minutesAgo: 2, loggedBy: 'Devendra Singh',
  },
  {
    guestName: 'Sunita Verma', phone: '9825033445', flatId: 'A-101', purpose: 'Guest',
    approvalStatus: 'APPROVED', minutesAgo: 40, loggedBy: 'Devendra Singh', approvedBy: 'Aarav Patel',
  },
  {
    guestName: 'Amit Shah', phone: '9725055667', flatId: 'A-201', purpose: 'Cab / Taxi',
    vehicleNo: 'GJ-01-TX-4411', approvalStatus: 'APPROVED', minutesAgo: 150, minutesOut: 95,
    loggedBy: 'Devendra Singh', approvedBy: 'Rajesh Trivedi',
  },
  {
    guestName: 'Deepak Nair', phone: '9904577889', flatId: 'A-201', purpose: 'Home Service',
    approvalStatus: 'APPROVED', minutesAgo: 240, minutesOut: 180, loggedBy: 'Devendra Singh',
    approvedBy: 'Rajesh Trivedi',
  },
  {
    guestName: 'Kabir Mehta', phone: '9012099881', flatId: 'A-201', purpose: 'Guest',
    vehicleNo: 'GJ-11-EC-2929', approvalStatus: 'DENIED', minutesAgo: 320, loggedBy: 'Devendra Singh',
    guardNote: 'Resident not expecting any guest today',
  },
  {
    guestName: 'Zomato — Imran Sheikh', phone: '9769012345', flatId: 'A-101', purpose: 'Delivery / Courier',
    vehicleNo: 'GJ-18-XY-7788', approvalStatus: 'APPROVED', minutesAgo: 30, minutesOut: 12,
    loggedBy: 'Devendra Singh', approvedBy: 'Aarav Patel',
  },
];
