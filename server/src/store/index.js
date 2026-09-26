import { dbState } from '../config/db.js';
import { mongooseModels } from '../models/index.js';
import { memoryModels } from './memory.js';

/**
 * `db.User.find({...})` transparently resolves to the Mongoose model when a
 * MongoDB connection is live, or to the in-memory Mongo-compatible model in
 * demo/offline mode. Every method returns a Promise, so controllers never
 * need to know which backend is active.
 */
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const registry = dbState.usingMemory ? memoryModels : mongooseModels;
      const model = registry[prop];
      if (!model) throw new Error(`Unknown model: ${String(prop)}`);
      return model;
    },
  }
);

export const stripPassword = (doc) => {
  if (!doc) return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete plain.password;
  delete plain.securityCode;
  delete plain.__v;
  return plain;
};

export const plain = (doc) => {
  if (!doc) return doc;
  return typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
};

export const toSafeUser = (doc) => {
  const user = stripPassword(doc);
  if (!user) return user;
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isCommitteeMember: Boolean(user.isCommitteeMember),
    familyMembers: Array.isArray(user.familyMembers) ? user.familyMembers : [],
    contactNumber: user.contactNumber,
    flatId: user.flatId,
    staffId: user.staffId,
    approvalStatus: user.approvalStatus || 'APPROVED',
    approvedBy: user.approvedBy,
    approvedAt: user.approvedAt,
    createdAt: user.createdAt,
  };
};
