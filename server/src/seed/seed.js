import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { db } from '../store/index.js';
import { clearSnapshot, flushStore, hydrateMemoryStore } from '../store/memory.js';
import { buildBillAmounts, dueDateFor, MONTHS } from '../utils/helpers.js';
import { formatMobile } from '../utils/validators.js';
import {
  COMPLAINTS,
  FLATS,
  GATE_PASSES,
  NOTICES,
  OVERDUE_MAP,
  SOCIETY,
  USERS,
  VISITORS,
} from './seedData.js';

const PAYMENT_MODES = ['UPI', 'CARD', 'NETBANKING'];
const txnId = (i) => `pay_${(918273645 + i * 137).toString(36).toUpperCase()}${String(1000 + i).slice(-4)}`;

/** Hash each distinct password once (bcrypt, 10 rounds) and reuse the digest —
 *  keeps the 50-account seed fast while every user still stores a real hash. */
async function buildHashCache(users) {
  const cache = new Map();
  await Promise.all(
    [...new Set(users.map((u) => u.password))].map(async (plain) => {
      cache.set(plain, await bcrypt.hash(plain, 10));
    })
  );
  return cache;
}

async function seedFlats() {
  const maintenanceSetting = await db.SocietySetting.findOne({ key: 'society-default-maintenance-rate' });
  for (const flat of FLATS) {
    const exists = await db.Flat.findOne({ flatId: flat.flatId });
    if (exists) continue;
    const { email, ...doc } = flat;
    await db.Flat.create({
      ...doc,
      ...(maintenanceSetting ? { maintenanceRate: Number(maintenanceSetting.value) } : {}),
    });
  }
}

async function seedUsers() {
  const hashCache = await buildHashCache(USERS);
  for (const user of USERS) {
    const exists = await db.User.findOne({ email: user.email });
    if (exists) continue;
    const { password, contactNumber, ...rest } = user;
    await db.User.create({
      ...rest,
      contactNumber,
      password: hashCache.get(password),
      isActive: true,
      // Seeded demo accounts are pre-approved — the approval gate is for self-registration.
      approvalStatus: 'APPROVED',
      approvedBy: 'Seed (Society Office)',
      approvedAt: new Date(),
    });
  }
}

async function seedSalaryRecords() {
  const cleaner = await db.User.findOne({ email: 'cleaner@homi.com' });
  if (!cleaner) return;
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const cleanerId = String(cleaner._id);
  const amount = Number(cleaner.monthlySalary || 24000);

  if (!(await db.SalaryPayment.findOne({ cleanerId, month: previousMonth }))) {
    await db.SalaryPayment.create({
      cleanerId,
      cleanerName: cleaner.name,
      cleanerStaffId: cleaner.staffId || 'CLN-001',
      month: previousMonth,
      amount,
      status: 'PAID',
      paymentMode: 'BANK_TRANSFER',
      reference: `DEMO-UTR-${previousMonth.replace('-', '')}`,
      paidAt: new Date(Date.UTC(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth(), 28)),
      createdBy: 'Seed Demo',
      paidRecordedBy: 'Seed Demo',
    });
  }
  if (!(await db.SalaryPayment.findOne({ cleanerId, month: currentMonth }))) {
    await db.SalaryPayment.create({
      cleanerId,
      cleanerName: cleaner.name,
      cleanerStaffId: cleaner.staffId || 'CLN-001',
      month: currentMonth,
      amount,
      status: 'PENDING',
      createdBy: 'Seed Demo',
    });
  }
}

/**
 * Seeds the FY 2026 maintenance ledger:
 *  - December 2025 carry-forward (a few flats) → OVERDUE
 *  - January → August 2026 → PAID with Razorpay-style txn references
 *  - The current month → PENDING (due on the 10th)
 */
async function seedBills() {
  const existing = await db.Bill.countDocuments({});
  if (existing > 0) return;

  const flats = (await db.Flat.find({})).filter((f) => f.isOccupied);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonthIndex = now.getUTCMonth();

  // Only the demo resident's flat carries the December 2025 carry-forward.
  for (const flat of flats.filter((f) => f.flatId === 'A-101')) {
    const amounts = buildBillAmounts(flat);
    await db.Bill.create({
      flatId: flat.flatId,
      residentName: flat.ownerName,
      month: 'December',
      year: currentYear - 1,
      billingPeriod: `December ${currentYear - 1}`,
      ...amounts,
      status: 'OVERDUE',
      dueDate: dueDateFor(currentYear - 1, 11),
      generatedBy: 'CRON',
    });
  }

  let counter = 0;
  for (let monthIndex = 0; monthIndex <= currentMonthIndex; monthIndex += 1) {
    for (const flat of flats) {
      const amounts = buildBillAmounts(flat);
      const month = MONTHS[monthIndex];
      const overdueMonths = OVERDUE_MAP[flat.flatId] || [];
      const isCurrentMonth = monthIndex === currentMonthIndex;
      let status = 'PAID';

      if (overdueMonths.includes(month) && monthIndex < currentMonthIndex) status = 'OVERDUE';
      else if (isCurrentMonth) status = overdueMonths.includes(month) ? 'OVERDUE' : 'PENDING';

      // The admin's own home (A-201) is fully paid — the demo defaulters stay A-101 only.
      if (flat.flatId === 'A-201') status = 'PAID';

      counter += 1;
      await db.Bill.create({
        flatId: flat.flatId,
        residentName: flat.ownerName,
        month,
        year: currentYear,
        billingPeriod: `${month} ${currentYear}`,
        ...amounts,
        status,
        dueDate: dueDateFor(currentYear, monthIndex),
        generatedBy: 'CRON',
        ...(status === 'PAID'
          ? {
              paymentTxnid: txnId(counter),
              paymentMode: PAYMENT_MODES[counter % PAYMENT_MODES.length],
              paidAt: new Date(Date.UTC(currentYear, monthIndex, 3 + (counter % 6))),
            }
          : {}),
      });
    }
  }
}

