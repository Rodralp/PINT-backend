import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import {
  acquireBadge,
  getBadgeSuggestions,
  getPreferenceAreas,
  getPreferences,
  createReminder,
  deleteReminder,
  getCatalogBadges,
  getLearningPaths,
  getMyBadges,
  getMyRequests,
  getPedidoDetail,
  getProfileData,
  getRankingConsultores,
  getReminders,
  savePreferences,
  updateProfileData,
  updateReminder,
  uploadEvidence,
  getBadgeRequirements,
  getExpiringSoonBadgesForUser,
  getUserImage,
  uploadUserImage,
  deleteUserImage,
  getUserVitrine,
  saveUserVitrine,
} from '../controllers/consultorController.js';

const router = Router();
const uploadsDir = path.resolve(globalThis.process?.cwd?.() || '.', 'uploads');
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      callback(null, uploadsDir);
    } catch (error) {
      callback(error, uploadsDir);
    }
  },
  filename: (_req, file, callback) => {
    const originalName = String(file?.originalname || 'evidence').trim();
    const extension = path.extname(originalName).toLowerCase().slice(0, 10);
    const baseName = path.basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'evidence';
    const uniquePart = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    callback(null, `${baseName}-${uniquePart}${extension}`.slice(0, 50));
  },
});
const upload = multer({ storage: uploadStorage });

router.get('/catalog-badges', getCatalogBadges);
router.get('/learning-paths', getLearningPaths);
router.get('/meus-badges', getMyBadges);
router.post('/badges/:badgeId/adquirir', acquireBadge);
router.get('/preferencias/areas', getPreferenceAreas);
router.get('/preferencias', getPreferences);
router.put('/preferencias', savePreferences);
router.get('/sugestoes', getBadgeSuggestions);
router.get('/meus-pedidos', getMyRequests);
router.get('/pedidos/:pedidoId', getPedidoDetail);
router.get('/ranking', getRankingConsultores);
router.get('/lembretes', getReminders);
router.post('/lembretes', createReminder);
router.put('/lembretes/:id', updateReminder);
router.delete('/lembretes/:id', deleteReminder);
router.post('/pedidos/:pedidoId/evidencias', upload.array('files'), uploadEvidence);
router.get('/profile', getProfileData);
router.put('/profile', updateProfileData);
router.get('/badge/:badgeId/requirements', getBadgeRequirements);
router.get('/expiring-soon', getExpiringSoonBadgesForUser);
router.get('/user-image', getUserImage);
router.post('/user-image', uploadUserImage);
router.delete('/user-image', deleteUserImage);
router.get('/vitrine', getUserVitrine);
router.post('/vitrine', saveUserVitrine);

export default router;
