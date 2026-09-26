import bcrypt from 'bcryptjs';
import { db, toSafeUser } from '../store/index.js';
import { signToken } from '../utils/tokens.js';
import { asyncHandler, parseFlatId } from '../utils/helpers.js';
import { formatMobile, validateMobileField } from '../utils/validators.js';
import { env } from '../config/env.js';
import { emitToAdmins } from '../realtime/socket.js';

export const DEMO_ACCOUNTS = {
  RESIDENT: { email: 'resident@homi.com', password: 'resident123', label: 'Resident (Flat A-101)' },
  ADMIN: { email: 'admin@homi.com', password: 'admin123', label: 'Admin / Secretary' },
  GUARD: { email: 'guard@homi.com', password: 'guard123', label: 'Gate Security Guard' },
};

const withDisplayMobile = (user) => ({ ...user, contactNumber: user?.contactNumber || '' });

const authPayload = (user, message) => ({
  success: true,
  message,
  token: signToken(user),
  user: withDisplayMobile(toSafeUser(user)),
});

/** POST /api/auth/register */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'RESIDENT', contactNumber, flatId, securityCode, staffId } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are required');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }
  if (!['RESIDENT', 'ADMIN', 'GUARD'].includes(role)) {
    res.status(400);
    throw new Error('Invalid role selected');
  }

  const existing = await db.User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    res.status(409);
    throw new Error('An account with this email already exists');
  }

  // Master passkeys protect privileged self-registration (RBAC hardening)
  if (role === 'ADMIN' && securityCode !== env.ADMIN_MASTER_CODE) {
    res.status(403);
    throw new Error('Invalid Admin Master Security Code');
  }
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
    name: name.trim(),
    email: String(email).toLowerCase().trim(),
    password: hashed,
    role,
    contactNumber: mobile.value,
    flatId: role === 'RESIDENT' ? String(flatId).toUpperCase() : undefined,
    staffId: role !== 'RESIDENT' ? staffId || securityCode : undefined,
    securityCode: role !== 'RESIDENT' ? securityCode : undefined,
    isActive: true,
    // Residents and guards must be approved by the society admin before signing in.
    approvalStatus: role === 'RESIDENT' || role === 'GUARD' ? 'PENDING' : 'APPROVED',
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

  const user = await db.User.findOne({ email: String(email).toLowerCase().trim() });
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

  // Admin approval gate — self-registered residents/guards cannot sign in yet.
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
  res.json({
    success: true,
    accounts: Object.entries(DEMO_ACCOUNTS).map(([role, acc]) => ({ role, ...acc })),
    masterCodes: { ADMIN: env.ADMIN_MASTER_CODE, GUARD: env.GUARD_MASTER_CODE },
  });
};
