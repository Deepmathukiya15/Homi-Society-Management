import { Router } from 'express';
import { getUsers, setApproval } from '../controllers/userController.js';
import { demoAccounts, demoLogin, login, me, register } from '../controllers/authController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/demo-login', demoLogin);
router.get('/demo-accounts', demoAccounts);
router.get('/me', protect, me);

// Admin approval queue for newly registered residents / guards (RBAC: ADMIN only)
router.get('/pending-users', protect, authorize('ADMIN'), getUsers);
router.patch('/users/:id/approval', protect, authorize('ADMIN'), setApproval);
export default router;
