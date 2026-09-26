import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRouter from './routes/auth.js';
import saludRouter from './routes/salud.js';
import vehiculosRouter from './routes/vehiculos.js';
import { manejarError } from './middleware/errores.js';

const frontendPath = fileURLToPath(new URL('./dist/', import.meta.url));

export function crearAplicacion() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
  app.use(express.json({ limit: '128kb' }));
  app.use('/api/salud', saludRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/vehiculos', vehiculosRouter);

  if (existsSync(frontendPath)) {
    app.use(express.static(frontendPath, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(fileURLToPath(new URL('./dist/index.html', import.meta.url))));
  }

  app.use((_req, res) => res.status(404).json({ error: 'No encontramos esa ruta.' }));
  app.use(manejarError);
  return app;
}
