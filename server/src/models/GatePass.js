import mongoose from 'mongoose';

const gatePassSchema = new mongoose.Schema(
  {
    displayCode: { type: String, required: true, unique: true }, // HOMI-A101-9982
    passCode: { type: String, required: true, index: true }, // 10-digit numeric console code
    flatId: { type: String, required: true, uppercase: true, trim: true },
    residentName: { type: String },
    guestName: { type: String, required: true },
    phone: { type: String, trim: true },
    purpose: { type: String, default: 'Guest' },
    vehicleNo: { type: String, trim: true, uppercase: true },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'USED', 'EXPIRED'], default: 'ACTIVE' },
    usedAt: { type: Date },
    scannedBy: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('GatePass', gatePassSchema);
