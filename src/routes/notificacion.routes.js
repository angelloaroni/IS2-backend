import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    marcarNotificacionesLeidasController,
    notificarSistemaController,
    obtenerNotificacionesController,
} from '../controllers/notificacion.controller.js';

const router = Router();

router.get('/', obtenerNotificacionesController);
router.patch('/leer', marcarNotificacionesLeidasController);
router.post('/sistema', authorizeRoles('admin'), notificarSistemaController);

export default router;