import { db } from '../store/index.js';
import { asyncHandler, displayCodeFor, randomPassCode } from '../utils/helpers.js';
import { formatMobile, validateMobileField, validateVehicleField } from '../utils/validators.js';
import { emitToAdmins, emitToFlat, emitToGuards } from '../realtime/socket.js';

const sortByNewest = (list) =>
  [...list].sort((a, b) => new Date(b.checkInTime || b.createdAt) - new Date(a.checkInTime || a.createdAt));

/** GET /api/visitors/logs — role scoped gate feed */
export const getVisitorLogs = asyncHandler(async (req, res) => {
  const { flatId, status, active } = req.query;
  let visitors = await db.Visitor.find({});

  if (req.user.role === 'RESIDENT') {
    visitors = visitors.filter((v) => v.flatId === req.user.flatId);
  } else if (flatId && flatId !== 'ALL') {
    visitors = visitors.filter((v) => v.flatId === String(flatId).toUpperCase());
  }
  if (status && status !== 'ALL') visitors = visitors.filter((v) => v.approvalStatus === status);
  if (active === 'true') visitors = visitors.filter((v) => !v.checkOutTime);

  res.json({
    success: true,
    count: visitors.length,
    activeVisitorsInside: visitors.filter((v) => !v.checkOutTime && ['APPROVED', 'PRE_APPROVED'].includes(v.approvalStatus)).length,
    pending: visitors.filter((v) => v.approvalStatus === 'PENDING').length,
    visitors: sortByNewest(visitors),
  });
});

/**
 * POST /api/visitors/check-in  (guard / admin)
 * Creates the visitor log then dispatches a live sanction request to the
 * resident's isolated flat room over Socket.io.
 */
export const checkInVisitor = asyncHandler(async (req, res) => {
  const { guestName, phone, flatId, vehicleNo, purpose, notes, passCode } = req.body;
  if (!guestName || !flatId) {
    res.status(400);
    throw new Error('Guest name and destination flat are required');
  }

  const flat = await db.Flat.findOne({ flatId: String(flatId).toUpperCase() });
  if (!flat) {
    res.status(404);
    throw new Error(`Destination flat ${flatId} does not exist in the society (valid: A-101 … C-504)`);
  }

  // Gate data hygiene: 10-digit mobile + GJ-11-EC-2929 plate format
  const mobile = validateMobileField(phone, { required: true, field: 'Guest mobile number' });
  if (!mobile.ok) {
    res.status(400);
    throw new Error(mobile.message);
  }
  const plate = validateVehicleField(vehicleNo, { field: 'Vehicle number' });
  if (!plate.ok) {
    res.status(400);
    throw new Error(plate.message);
  }

  // QR pre-approved pass → contactless entry, no resident tap needed
  let preApproved = null;
  if (passCode) {
    preApproved = await db.GatePass.findOne({ passCode: String(passCode), status: 'ACTIVE' });
  }

  const approved = Boolean(preApproved);
  const visitor = await db.Visitor.create({
    guestName: guestName.trim(),
    phone: mobile.value,
    flatId: flat.flatId,
    vehicleNo: plate.value,
    purpose: purpose || 'Guest',
    notes: notes || '',
    approvalStatus: approved ? 'PRE_APPROVED' : 'PENDING',
    checkInTime: new Date(),
    checkOutTime: null,
    loggedBy: req.user.name,
    passCode: preApproved?.passCode,
    createdBy: req.user.role === 'GUARD' ? 'GUARD' : 'ADMIN',
    approvedBy: approved ? 'Pre-approved QR Pass' : undefined,
  });

  const telemetry = {
    visitor,
    flat: { flatId: flat.flatId, ownerName: flat.ownerName, allocatedParking: flat.allocatedParking },
    at: new Date().toISOString(),
  };

  if (approved) {
    await db.GatePass.findByIdAndUpdate(preApproved._id, { $set: { status: 'USED', usedAt: new Date(), scannedBy: req.user.name } });
    emitToGuards('visitor_updated', { ...telemetry, message: `QR pass ${preApproved.displayCode} auto-approved for ${visitor.guestName}` });
    emitToAdmins('visitor_updated', telemetry);
    emitToFlat(flat.flatId, 'visitor_updated', telemetry);
  } else {
    // 1. target the isolated flat room  2. mirror to gate + admin dashboards
    emitToFlat(flat.flatId, 'new_visitor_request', telemetry);
    emitToGuards('visitor_request_logged', telemetry);
    emitToAdmins('visitor_request_logged', telemetry);
  }

  res.status(201).json({
    success: true,
    message: approved
      ? `QR pass verified — ${visitor.guestName} admitted to Flat ${flat.flatId}`
      : `Approval request dispatched to Flat ${flat.flatId} over Socket.io (${formatMobile(mobile.value)})`,
    visitor,
    autoApproved: approved,
  });
});

