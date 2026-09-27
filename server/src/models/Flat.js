import mongoose from 'mongoose';

const flatSchema = new mongoose.Schema(
  {
    flatId: { type: String, required: true, unique: true, uppercase: true, trim: true }, // "A-101"
    block: { type: String, required: true, uppercase: true, trim: true, enum: ['A', 'B', 'C'] }, // building block
    wing: { type: String, required: true, uppercase: true, trim: true }, // legacy alias of `block`
    flatNumber: { type: String, required: true, trim: true }, // "101" … "504"
    floor: { type: Number, min: 1, max: 5, default: 1 },
    unit: { type: Number, min: 1, max: 4, default: 1 },
    area: { type: Number, default: 1100 }, // sq.ft.
    isOccupied: { type: Boolean, default: false },
    ownerName: { type: String, trim: true, default: 'Unassigned' },
    ownerContact: { type: String, trim: true, default: '—' },
    residentType: { type: String, enum: ['Owner', 'Tenant', 'Vacant'], default: 'Vacant' },
    // Legacy combined slot remains for billing and older clients; new assignments are split by vehicle type.
    allocatedParking: { type: String, trim: true, default: '' },
    allocatedBikeParking: { type: String, trim: true, default: '' },
    allocatedCarParking: { type: String, trim: true, default: '' },
    maintenanceRate: { type: Number, default: 2500 }, // base monthly maintenance (₹)
  },
  { timestamps: true }
);

export default mongoose.model('Flat', flatSchema);
