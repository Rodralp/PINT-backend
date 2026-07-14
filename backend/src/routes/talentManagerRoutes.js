import { Router } from 'express';
import {
  getHistoricoServiceLines,
  getHistoricoBadges,
  getHistoricoConsultores,
  getDetalhesConsultorTM,
  getDetalhesBadgeTM,
  getDetalhesServiceLineTM,
} from '../controllers/talentManagerController.js';

const router = Router();

router.get('/historico/service-lines', getHistoricoServiceLines);
router.get('/historico/badges', getHistoricoBadges);
router.get('/historico/consultores', getHistoricoConsultores);
router.get('/historico/consultor', getDetalhesConsultorTM);
router.get('/historico/badge', getDetalhesBadgeTM);
router.get('/historico/service-line', getDetalhesServiceLineTM);

export default router;
