import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    agregarPremioController,
    editarPremioController,
    eliminarPremioController,
    canjearPremioController,
    obtenerPremiosController,
} from '../controllers/premio.controller.js';

const router = Router();

router.get('/', obtenerPremiosController);
router.post('/', authorizeRoles('admin'), agregarPremioController);
router.put('/:id', authorizeRoles('admin'), editarPremioController);
router.delete('/:id', authorizeRoles('admin'), eliminarPremioController);
router.post('/:id/canjear', canjearPremioController);

export default router;
