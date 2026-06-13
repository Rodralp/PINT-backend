import { Router } from 'express';
import {
  downloadManagedEvidence,
  getManagedRequestById,
  getManagedRequests,
  submitManagedRequestDecision,
} from '../controllers/requestManagementController.js';

const router = Router();

router.get('/:role/requests', getManagedRequests);
router.get('/:role/requests/:requestId', getManagedRequestById);
router.get('/:role/requests/:requestId/evidences/:evidenceId/download', downloadManagedEvidence);
router.post('/:role/requests/:requestId/decision', submitManagedRequestDecision);

export default router;
