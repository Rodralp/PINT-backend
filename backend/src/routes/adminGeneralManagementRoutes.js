import { Router } from 'express';
import {
  getGeneralManagement,
  updateNotificationSettings,
  updateRgpdTopics,
  updateGeneralSettings,
} from '../controllers/adminGeneralManagementController.js';

const router = Router();

router.get('/', getGeneralManagement);
router.put('/notifications', updateNotificationSettings);
router.put('/rgpd', updateRgpdTopics);
router.put('/settings', updateGeneralSettings);

export default router;
