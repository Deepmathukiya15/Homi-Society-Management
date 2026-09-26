import { db } from '../store/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { emitToAdmins, emitToFlat } from '../realtime/socket.js';

const statusWeight = { PENDING: 0, IN_PROGRESS: 1, RESOLVED: 2 };

/** GET /api/complaints — residents see their own tickets, admin sees the helpdesk queue */
export const getComplaints = asyncHandler(async (req, res) => {
  const { status = 'ALL', category = 'ALL' } = req.query;
  let complaints = await db.Complaint.find({});

  if (req.user.role === 'RESIDENT') complaints = complaints.filter((c) => c.flatId === req.user.flatId);
  if (status !== 'ALL') complaints = complaints.filter((c) => c.status === status);
  if (category !== 'ALL') complaints = complaints.filter((c) => c.category === category);

  complaints.sort(
    (a, b) => statusWeight[a.status] - statusWeight[b.status] || new Date(b.createdAt) - new Date(a.createdAt)
  );

  res.json({
    success: true,
    count: complaints.length,
    open: complaints.filter((c) => c.status !== 'RESOLVED').length,
    complaints,
  });
});

/** POST /api/complaints (resident) */
export const createComplaint = asyncHandler(async (req, res) => {
  const { category = 'GENERAL', title, description, priority = 'MEDIUM' } = req.body;
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) {
    res.status(400);
    throw new Error('Issue title is required');
  }
  const flatId = req.user.flatId;
  if (!flatId) {
    res.status(400);
    throw new Error('Your account must be assigned to a flat before raising a helpdesk ticket');
  }
  const cleanPriority = String(priority).toUpperCase();
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(cleanPriority)) {
    res.status(400);
    throw new Error('Priority must be LOW, MEDIUM, HIGH, or CRITICAL');
  }
  const cleanCategory = String(category).toUpperCase();
  if (!['PLUMBING', 'ELECTRICAL', 'LIFT', 'CLEANING', 'SECURITY', 'GENERAL'].includes(cleanCategory)) {
    res.status(400);
    throw new Error('Select a valid helpdesk category');
  }

  const ticketNo = `TKT-${Date.now().toString().slice(-6)}`;
  const complaint = await db.Complaint.create({
    ticketNo,
    flatId,
    residentName: req.user.name,
    category: cleanCategory,
    title: cleanTitle,
    description: String(description || '').trim(),
    priority: cleanPriority,
    status: 'PENDING',
  });

  emitToAdmins('complaint_raised', { complaint, at: new Date().toISOString() });
  emitToFlat(flatId, 'complaint_raised', { complaint });

  res.status(201).json({
    success: true,
    message: `Ticket ${ticketNo} raised — maintenance team has been notified.`,
    complaint,
  });
});

/** PATCH /api/complaints/:id/status (admin) */
export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, adminRemarks } = req.body;
  if (!['PENDING', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
    res.status(400);
    throw new Error('Status must be PENDING, IN_PROGRESS or RESOLVED');
  }
  const complaint = await db.Complaint.findById(req.params.id);
  if (!complaint) {
    res.status(404);
    throw new Error('Complaint not found');
  }

  const updated = await db.Complaint.findByIdAndUpdate(
    complaint._id,
    {
      $set: {
        status,
        adminRemarks: adminRemarks || complaint.adminRemarks || 'Action taken by Society Management Committee',
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    },
    { new: true }
  );

  const payload = { complaint: updated, updatedBy: req.user.name };
  emitToAdmins('complaint_updated', payload);
  emitToFlat(updated.flatId, 'complaint_updated', payload);

  res.json({ success: true, message: `Complaint Updated — status is now ${status}`, complaint: updated });
});
