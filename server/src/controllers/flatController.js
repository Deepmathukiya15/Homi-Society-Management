import { db } from '../store/index.js';
import { asyncHandler, BLOCKS, FLOORS, UNITS_PER_FLOOR, flatIdFor, flatNumberFor, parseFlatId } from '../utils/helpers.js';
import { formatMobile, validateMobileField } from '../utils/validators.js';

/** Residents see the society directory but never other owners' phone numbers. */
const projectFlat = (flat, viewer) => {
  const base = {
    _id: String(flat._id),
    flatId: flat.flatId,
    block: flat.block || flat.wing,
    wing: flat.block || flat.wing,
    flatNumber: flat.flatNumber,
    floor: flat.floor,
    unit: flat.unit,
    area: flat.area,
    isOccupied: flat.isOccupied,
    residentType: flat.residentType,
    allocatedParking: flat.allocatedParking,
    maintenanceRate: flat.maintenanceRate,
  };
  if (viewer?.role === 'ADMIN') {
    return { ...base, ownerName: flat.ownerName, ownerContact: flat.ownerContact, ownerContactDisplay: formatMobile(flat.ownerContact) };
  }
  return { ...base, ownerName: flat.isOccupied ? flat.ownerName : 'Unassigned' };
};

const sortFlats = (list) =>
  [...list].sort(
    (a, b) =>
      String(a.block || a.wing).localeCompare(String(b.block || b.wing)) ||
      Number(a.floor) - Number(b.floor) ||
      Number(a.unit) - Number(b.unit)
  );

/** GET /api/flats?block=A&floor=3&occupancy=OCCUPIED&search=patel */
export const getFlats = asyncHandler(async (req, res) => {
  const { block, wing, floor = 'ALL', occupancy = 'ALL', search = '' } = req.query;
  const blockFilter = String(block || wing || 'ALL').toUpperCase();

  const flats = await db.Flat.find({});

  const filtered = flats
    .filter((f) => blockFilter === 'ALL' || String(f.block || f.wing).toUpperCase() === blockFilter)
    .filter((f) => floor === 'ALL' || String(f.floor) === String(floor))
    .filter((f) => {
      if (occupancy === 'OCCUPIED') return f.isOccupied;
      if (occupancy === 'VACANT') return !f.isOccupied;
      return true;
    })
    .filter((f) => {
      if (!search) return true;
      const q = String(search).toLowerCase();
      return (
        f.flatId.toLowerCase().includes(q) ||
        String(f.ownerName || '').toLowerCase().includes(q) ||
        String(f.allocatedParking || '').toLowerCase().includes(q) ||
        String(f.block || f.wing).toLowerCase().includes(q)
      );
    });

  const projected = sortFlats(filtered).map((f) => projectFlat(f, req.user));
  res.json({ success: true, count: projected.length, flats: projected });
});

/**
 * GET /api/flats/available  (PUBLIC — no token, used by the New Registration form)
 *
 * A flat that already has a login account in the database is "claimed" and must
 * never be offered again, so the sign-up picker only lists unclaimed flats.
 */
export const getAvailableFlats = asyncHandler(async (req, res) => {
  const flats = await db.Flat.find({});
  const users = await db.User.find({});

  // A rejected registration frees its flat again (the account stays for audit,
  // but it no longer holds the home).
  const claimed = new Set(
    users
      .filter((u) => (u.approvalStatus || 'APPROVED') !== 'REJECTED')
      .map((u) => (u.flatId ? String(u.flatId).toUpperCase() : null))
      .filter(Boolean),
  );

  const available = flats
    .map((f) => String(f.flatId).toUpperCase())
    .filter((flatId) => !claimed.has(flatId))
    .sort();

  const byBlock = BLOCKS.map((block) => ({
    block,
    flatIds: available.filter((flatId) => flatId.startsWith(`${block}-`)),
    floors: FLOORS.map((floor) => ({
      floor,
      flatIds: available.filter((flatId) => flatId.startsWith(`${block}-${floor}`)),
    })),
  }));

  res.json({
    success: true,
    totalFlats: flats.length,
    claimed: claimed.size,
    availableCount: available.length,
    available,
    byBlock,
    structure: {
      blocks: BLOCKS,
      floors: FLOORS,
      unitsPerFloor: UNITS_PER_FLOOR,
      label: `${BLOCKS.length} blocks × ${FLOORS.length} floors × ${UNITS_PER_FLOOR.length} flats`,
    },
  });
});

