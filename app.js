import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRouter from './routes/auth.js';
import saludRouter from './routes/salud.js';
import vehiculosRouter from './routes/vehiculos.js';
import { manejarError } from './middleware/errores.js';

const frontendPath = fileURLToPath(new URL('./dist/', import.meta.url));
const fotosDemo = {
  '2018-ford-mustang-gt': {
    nombre: 'Ford Mustang GT · 2018',
    tomas: {
      '01-front-left.jpg': 'Frontal izquierda',
      '02-left-side.jpg': 'Lateral izquierdo',
      '03-front-right.jpg': 'Frontal derecha',
      '04-rear.jpg': 'Parte trasera',
      '05-interior.jpg': 'Interior'
    }
  },
  '2020-toyota-rav4-adventure': {
    nombre: 'Toyota RAV4 Adventure · 2020',
    tomas: {
      '01-front-left.jpg': 'Frontal izquierda',
      '02-left-side.jpg': 'Lateral izquierdo',
      '03-front-right.jpg': 'Frontal derecha',
      '04-rear.jpg': 'Parte trasera',
      '05-interior.jpg': 'Interior'
    }
  }
};

function responderFotoPendiente(req, res, next) {
  const lote = fotosDemo[req.params.lote];
  const toma = lote?.tomas[req.params.archivo];
  if (!toma) return next();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#e9ede3"/>
    <path d="M0 610h1200v190H0z" fill="#dce4d3"/>
    <rect x="64" y="64" width="1072" height="672" fill="none" stroke="#bbc7b2" stroke-width="2"/>
    <text x="600" y="330" text-anchor="middle" fill="#39443e" font-family="Arial,sans-serif" font-size="34" font-weight="700">FOTO REAL PENDIENTE</text>
    <text x="600" y="390" text-anchor="middle" fill="#58655d" font-family="Arial,sans-serif" font-size="27">${lote.nombre}</text>
    <text x="600" y="445" text-anchor="middle" fill="#58655d" font-family="Arial,sans-serif" font-size="23">${toma}</text>
    <text x="600" y="505" text-anchor="middle" fill="#7b867e" font-family="Arial,sans-serif" font-size="18">No representa una imagen del vehículo</text>
  </svg>`;
  res.status(200).type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
}

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
    app.get('/images/demo/:lote/:archivo', responderFotoPendiente);
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(fileURLToPath(new URL('./dist/index.html', import.meta.url))));
  }

  app.use((_req, res) => res.status(404).json({ error: 'No encontramos esa ruta.' }));
  app.use(manejarError);
  return app;
}
