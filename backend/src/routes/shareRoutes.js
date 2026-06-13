import { Router } from 'express';
import { getShareBadge } from '../controllers/shareController.js';

const router = Router();

router.get('/badge/:badgeId', getShareBadge);

export default router;
