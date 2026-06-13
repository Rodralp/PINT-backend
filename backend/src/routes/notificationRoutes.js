import { Router } from 'express';
import {
	getUserNotifications,
	markNotificationRead,
	getNotificationSettings,
	updateNotificationSettings,
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', getUserNotifications);
router.get('/settings', getNotificationSettings);
router.patch('/:notificationId/read', markNotificationRead);
router.put('/settings', updateNotificationSettings);

export default router;
