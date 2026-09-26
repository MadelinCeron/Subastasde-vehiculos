import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { obtenerConexion, sql } from '../config/db.js';

const cuentas = [
  { nombre: 'Lucía', apellido: 'Méndez', correo: 'lucia.demo@rastro.test', telefono: '+502 5550 1676', password: 'Rastro-Lote-16776-A!' },
  { nombre: 'Mateo', apellido: 'Cifuentes', correo: 'mateo.demo@rastro.test', telefono: '+502 5551 6776', password: 'Rastro-Lote-16776-B!' },
  { nombre: 'Sofía', apellido: 'Paz', correo: 'sofia.demo@rastro.test', telefono: '+502 5552 6776', password: 'Rastro-Lote-16776-C!' }
];

const imagenesPorModelo = {
  'Mustang GT': [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1500&q=85'
  ],
  'RAV4 Adventure': [
    'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1502161254066-6c74afbf07aa?auto=format&fit=crop&w=1500&q=85',
    'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1500&q=85'
  ]
};

async function crearUsuario(pool, cuenta) {
  const existente = await pool.request().input('correo', sql.NVarChar(320), cuenta.correo)
    .query('SELECT Id FROM dbo.Usuarios_16776 WHERE Correo=@correo;');
  if (existente.recordset[0]) return existente.recordset[0].Id;
  const hash = await bcrypt.hash(cuenta.password, 12);
  const result = await pool.request().input('nombre', sql.NVarChar(80), cuenta.nombre)
    .input('apellido', sql.NVarChar(80), cuenta.apellido).input('correo', sql.NVarChar(320), cuenta.correo)
    .input('telefono', sql.NVarChar(40), cuenta.telefono).input('hash', sql.NVarChar(100), hash)
    .query(`INSERT INTO dbo.Usuarios_16776 (Nombre, Apellido, Correo, Telefono, PasswordHash)
      OUTPUT INSERTED.Id VALUES (@nombre, @apellido, @correo, @telefono, @hash);`);
  return result.recordset[0].Id;
}

async function insertarFotos(transaction, vehiculoId, imagenes) {
  const request = new sql.Request(transaction).input('vehiculoId', sql.Int, vehiculoId);
  const values = imagenes.map((url, index) => {
    const urlParam = `foto${index}`;
    const ordenParam = `orden${index}`;
    request.input(urlParam, sql.NVarChar(2048), url).input(ordenParam, sql.TinyInt, index + 1);
    return `(@vehiculoId, @${urlParam}, @${ordenParam})`;
  });
  await request.query(`INSERT INTO dbo.FotosVehiculo_16776 (VehiculoId, Url, Orden) VALUES ${values.join(', ')};`);
}

async function crearLoteDemo(pool, usuarioId, vehicle, index) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const existente = await new sql.Request(transaction).input('modelo', sql.NVarChar(80), vehicle.modelo)
      .query('SELECT TOP (1) Id FROM dbo.Vehiculos_16776 WITH (UPDLOCK, HOLDLOCK) WHERE EsDemo=1 AND Modelo=@modelo;');
    if (existente.recordset[0]) {
      const id = existente.recordset[0].Id;
      await new sql.Request(transaction).input('id', sql.Int, id)
        .query('DELETE FROM dbo.FotosVehiculo_16776 WHERE VehiculoId=@id;');
      await insertarFotos(transaction, id, imagenesPorModelo[vehicle.modelo]);
      await transaction.commit();
      return;
    }
    const inicio = new Date(Date.now() - 60 * 60 * 1000);
    const cierre = new Date(Date.now() + (index + 4) * 24 * 60 * 60 * 1000);
    const inserted = await new sql.Request(transaction).input('usuario', sql.UniqueIdentifier, usuarioId)
      .input('anio', sql.SmallInt, vehicle.anio).input('tipo', sql.NVarChar(40), vehicle.tipo)
      .input('marca', sql.NVarChar(60), vehicle.marca).input('modelo', sql.NVarChar(80), vehicle.modelo)
      .input('motor', sql.NVarChar(60), vehicle.motor).input('transmision', sql.NVarChar(40), vehicle.transmision)
      .input('combustible', sql.NVarChar(40), vehicle.combustible).input('tren', sql.NVarChar(40), vehicle.tren)
      .input('cilindros', sql.TinyInt, vehicle.cilindros).input('dano', sql.NVarChar(12), vehicle.dano)
      .input('base', sql.Decimal(12, 2), vehicle.base).input('inicio', sql.DateTime2, inicio)
      .input('cierre', sql.DateTime2, cierre)
      .query(`INSERT INTO dbo.Vehiculos_16776
        (PublicadorId, Anio, Tipo, Marca, Modelo, Motor, Transmision, Combustible, TrenManejo, Cilindros, Dano, MontoBase, InicioUtc, CierreUtc, EsDemo)
        OUTPUT INSERTED.Id VALUES (@usuario, @anio, @tipo, @marca, @modelo, @motor, @transmision, @combustible, @tren, @cilindros, @dano, @base, @inicio, @cierre, 1);`);
    const id = inserted.recordset[0].Id;
    await insertarFotos(transaction, id, imagenesPorModelo[vehicle.modelo]);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function seed() {
  const pool = await obtenerConexion();
  const ids = [];
  for (const cuenta of cuentas) ids.push(await crearUsuario(pool, cuenta));
  await crearLoteDemo(pool, ids[0], { anio: 2018, tipo: 'Cupé', marca: 'Ford', modelo: 'Mustang GT', motor: '5.0L V8', transmision: 'Manual', combustible: 'Gasolina', tren: 'Tracción trasera', cilindros: 8, dano: 'amarillo', base: 95000 }, 0);
  await crearLoteDemo(pool, ids[1], { anio: 2020, tipo: 'SUV', marca: 'Toyota', modelo: 'RAV4 Adventure', motor: '2.5L', transmision: 'Automática', combustible: 'Gasolina', tren: 'AWD', cilindros: 4, dano: 'verde', base: 78000 }, 1);
  console.log('Seed _16776 listo. Las contraseñas de demostración están documentadas en README.md.');
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  seed().then(async () => (await obtenerConexion()).close()).catch(async (error) => {
    console.error(`Seed fallido (${error.code || error.name || 'unknown'}).`);
    try { await (await obtenerConexion()).close(); } catch {}
    process.exitCode = 1;
  });
}
