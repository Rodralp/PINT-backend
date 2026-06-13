import { Router } from 'express';
import {
	getAdminGestorDashboard,
	getConsultorDashboard,
	getServiceLineLeaderDashboard,
	getTalentManagerDashboard,
} from '../controllers/dashboardController.js';

const router = Router();

router.get('/talent-manager', getTalentManagerDashboard);
router.get('/service-line-leader', getServiceLineLeaderDashboard);
router.get('/admin-gestor', getAdminGestorDashboard);
router.get('/consultor', getConsultorDashboard);

export default router;
