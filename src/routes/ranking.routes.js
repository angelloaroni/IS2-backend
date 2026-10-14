import { Router } from 'express';
import { obtenerRankingController } from '../controllers/ranking.controller.js';

const router = Router();

router.get('/', obtenerRankingController);

export default router;