async function seedNotices() {
  for (const notice of NOTICES) {
    const exists = await db.Notice.findOne({ title: notice.title });
    if (exists) continue;
    await db.Notice.create(notice);
  }
}

async function seedComplaints() {
  for (const complaint of COMPLAINTS) {
    const exists = await db.Complaint.findOne({ ticketNo: complaint.ticketNo });
    if (exists) continue;
    await db.Complaint.create({
      ...complaint,
      resolvedAt: complaint.status === 'RESOLVED' ? new Date(Date.now() - 36 * 3600 * 1000) : null,
    });
  }
}

async function seedPasses() {
  for (const pass of GATE_PASSES) {
    const exists = await db.GatePass.findOne({ displayCode: pass.displayCode });
    if (exists) continue;
    await db.GatePass.create({
      displayCode: pass.displayCode,
      passCode: pass.passCode,
      flatId: pass.flatId,
      residentName: pass.residentName,
      guestName: pass.guestName,
      phone: pass.phone,
      purpose: pass.purpose,
      vehicleNo: pass.vehicleNo,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + (pass.validHours || 24) * 3600 * 1000),
      status: 'ACTIVE',
    });
  }
}

async function seedVisitors() {
  const existing = await db.Visitor.countDocuments({});
  if (existing > 0) return;
  for (const v of VISITORS) {
    await db.Visitor.create({
      guestName: v.guestName,
      phone: v.phone,
      flatId: v.flatId,
      vehicleNo: v.vehicleNo || '',
      purpose: v.purpose,
      notes: '',
      approvalStatus: v.approvalStatus,
      checkInTime: new Date(Date.now() - v.minutesAgo * 60 * 1000),
      checkOutTime: v.minutesOut ? new Date(Date.now() - v.minutesOut * 60 * 1000) : null,
      approvedBy: v.approvedBy,
      guardNote: v.guardNote || '',
      loggedBy: v.loggedBy,
      createdBy: 'GUARD',
    });
  }
}

export async function runSeed({ force = false } = {}) {
  if (force) {
    clearSnapshot();
    for (const model of ['User', 'Flat', 'Visitor', 'Bill', 'Notice', 'Complaint', 'GatePass', 'Meeting', 'SalaryPayment', 'SocietySetting']) {
      await db[model].deleteMany({});
    }
  }
  await seedFlats();
  await seedUsers();
  await seedSalaryRecords();
  await seedBills();
  await seedNotices();
  await seedComplaints();
  await seedPasses();
  await seedVisitors();

  const [flats, users, bills, notices, complaints, visitors, passes, meetings] = await Promise.all([
    db.Flat.countDocuments({}),
    db.User.countDocuments({}),
    db.Bill.countDocuments({}),
    db.Notice.countDocuments({}),
    db.Complaint.countDocuments({}),
    db.Visitor.countDocuments({}),
    db.GatePass.countDocuments({}),
    db.Meeting.countDocuments({}),
  ]);

  const [occupied, vacant] = await Promise.all([
    db.Flat.countDocuments({ isOccupied: true }),
    db.Flat.countDocuments({ isOccupied: false }),
  ]);

  flushStore(); // persist immediately so a restart keeps this exact seed
  return { flats, occupied, vacant, users, bills, notices, complaints, visitors, passes, meetings };
}

/** Called on server boot — only seeds when the society database is empty. */
export async function seedIfEmpty() {
  await seedFlats();
  await seedUsers();
  await seedSalaryRecords();
  const bills = await db.Bill.countDocuments({});
  if (bills > 0) return { seeded: false, message: 'Society data already present' };
  const summary = await runSeed();
  return {
    seeded: true,
    summary,
    message:
      `${summary.flats} flats (Blocks A/B/C × 5 floors × 4) • ${summary.occupied} occupied / ${summary.vacant} vacant • ` +
      `${summary.users} users • ${summary.bills} maintenance invoices • ${summary.notices} notices • ${summary.complaints} tickets`,
  };
}

// ── CLI: npm run seed  /  npm run seed -- --force ─────────────────────────
const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  const force = process.argv.includes('--force');
  (async () => {
    await connectDB();
    hydrateMemoryStore();
    console.log(`Seeding ${SOCIETY.name} — Blocks ${SOCIETY.blocks.join('/')} • ${SOCIETY.floorsPerBlock} floors • ${SOCIETY.flatsPerFloor} flats per floor`);
    const summary = force ? await runSeed({ force: true }) : (await seedIfEmpty()).summary || (await runSeed());
    console.table(summary);
    console.log(
      `Seed complete. Demo logins → resident@homi.com / resident123 (Flat A-101) • admin@homi.com / admin123 • guard@homi.com / guard123 • cleaner@homi.com / cleaner123 • sample mobile: ${formatMobile('9876543210')}`
    );
    process.exit(0);
  })().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
