import { Router } from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import {
    agregarLogroController,
    obtenerLogrosController,
} from '../controllers/logro.controller.js';

const router = Router();

router.get('/', obtenerLogrosController);
router.post('/', authorizeRoles('admin'), agregarLogroController);

export default router;