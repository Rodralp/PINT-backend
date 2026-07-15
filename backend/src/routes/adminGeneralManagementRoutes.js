import { Router } from 'express';
import {
  getGeneralManagement,
  updateNotificationSettings,
  updateRgpdTopics,
} from '../controllers/adminGeneralManagementController.js';

const router = Router();

router.get('/', getGeneralManagement);
router.put('/notifications', updateNotificationSettings);
router.put('/rgpd', updateRgpdTopics);

export default router;
