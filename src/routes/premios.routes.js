import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    agregarPremioController,
    canjearPremioController,
    obtenerPremiosController,
} from '../controllers/premio.controller.js';

const router = Router();

router.get('/', obtenerPremiosController);
router.post('/', authorizeRoles('admin'), agregarPremioController);
router.post('/:id/canjear', canjearPremioController);

export default router;