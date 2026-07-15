import { Router } from 'express';
import {
	changePassword,
	createAdminUser,
	decidePendingUser,
	listAdminUsers,
	listRgpdTopics,
	listServiceLines,
	login,
	recoverPassword,
	register,
	resetPassword,
	updateAdminUserPermissions,
	updateAdminUserStatus,
} from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/recover-password', recoverPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', changePassword);
router.get('/rgpd-topics', listRgpdTopics);
router.get('/admin/service-lines', listServiceLines);
router.get('/admin/users', listAdminUsers);
router.post('/admin/users', createAdminUser);
router.patch('/admin/users/:accountId/permissions', updateAdminUserPermissions);
router.patch('/admin/users/:accountId/status', updateAdminUserStatus);
router.post('/admin/users/:accountId/decision', decidePendingUser);

export default router;
