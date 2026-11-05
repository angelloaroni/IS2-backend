import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    actualizarPerfilController,
    actualizarUsuarioAdminController,
    bloquearUsuarioController,
    listarUsuariosAdminController,
    obtenerUsuarioAdminController,
    obtenerUsuarioController,
} from '../controllers/usuario.controller.js';
import {
    obtenerHistorialController,
    obtenerMetricasController,
} from '../controllers/historialReciclaje.controller.js';

const router = Router();

router.get('/admin', authorizeRoles('admin'), listarUsuariosAdminController);
router.get('/admin/:id', authorizeRoles('admin'), obtenerUsuarioAdminController);
router.patch('/admin/:id', authorizeRoles('admin'), actualizarUsuarioAdminController);
router.get('/', obtenerUsuarioController);
router.get('/me/historial', obtenerHistorialController);
router.get('/me/metricas', obtenerMetricasController);
router.patch('/me', actualizarPerfilController);
router.delete('/:id', authorizeRoles('admin'), bloquearUsuarioController);

export default router;