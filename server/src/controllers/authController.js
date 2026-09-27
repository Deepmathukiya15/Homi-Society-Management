import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, findUserForLogin, toSafeUser } from '../store/index.js';
import { signToken } from '../utils/tokens.js';
import { asyncHandler, parseFlatId } from '../utils/helpers.js';
import { formatMobile, validateMobileField } from '../utils/validators.js';
import { env } from '../config/env.js';
import { emitToAdmins } from '../realtime/socket.js';

export const DEMO_ACCOUNTS = {
  RESIDENT: { email: 'resident@homi.com', password: 'resident123', label: 'Resident (Flat A-101)' },
  ADMIN: { email: 'admin@homi.com', password: 'admin123', label: 'Admin / Secretary' },
  GUARD: { email: 'guard@homi.com', password: 'guard123', label: 'Gate Security Guard' },
  CLEANER: { email: 'cleaner@homi.com', password: 'cleaner123', label: 'Cleaning Staff' },
};

const withDisplayMobile = (user) => ({
  ...user,
  contactNumber: user?.contactNumber || '',
  canPromoteAdmins: String(user?.email || '').toLowerCase() === env.SUPER_ADMIN_EMAIL,
});

const authPayload = (user, message) => ({
  success: true,
  message,
  token: signToken(user),
  user: withDisplayMobile(toSafeUser(user)),
});

