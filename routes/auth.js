import { Router } from 'express';
import { iniciarSesion, perfil, registrar } from '../controllers/authController.js';
import { autenticar } from '../middleware/autenticacion.js';

const router = Router();
router.post('/registro', registrar);
router.post('/login', iniciarSesion);
router.get('/me', autenticar, perfil);
export default router;
