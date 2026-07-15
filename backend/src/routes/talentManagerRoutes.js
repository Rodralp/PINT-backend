import { Router } from 'express';
import {
  getHistoricoServiceLines,
  getHistoricoBadges,
  getHistoricoConsultores,
  getDetalhesConsultorTM,
  getDetalhesBadgeTM,
  getDetalhesServiceLineTM,
  getHistoricoPorEstadoTM,
  getHistoricoCandidaturaTM,
} from '../controllers/talentManagerController.js';

const router = Router();

router.get('/historico/service-lines', getHistoricoServiceLines);
router.get('/historico/badges', getHistoricoBadges);
router.get('/historico/consultores', getHistoricoConsultores);
router.get('/historico/consultor', getDetalhesConsultorTM);
router.get('/historico/badge', getDetalhesBadgeTM);
router.get('/historico/service-line', getDetalhesServiceLineTM);

router.get('/historico/service-line-estado', getHistoricoPorEstadoTM);
router.get('/historico/area-estado', getHistoricoPorEstadoTM);
router.get('/historico/badge-estado', getHistoricoPorEstadoTM);
router.get('/historico/consultor-estado', getHistoricoPorEstadoTM);
router.get('/historico/candidatura', getHistoricoCandidaturaTM);

export default router;
