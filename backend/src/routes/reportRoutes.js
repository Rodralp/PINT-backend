import { Router } from 'express';
import { getBadgeReport } from '../controllers/reportController.js';

const router = Router();

router.get('/badge-assignments', getBadgeReport);

export default router;
