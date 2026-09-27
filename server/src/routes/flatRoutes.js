import { Router } from 'express';
import {
  createFlat,
  getAvailableFlats,
  getDirectorySummary,
  getSocietyMaintenanceRate,
  getFlat,
  getFlats,
  setSocietyMaintenanceRate,
  updateFlat,
} from '../controllers/flatController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

// Public: the New Registration form needs the list of unclaimed flats before login.
router.get('/available', getAvailableFlats);

router.use(protect);
router.get('/', authorize('ADMIN'), getFlats);
router.get('/directory/summary', authorize('ADMIN'), getDirectorySummary);
router.get('/maintenance-rate', authorize('ADMIN'), getSocietyMaintenanceRate);
router.patch('/maintenance-rate', authorize('ADMIN'), setSocietyMaintenanceRate);
router.post('/', authorize('ADMIN'), createFlat);
router.get('/:flatId', authorize('ADMIN', 'RESIDENT'), getFlat);
router.patch('/:flatId', authorize('ADMIN'), updateFlat);
export default router;
