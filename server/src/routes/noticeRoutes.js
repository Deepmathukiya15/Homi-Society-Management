import { Router } from 'express';
import { createNotice, deleteNotice, getNotices, togglePin } from '../controllers/noticeController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', getNotices);
router.post('/', authorize('ADMIN'), createNotice);
router.patch('/:id/pin', authorize('ADMIN'), togglePin);
router.delete('/:id', authorize('ADMIN'), deleteNotice);
export default router;
