import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    category: { type: String, enum: ['GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT'], default: 'GENERAL' },
    priority: { type: String, enum: ['NORMAL', 'HIGH', 'CRITICAL'], default: 'NORMAL' },
    postedBy: { type: String, default: 'Society Management Committee' },
    isPinned: { type: Boolean, default: false },
    audience: { type: String, enum: ['ALL', 'WING'], default: 'ALL' },
    wing: { type: String, default: 'ALL' },
  },
  { timestamps: true }
);

export default mongoose.model('Notice', noticeSchema);
