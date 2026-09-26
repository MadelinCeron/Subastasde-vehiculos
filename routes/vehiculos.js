import { Router } from 'express';
import { detalle, editar, listar, misVehiculos, ofertar, publicar } from '../controllers/vehiculosController.js';
import { autenticar } from '../middleware/autenticacion.js';

const router = Router();
router.get('/', listar);
router.get('/mios', autenticar, misVehiculos);
router.post('/', autenticar, publicar);
router.get('/:id', detalle);
router.put('/:id', autenticar, editar);
router.post('/:id/pujas', autenticar, ofertar);
export default router;
