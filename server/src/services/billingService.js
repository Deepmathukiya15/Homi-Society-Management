import { db } from '../store/index.js';
import { buildBillAmounts, dueDateFor, monthName, MONTHS } from '../utils/helpers.js';
import { emitToAdmins, emitToFlat } from '../realtime/socket.js';

/**
 * Monthly maintenance batch generator.
 * Called by (a) the node-cron scheduler `0 0 1 * *` and (b) the manual
 * "Run Monthly Cron Bill" button on the admin dashboard.
 */
export async function runMonthlyBilling({ month, year } = {}) {
  const now = new Date();
  const billingMonth = month || monthName(now.getUTCMonth());
  const billingYear = Number(year || now.getUTCFullYear());
  const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === String(billingMonth).toLowerCase());

  if (monthIndex === -1) {
    const err = new Error('Invalid billing month');
    err.status = 400;
    throw err;
  }

  const flats = (await db.Flat.find({})).filter((f) => f.isOccupied);
  const existing = await db.Bill.find({ month: billingMonth, year: billingYear });
  const results = { month: billingMonth, year: billingYear, generated: 0, skipped: 0, totalAmount: 0, bills: [] };

  for (const flat of flats) {
    if (existing.some((b) => b.flatId === flat.flatId)) {
      results.skipped += 1;
      continue;
    }
    const amounts = buildBillAmounts(flat);
    const bill = await db.Bill.create({
      flatId: flat.flatId,
      residentName: flat.ownerName,
      month: billingMonth,
      year: billingYear,
      billingPeriod: `${billingMonth} ${billingYear}`,
      ...amounts,
      status: 'PENDING',
      dueDate: dueDateFor(billingYear, monthIndex),
      generatedBy: 'CRON',
    });
    results.generated += 1;
    results.totalAmount += amounts.amount;
    results.bills.push(bill);
    emitToFlat(flat.flatId, 'bill_generated', { bill });
  }

  emitToAdmins('cron_batch_completed', {
    month: billingMonth,
    year: billingYear,
    generated: results.generated,
    totalAmount: results.totalAmount,
    at: new Date().toISOString(),
  });

  return results;
}
