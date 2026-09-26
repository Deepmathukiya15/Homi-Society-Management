import { verifyToken } from '../utils/tokens.js';
import { db, toSafeUser } from '../store/index.js';

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.homi_token;
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized — no token provided' });

    const decoded = verifyToken(token);
    const user = await db.User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'Session user no longer exists' });

    if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message:
          user.approvalStatus === 'REJECTED'
            ? 'This registration was rejected by the society admin'
            : 'Your account is awaiting admin approval',
      });
    }

    req.user = toSafeUser(user);
    req.token = token;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired session token' });
  }
};

/** Role-Based Access Control middleware → authorize('ADMIN', 'GUARD') */
export const authorizeCommittee = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });
  if (req.user.role !== 'ADMIN' && !req.user.isCommitteeMember) {
    return res.status(403).json({ success: false, message: 'Committee membership is required for this action' });
  }
  next();
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied — ${req.user.role} role cannot perform this action`,
    });
  }
  next();
};

/** Residents may only read their own flat's data. */
export const scopeToFlat = (req, res, next) => {
  if (req.user?.role === 'RESIDENT') {
    req.scopeFlatId = req.user.flatId;
  } else {
    req.scopeFlatId = null;
  }
  next();
};
