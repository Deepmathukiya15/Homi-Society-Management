import mongoose from 'mongoose';

const salaryPaymentSchema = new mongoose.Schema(
  {
    cleanerId: { type: String, required: true, index: true },
    cleanerName: { type: String, required: true, trim: true },
    cleanerStaffId: { type: String, trim: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // YYYY-MM
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' },
    paymentMode: { type: String, enum: ['BANK_TRANSFER', 'UPI', 'CASH'], default: 'BANK_TRANSFER' },
    reference: { type: String, trim: true, maxlength: 120 },
    paidAt: { type: Date },
    createdBy: { type: String, required: true },
    paidRecordedBy: { type: String },
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ cleanerId: 1, month: 1 }, { unique: true });

export default mongoose.model('SalaryPayment', salaryPaymentSchema);
