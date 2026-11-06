import { Router } from 'express';
import authMiddleware, { authorizeRoles } from '../middlewares/auth.middleware.js';
import { materiales, participacion } from '../controllers/dashboard.controller.js';

const router = Router();
router.use(authMiddleware, authorizeRoles('admin'));
router.get('/materiales', materiales);
router.get('/participacion', participacion);
export default router;
