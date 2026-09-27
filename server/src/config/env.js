import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const DEFAULT_JWT_SECRET = 'homi_super_secret_change_me_in_production';

export const env = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: nodeEnv,
  DEMO_LOGIN_ENABLED: nodeEnv !== 'production' && String(process.env.DEMO_LOGIN_ENABLED ?? 'true') === 'true',
  MONGODB_URI: process.env.MONGODB_URI || '',
  AUTO_SEED: nodeEnv !== 'production' && String(process.env.AUTO_SEED ?? 'true') === 'true',
  JWT_SECRET: process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : DEFAULT_JWT_SECRET),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SUPER_ADMIN_EMAIL: String(process.env.SUPER_ADMIN_EMAIL || 'admin@homi.com').trim().toLowerCase(),
  GUARD_MASTER_CODE: process.env.GUARD_MASTER_CODE || (nodeEnv === 'production' ? '' : 'SEC-001'),
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

export const isProd = env.NODE_ENV === 'production';
