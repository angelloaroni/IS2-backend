import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    bloquearUsuarioController,
    obtenerUsuarioController,
} from '../controllers/usuario.controller.js';
import {
    obtenerHistorialController,
    obtenerMetricasController,
} from '../controllers/historialReciclaje.controller.js';

const router = Router();

router.get('/', obtenerUsuarioController);
router.get('/me/historial', obtenerHistorialController);
router.get('/me/metricas', obtenerMetricasController);
router.delete('/:id', authorizeRoles('admin'), bloquearUsuarioController);

export default router;