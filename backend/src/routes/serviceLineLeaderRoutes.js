import { Router } from 'express';
import {
  getMyServiceLine,
  getRankingConsultoresSLL,
  getHistoricoAreasSLL,
  getHistoricoBadgesSLL,
  getHistoricoConsultoresSLL,
  getDetalhesConsultorSLL,
  getDetalhesBadgeSLL,
  getHistoricoPorEstado,
} from '../controllers/serviceLineLeaderController.js';

const router = Router();

router.get('/minha-service-line', getMyServiceLine);
router.get('/ranking', getRankingConsultoresSLL);
router.get('/historico/areas', getHistoricoAreasSLL);
router.get('/historico/badges', getHistoricoBadgesSLL);
router.get('/historico/consultores', getHistoricoConsultoresSLL);
router.get('/historico/consultor', getDetalhesConsultorSLL);
router.get('/historico/badge', getDetalhesBadgeSLL);

// Rotas para histórico por estado
router.get('/historico/service-line', getHistoricoPorEstado);
router.get('/historico/area', getHistoricoPorEstado);
router.get('/historico/badge-estado', getHistoricoPorEstado);
router.get('/historico/consultor-estado', getHistoricoPorEstado);

export default router;
