import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || '',
  AUTO_SEED: String(process.env.AUTO_SEED || 'true') === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'homi_super_secret_change_me_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_MASTER_CODE: process.env.ADMIN_MASTER_CODE || 'ADM-001',
  GUARD_MASTER_CODE: process.env.GUARD_MASTER_CODE || 'SEC-001',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

export const isProd = env.NODE_ENV === 'production';
