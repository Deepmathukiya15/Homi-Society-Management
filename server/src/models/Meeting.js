import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    location: { type: String, required: true, trim: true },
    status: { type: String, enum: ['SCHEDULED', 'CANCELLED'], default: 'SCHEDULED' },
    createdBy: { type: String, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Meeting', meetingSchema);
