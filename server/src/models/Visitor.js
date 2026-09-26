import mongoose from 'mongoose';

export const PURPOSES = ['Guest', 'Delivery / Courier', 'Cab / Taxi', 'Home Service', 'Other / Meeting'];

const visitorSchema = new mongoose.Schema(
  {
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    flatId: { type: String, required: true, uppercase: true, trim: true },
    vehicleNo: { type: String, trim: true, uppercase: true },
    purpose: { type: String, enum: PURPOSES, default: 'Guest' },
    notes: { type: String, trim: true },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'DENIED', 'PRE_APPROVED'],
      default: 'PENDING',
    },
    checkInTime: { type: Date, default: Date.now },
    checkOutTime: { type: Date, default: null },
    approvedBy: { type: String }, // resident name who tapped Approve
    guardNote: { type: String },
    passCode: { type: String }, // set when entry came through a QR gate pass
    loggedBy: { type: String }, // guard on duty
    checkedOutBy: { type: String }, // guard who logged the exit
    createdBy: { type: String, enum: ['GUARD', 'RESIDENT', 'ADMIN'], default: 'GUARD' },
  },
  { timestamps: true }
);

visitorSchema.virtual('isInside').get(function () {
  return !this.checkOutTime;
});

export default mongoose.model('Visitor', visitorSchema);