/** PATCH /api/visitors/:id/decision — resident taps Approve / Deny */
export const decideVisitor = asyncHandler(async (req, res) => {
  const { status, guardNote } = req.body;
  if (!['APPROVED', 'DENIED'].includes(status)) {
    res.status(400);
    throw new Error('Decision status must be APPROVED or DENIED');
  }
  const visitor = await db.Visitor.findById(req.params.id);
  if (!visitor) {
    res.status(404);
    throw new Error('Visitor log not found');
  }
  if (req.user.role === 'RESIDENT' && visitor.flatId !== req.user.flatId) {
    res.status(403);
    throw new Error('You can only action visitors for your own flat');
  }

  const updated = await db.Visitor.findByIdAndUpdate(
    visitor._id,
    { $set: { approvalStatus: status, approvedBy: req.user.name, guardNote: guardNote || '' } },
    { new: true }
  );

  const payload = { visitor: updated, decidedBy: req.user.name, at: new Date().toISOString() };
  emitToGuards('visitor_updated', payload);
  emitToAdmins('visitor_updated', payload);
  emitToFlat(updated.flatId, 'visitor_updated', payload);

  res.json({
    success: true,
    message:
      status === 'APPROVED'
        ? `Entry approved — ${updated.guestName} admitted to Flat ${updated.flatId}`
        : `Entry denied — security guard notified of denied entry.`,
    visitor: updated,
  });
});

/** PATCH /api/visitors/:id/check-out (guard) */
export const checkOutVisitor = asyncHandler(async (req, res) => {
  const visitor = await db.Visitor.findById(req.params.id);
  if (!visitor) {
    res.status(404);
    throw new Error('Visitor log not found');
  }
  if (visitor.checkOutTime) {
    res.status(400);
    throw new Error(`${visitor.guestName} has already been checked out`);
  }
  const updated = await db.Visitor.findByIdAndUpdate(
    visitor._id,
    { $set: { checkOutTime: new Date(), checkedOutBy: req.user.name } },
    { new: true }
  );
  const payload = { visitor: updated, at: new Date().toISOString() };
  emitToGuards('visitor_checked_out', payload);
  emitToAdmins('visitor_checked_out', payload);
  emitToFlat(updated.flatId, 'visitor_checked_out', payload);

  res.json({ success: true, message: `${updated.guestName} checked out — exit gate logged`, visitor: updated });
});

/**
 * POST /api/visitors/pre-approve  (resident)
 * Generates a signed QR gate pass the guard can scan for contactless entry.
 */
export const createGatePass = asyncHandler(async (req, res) => {
  const { guestName, phone, purpose, vehicleNo, validHours = 24 } = req.body;
  if (!guestName) {
    res.status(400);
    throw new Error('Guest name is required to generate a gate pass');
  }
  const flatId = req.user.role === 'RESIDENT' ? req.user.flatId : String(req.body.flatId || '').toUpperCase();
  if (!flatId) {
    res.status(400);
    throw new Error('A flat is required to issue a gate pass');
  }

  const mobile = validateMobileField(phone, { required: true, field: 'Guest mobile number' });
  if (!mobile.ok) {
    res.status(400);
    throw new Error(mobile.message);
  }
  const plate = validateVehicleField(vehicleNo, { field: 'Vehicle number' });
  if (!plate.ok) {
    res.status(400);
    throw new Error(plate.message);
  }

  const passCode = randomPassCode();
  const displayCode = displayCodeFor(flatId);
  const validUntil = new Date(Date.now() + Number(validHours) * 3600 * 1000);

  const pass = await db.GatePass.create({
    displayCode,
    passCode,
    flatId,
    residentName: req.user.name,
    guestName: guestName.trim(),
    phone: mobile.value,
    purpose: purpose || 'Guest',
    vehicleNo: plate.value,
    validFrom: new Date(),
    validUntil,
    status: 'ACTIVE',
  });

  // The QR payload is what the tablet camera decodes at the gate
  const qrPayload = JSON.stringify({
    t: 'HOMI_GATE_PASS',
    code: pass.passCode,
    fp: flatId,
    g: pass.guestName,
    v: validUntil.toISOString(),
  });

  emitToGuards('gate_pass_issued', { pass, at: new Date().toISOString() });
  emitToAdmins('gate_pass_issued', { pass, at: new Date().toISOString() });

  res.status(201).json({
    success: true,
    message: `QR pass issued for ${pass.guestName} — valid till ${validUntil.toLocaleString('en-IN')}`,
    pass,
    qrPayload,
  });
});

