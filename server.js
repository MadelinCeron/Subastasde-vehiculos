import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { crearAplicacion } from './app.js';
import { obtenerConexion } from './config/db.js';
import { obtenerSecreto } from './middleware/autenticacion.js';
import { registrarEventos } from './events/subastas.js';

const puerto = Number(process.env.PORT || 3000);

try {
  obtenerSecreto();
  const pool = await obtenerConexion();
  await pool.request().query('SELECT 1 AS ok;');

  const servidor = createServer(crearAplicacion());
  const io = new Server(servidor, { cors: { origin: process.env.CORS_ORIGIN || true } });
  registrarEventos(io);
  servidor.listen(puerto, '0.0.0.0', () => console.log(`Subastas 16776 escuchando en puerto ${puerto}.`));
} catch (error) {
  console.error(`No se pudo iniciar la aplicación (${error.code || error.name || 'unknown'}). Revisá las variables de entorno.`);
  process.exitCode = 1;
}
