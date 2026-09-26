import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

import { env, isProd } from './config/env.js';
import { connectDB, dbState } from './config/db.js';
import { initSocket } from './realtime/socket.js';
import { flushStore, hydrateMemoryStore } from './store/memory.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error.js';
import { runMonthlyBilling } from './services/billingService.js';
import { seedIfEmpty } from './seed/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

app.use(cors({ origin: env.CLIENT_URL === '*' ? '*' : [env.CLIENT_URL, /localhost:\d+$/, /\.e2b\.app$/], credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'online',
    app: 'HOMI — Integrated Home & Community Management Solutions',
    database: dbState.label,
    usingMemory: dbState.usingMemory,
    razorpay:
      env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
        ? 'live keys configured'
        : isProd
          ? 'online payments disabled (live keys missing)'
          : 'simulated gateway (development only)',
    socketRooms: ['flat_<FLAT_ID>', 'guard_feed', 'admin_feed'],
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRoutes);
app.use(notFound);

// ── Serve the production React build (single-port deployment) ─────────────
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`[STATIC] Serving client build from ${clientDist}`);
}

app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

// ── Automated monthly billing: midnight on the 1st of every month ────────
cron.schedule(
  '0 0 1 * *',
  async () => {
    try {
      const result = await runMonthlyBilling();
      console.log(
        `[CRON] Monthly maintenance batch for ${result.month} ${result.year}: ${result.generated} bills raised (₹${result.totalAmount})`
      );
    } catch (err) {
      console.error('[CRON] Bill generation failed:', err.message);
    }
  },
  { timezone: 'Asia/Kolkata' }
);

const assertProductionConfig = () => {
  if (!isProd) return;
  const unsafe = [];
  if (!env.MONGODB_URI) unsafe.push('MONGODB_URI');
  if (!env.JWT_SECRET || env.JWT_SECRET === 'homi_super_secret_change_me_in_production') unsafe.push('a unique JWT_SECRET');
  if (!env.ADMIN_MASTER_CODE || env.ADMIN_MASTER_CODE === 'ADM-001') unsafe.push('a unique ADMIN_MASTER_CODE');
  if (!env.GUARD_MASTER_CODE || env.GUARD_MASTER_CODE === 'SEC-001') unsafe.push('a unique GUARD_MASTER_CODE');
  if (unsafe.length) throw new Error(`Unsafe production configuration. Set ${unsafe.join(', ')} before starting.`);
};

const start = async () => {
  assertProductionConfig();
  await connectDB();

  // Restore the durable snapshot so in-flight JWT sessions survive a restart
  if (dbState.usingMemory) {
    const restored = hydrateMemoryStore();
    if (restored.restored) {
      console.log(`[STORE] Restored ${restored.documents} documents from snapshot (saved ${restored.savedAt})`);
    }
  }

  if (env.AUTO_SEED) {
    const summary = await seedIfEmpty();
    if (summary.seeded) console.log(`[SEED] Society data bootstrapped: ${summary.message}`);
  }

  server.listen(env.PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ██╗  ██╗ ██████╗ ███╗   ███╗██╗');
    console.log('  ██║  ██║██╔═══██╗████╗ ████║██║');
    console.log('  ███████║██║   ██║██╔████╔██║██║');
    console.log('  ██╔══██║██║   ██║██║╚██╔╝██║██║');
    console.log('  ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║');
    console.log('  ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝');
    console.log(`  HOMI Society OS running on http://localhost:${env.PORT}  [${env.NODE_ENV}]`);
    console.log(`  Database : ${dbState.label}`);
    if (dbState.usingMemory) console.log('  Snapshot : .data/homi-memory.json (sessions survive restarts)');
    console.log(`  Sockets  : flat_* | guard_feed | admin_feed`);
    console.log('');
  });
};

// Flush the in-memory snapshot before exiting so nothing is lost
['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((signal) => {
  process.on(signal, () => {
    flushStore();
    process.exit(0);
  });
});

start().catch((err) => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});

export { app, server };
