import { db, toSafeUser } from '../store/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { emitToAdmins } from '../realtime/socket.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAYMENT_MODES = ['BANK_TRANSFER', 'UPI', 'CASH'];
const isApprovedCleaner = (user) => user?.role === 'CLEANER' && (user.approvalStatus || 'APPROVED') === 'APPROVED';

/** Admin payroll register: approved and pending cleaning staff + all salary records. */
export const getCleaningStaffPayroll = asyncHandler(async (_req, res) => {
  const staff = await db.User.find({ role: 'CLEANER' });
  const records = await db.SalaryPayment.find({});
  records.sort((a, b) => String(b.month).localeCompare(String(a.month)) || String(a.cleanerName).localeCompare(String(b.cleanerName)));
  res.json({
    success: true,
    staff: staff.map(toSafeUser).sort((a, b) => a.name.localeCompare(b.name)),
    records,
    totals: {
      pending: records.filter((r) => r.status === 'PENDING').reduce((sum, r) => sum + Number(r.amount || 0), 0),
      paid: records.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + Number(r.amount || 0), 0),
    },
  });
});

/** Cleaner sees only their own salary history. */
export const getMySalaryRecords = asyncHandler(async (req, res) => {
  const records = await db.SalaryPayment.find({ cleanerId: String(req.user._id) });
  records.sort((a, b) => String(b.month).localeCompare(String(a.month)));
  res.json({ success: true, monthlySalary: Number(req.user.monthlySalary || 0), records });
});

export const setCleanerMonthlySalary = asyncHandler(async (req, res) => {
  const cleaner = await db.User.findById(req.params.id);
  if (!isApprovedCleaner(cleaner)) {
    res.status(404);
    throw new Error('Approved cleaning staff account not found');
  }
  const amount = Number(req.body.monthlySalary);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    res.status(400);
    throw new Error('Monthly salary must be between ₹0 and ₹10,00,000');
  }
  const updated = await db.User.findByIdAndUpdate(cleaner._id, { $set: { monthlySalary: Math.round(amount * 100) / 100 } }, { new: true });
  res.json({ success: true, message: `Monthly salary updated for ${updated.name}`, user: toSafeUser(updated) });
});

export const createSalaryRecord = asyncHandler(async (req, res) => {
  const { cleanerId, month } = req.body;
  if (!MONTH_RE.test(String(month || ''))) {
    res.status(400);
    throw new Error('Salary month must use YYYY-MM format');
  }
  const cleaner = await db.User.findById(cleanerId);
  if (!isApprovedCleaner(cleaner)) {
    res.status(404);
    throw new Error('Approved cleaning staff account not found');
  }
  const amount = Number(req.body.amount ?? cleaner.monthlySalary);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    res.status(400);
    throw new Error('Set a valid monthly salary greater than ₹0 before creating this salary record');
  }
  const existing = await db.SalaryPayment.findOne({ cleanerId: String(cleaner._id), month: String(month) });
  if (existing) {
    res.status(409);
    throw new Error(`A salary record for ${month} already exists for ${cleaner.name}`);
  }
  const record = await db.SalaryPayment.create({
    cleanerId: String(cleaner._id),
    cleanerName: cleaner.name,
    cleanerStaffId: cleaner.staffId || '',
    month: String(month),
    amount: Math.round(amount * 100) / 100,
    status: 'PENDING',
    paymentMode: 'BANK_TRANSFER',
    createdBy: req.user.name,
  });
  emitToAdmins('payroll:updated', { record });
  res.status(201).json({ success: true, message: `Salary record created for ${cleaner.name} • ${month}`, record });
});

/** Record an externally completed salary transfer; this endpoint never moves funds. */
export const markSalaryPaid = asyncHandler(async (req, res) => {
  const mode = String(req.body.paymentMode || 'BANK_TRANSFER').toUpperCase();
  const reference = String(req.body.reference || '').trim();
  if (!PAYMENT_MODES.includes(mode)) {
    res.status(400);
    throw new Error('Payment mode must be Bank Transfer, UPI, or Cash');
  }
  if (!reference || reference.length > 120) {
    res.status(400);
    throw new Error('Enter the bank/UPI transaction reference or cash voucher number');
  }
  const updated = await db.SalaryPayment.findOneAndUpdate(
    { _id: String(req.params.id), status: 'PENDING' },
    { $set: { status: 'PAID', paymentMode: mode, reference, paidAt: new Date(), paidRecordedBy: req.user.name } },
    { new: true }
  );
  if (!updated) {
    const existing = await db.SalaryPayment.findById(req.params.id);
    if (!existing) {
      res.status(404);
      throw new Error('Salary record not found');
    }
    res.status(409);
    throw new Error('This salary has already been recorded as paid');
  }
  emitToAdmins('payroll:updated', { record: updated });
  res.json({ success: true, message: `Payment record saved for ${updated.cleanerName} • ${updated.month}. This records a transfer done outside the app; it does not send money.`, record: updated });
});
