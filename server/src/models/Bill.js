import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
  {
    flatId: { type: String, required: true, uppercase: true, trim: true },
    residentName: { type: String, default: 'Resident' },
    month: { type: String, required: true }, // "September"
    year: { type: Number, required: true },
    billingPeriod: { type: String }, // "September 2026"
    baseMaintenance: { type: Number, required: true },
    parkingCharge: { type: Number, default: 0 },
    waterCharge: { type: Number, default: 150 },
    securityCharge: { type: Number, default: 250 },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PAID', 'PENDING', 'OVERDUE'], default: 'PENDING' },
    dueDate: { type: Date, required: true },
    paymentTxnid: { type: String },
    razorpayOrderId: { type: String },
    paymentMode: { type: String }, // UPI / CARD / NETBANKING / RAZORPAY
    paidAt: { type: Date },
    generatedBy: { type: String, default: 'CRON' }, // CRON | ADMIN
  },
  { timestamps: true }
);

billSchema.index({ flatId: 1, month: 1, year: 1 }, { unique: false });

export default mongoose.model('Bill', billSchema);
