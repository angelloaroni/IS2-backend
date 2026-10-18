import {Router} from 'express';
import { registrarResiduo } from '../controllers/residuo.controller.js';

const router = Router();

router.post('/', registrarResiduo);

export default router;