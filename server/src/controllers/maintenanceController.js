import { db } from '../store/index.js';
import { asyncHandler, MONTHS } from '../utils/helpers.js';
import { runMonthlyBilling } from '../services/billingService.js';

/** GET /api/maintenance/bills — admin sees the ledger, residents see their flat */
export const getBills = asyncHandler(async (req, res) => {
  const { status = 'ALL', flatId = 'ALL', search = '' } = req.query;
  let bills = await db.Bill.find({});

  if (req.user.role === 'RESIDENT') {
    bills = bills.filter((b) => b.flatId === req.user.flatId);
  } else if (flatId !== 'ALL') {
    bills = bills.filter((b) => b.flatId === String(flatId).toUpperCase());
  }
  if (status !== 'ALL') bills = bills.filter((b) => b.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    bills = bills.filter(
      (b) =>
        b.flatId.toLowerCase().includes(q) ||
        String(b.residentName || '').toLowerCase().includes(q) ||
        String(b.month || '').toLowerCase().includes(q)
    );
  }

  bills.sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime() || a.flatId.localeCompare(b.flatId)
  );

  res.json({
    success: true,
    count: bills.length,
    totalAmount: bills.reduce((s, b) => s + Number(b.amount || 0), 0),
    bills,
  });
});

/** GET /api/maintenance/stats — revenue ledger KPIs + chart series for the admin dashboard */
export const getMaintenanceStats = asyncHandler(async (_req, res) => {
  const [bills, flats] = await Promise.all([db.Bill.find({}), db.Flat.find({})]);
  const year = new Date().getFullYear();
  const paid = bills.filter((b) => b.status === 'PAID');
  const pending = bills.filter((b) => b.status === 'PENDING');
  const overdue = bills.filter((b) => b.status === 'OVERDUE');
  const sum = (list) => list.reduce((s, b) => s + Number(b.amount || 0), 0);

  const monthlySeries = MONTHS.map((month, index) => {
    const scoped = bills.filter((b) => b.month === month && Number(b.year) === year);
    return {
      month: month.slice(0, 3),
      monthIndex: index,
      collected: sum(scoped.filter((b) => b.status === 'PAID')),
      outstanding: sum(scoped.filter((b) => b.status !== 'PAID')),
      bills: scoped.length,
    };
  });

  const flatsWithDues = [...new Set([...pending, ...overdue].map((b) => b.flatId))];

  res.json({
    success: true,
    stats: {
      year,
      totalBills: bills.length,
      totalInvoiced: sum(bills),
      totalCollected: sum(paid),
      pendingDues: sum(pending),
      overdueDues: sum(overdue),
      outstanding: sum(pending) + sum(overdue),
      collectionRate: bills.length ? Math.round((sum(paid) / Math.max(sum(bills), 1)) * 100) : 0,
      paidCount: paid.length,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      occupiedFlats: flats.filter((f) => f.isOccupied).length,
      pendingFlats: flatsWithDues.length,
      monthlySeries,
    },
  });
});

/**
 * POST /api/maintenance/generate-cron-bills  { month, year }
 * Manual trigger for the exact job node-cron fires on the 1st at 00:00
 * (`0 0 1 * *`) — used to demonstrate automation during the viva.
 */
export const generateCronBills = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const results = await runMonthlyBilling({ month, year });
  res.json({
    success: true,
    message: `Cron batch executed for ${results.month} ${results.year} — ${results.generated} invoice(s) generated, ₹${results.totalAmount.toLocaleString(
      'en-IN'
    )} raised${results.skipped ? `, ${results.skipped} already existed` : ''}`,
    results,
  });
});

/** GET /api/maintenance/defaulters — highest outstanding dues, admin view */
export const getDefaulters = asyncHandler(async (_req, res) => {
  const bills = (await db.Bill.find({})).filter((b) => b.status !== 'PAID');
  const grouped = new Map();
  bills.forEach((b) => {
    const key = b.flatId;
    const entry = grouped.get(key) || { flatId: key, residentName: b.residentName, due: 0, months: [] };
    entry.due += Number(b.amount || 0);
    entry.months.push(b.month);
    grouped.set(key, entry);
  });
  res.json({
    success: true,
    defaulters: [...grouped.values()].sort((a, b) => b.due - a.due),
  });
});
