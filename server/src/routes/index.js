import { Router } from 'express';
import authRoutes from './authRoutes.js';
import flatRoutes from './flatRoutes.js';
import visitorRoutes from './visitorRoutes.js';
import maintenanceRoutes from './maintenanceRoutes.js';
import noticeRoutes from './noticeRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import paymentRoutes from './paymentRoutes.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/flats', flatRoutes);
router.use('/visitors', visitorRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/notices', noticeRoutes);
router.use('/complaints', complaintRoutes);
router.use('/payments', paymentRoutes);

export default router;
