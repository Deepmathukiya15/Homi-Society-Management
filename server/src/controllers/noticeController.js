import { db } from '../store/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { emitToAdmins, broadcast } from '../realtime/socket.js';

/** GET /api/notices */
export const getNotices = asyncHandler(async (_req, res) => {
  const notices = await db.Notice.find({});
  notices.sort(
    (a, b) => Number(b.isPinned || 0) - Number(a.isPinned || 0) || new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ success: true, count: notices.length, notices });
});

/** POST /api/notices (admin) */
export const createNotice = asyncHandler(async (req, res) => {
  const { title, content, category = 'GENERAL', priority = 'NORMAL', isPinned = false, audience = 'ALL', wing = 'ALL' } = req.body;
  if (!title || !content) {
    res.status(400);
    throw new Error('Notice title and description are required');
  }
  const notice = await db.Notice.create({
    title: title.trim(),
    content: content.trim(),
    category,
    priority,
    isPinned: Boolean(isPinned),
    audience,
    wing,
    postedBy: `${req.user.name} (${req.user.role === 'ADMIN' ? 'Secretary' : 'Committee'})`,
  });

  broadcast('notice_published', { notice, at: new Date().toISOString() });
  emitToAdmins('notice_published', { notice });

  res.status(201).json({
    success: true,
    message: 'Notice Published — now visible across all resident portals.',
    notice,
  });
});

/** DELETE /api/notices/:id (admin) */
export const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await db.Notice.findById(req.params.id);
  if (!notice) {
    res.status(404);
    throw new Error('Notice not found');
  }
  await db.Notice.findByIdAndDelete(req.params.id);
  broadcast('notice_deleted', { noticeId: req.params.id });
  res.json({ success: true, message: 'Notice Deleted — removed from board', noticeId: req.params.id });
});

/** PATCH /api/notices/:id/pin (admin) */
export const togglePin = asyncHandler(async (req, res) => {
  const notice = await db.Notice.findById(req.params.id);
  if (!notice) {
    res.status(404);
    throw new Error('Notice not found');
  }
  const updated = await db.Notice.findByIdAndUpdate(notice._id, { $set: { isPinned: !notice.isPinned } }, { new: true });
  res.json({ success: true, message: updated.isPinned ? 'Notice pinned to top of board' : 'Notice unpinned', notice: updated });
});
