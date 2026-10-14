import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    bloquearUsuarioController,
    obtenerUsuarioController,
} from '../controllers/usuario.controller.js';

const router = Router();

router.get('/', obtenerUsuarioController);
router.delete('/:id', authorizeRoles('admin'), bloquearUsuarioController);

export default router;