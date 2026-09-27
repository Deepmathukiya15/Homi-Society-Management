import { db, toSafeUser } from '../store/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { emitToRoom } from '../realtime/socket.js';
import { env } from '../config/env.js';

const APPROVAL_STATES = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * GET /api/users  (ADMIN)
 *   ?approvalStatus=PENDING|APPROVED|REJECTED|ALL   ?role=RESIDENT|ADMIN|GUARD
 * Feeds the admin "Approvals" module.
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { approvalStatus = 'ALL', role } = req.query;

  let users = await db.User.find({});
  if (approvalStatus && approvalStatus !== 'ALL') {
    users = users.filter((u) => (u.approvalStatus || 'APPROVED') === String(approvalStatus).toUpperCase());
  }
  if (role && role !== 'ALL') {
    users = users.filter((u) => u.role === String(role).toUpperCase());
  }

  const sorted = [...users].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const all = await db.User.find({});

  res.json({
    success: true,
    count: sorted.length,
    users: sorted.map(toSafeUser),
    counts: {
      pending: all.filter((u) => (u.approvalStatus || 'APPROVED') === 'PENDING').length,
      approved: all.filter((u) => (u.approvalStatus || 'APPROVED') === 'APPROVED').length,
      rejected: all.filter((u) => u.approvalStatus === 'REJECTED').length,
    },
  });
});

/**
 * PATCH /api/users/:id/approval  (ADMIN)  { status: 'APPROVED' | 'REJECTED' }
 * The gate that lets a newly registered resident / guard sign in.
 */
/** PATCH /api/auth/users/:id/committee (ADMIN) — assign/revoke committee access. */
export const setCommitteeMembership = asyncHandler(async (req, res) => {
  const user = await db.User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User account not found');
  }
  if (user.role !== 'RESIDENT' || (user.approvalStatus || 'APPROVED') !== 'APPROVED') {
    res.status(400);
    throw new Error('Only approved resident accounts can be committee members');
  }
  if (typeof req.body.isCommitteeMember !== 'boolean') {
    res.status(400);
    throw new Error('isCommitteeMember must be true or false');
  }

  const updated = await db.User.findByIdAndUpdate(
    user._id,
    { $set: { isCommitteeMember: req.body.isCommitteeMember } },
    { new: true }
  );
  res.json({
    success: true,
    message: `${updated.name} ${updated.isCommitteeMember ? 'added to' : 'removed from'} the society committee`,
    user: toSafeUser(updated),
  });
});

/** Promote an approved committee resident to ADMIN. Self-registration cannot grant admin access. */
export const promoteCommitteeMemberToAdmin = asyncHandler(async (req, res) => {
  if (String(req.user.email || '').toLowerCase() !== env.SUPER_ADMIN_EMAIL) {
    res.status(403);
    throw new Error('Only the designated society owner admin can grant Admin access');
  }
  const user = await db.User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User account not found');
  }
  if (user.role !== 'RESIDENT' || (user.approvalStatus || 'APPROVED') !== 'APPROVED') {
    res.status(400);
    throw new Error('Only an approved resident can be promoted');
  }
  if (!user.isCommitteeMember) {
    res.status(400);
    throw new Error('Add this approved resident to the committee before promoting them to admin');
  }

  const updated = await db.User.findByIdAndUpdate(
    user._id,
    { $set: { role: 'ADMIN', isCommitteeMember: true } },
    { new: true }
  );
  res.json({
    success: true,
    message: `${updated.name} is now an admin (committee membership retained)`,
    user: toSafeUser(updated),
  });
});

export const setApproval = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!APPROVAL_STATES.includes(status)) {
    res.status(400);
    throw new Error('Approval status must be APPROVED, REJECTED or PENDING');
  }

  const user = await db.User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User account not found');
  }
  if (user.role === 'ADMIN' && status !== 'APPROVED') {
    res.status(400);
    throw new Error('The admin account cannot be rejected');
  }

  const residentFlat = user.role === 'RESIDENT' && user.flatId
    ? await db.Flat.findOne({ flatId: String(user.flatId).toUpperCase() })
    : null;

  if (user.role === 'RESIDENT' && status !== 'REJECTED') {
    if (status === 'APPROVED' && !residentFlat) {
      res.status(409);
      throw new Error(`Cannot approve ${user.name}: flat ${user.flatId || '—'} is missing from the flat directory`);
    }
    const otherClaims = (await db.User.find({ flatId: String(user.flatId || '').toUpperCase() })).filter(
      (candidate) => String(candidate._id) !== String(user._id) && (candidate.approvalStatus || 'APPROVED') !== 'REJECTED'
    );
    if (otherClaims.length) {
      res.status(409);
      throw new Error(`Flat ${user.flatId} is already reserved by another resident account`);
    }
    if (status === 'APPROVED' && residentFlat?.isOccupied && residentFlat.ownerName && residentFlat.ownerName !== user.name) {
      res.status(409);
      throw new Error(`Flat ${user.flatId} is already marked occupied by ${residentFlat.ownerName}`);
    }
  }

  const updated = await db.User.findByIdAndUpdate(
    user._id,
    { $set: { approvalStatus: status, approvedBy: req.user.name, approvedAt: new Date() } },
    { new: true }
  );

  if (user.role === 'RESIDENT' && residentFlat && status === 'APPROVED') {
    await db.Flat.findByIdAndUpdate(
      residentFlat._id,
      { $set: {
        isOccupied: true,
        ownerName: user.name,
        ownerContact: user.contactNumber || '',
        residentType: residentFlat.residentType === 'Tenant' ? 'Tenant' : 'Owner',
      } },
      { new: true }
    );
  } else if (user.role === 'RESIDENT' && residentFlat && status === 'REJECTED') {
    const remainingClaims = (await db.User.find({ flatId: String(user.flatId).toUpperCase() })).filter(
      (candidate) => String(candidate._id) !== String(user._id) && (candidate.approvalStatus || 'APPROVED') !== 'REJECTED'
    );
    if (!remainingClaims.length && (!residentFlat.isOccupied || residentFlat.ownerName === user.name)) {
      await db.Flat.findByIdAndUpdate(
        residentFlat._id,
        { $set: { isOccupied: false, ownerName: 'Unassigned', ownerContact: '', residentType: 'Vacant' } },
        { new: true }
      );
    }
  }

  // Let the admin feed and the user's own device hear about the decision.
  emitToRoom('admin_feed', 'user:approval', { user: toSafeUser(updated), status });
  if (updated.flatId) {
    emitToRoom(`flat_${updated.flatId}`, 'user:approval', { user: toSafeUser(updated), status });
  }

  const label = status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'set back to pending';
  res.json({
    success: true,
    message: `${updated.name} (${updated.role}${updated.flatId ? ` • ${updated.flatId}` : ''}) was ${label} by ${req.user.name}`,
    user: toSafeUser(updated),
    counts: {},
  });
});
