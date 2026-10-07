import {Router} from 'express';
import { registrarResiduo } from '../controllers/residuo.controller.js';

const router = Router();

router.post('/registrar-residuo', registrarResiduo);

export default router;