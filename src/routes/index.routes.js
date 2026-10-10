import {Router} from 'express';

import authMiddleware, {authorizeRoles} from '../middlewares/auth.middleware.js';
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

router.use('/usuarios', authMiddleware, authorizeRoles(['admin', 'usuario']), usuarioRoutes);
router.use('/residuos', authMiddleware, authorizeRoles(['admin', 'usuario']), residuosRoutes);
router.use('/residuo', authMiddleware, authorizeRoles(['admin', 'usuario']), residuoRoutes);
router.use('/premios', authMiddleware, authorizeRoles(['admin', 'usuario']), premiosRoutes);
router.use('/tachos', authMiddleware, authorizeRoles(['admin']), tachoRoutes);
router.use('/ranking', authMiddleware, authorizeRoles(['admin', 'usuario']), rankingRoutes);
router.use('/logros', authMiddleware, authorizeRoles(['admin', 'usuario']), logrosRoutes);

export default router;
