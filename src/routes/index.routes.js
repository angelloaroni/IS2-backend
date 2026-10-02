import {Router} from 'express';

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
router.use('/usuarios', usuarioRoutes);
router.use('/residuos', residuosRoutes);
router.use('/residuo', residuoRoutes);
router.use('/premios', premiosRoutes);
router.use('/tachos', tachoRoutes);
router.use('/ranking', rankingRoutes);
router.use('/logros', logrosRoutes);

export default router;
