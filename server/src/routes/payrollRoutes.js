import { Router } from 'express';
import {
  createSalaryRecord,
  getCleaningStaffPayroll,
  getMySalaryRecords,
  markSalaryPaid,
  setCleanerMonthlySalary,
} from '../controllers/payrollController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/mine', authorize('CLEANER'), getMySalaryRecords);
router.get('/staff', authorize('ADMIN'), getCleaningStaffPayroll);
router.patch('/staff/:id/salary', authorize('ADMIN'), setCleanerMonthlySalary);
router.post('/records', authorize('ADMIN'), createSalaryRecord);
router.patch('/records/:id/paid', authorize('ADMIN'), markSalaryPaid);
export default router;
