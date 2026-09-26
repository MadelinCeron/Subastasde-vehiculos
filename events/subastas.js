import { obtenerConexion, sql } from '../config/db.js';
import { verificarTokenSocket } from '../middleware/autenticacion.js';

let io;

const sala = (id) => `subasta:${id}`;

async function emitirEstadoPersonal(id) {
  const sockets = await io.in(sala(id)).fetchSockets();
  const usuarios = new Map();
  for (const socket of sockets) {
    if (socket.data.usuarioId) {
      if (!usuarios.has(socket.data.usuarioId)) usuarios.set(socket.data.usuarioId, []);
      usuarios.get(socket.data.usuarioId).push(socket);
    }
  }
  if (!usuarios.size) return;

  const pool = await obtenerConexion();
  const lider = await pool.request().input('id', sql.Int, id).query(`
    SELECT TOP (1) UsuarioId AS usuarioId FROM dbo.PujasVehiculo_16776
    WHERE VehiculoId=@id ORDER BY Monto DESC, Id DESC;
  `);
  const liderId = lider.recordset[0]?.usuarioId?.toLowerCase();
  for (const [usuarioId, conexiones] of usuarios) {
    const tieneOferta = await pool.request().input('id', sql.Int, id)
      .input('usuario', sql.UniqueIdentifier, usuarioId)
      .query('SELECT TOP (1) 1 AS existe FROM dbo.PujasVehiculo_16776 WHERE VehiculoId=@id AND UsuarioId=@usuario;');
    if (!tieneOferta.recordset[0]) continue;
    const estado = liderId === usuarioId.toLowerCase() ? 'ganando' : 'superada';
    for (const socket of conexiones) socket.emit('subasta:estado-personal', { estado });
  }
}

export function registrarEventos(socketServer) {
  io = socketServer;
  io.use((socket, next) => {
    try {
      const identidad = verificarTokenSocket(socket.handshake.auth?.token);
      socket.data.usuarioId = identidad?.sub || null;
      next();
    } catch {
      next(new Error('Sesión inválida'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('subasta:unirse', async (valor, confirmacion) => {
      const id = Number(valor);
      if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
        confirmacion?.({ error: 'Identificador inválido.' });
        return;
      }
      socket.join(sala(id));
      try { await emitirEstadoPersonal(id); } catch { /* La conexión sigue siendo útil para los avisos públicos. */ }
      confirmacion?.({ ok: true });
    });
    socket.on('subasta:salir', (valor) => {
      const id = Number(valor);
      if (Number.isInteger(id)) socket.leave(sala(id));
    });
  });
}

export function emitirPuja(id, puja) {
  if (!io) return;
  io.to(sala(id)).emit('subasta:actualizacion', { monto: puja.monto, cantidad: puja.cantidad });
  emitirEstadoPersonal(id).catch(() => {});
}
