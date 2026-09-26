import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Database connection state.
 * `usingMemory` drives the model resolver in src/store/index.js so the very
 * same controllers run against MongoDB (Mongoose) or the built-in
 * Mongo-compatible in-memory store used for offline demos / viva defenses.
 */
export const dbState = {
  usingMemory: true,
  label: 'In-Memory Store (Mongo-compatible)',
  host: 'memory://homi_society',
};

export async function connectDB() {
  if (!env.MONGODB_URI) {
    console.warn('[DB] MONGODB_URI not set → booting in-memory Mongo-compatible store');
    return dbState;
  }
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    dbState.usingMemory = false;
    dbState.label = `MongoDB ${mongoose.connection.host}`;
    dbState.host = mongoose.connection.host;
    console.log(`[DB] MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.warn(`[DB] MongoDB connection failed (${err.message})`);
    console.warn('[DB] Falling back to in-memory Mongo-compatible store');
  }
  return dbState;
}
