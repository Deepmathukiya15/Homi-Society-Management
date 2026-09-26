import mongoose from 'mongoose';

export const COMPLAINT_CATEGORIES = [
  'PLUMBING',
  'ELECTRICAL',
  'LIFT',
  'CLEANING',
  'SECURITY',
  'GENERAL',
];

const complaintSchema = new mongoose.Schema(
  {
    ticketNo: { type: String },
    flatId: { type: String, required: true, uppercase: true, trim: true },
    residentName: { type: String, default: 'Resident' },
    category: { type: String, enum: COMPLAINT_CATEGORIES, default: 'GENERAL' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'], default: 'PENDING' },
    adminRemarks: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Complaint', complaintSchema);
