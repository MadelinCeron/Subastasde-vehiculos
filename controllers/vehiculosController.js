import { crearPuja, crearVehiculo, editarVehiculo, listarMios, listarVehiculos, obtenerVehiculo } from '../services/vehiculosService.js';
import { emitirPuja } from '../events/subastas.js';

export async function listar(req, res, next) {
  try { res.json({ vehiculos: await listarVehiculos(req) }); } catch (error) { next(error); }
}

export async function misVehiculos(req, res, next) {
  try { res.json({ vehiculos: await listarMios(req.usuario.sub) }); } catch (error) { next(error); }
}

export async function detalle(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
    const vehiculo = await obtenerVehiculo(id);
    if (!vehiculo) return res.status(404).json({ error: 'No encontramos ese vehículo.' });
    res.json({ vehiculo });
  } catch (error) { next(error); }
}

export async function publicar(req, res, next) {
  try {
    const resultado = await crearVehiculo(req.body, req.usuario.sub);
    if (resultado.errores) return res.status(400).json({ error: resultado.errores.join(' ') });
    res.status(201).json({ id: resultado.id });
  } catch (error) { next(error); }
}

export async function editar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
    const resultado = await editarVehiculo(id, req.body, req.usuario.sub);
    if (resultado.errores) return res.status(400).json({ error: resultado.errores.join(' ') });
    if (resultado.noEditable) return res.status(404).json({ error: 'La publicación no existe o no es tuya.' });
    if (resultado.terminosBloqueados) return res.status(409).json({ error: 'Con ofertas activas no se pueden cambiar el monto base ni las fechas.' });
    res.json({ id: resultado.id });
  } catch (error) { next(error); }
}

export async function ofertar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
    const resultado = await crearPuja(id, req.body.monto, req.usuario.sub);
    if (resultado.noExiste) return res.status(404).json({ error: 'No encontramos esa subasta.' });
    if (resultado.error) return res.status(409).json({ error: resultado.error, montoMinimo: resultado.montoMinimo });
    emitirPuja(id, resultado);
    res.status(201).json({ monto: resultado.monto, cantidad: resultado.cantidad });
  } catch (error) { next(error); }
}
