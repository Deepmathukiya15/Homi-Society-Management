import { Router } from 'express';
import { cancelMeeting, createMeeting, listMeetings, updateMeeting } from '../controllers/meetingController.js';
import { authorizeCommittee, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect, authorizeCommittee);
router.get('/', listMeetings);
router.post('/', createMeeting);
router.patch('/:id', updateMeeting);
router.patch('/:id/cancel', cancelMeeting);
export default router;
