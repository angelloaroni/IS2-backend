import { Router } from 'express';
import { registrarUsuarioController, loginController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/registro', registrarUsuarioController);
router.post('/login', loginController);

export default router;