/** POST /api/visitors/validate-pass — guard scans / types the pass code */
export const validatePass = asyncHandler(async (req, res) => {
  const raw = String(req.body.code || '').trim();
  if (!raw) {
    res.status(400);
    throw new Error('No pass code received from scanner');
  }

  // Accept either the raw 10-digit console code or the JSON QR matrix payload
  let code = raw;
  let payloadGuest = null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      code = parsed.code;
      payloadGuest = parsed.g;
    } catch {
      res.status(400);
      throw new Error('QR matrix payload could not be decoded');
    }
  }

  const pass = await db.GatePass.findOne({ passCode: code });
  if (!pass) {
    res.status(404);
    throw new Error('Invalid or Expired QR Pass Code');
  }
  if (pass.status === 'USED') {
    res.status(409);
    throw new Error(`Pass ${pass.displayCode} has already been used at ${new Date(pass.usedAt).toLocaleString('en-IN')}`);
  }
  if (new Date(pass.validUntil).getTime() < Date.now()) {
    await db.GatePass.findByIdAndUpdate(pass._id, { $set: { status: 'EXPIRED' } });
    res.status(410);
    throw new Error('This gate pass has expired — ask the resident to issue a new one');
  }

  const visitor = await db.Visitor.create({
    guestName: pass.guestName || payloadGuest || 'QR Guest',
    phone: pass.phone || '',
    flatId: pass.flatId,
    vehicleNo: pass.vehicleNo || '',
    purpose: pass.purpose || 'Guest',
    notes: `Contactless QR entry via ${pass.displayCode}`,
    approvalStatus: 'PRE_APPROVED',
    checkInTime: new Date(),
    checkOutTime: null,
    passCode: pass.passCode,
    loggedBy: req.user.name,
    approvedBy: `${pass.residentName || 'Resident'} (pre-approved pass)`,
    createdBy: 'GUARD',
  });

  const updatedPass = await db.GatePass.findByIdAndUpdate(
    pass._id,
    { $set: { status: 'USED', usedAt: new Date(), scannedBy: req.user.name } },
    { new: true }
  );

  const telemetry = { visitor, pass: updatedPass, at: new Date().toISOString() };
  emitToFlat(pass.flatId, 'visitor_updated', telemetry);
  emitToGuards('visitor_updated', telemetry);
  emitToAdmins('visitor_updated', telemetry);

  res.json({
    success: true,
    message: 'QR Pass Verified — access granted at gate',
    pass: updatedPass,
    visitor,
  });
});

/** GET /api/visitors/passes — active passes for the signed-in resident */
export const getMyPasses = asyncHandler(async (req, res) => {
  const query = req.user.role === 'RESIDENT' ? { flatId: req.user.flatId } : {};
  const passes = await db.GatePass.find(query);
  res.json({
    success: true,
    passes: passes
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((p) => ({
        ...p,
        isExpired: p.status === 'EXPIRED' || new Date(p.validUntil).getTime() < Date.now(),
      })),
  });
});

/** POST /api/visitors/sos — resident panic broadcast */
export const raiseSOS = asyncHandler(async (req, res) => {
  const { category = 'Medical Emergency', note = '' } = req.body;
  const flatId = req.user.flatId || req.body.flatId || 'GATE';
  const alarm = {
    id: `SOS-${Date.now()}`,
    category,
    note,
    flatId,
    raisedBy: req.user.name,
    at: new Date().toISOString(),
  };
  emitToGuards('sos_broadcast', alarm);
  emitToAdmins('sos_broadcast', alarm);
  emitToFlat(flatId, 'sos_acknowledged', alarm);
  console.warn(`[SOS] ${category} raised from Flat ${flatId} by ${req.user.name}`);
  res.json({
    success: true,
    message: `Emergency SOS broadcast — Gate Security & Society Management have been alerted (${category}).`,
    alarm,
  });
});

/** GET /api/visitors/stats */
export const visitorStats = asyncHandler(async (_req, res) => {
  const visitors = await db.Visitor.find({});
  const todayKey = new Date().toDateString();
  const inside = visitors.filter((v) => !v.checkOutTime && ['APPROVED', 'PRE_APPROVED'].includes(v.approvalStatus));
  res.json({
    success: true,
    stats: {
      total: visitors.length,
      activeVisitorsInside: inside.length,
      pendingApprovals: visitors.filter((v) => v.approvalStatus === 'PENDING').length,
      todayTotal: visitors.filter((v) => new Date(v.checkInTime || v.createdAt).toDateString() === todayKey).length,
      denied: visitors.filter((v) => v.approvalStatus === 'DENIED').length,
      insideList: inside.map((v) => ({
        _id: String(v._id),
        guestName: v.guestName,
        flatId: v.flatId,
        purpose: v.purpose,
        checkInTime: v.checkInTime,
      })),
    },
  });
});
