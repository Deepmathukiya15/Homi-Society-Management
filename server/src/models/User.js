import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['RESIDENT', 'ADMIN', 'GUARD'], default: 'RESIDENT' },
    contactNumber: { type: String, trim: true },
    flatId: { type: String, trim: true, uppercase: true }, // residents only, e.g. "A-101"
    staffId: { type: String, trim: true }, // guards only, e.g. "SEC-001"
    securityCode: { type: String, select: false }, // master passkey used at registration
    isActive: { type: Boolean, default: true },
    // Self-registered residents/guards land in PENDING and cannot sign in until an
    // admin approves them from the Approvals module.
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    contactNumber: this.contactNumber,
    flatId: this.flatId,
    staffId: this.staffId,
    approvalStatus: this.approvalStatus || 'APPROVED',
    approvedBy: this.approvedBy,
    approvedAt: this.approvedAt,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
