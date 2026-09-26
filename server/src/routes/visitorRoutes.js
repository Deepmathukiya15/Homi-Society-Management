import { Router } from 'express';
import {
  checkInVisitor,
  checkOutVisitor,
  createGatePass,
  decideVisitor,
  getMyPasses,
  getVisitorLogs,
  raiseSOS,
  validatePass,
  visitorStats,
} from '../controllers/visitorController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/logs', getVisitorLogs);
router.get('/stats', authorize('ADMIN', 'GUARD'), visitorStats);
router.get('/passes', getMyPasses);
router.post('/check-in', authorize('GUARD', 'ADMIN'), checkInVisitor);
router.post('/pre-approve', authorize('RESIDENT'), createGatePass);
router.post('/validate-pass', authorize('GUARD', 'ADMIN'), validatePass);
router.post('/sos', raiseSOS);
router.patch('/:id/decision', authorize('RESIDENT'), decideVisitor);
router.patch('/:id/check-out', authorize('GUARD', 'ADMIN'), checkOutVisitor);
export default router;
