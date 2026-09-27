import mongoose from 'mongoose';

const societySettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Number, required: true, min: 0 },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('SocietySetting', societySettingSchema);
