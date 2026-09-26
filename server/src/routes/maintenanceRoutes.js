import { Router } from 'express';
import { generateCronBills, getBills, getDefaulters, getMaintenanceStats } from '../controllers/maintenanceController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/bills', getBills);
router.get('/stats', getMaintenanceStats);
router.get('/defaulters', authorize('ADMIN'), getDefaulters);
router.post('/generate-cron-bills', authorize('ADMIN'), generateCronBills);
export default router;
