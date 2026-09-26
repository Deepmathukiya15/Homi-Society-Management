import { db } from '../store/index.js';
import { asyncHandler } from '../utils/helpers.js';

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const meetingInput = (body, { partial = false } = {}) => {
  const result = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) throw badRequest('Meeting title is required');
    result.title = title;
  }
  if (!partial || body.location !== undefined) {
    const location = String(body.location || '').trim();
    if (!location) throw badRequest('Meeting location is required');
    result.location = location;
  }
  if (!partial || body.startAt !== undefined) {
    const startAt = new Date(body.startAt);
    if (!body.startAt || Number.isNaN(startAt.getTime())) throw badRequest('Enter a valid meeting date and time');
    result.startAt = startAt;
  }
  if (body.endAt !== undefined) {
    if (body.endAt === '' || body.endAt === null) result.endAt = null;
    else {
      const endAt = new Date(body.endAt);
      if (Number.isNaN(endAt.getTime())) throw badRequest('Enter a valid meeting end time');
      result.endAt = endAt;
    }
  }
  if (!partial || body.description !== undefined) result.description = String(body.description || '').trim();
  if (result.startAt && result.endAt && result.endAt <= result.startAt) {
    throw badRequest('Meeting end time must be after its start time');
  }
  return result;
};

export const listMeetings = asyncHandler(async (_req, res) => {
  const meetings = await db.Meeting.find({});
  meetings.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  res.json({ success: true, meetings });
});

export const createMeeting = asyncHandler(async (req, res) => {
  const fields = meetingInput(req.body);
  const meeting = await db.Meeting.create({
    ...fields,
    status: 'SCHEDULED',
    createdBy: req.user.name,
    updatedBy: req.user.name,
  });
  res.status(201).json({ success: true, message: 'Society meeting scheduled', meeting });
});

export const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await db.Meeting.findById(req.params.id);
  if (!meeting) {
    res.status(404);
    throw new Error('Meeting not found');
  }
  const fields = meetingInput(req.body, { partial: true });
  const startAt = fields.startAt || new Date(meeting.startAt);
  const endAt = fields.endAt !== undefined ? fields.endAt : meeting.endAt ? new Date(meeting.endAt) : null;
  if (endAt && endAt <= startAt) {
    res.status(400);
    throw badRequest('Meeting end time must be after its start time');
  }
  const updated = await db.Meeting.findByIdAndUpdate(
    meeting._id,
    { $set: { ...fields, updatedBy: req.user.name } },
    { new: true }
  );
  res.json({ success: true, message: 'Meeting details updated', meeting: updated });
});

export const cancelMeeting = asyncHandler(async (req, res) => {
  const meeting = await db.Meeting.findById(req.params.id);
  if (!meeting) {
    res.status(404);
    throw new Error('Meeting not found');
  }
  const updated = await db.Meeting.findByIdAndUpdate(
    meeting._id,
    { $set: { status: 'CANCELLED', updatedBy: req.user.name } },
    { new: true }
  );
  res.json({ success: true, message: 'Meeting cancelled', meeting: updated });
});
