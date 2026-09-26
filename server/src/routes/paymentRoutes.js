import { Router } from 'express';
import { createOrder, getPaymentConfig, recordOfflinePayment, verifyPayment } from '../controllers/paymentController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/config', getPaymentConfig);
router.post('/create-order', authorize('ADMIN', 'RESIDENT'), createOrder);
router.post('/verify', authorize('ADMIN', 'RESIDENT'), verifyPayment);
router.post('/record-offline', authorize('ADMIN'), recordOfflinePayment);
export default router;
