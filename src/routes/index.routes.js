import {Router} from 'express';

import authMiddleware from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import usuarioRoutes from './usuario.routes.js';
import residuosRoutes from './residuos.routes.js';
import residuoRoutes from './residuo.routes.js';
import premiosRoutes from './premios.routes.js';
import tachoRoutes from './tacho.routes.js';
import rankingRoutes from './ranking.routes.js';
import logrosRoutes from './logro.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', authMiddleware, usuarioRoutes);
router.use('/residuos', authMiddleware, residuosRoutes);
router.use('/residuo', authMiddleware, residuoRoutes);
router.use('/premios', authMiddleware, premiosRoutes);
router.use('/tachos', authMiddleware, tachoRoutes);
router.use('/ranking', authMiddleware, rankingRoutes);
router.use('/logros', authMiddleware, logrosRoutes);

export default router;
