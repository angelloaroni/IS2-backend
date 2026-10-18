import {Router} from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    agregarTacho,
    editarTacho,
    eliminarTacho,
    obtenerTacho,
    obtenerTachos,
    obtenerTachosCercanos,
} from '../controllers/tacho.controller.js';

const router = Router();

router.get('/', obtenerTachos);
router.get('/cercanos', obtenerTachosCercanos);
router.get('/:id', obtenerTacho);
router.post('/', authorizeRoles('admin'), agregarTacho);
router.put('/:id', authorizeRoles('admin'), editarTacho);
router.delete('/:id', authorizeRoles('admin'), eliminarTacho);

export default router;