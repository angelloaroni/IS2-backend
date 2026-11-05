import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    actualizarConfiguracionRankingController,
    obtenerConfiguracionRankingController,
    obtenerRankingController,
    obtenerRecicladorMesController,
} from '../controllers/ranking.controller.js';

const router = Router();

router.get('/config', authorizeRoles('admin'), obtenerConfiguracionRankingController);
router.put('/config', authorizeRoles('admin'), actualizarConfiguracionRankingController);
router.get('/reciclador-mes', obtenerRecicladorMesController);
router.get('/', obtenerRankingController);

export default router;