/**
 * GET /api/flats/directory/summary
 * Occupancy KPIs plus the building structure (blocks × floors × units) that
 * drives the block/floor visuals across the portals.
 */
export const getDirectorySummary = asyncHandler(async (_req, res) => {
  const flats = await db.Flat.find({});
  const blocks = [...new Set(flats.map((f) => f.block || f.wing))].sort();

  const byBlock = blocks.map((block) => {
    const set = flats.filter((f) => (f.block || f.wing) === block);
    const floors = FLOORS.map((floor) => {
      const floorSet = set
        .filter((f) => Number(f.floor) === floor)
        .sort((a, b) => Number(a.unit) - Number(b.unit));
      // flatDetails powers the visual building directory (occupancy tones per flat)
      const flatDetails = Object.fromEntries(
        floorSet.map((f) => [
          f.flatId,
          {
            flatId: f.flatId,
            isOccupied: f.isOccupied,
            residentType: f.residentType,
            ownerName: f.isOccupied ? f.ownerName : 'Unassigned',
            allocatedParking: f.allocatedParking || '',
          },
        ])
      );
      return {
        floor,
        label: `Floor ${floor}`,
        flatIds: floorSet.map((f) => f.flatId),
        occupiedIds: floorSet.filter((f) => f.isOccupied).map((f) => f.flatId),
        flatDetails,
        total: floorSet.length,
        occupied: floorSet.filter((f) => f.isOccupied).length,
        vacant: floorSet.filter((f) => !f.isOccupied).length,
      };
    });
    return {
      block,
      total: set.length,
      occupied: set.filter((f) => f.isOccupied).length,
      vacant: set.filter((f) => !f.isOccupied).length,
      allocatedParking: set.filter((f) => f.allocatedParking).length,
      floors,
    };
  });

  res.json({
    success: true,
    summary: {
      structure: {
        blocks: BLOCKS,
        floors: FLOORS,
        unitsPerFloor: UNITS_PER_FLOOR.length,
        label: `${BLOCKS.length} blocks × ${FLOORS.length} floors × ${UNITS_PER_FLOOR.length} flats`,
      },
      totalFlats: flats.length,
      occupied: flats.filter((f) => f.isOccupied).length,
      vacant: flats.filter((f) => !f.isOccupied).length,
      allocatedParking: flats.filter((f) => f.allocatedParking).length,
      occupants: flats.filter((f) => f.residentType === 'Owner').length,
      tenants: flats.filter((f) => f.residentType === 'Tenant').length,
      byBlock,
      byWing: byBlock, // legacy alias used by older chart code
    },
  });
});

/** GET /api/flats/:flatId */
export const getFlat = asyncHandler(async (req, res) => {
  const flat = await db.Flat.findOne({ flatId: String(req.params.flatId).toUpperCase() });
  if (!flat) {
    res.status(404);
    throw new Error(`Flat ${req.params.flatId} not found (valid range A-101 … C-504)`);
  }
  if (req.user.role === 'RESIDENT' && flat.flatId !== req.user.flatId) {
    res.status(403);
    throw new Error('You can only view details for your own flat');
  }
  const [bills, visitors] = await Promise.all([
    db.Bill.find({ flatId: flat.flatId }),
    db.Visitor.find({ flatId: flat.flatId }),
  ]);

  res.json({
    success: true,
    flat: projectFlat(flat, req.user),
    stats: {
      bills: bills.length,
      pendingDues: bills.filter((b) => b.status !== 'PAID').reduce((sum, b) => sum + Number(b.amount || 0), 0),
      visitors: visitors.length,
      openComplaints: (await db.Complaint.find({ flatId: flat.flatId })).filter((c) => c.status !== 'RESOLVED').length,
    },
  });
});

