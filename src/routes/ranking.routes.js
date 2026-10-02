import {Router} from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

//para hacer pruebas

/* router.get('/_debug-auth', (req, res) => {
  return res.json({ usuario: req.usuario });
});
 */

router.get('/', authMiddleware, (req, res) => {
    
});


export default router;