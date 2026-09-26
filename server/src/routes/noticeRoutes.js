import { Router } from 'express';
import { createNotice, deleteNotice, getNotices, togglePin } from '../controllers/noticeController.js';
import { authorizeCommittee, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', getNotices);
router.post('/', authorizeCommittee, createNotice);
router.patch('/:id/pin', authorizeCommittee, togglePin);
router.delete('/:id', authorizeCommittee, deleteNotice);
export default router;
