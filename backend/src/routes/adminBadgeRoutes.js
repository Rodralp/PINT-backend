import { Router } from 'express';
import {
  createBadge,
  getBadge,
  updateBadge,
  getExpiringSoonBadges,
} from '../controllers/adminBadgeController.js';

const router = Router();

router.get('/expiring-soon', getExpiringSoonBadges);
router.get('/:badgeId', getBadge);
router.post('/', createBadge);
router.put('/:badgeId', updateBadge);

export default router;
