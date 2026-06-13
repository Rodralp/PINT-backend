import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import {
  createAnnouncement,
  downloadAnnouncementAttachment,
  getAnnouncementRecipients,
  getUserAnnouncements,
} from '../controllers/announcementController.js';

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
    const originalName = String(file?.originalname || 'attachment').trim();
    const extension = path.extname(originalName).toLowerCase().slice(0, 10);
    const baseName = path.basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'attachment';
    const uniquePart = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    callback(null, `${baseName}-${uniquePart}${extension}`.slice(0, 50));
  },
});
const upload = multer({ storage: uploadStorage });

router.get('/recipients', getAnnouncementRecipients);
router.get('/', getUserAnnouncements);
router.get('/:logId/files/:fileId/download', downloadAnnouncementAttachment);
router.post('/', upload.array('files'), createAnnouncement);

export default router;
