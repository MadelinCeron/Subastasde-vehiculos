import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { Server } from 'socket.io';
import { io as conectarSocket } from 'socket.io-client';

process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
const { crearAplicacion } = await import('../app.js');
const { obtenerConexion, sql } = await import('../config/db.js');
const { registrarEventos } = await import('../events/subastas.js');
const { migrar } = await import('../database/migrate.js');
const { seed } = await import('../database/seed.js');

let servidor;
let io;
let origen;
const vehiculosPrueba = [];
const usuariosPrueba = [];
const sockets = [];

function escuchar(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

async function pedir(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(origen + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, data: await response.json() };
}

async function crearCuenta(etiqueta) {
  const correo = `${etiqueta}-${randomBytes(6).toString('hex')}@rastro.test`;
  const result = await pedir('/api/auth/registro', {
    method: 'POST',
    body: { nombre: 'Prueba', apellido: etiqueta, correo, telefono: '+502 5555 1677', password: 'Prueba-Rastro-16776!' }
  });
  assert.equal(result.status, 201);
  usuariosPrueba.push(result.data.usuario.id);
  return { token: result.data.token, usuario: result.data.usuario, correo, password: 'Prueba-Rastro-16776!' };
}

function vehiculo({ marca = 'Honda', modelo = 'Civic Test', inicio = new Date(Date.now() - 60000), cierre = new Date(Date.now() + 3600000) } = {}) {
  return {
    anio: 2021, tipo: 'Sedán', marca, modelo, motor: '2.0L', transmision: 'Automática',
    combustible: 'Gasolina', trenManejo: 'FWD', cilindros: 4, dano: 'verde', montoBase: 1000,
    inicioUtc: inicio.toISOString(), cierreUtc: cierre.toISOString(),
    fotos: Array.from({ length: 5 }, (_, index) => `https://images.example.test/${index + 1}.jpg`)
  };
}

function conectar(token) {
  return new Promise((resolve, reject) => {
    const socket = conectarSocket(origen, { auth: { token }, transports: ['websocket'], reconnection: false });
    const timer = setTimeout(() => reject(new Error('Socket.IO no conectó a tiempo.')), 4000);
    socket.once('connect', () => { clearTimeout(timer); sockets.push(socket); resolve(socket); });
    socket.once('connect_error', reject);
  });
}

function esperarEvento(socket, nombre) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No llegó el evento ${nombre}.`)), 4000);
    socket.once(nombre, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function unirse(socket, id) {
  return new Promise((resolve, reject) => {
    socket.emit('subasta:unirse', id, (respuesta) => respuesta?.ok ? resolve() : reject(new Error(respuesta?.error || 'No se pudo unir a la sala.')));
  });
}

before(async () => {
  await migrar();
  await seed();
  servidor = createServer(crearAplicacion());
  io = new Server(servidor);
  registrarEventos(io);
  origen = `http://127.0.0.1:${await escuchar(servidor)}`;
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (io) await new Promise((resolve) => io.close(resolve));
  else if (servidor?.listening) await new Promise((resolve) => servidor.close(resolve));
  if (!vehiculosPrueba.length && !usuariosPrueba.length) return;
  const pool = await obtenerConexion();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    for (const id of vehiculosPrueba) {
      await new sql.Request(transaction).input('id', sql.Int, id).query('DELETE FROM dbo.PujasVehiculo_16776 WHERE VehiculoId=@id; DELETE FROM dbo.Vehiculos_16776 WHERE Id=@id;');
    }
    for (const id of usuariosPrueba) {
      await new sql.Request(transaction).input('id', sql.UniqueIdentifier, id).query('DELETE FROM dbo.Usuarios_16776 WHERE Id=@id;');
    }
    await transaction.commit();
    await pool.close();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

test('autenticación, filtros, edición, reglas de oferta y dos clientes en vivo', async () => {
  const health = await pedir('/api/salud');
  assert.equal(health.status, 200);

  for (const [id, ruta] of [
    [1, '/images/demo/2018-ford-mustang-gt/'],
    [2, '/images/demo/2020-toyota-rav4-adventure/']
  ]) {
    const demo = (await pedir(`/api/vehiculos/${id}`)).data.vehiculo;
    assert.equal(demo.fotos.length, 5);
    assert.equal(new Set(demo.fotos).size, 5);
    assert.ok(demo.fotos.every((foto) => foto.startsWith(ruta)));
    const placeholder = await fetch(origen + demo.fotos[0]);
    assert.equal(placeholder.status, 200);
    assert.match(placeholder.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(await placeholder.text(), /FOTO REAL PENDIENTE/);
  }

  const a = await crearCuenta('CompradorA');
  const b = await crearCuenta('CompradorB');
  const login = await pedir('/api/auth/login', { method: 'POST', body: { correo: a.correo, password: a.password } });
  assert.equal(login.status, 200);
  assert.equal(Object.hasOwn(login.data.usuario, 'PasswordHash'), false);

  for (const [correo, password] of [
    ['lucia.demo@rastro.test', 'Rastro-Lote-16776-A!'],
    ['mateo.demo@rastro.test', 'Rastro-Lote-16776-B!'],
    ['sofia.demo@rastro.test', 'Rastro-Lote-16776-C!']
  ]) assert.equal((await pedir('/api/auth/login', { method: 'POST', body: { correo, password } })).status, 200);

  const body = vehiculo();
  assert.equal((await pedir('/api/vehiculos', { method: 'POST', body })).status, 401);
  assert.equal((await pedir('/api/vehiculos', { token: a.token, method: 'POST', body: { ...body, fotos: body.fotos.slice(0, 4) } })).status, 400);
  const created = await pedir('/api/vehiculos', { token: a.token, method: 'POST', body });
  assert.equal(created.status, 201);
  const id = created.data.id;
  vehiculosPrueba.push(id);

  const filtro = await pedir('/api/vehiculos?marca=Honda&anio=2021&transmision=Autom%C3%A1tica&cilindros=4&dano=verde');
  assert.ok(filtro.data.vehiculos.some((item) => item.id === id));
  const filtroInvalido = await pedir('/api/vehiculos?anio=no-es-numero');
  assert.equal(filtroInvalido.status, 200);
  assert.ok((await pedir('/api/vehiculos/mios', { token: a.token })).data.vehiculos.some((item) => item.id === id));

  const loaded = await pedir(`/api/vehiculos/${id}`);
  assert.equal(loaded.data.vehiculo.fotos.length, 5);
  assert.equal(JSON.stringify(loaded.data.vehiculo).includes(a.correo), false);
  const bodyEditado = { ...body, modelo: 'Civic Revisado', inicioUtc: new Date(loaded.data.vehiculo.inicioUtc).toISOString(), cierreUtc: new Date(loaded.data.vehiculo.cierreUtc).toISOString() };
  assert.equal((await pedir(`/api/vehiculos/${id}`, { token: a.token, method: 'PUT', body: bodyEditado })).status, 200);
  assert.equal((await pedir(`/api/vehiculos/${id}`, { token: b.token, method: 'PUT', body: bodyEditado })).status, 404);

  const baseOferta = await pedir(`/api/vehiculos/${id}/pujas`, { token: a.token, method: 'POST', body: { monto: 1000 } });
  assert.equal(baseOferta.status, 409);
  const socketA = await conectar(a.token);
  const socketB = await conectar(b.token);
  await Promise.all([unirse(socketA, id), unirse(socketB, id)]);
  const publicA = esperarEvento(socketA, 'subasta:actualizacion');
  const publicB = esperarEvento(socketB, 'subasta:actualizacion');
  const personalA = esperarEvento(socketA, 'subasta:estado-personal');
  const firstBid = await pedir(`/api/vehiculos/${id}/pujas`, { token: a.token, method: 'POST', body: { monto: 1000.01 } });
  assert.equal(firstBid.status, 201);
  const [eventA, eventB, stateA] = await Promise.all([publicA, publicB, personalA]);
  assert.deepEqual(eventA, { monto: 1000.01, cantidad: 1 });
  assert.deepEqual(eventB, eventA);
  assert.deepEqual(Object.keys(eventA).sort(), ['cantidad', 'monto']);
  assert.equal(stateA.estado, 'ganando');

  assert.equal((await pedir(`/api/vehiculos/${id}/pujas`, { token: b.token, method: 'POST', body: { monto: 1100.01 } })).status, 409);
  const outbidA = esperarEvento(socketA, 'subasta:estado-personal');
  const winningB = esperarEvento(socketB, 'subasta:estado-personal');
  const secondBid = await pedir(`/api/vehiculos/${id}/pujas`, { token: b.token, method: 'POST', body: { monto: 1100.02 } });
  assert.equal(secondBid.status, 201);
  assert.equal((await outbidA).estado, 'superada');
  assert.equal((await winningB).estado, 'ganando');

  const montoRival = 1210.03;
  const racingOffers = await Promise.all([
    pedir(`/api/vehiculos/${id}/pujas`, { token: a.token, method: 'POST', body: { monto: montoRival } }),
    pedir(`/api/vehiculos/${id}/pujas`, { token: b.token, method: 'POST', body: { monto: montoRival } })
  ]);
  assert.deepEqual(racingOffers.map((item) => item.status).sort(), [201, 409]);
  const publicDetail = await pedir(`/api/vehiculos/${id}`);
  assert.equal(publicDetail.data.vehiculo.cantidadPujas, 3);

  const termsChanged = { ...bodyEditado, montoBase: 1100 };
  assert.equal((await pedir(`/api/vehiculos/${id}`, { token: a.token, method: 'PUT', body: termsChanged })).status, 409);

  const expired = await pedir('/api/vehiculos', { token: a.token, method: 'POST', body: vehiculo({ modelo: 'Civic Vencido', inicio: new Date(Date.now() - 3600000), cierre: new Date(Date.now() - 60000) }) });
  assert.equal(expired.status, 201);
  vehiculosPrueba.push(expired.data.id);
  assert.equal((await pedir(`/api/vehiculos/${expired.data.id}/pujas`, { token: a.token, method: 'POST', body: { monto: 1001 } })).status, 409);
  assert.equal((await pedir(`/api/vehiculos/${expired.data.id}`)).data.vehiculo.desierta, 1);

  const upcoming = await pedir('/api/vehiculos', { token: a.token, method: 'POST', body: vehiculo({ modelo: 'Civic Futuro', inicio: new Date(Date.now() + 3600000), cierre: new Date(Date.now() + 7200000) }) });
  assert.equal(upcoming.status, 201);
  vehiculosPrueba.push(upcoming.data.id);
  assert.equal((await pedir(`/api/vehiculos/${upcoming.data.id}/pujas`, { token: b.token, method: 'POST', body: { monto: 1001 } })).status, 409);
});