/** PATCH /api/flats/:flatId — admin updates occupancy / owner / parking */
export const updateFlat = asyncHandler(async (req, res) => {
  const flat = await db.Flat.findOne({ flatId: String(req.params.flatId).toUpperCase() });
  if (!flat) {
    res.status(404);
    throw new Error(`Flat ${req.params.flatId} not found`);
  }

  const patch = {};
  ['isOccupied', 'ownerName', 'residentType', 'allocatedParking', 'maintenanceRate'].forEach((key) => {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  });

  // Owner contact must be a valid 10-digit mobile when provided — an empty
  // value clears the stored number (e.g. when the flat is marked vacant).
  if (req.body.ownerContact !== undefined) {
    const rawContact = String(req.body.ownerContact).trim();
    if (rawContact === '' || rawContact === '—') {
      patch.ownerContact = '';
    } else {
      const mobile = validateMobileField(req.body.ownerContact, { field: 'Owner contact number' });
      if (!mobile.ok) {
        res.status(400);
        throw new Error(mobile.message);
      }
      patch.ownerContact = mobile.value;
    }
  }

  if (patch.maintenanceRate !== undefined) patch.maintenanceRate = Number(patch.maintenanceRate);
  if (patch.allocatedParking !== undefined) patch.allocatedParking = String(patch.allocatedParking).toUpperCase();

  const updated = await db.Flat.findByIdAndUpdate(flat._id, { $set: patch }, { new: true });
  res.json({
    success: true,
    message: `Flat ${updated.flatId} (Block ${updated.block || updated.wing} • Floor ${updated.floor}) updated`,
    flat: projectFlat(updated, req.user),
  });
});

/**
 * POST /api/flats — admin onboards a flat.
 * Accepts either a full flatId ("B-305") or block + floor + unit.
 */
export const createFlat = asyncHandler(async (req, res) => {
  const { block, floor, unit, flatId: rawFlatId } = req.body;

  let parsed = rawFlatId ? parseFlatId(rawFlatId) : null;
  if (!parsed) {
    if (block && floor && unit) {
      parsed = { block: String(block).toUpperCase(), floor: Number(floor), unit: Number(unit) };
    } else {
      res.status(400);
      throw new Error('Provide block + floor + unit (e.g. Block B, Floor 3, Unit 5) or a flat id like B-305');
    }
  }

  const { block: b, floor: f, unit: u } = parsed;
  if (!BLOCKS.includes(b)) {
    res.status(400);
    throw new Error(`Block must be one of ${BLOCKS.join(', ')}`);
  }
  if (!FLOORS.includes(Number(f))) {
    res.status(400);
    throw new Error(`Floor must be between ${FLOORS[0]} and ${FLOORS[FLOORS.length - 1]}`);
  }
  if (!UNITS_PER_FLOOR.includes(Number(u))) {
    res.status(400);
    throw new Error(`Unit must be between ${UNITS_PER_FLOOR[0]} and ${UNITS_PER_FLOOR[UNITS_PER_FLOOR.length - 1]} (4 flats per floor)`);
  }

  const flatId = flatIdFor(b, Number(f), Number(u));
  const exists = await db.Flat.findOne({ flatId });
  if (exists) {
    res.status(409);
    throw new Error(`Flat ${flatId} already exists in the directory`);
  }

  let ownerContact = '';
  if (req.body.ownerContact) {
    const mobile = validateMobileField(req.body.ownerContact, { field: 'Owner contact number' });
    if (!mobile.ok) {
      res.status(400);
      throw new Error(mobile.message);
    }
    ownerContact = mobile.value;
  }

  const flat = await db.Flat.create({
    flatId,
    block: b,
    wing: b,
    flatNumber: flatNumberFor(Number(f), Number(u)),
    floor: Number(f),
    unit: Number(u),
    area: Number(req.body.area || 1180 + (Number(f) - 1) * 60),
    maintenanceRate: Number(req.body.maintenanceRate || 2500),
    isOccupied: Boolean(req.body.isOccupied),
    ownerName: req.body.ownerName || 'Unassigned',
    ownerContact,
    residentType: req.body.residentType || 'Vacant',
    allocatedParking: req.body.allocatedParking ? String(req.body.allocatedParking).toUpperCase() : '',
  });

  res.status(201).json({
    success: true,
    message: `Flat ${flat.flatId} added to Block ${flat.block} • Floor ${flat.floor}`,
    flat: projectFlat(flat, req.user),
  });
});
