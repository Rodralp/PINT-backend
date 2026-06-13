import { Router } from 'express';
import {
  listLearningPaths,
  createLearningPath,
  updateLearningPath,
  createServiceLine,
  updateServiceLine,
  createArea,
  updateArea,
  createLevel,
  updateLevel,
  updateLearningPathStatus,
  updateServiceLineStatus,
  updateAreaStatus,
  updateLevelStatus,
} from '../controllers/adminLearningPathController.js';

const router = Router();

router.get('/', listLearningPaths);
router.post('/', createLearningPath);
router.put('/:learningPathId', updateLearningPath);
router.patch('/:learningPathId/status', updateLearningPathStatus);
router.post('/:learningPathId/service-lines', createServiceLine);

router.put('/service-lines/:serviceLineId', updateServiceLine);
router.patch('/service-lines/:serviceLineId/status', updateServiceLineStatus);
router.post('/service-lines/:serviceLineId/areas', createArea);

router.put('/areas/:areaId', updateArea);
router.patch('/areas/:areaId/status', updateAreaStatus);
router.post('/areas/:areaId/levels', createLevel);

router.put('/levels/:levelId', updateLevel);
router.patch('/levels/:levelId/status', updateLevelStatus);

export default router;
