import { Router } from 'express';
import {
    loginController,
    modificarContrasenaController,
    registrarUsuarioController,
    solicitarCodigoRegistroController,
    solicitarRecuperacionController,
    verificarCodigoController,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/registro', registrarUsuarioController);
router.post('/registro/codigo', solicitarCodigoRegistroController);
router.post('/recuperar-contrasena', solicitarRecuperacionController);
router.post('/verificar-codigo', verificarCodigoController);
router.post('/modificar-contrasena', modificarContrasenaController);
router.post('/login', loginController);

export default router;
