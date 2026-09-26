import { Router } from 'express';
import { createComplaint, getComplaints, updateComplaintStatus } from '../controllers/complaintController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', getComplaints);
router.post('/', createComplaint);
router.patch('/:id/status', authorize('ADMIN'), updateComplaintStatus);
export default router;
