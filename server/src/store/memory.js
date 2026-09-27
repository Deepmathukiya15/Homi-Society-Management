import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Durable snapshot for the in-memory store.
 * Without this, restarting the process would wipe every user — which silently
 * invalidates all previously issued JWTs and surfaces as
 * "Not authorized — no token provided" in the UI. Persisting the store keeps
 * demo sessions (and all seeded data) alive across restarts.
 */
const DATA_DIR = path.resolve(__dirname, '../../.data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'homi-memory.json');
const PERSIST_ENABLED = String(process.env.HOMI_PERSIST ?? 'true') !== 'false';

let saveTimer = null;
let hydrating = false;

function schedulePersist() {
  if (!PERSIST_ENABLED || hydrating) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistNow(), 250);
}

export function persistNow() {
  if (!PERSIST_ENABLED) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = { savedAt: new Date().toISOString(), collections: {} };
    Object.entries(memoryModels).forEach(([name, model]) => {
      payload.collections[name] = [...model.docs.values()];
    });
    const tmp = `${SNAPSHOT_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, SNAPSHOT_FILE);
  } catch (err) {
    console.warn('[STORE] Snapshot write failed:', err.message);
  }
}

/** Restores a previous snapshot (returns how many documents were recovered). */
export function hydrateMemoryStore() {
  if (!PERSIST_ENABLED || !fs.existsSync(SNAPSHOT_FILE)) return { restored: false, documents: 0 };
  try {
    const payload = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    let documents = 0;
    hydrating = true;
    Object.entries(payload.collections || {}).forEach(([name, docs]) => {
      const model = memoryModels[name];
      if (!model || !Array.isArray(docs)) return;
      model.docs.clear();
      docs.forEach((doc) => {
        model.docs.set(String(doc._id), { ...doc });
        documents += 1;
      });
    });
    hydrating = false;
    return { restored: true, documents, savedAt: payload.savedAt };
  } catch (err) {
    hydrating = false;
    console.warn('[STORE] Snapshot restore failed:', err.message);
    return { restored: false, documents: 0 };
  }
}

export function clearSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) fs.unlinkSync(SNAPSHOT_FILE);
  } catch {
    /* best effort */
  }
}

/**
 * Tiny Mongo-compatible in-memory database.
 * Implements the subset of the Mongoose model API that HOMI controllers rely
 * on, so the exact same controller code runs with or without MongoDB.
 */

const newId = () => crypto.randomBytes(12).toString('hex');

const readPath = (doc, path) =>
  path.split('.').reduce((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), doc);

function valueMatches(value, cond) {
  if (cond === null || cond === undefined) return value === null || value === undefined;
  if (cond instanceof Date) return new Date(value).getTime() === cond.getTime();
  if (cond instanceof RegExp) return cond.test(String(value ?? ''));

  if (typeof cond === 'object' && !Array.isArray(cond)) {
    if ('$in' in cond) return cond.$in.some((v) => String(v) === String(value));
    if ('$nin' in cond) return !cond.$nin.some((v) => String(v) === String(value));
    if ('$ne' in cond) return !valueMatches(value, cond.$ne);
    if ('$exists' in cond) return cond.$exists ? value !== undefined : value === undefined;
    if ('$regex' in cond) return new RegExp(cond.$regex, cond.$options || 'i').test(String(value ?? ''));
    if ('$gt' in cond) return Number(value) > Number(cond.$gt);
    if ('$gte' in cond) return Number(value) >= Number(cond.$gte);
    if ('$lt' in cond) return Number(value) < Number(cond.$lt);
    if ('$lte' in cond) return Number(value) <= Number(cond.$lte);
    return JSON.stringify(value) === JSON.stringify(cond);
  }
  if (typeof cond === 'string' && typeof value === 'string') return value === cond;
  return String(value) === String(cond);
}

function docMatches(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;
  if (query.$or) {
    const ok = query.$or.some((part) => docMatches(doc, part));
    if (!ok) return false;
  }
  if (query.$and) {
    const ok = query.$and.every((part) => docMatches(doc, part));
    if (!ok) return false;
  }
  return Object.entries(query)
    .filter(([key]) => !key.startsWith('$'))
    .every(([key, cond]) => valueMatches(readPath(doc, key), cond));
}

function setPath(doc, path, value) {
  if (!path.includes('.')) {
    doc[path] = value;
    return;
  }
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, k) => (acc[k] = acc[k] || {}), doc);
  target[last] = value;
}

function applyUpdate(doc, update) {
  const root = update.$set || update;
  Object.entries(root)
    .filter(([key]) => !key.startsWith('$'))
    .forEach(([key, value]) => setPath(doc, key, value));
  return doc;
}

export class MemoryModel {
  constructor(name) {
    this.name = name;
    this.docs = new Map();
  }

  _materialize(data) {
    const now = new Date();
    const doc = {
      _id: newId(),
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    if (doc.checkOutTime === undefined) doc.checkOutTime = null;
    this.docs.set(doc._id, doc);
    return doc;
  }

  async create(data) {
    const doc = this._materialize({ ...data });
    schedulePersist();
    return doc;
  }

  async insertMany(items = []) {
    const docs = items.map((item) => this._materialize({ ...item }));
    schedulePersist();
    return docs;
  }

  async find(query = {}) {
    return [...this.docs.values()].filter((doc) => docMatches(doc, query)).map((doc) => ({ ...doc }));
  }

  async findOne(query = {}) {
    const found = [...this.docs.values()].find((doc) => docMatches(doc, query));
    return found ? { ...found } : null;
  }

  async findById(id) {
    if (!id) return null;
    const found = this.docs.get(String(id));
    return found ? { ...found } : null;
  }

  async findByIdAndUpdate(id, update = {}, options = {}) {
    const found = this.docs.get(String(id));
    if (!found) return null;
    const before = { ...found };
    applyUpdate(found, update);
    found.updatedAt = new Date();
    schedulePersist();
    return options.new === false ? before : { ...found };
  }

  async findOneAndUpdate(query = {}, update = {}, options = {}) {
    const found = [...this.docs.values()].find((doc) => docMatches(doc, query));
    if (!found) return null;
    const before = { ...found };
    applyUpdate(found, update);
    found.updatedAt = new Date();
    schedulePersist();
    return options.new === false ? before : { ...found };
  }

  async updateOne(query = {}, update = {}) {
    const found = [...this.docs.values()].find((doc) => docMatches(doc, query));
    if (!found) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(found, update);
    found.updatedAt = new Date();
    schedulePersist();
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(query = {}, update = {}) {
    const matched = [...this.docs.values()].filter((doc) => docMatches(doc, query));
    matched.forEach((doc) => {
      applyUpdate(doc, update);
      doc.updatedAt = new Date();
    });
    if (matched.length) schedulePersist();
    return { matchedCount: matched.length, modifiedCount: matched.length };
  }

  async deleteOne(query = {}) {
    const found = [...this.docs.values()].find((doc) => docMatches(doc, query));
    if (!found) return { deletedCount: 0 };
    this.docs.delete(found._id);
    schedulePersist();
    return { deletedCount: 1 };
  }

  async deleteMany(query = {}) {
    const matched = [...this.docs.values()].filter((doc) => docMatches(doc, query));
    matched.forEach((doc) => this.docs.delete(doc._id));
    if (matched.length) schedulePersist();
    return { deletedCount: matched.length };
  }

  async findByIdAndDelete(id) {
    const found = this.docs.get(String(id));
    if (!found) return null;
    this.docs.delete(String(id));
    schedulePersist();
    return { ...found };
  }

  async countDocuments(query = {}) {
    return [...this.docs.values()].filter((doc) => docMatches(doc, query)).length;
  }

  async distinct(field) {
    return [...new Set([...this.docs.values()].map((doc) => readPath(doc, field)))];
  }
}

export const flushStore = () => {
  if (saveTimer) clearTimeout(saveTimer);
  persistNow();
};

export const memoryModels = {
  User: new MemoryModel('User'),
  Flat: new MemoryModel('Flat'),
  Visitor: new MemoryModel('Visitor'),
  Bill: new MemoryModel('Bill'),
  Notice: new MemoryModel('Notice'),
  Complaint: new MemoryModel('Complaint'),
  GatePass: new MemoryModel('GatePass'),
  Meeting: new MemoryModel('Meeting'),
  SalaryPayment: new MemoryModel('SalaryPayment'),
  SocietySetting: new MemoryModel('SocietySetting'),
};

export const resetMemoryStore = () => {
  Object.values(memoryModels).forEach((model) => model.docs.clear());
  schedulePersist();
};