/** POST /api/auth/register */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role: requestedRole = 'RESIDENT', contactNumber, flatId, securityCode, staffId, familyMembers } = req.body;
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(requestedRole || 'RESIDENT').toUpperCase();
  const role = normalizedRole;

  if (!cleanName || !cleanEmail || !password) {
    res.status(400);
    throw new Error('Name, email and password are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400);
    throw new Error('Enter a valid email address');
  }
  if (String(password).length < 6 || String(password).length > 128) {
    res.status(400);
    throw new Error('Password must be between 6 and 128 characters');
  }
  // Admin accounts are never self-registered. Existing admins may promote an approved committee member.
  if (!['RESIDENT', 'GUARD', 'CLEANER'].includes(normalizedRole)) {
    res.status(400);
    throw new Error('Choose Resident, Guard, or Other (Cleaning Staff). Admin access is assigned by an existing admin.');
  }

  let residentFamilyMembers = [];
  if (role === 'RESIDENT') {
    if (!Array.isArray(familyMembers) || familyMembers.length < 1 || familyMembers.length > 6) {
      res.status(400);
      throw new Error('Enter between 1 and 6 household member names');
    }
    residentFamilyMembers = familyMembers.map((member) => String(member || '').trim());
    if (residentFamilyMembers.some((member) => !member)) {
      res.status(400);
      throw new Error('Enter a name for every household member');
    }
    if (residentFamilyMembers[0].toLowerCase() !== cleanName.toLowerCase()) {
      res.status(400);
      throw new Error('The first household member must be the registering resident');
    }
  }

  const existing = await db.User.findOne({ email: cleanEmail });
  if (existing) {
    res.status(409);
    throw new Error('An account with this email already exists');
  }

  // Guard registrations require the society's guard passcode; admin registration is disabled.
  if (role === 'GUARD' && securityCode !== env.GUARD_MASTER_CODE) {
    res.status(403);
    throw new Error('Invalid Guard Staff Pass Code');
  }
  if (role === 'RESIDENT' && !flatId) {
    res.status(400);
    throw new Error('Resident registration requires a Flat ID (e.g. A-101)');
  }

  // 10-digit Indian mobile validation (server-side — never trust the client)
  const mobile = validateMobileField(contactNumber, { required: true });
  if (!mobile.ok) {
    res.status(400);
    throw new Error(mobile.message);
  }

  if (role === 'RESIDENT') {
    const parsed = parseFlatId(flatId);
    if (!parsed) {
      res.status(400);
      throw new Error('Flat ID must follow the society numbering A-101 … C-504 (Block-Floor-Unit)');
    }
    const flat = await db.Flat.findOne({ flatId: String(flatId).toUpperCase() });
    if (!flat) {
      res.status(404);
      throw new Error(`Flat ${flatId} was not found in the society directory`);
    }

    // One account per home: a flat that is already registered is never re-issued.
    // Rejected registrations release the flat, so they do not count as claimed.
    const claimed = (await db.User.find({ flatId: String(flatId).toUpperCase() })).find(
      (u) => (u.approvalStatus || 'APPROVED') !== 'REJECTED'
    );
    if (claimed) {
      res.status(409);
      throw new Error(`Flat ${String(flatId).toUpperCase()} is already registered to another resident — please choose an unclaimed flat`);
    }
  }

  // bcrypt one-way hash, 10 salt rounds — plain passwords are never stored
  const hashed = await bcrypt.hash(String(password), 10);
  const user = await db.User.create({
    name: cleanName,
    email: cleanEmail,
    password: hashed,
    role,
    familyMembers: residentFamilyMembers,
    contactNumber: mobile.value,
    flatId: role === 'RESIDENT' ? String(flatId).toUpperCase() : undefined,
    staffId: role === 'GUARD'
      ? String(staffId || securityCode || '').trim()
      : role === 'CLEANER'
        ? String(staffId || `CLN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).trim()
        : undefined,
    securityCode: role === 'GUARD' ? securityCode : undefined,
    monthlySalary: role === 'CLEANER' ? 0 : undefined,
    isActive: true,
    // Every self-registered non-admin account awaits the existing admin's approval.
    approvalStatus: 'PENDING',
  });

  if (user.approvalStatus === 'PENDING') {
    // Live badge in the admin command center
    emitToAdmins('registration:pending', {
      user: toSafeUser(user),
      message: `${user.name} (${user.role}${user.flatId ? ` • ${user.flatId}` : ''}) is waiting for admin approval`,
    });

    return res.status(201).json({
      success: true,
      pendingApproval: true,
      message:
        'Registration submitted! Your account is waiting for society admin approval — you can sign in once the admin approves it.',
      user: toSafeUser(user),
    });
  }

  return res.status(201).json(authPayload(user, `Registration successful — welcome to HOMI, ${user.name}!`));
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await findUserForLogin(String(email).toLowerCase().trim());
  if (!user) {
    res.status(401);
    throw new Error('Authentication failed. Please check details.');
  }
  const stored = user.password;
  const ok = await bcrypt.compare(String(password), stored);
  if (!ok) {
    res.status(401);
    throw new Error('Authentication failed. Please check details.');
  }

  // Admin approval gate — self-registered residents, guards and cleaners cannot sign in yet.
  const approval = user.approvalStatus || 'APPROVED';
  if (approval === 'PENDING') {
    res.status(403);
    throw new Error(
      'Your registration is awaiting society admin approval. Please sign in once the admin approves your account.'
    );
  }
  if (approval === 'REJECTED') {
    res.status(403);
    throw new Error('Your registration was rejected by the society admin. Please contact the society office.');
  }

  await db.User.findByIdAndUpdate(user._id, { $set: { lastLoginAt: new Date() } });
  res.json(authPayload(user, `Signed in as ${user.role}`));
});

/** POST /api/auth/demo-login  → 1-click evaluation logins for the login screen */
export const demoLogin = asyncHandler(async (req, res) => {
  if (!env.DEMO_LOGIN_ENABLED) {
    res.status(404);
    throw new Error('Demo logins are disabled in this environment');
  }
  const role = String(req.body.role || 'RESIDENT').toUpperCase();
  const account = DEMO_ACCOUNTS[role];
  if (!account) {
    res.status(400);
    throw new Error('Unknown demo role');
  }
  const user = await db.User.findOne({ email: account.email });
  if (!user) {
    res.status(404);
    throw new Error('Demo account missing — run `npm run seed` first');
  }
  res.json(authPayload(user, `1-Click Demo Login → ${role} portal`));
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req, res) => {
  const flat = req.user.flatId ? await db.Flat.findOne({ flatId: req.user.flatId }) : null;
  res.json({
    success: true,
    user: withDisplayMobile(req.user),
    flat: flat ? { ...flat, ownerContactDisplay: formatMobile(flat.ownerContact) } : null,
  });
});

/** GET /api/auth/demo-accounts — shown as hints on the login screen */
export const demoAccounts = (_req, res) => {
  if (!env.DEMO_LOGIN_ENABLED) {
    return res.status(404).json({ success: false, message: 'Demo accounts are disabled in this environment' });
  }
  res.json({
    success: true,
    accounts: Object.entries(DEMO_ACCOUNTS).map(([role, acc]) => ({ role, ...acc })),
  });
};
