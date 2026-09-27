import { db } from '../store/index.js';
import { asyncHandler, BLOCKS, FLOORS, UNITS_PER_FLOOR, flatIdFor, flatNumberFor, parseFlatId } from '../utils/helpers.js';
import { formatMobile, validateMobileField } from '../utils/validators.js';
import { FLATS as DIRECTORY_FLATS } from '../seed/seedData.js';

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

/** Keep all 60 known homes visible even if an older database was seeded partially. */
const MAINTENANCE_SETTING_KEY = 'society-default-maintenance-rate';

let directoryEnsurePromise = null;
async function ensureSocietyDirectoryInternal() {
  const [flats, setting] = await Promise.all([
    db.Flat.find({}),
    db.SocietySetting.findOne({ key: MAINTENANCE_SETTING_KEY }),
  ]);
  const sharedRate = Number(setting?.value);
  const byId = new Map(flats.map((flat) => [String(flat.flatId).toUpperCase(), flat]));

  for (const template of DIRECTORY_FLATS) {
    const id = String(template.flatId).toUpperCase();
    if (byId.has(id)) continue;
    const { email: _email, ...base } = template;
    try {
      const created = await db.Flat.create({
        ...base,
        isOccupied: false,
        ownerName: 'Unassigned',
        ownerContact: '',
        residentType: 'Vacant',
        allocatedParking: '',
        maintenanceRate: Number.isFinite(sharedRate) && sharedRate > 0 ? sharedRate : Number(base.maintenanceRate || 2500),
      });
      byId.set(id, created);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const created = await db.Flat.findOne({ flatId: id });
      if (created) byId.set(id, created);
    }
  }

  // Repair older approved registrations whose flat card was never synchronized on approval.
  const residents = (await db.User.find({})).filter(
    (user) => ['RESIDENT', 'ADMIN'].includes(user.role) && (user.approvalStatus || 'APPROVED') === 'APPROVED' && user.flatId
  );
  const accountsByFlat = new Map();
  for (const user of residents) {
    const id = String(user.flatId).toUpperCase();
    if (!accountsByFlat.has(id)) accountsByFlat.set(id, []);
    accountsByFlat.get(id).push(user);
  }
  for (const [id, accounts] of accountsByFlat) {
    if (accounts.length !== 1) continue;
    const user = accounts[0];
    const flat = byId.get(id);
    if (!flat || (flat.isOccupied && flat.ownerName && flat.ownerName !== 'Unassigned' && flat.ownerName !== user.name)) continue;
    await db.Flat.findByIdAndUpdate(flat._id, { $set: {
      isOccupied: true,
      ownerName: user.name,
      ownerContact: user.contactNumber || '',
      residentType: flat.residentType === 'Tenant' ? 'Tenant' : 'Owner',
    } }, { new: true });
  }
}

function ensureSocietyDirectory() {
  if (!directoryEnsurePromise) {
    directoryEnsurePromise = ensureSocietyDirectoryInternal().finally(() => {
      directoryEnsurePromise = null;
    });
  }
  return directoryEnsurePromise;
}

/** GET /api/flats?block=A&floor=3&occupancy=OCCUPIED&search=patel */
export const getFlats = asyncHandler(async (req, res) => {
  const { block, wing, floor = 'ALL', occupancy = 'ALL', search = '' } = req.query;
  const blockFilter = String(block || wing || 'ALL').toUpperCase();

  await ensureSocietyDirectory();
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
  await ensureSocietyDirectory();
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

  const occupied = new Set(
    flats.filter((flat) => flat.isOccupied).map((flat) => String(flat.flatId).toUpperCase())
  );
  const claimedOrOccupied = new Set([...claimed, ...occupied]);
  const available = flats
    .map((f) => String(f.flatId).toUpperCase())
    .filter((flatId) => !claimedOrOccupied.has(flatId))
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
    claimed: claimedOrOccupied.size,
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
  await ensureSocietyDirectory();
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

/** Society-wide monthly maintenance setting; one admin change applies to every flat. */
export const getSocietyMaintenanceRate = asyncHandler(async (_req, res) => {
  const setting = await db.SocietySetting.findOne({ key: MAINTENANCE_SETTING_KEY });
  const flats = await db.Flat.find({});
  const rates = [...new Set(flats.map((flat) => Number(flat.maintenanceRate || 0)).filter((rate) => rate > 0))].sort((a, b) => a - b);
  res.json({
    success: true,
    maintenanceRate: setting ? Number(setting.value) : null,
    isSet: Boolean(setting),
    currentRates: rates,
    ratesVary: rates.length > 1,
  });
});

export const setSocietyMaintenanceRate = asyncHandler(async (req, res) => {
  const amount = Number(req.body.maintenanceRate);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    res.status(400);
    throw new Error('Society-wide monthly maintenance must be between ₹1 and ₹10,00,000');
  }
  const rate = Math.round(amount * 100) / 100;
  await ensureSocietyDirectory();
  const update = await db.Flat.updateMany({}, { $set: { maintenanceRate: rate } });
  const existing = await db.SocietySetting.findOne({ key: MAINTENANCE_SETTING_KEY });
  const setting = existing
    ? await db.SocietySetting.findByIdAndUpdate(existing._id, { $set: { value: rate, updatedBy: req.user.name } }, { new: true })
    : await db.SocietySetting.create({ key: MAINTENANCE_SETTING_KEY, value: rate, updatedBy: req.user.name });
  const updatedFlats = update.matchedCount ?? update.n ?? update.modifiedCount ?? 0;
  res.json({
    success: true,
    message: `Monthly maintenance set to ₹${rate.toLocaleString('en-IN')} for all ${updatedFlats} flats. New flats will use this rate automatically.`,
    maintenanceRate: Number(setting.value),
    updatedFlats,
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
  if (req.body.maintenanceRate !== undefined) {
    res.status(400);
    throw new Error('Maintenance is configured once for the whole society from the common maintenance setting');
  }
  const flat = await db.Flat.findOne({ flatId: String(req.params.flatId).toUpperCase() });
  if (!flat) {
    res.status(404);
    throw new Error(`Flat ${req.params.flatId} not found`);
  }

  const patch = {};
  ['isOccupied', 'ownerName', 'residentType', 'allocatedParking'].forEach((key) => {
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

  const maintenanceSetting = await db.SocietySetting.findOne({ key: MAINTENANCE_SETTING_KEY });
  const defaultMaintenanceRate = Number(maintenanceSetting?.value) || 2500;

  const flat = await db.Flat.create({
    flatId,
    block: b,
    wing: b,
    flatNumber: flatNumberFor(Number(f), Number(u)),
    floor: Number(f),
    unit: Number(u),
    area: Number(req.body.area || 1180 + (Number(f) - 1) * 60),
    maintenanceRate: defaultMaintenanceRate,
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
