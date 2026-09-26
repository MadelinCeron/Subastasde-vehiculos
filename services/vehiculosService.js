import { obtenerConexion, sql } from '../config/db.js';
import { validarVehiculo } from './validacionVehiculo.js';

const columnasFiltro = {
  anio: ['v.Anio', true],
  tipo: ['v.Tipo', false],
  marca: ['v.Marca', false],
  modelo: ['v.Modelo', false],
  motor: ['v.Motor', false],
  transmision: ['v.Transmision', false],
  combustible: ['v.Combustible', false],
  trenManejo: ['v.TrenManejo', false],
  cilindros: ['v.Cilindros', true],
  dano: ['v.Dano', false]
};

function filtros(req) {
  const condiciones = [];
  const consulta = (req.query.q || '').toString().trim();
  const parametros = [];
  if (consulta) {
    condiciones.push('(v.Marca LIKE @busqueda OR v.Modelo LIKE @busqueda OR v.Tipo LIKE @busqueda)');
    parametros.push((request) => request.input('busqueda', sql.NVarChar(180), `%${consulta.slice(0, 60)}%`));
  }
  for (const [clave, valor] of Object.entries(req.query)) {
    const definicion = columnasFiltro[clave];
    if (!definicion || !String(valor).trim()) continue;
    const [columna, numerica] = definicion;
    const dato = numerica ? Number(valor) : `%${String(valor).trim().slice(0, 60)}%`;
    if (numerica && !Number.isFinite(dato)) continue;
    const nombre = `f_${clave}`;
    condiciones.push(`${columna} ${numerica ? '=' : 'LIKE'} @${nombre}`);
    parametros.push((request) => request.input(nombre, numerica ? sql.Int : sql.NVarChar(80), dato));
  }
  return { condiciones, parametros };
}

function aplicarParametros(request, parametros) {
  for (const aplicar of parametros) aplicar(request);
  return request;
}

async function insertarFotos(transaction, vehiculoId, fotos) {
  const request = new sql.Request(transaction).input('vehiculoId', sql.Int, vehiculoId);
  const values = fotos.map((url, index) => {
    const urlParam = `foto${index}`;
    const ordenParam = `orden${index}`;
    request.input(urlParam, sql.NVarChar(2048), url).input(ordenParam, sql.TinyInt, index + 1);
    return `(@vehiculoId, @${urlParam}, @${ordenParam})`;
  });
  await request.query(`INSERT INTO dbo.FotosVehiculo_16776 (VehiculoId, Url, Orden) VALUES ${values.join(', ')};`);
}

export async function listarVehiculos(req) {
  const pool = await obtenerConexion();
  const { condiciones, parametros } = filtros(req);
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const request = aplicarParametros(pool.request(), parametros);
  const result = await request.query(`
    SELECT TOP (100)
      v.Id AS id, v.Anio AS anio, v.Tipo AS tipo, v.Marca AS marca, v.Modelo AS modelo,
      v.Motor AS motor, v.Transmision AS transmision, v.Combustible AS combustible,
      v.TrenManejo AS trenManejo, v.Cilindros AS cilindros, v.Dano AS dano,
      v.MontoBase AS montoBase, COALESCE(v.OfertaActual, v.MontoBase) AS ofertaActual,
      v.InicioUtc AS inicioUtc, v.CierreUtc AS cierreUtc,
      CASE WHEN v.CierreUtc <= SYSUTCDATETIME() THEN N'cerrada'
           WHEN v.InicioUtc > SYSUTCDATETIME() THEN N'programada' ELSE N'abierta' END AS estado,
      (SELECT TOP (1) f.Url FROM dbo.FotosVehiculo_16776 f WHERE f.VehiculoId = v.Id ORDER BY f.Orden) AS foto,
      (SELECT COUNT(*) FROM dbo.PujasVehiculo_16776 p WHERE p.VehiculoId = v.Id) AS cantidadPujas
    FROM dbo.Vehiculos_16776 v
    ${where}
    ORDER BY CASE WHEN v.CierreUtc > SYSUTCDATETIME() THEN 0 ELSE 1 END, v.CierreUtc ASC, v.Id DESC;
  `);
  return result.recordset;
}

export async function listarMios(usuarioId) {
  const pool = await obtenerConexion();
  const result = await pool.request().input('usuarioId', sql.UniqueIdentifier, usuarioId).query(`
    SELECT v.Id AS id, v.Anio AS anio, v.Tipo AS tipo, v.Marca AS marca, v.Modelo AS modelo,
      v.MontoBase AS montoBase, COALESCE(v.OfertaActual, v.MontoBase) AS ofertaActual,
      v.InicioUtc AS inicioUtc, v.CierreUtc AS cierreUtc,
      (SELECT TOP (1) f.Url FROM dbo.FotosVehiculo_16776 f WHERE f.VehiculoId = v.Id ORDER BY f.Orden) AS foto,
      (SELECT COUNT(*) FROM dbo.PujasVehiculo_16776 p WHERE p.VehiculoId = v.Id) AS cantidadPujas
    FROM dbo.Vehiculos_16776 v WHERE v.PublicadorId = @usuarioId ORDER BY v.CreadoUtc DESC;
  `);
  return result.recordset;
}

export async function obtenerVehiculo(id) {
  const pool = await obtenerConexion();
  const result = await pool.request().input('id', sql.Int, id).query(`
    SELECT v.Id AS id, v.Anio AS anio, v.Tipo AS tipo, v.Marca AS marca, v.Modelo AS modelo,
      v.Motor AS motor, v.Transmision AS transmision, v.Combustible AS combustible,
      v.TrenManejo AS trenManejo, v.Cilindros AS cilindros, v.Dano AS dano,
      v.MontoBase AS montoBase, COALESCE(v.OfertaActual, v.MontoBase) AS ofertaActual,
      v.InicioUtc AS inicioUtc, v.CierreUtc AS cierreUtc,
      CASE WHEN v.CierreUtc <= SYSUTCDATETIME() THEN N'cerrada'
           WHEN v.InicioUtc > SYSUTCDATETIME() THEN N'programada' ELSE N'abierta' END AS estado,
      (SELECT COUNT(*) FROM dbo.PujasVehiculo_16776 p WHERE p.VehiculoId = v.Id) AS cantidadPujas,
      CASE WHEN v.CierreUtc <= SYSUTCDATETIME() AND NOT EXISTS (SELECT 1 FROM dbo.PujasVehiculo_16776 p WHERE p.VehiculoId = v.Id) THEN 1 ELSE 0 END AS desierta
    FROM dbo.Vehiculos_16776 v WHERE v.Id = @id;
  `);
  const vehiculo = result.recordset[0];
  if (!vehiculo) return null;
  const fotos = await pool.request().input('id', sql.Int, id)
    .query('SELECT Url AS url FROM dbo.FotosVehiculo_16776 WHERE VehiculoId = @id ORDER BY Orden;');
  vehiculo.fotos = fotos.recordset.map((foto) => foto.url);
  return vehiculo;
}

export async function crearVehiculo(body, usuarioId) {
  const validacion = validarVehiculo(body);
  if (validacion.errores) return { errores: validacion.errores };
  const { datos } = validacion;
  const pool = await obtenerConexion();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await new sql.Request(transaction)
      .input('usuario', sql.UniqueIdentifier, usuarioId)
      .input('anio', sql.SmallInt, datos.anio)
      .input('tipo', sql.NVarChar(40), datos.tipo)
      .input('marca', sql.NVarChar(60), datos.marca)
      .input('modelo', sql.NVarChar(80), datos.modelo)
      .input('motor', sql.NVarChar(60), datos.motor)
      .input('transmision', sql.NVarChar(40), datos.transmision)
      .input('combustible', sql.NVarChar(40), datos.combustible)
      .input('trenManejo', sql.NVarChar(40), datos.trenManejo)
      .input('cilindros', sql.TinyInt, datos.cilindros)
      .input('dano', sql.NVarChar(12), datos.dano)
      .input('base', sql.Decimal(12, 2), datos.montoBase)
      .input('inicio', sql.DateTime2, new Date(datos.inicio))
      .input('cierre', sql.DateTime2, new Date(datos.cierre))
      .query(`
        INSERT INTO dbo.Vehiculos_16776
          (PublicadorId, Anio, Tipo, Marca, Modelo, Motor, Transmision, Combustible, TrenManejo, Cilindros, Dano, MontoBase, InicioUtc, CierreUtc)
        OUTPUT INSERTED.Id VALUES
          (@usuario, @anio, @tipo, @marca, @modelo, @motor, @transmision, @combustible, @trenManejo, @cilindros, @dano, @base, @inicio, @cierre);
      `);
    const id = result.recordset[0].Id;
    await insertarFotos(transaction, id, datos.fotos);
    await transaction.commit();
    return { id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function editarVehiculo(id, body, usuarioId) {
  const validacion = validarVehiculo(body);
  if (validacion.errores) return { errores: validacion.errores };
  const { datos } = validacion;
  const pool = await obtenerConexion();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const existente = await new sql.Request(transaction).input('id', sql.Int, id)
      .input('usuario', sql.UniqueIdentifier, usuarioId).query(`
        SELECT v.Id, v.MontoBase, v.InicioUtc, v.CierreUtc,
          CASE WHEN EXISTS (SELECT 1 FROM dbo.PujasVehiculo_16776 p WHERE p.VehiculoId = v.Id) THEN 1 ELSE 0 END AS TienePujas
        FROM dbo.Vehiculos_16776 v WITH (UPDLOCK, HOLDLOCK)
        WHERE v.Id = @id AND v.PublicadorId = @usuario;
      `);
    const publicacion = existente.recordset[0];
    if (!publicacion) {
      await transaction.rollback();
      return { noEditable: true };
    }
    if (publicacion.TienePujas && (
      Math.round(Number(publicacion.MontoBase) * 100) !== Math.round(datos.montoBase * 100)
      || publicacion.InicioUtc.getTime() !== new Date(datos.inicio).getTime()
      || publicacion.CierreUtc.getTime() !== new Date(datos.cierre).getTime()
    )) {
      await transaction.rollback();
      return { terminosBloqueados: true };
    }
    await new sql.Request(transaction)
      .input('id', sql.Int, id).input('anio', sql.SmallInt, datos.anio)
      .input('tipo', sql.NVarChar(40), datos.tipo).input('marca', sql.NVarChar(60), datos.marca)
      .input('modelo', sql.NVarChar(80), datos.modelo).input('motor', sql.NVarChar(60), datos.motor)
      .input('transmision', sql.NVarChar(40), datos.transmision).input('combustible', sql.NVarChar(40), datos.combustible)
      .input('trenManejo', sql.NVarChar(40), datos.trenManejo).input('cilindros', sql.TinyInt, datos.cilindros)
      .input('dano', sql.NVarChar(12), datos.dano).input('base', sql.Decimal(12, 2), datos.montoBase)
      .input('inicio', sql.DateTime2, new Date(datos.inicio)).input('cierre', sql.DateTime2, new Date(datos.cierre))
      .query(`UPDATE dbo.Vehiculos_16776 SET Anio=@anio, Tipo=@tipo, Marca=@marca, Modelo=@modelo, Motor=@motor,
        Transmision=@transmision, Combustible=@combustible, TrenManejo=@trenManejo, Cilindros=@cilindros,
        Dano=@dano, MontoBase=@base, InicioUtc=@inicio, CierreUtc=@cierre WHERE Id=@id;`);
    await new sql.Request(transaction).input('id', sql.Int, id).query('DELETE FROM dbo.FotosVehiculo_16776 WHERE VehiculoId=@id;');
    await insertarFotos(transaction, id, datos.fotos);
    await transaction.commit();
    return { id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function crearPuja(id, monto, usuarioId) {
  const oferta = Number(monto);
  if (!Number.isFinite(oferta) || oferta <= 0 || oferta >= 10000000000) return { error: 'La oferta debe ser un monto positivo válido.' };
  const montoCentavos = Math.round(oferta * 100);
  const pool = await obtenerConexion();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const subasta = await new sql.Request(transaction).input('id', sql.Int, id).query(`
      SELECT Id, MontoBase, OfertaActual, InicioUtc, CierreUtc, SYSUTCDATETIME() AS AhoraUtc
      FROM dbo.Vehiculos_16776 WITH (UPDLOCK, HOLDLOCK) WHERE Id=@id;
    `);
    const vehiculo = subasta.recordset[0];
    if (!vehiculo) {
      await transaction.rollback();
      return { noExiste: true };
    }
    const ahora = vehiculo.AhoraUtc;
    if (vehiculo.InicioUtc > ahora) {
      await transaction.rollback();
      return { error: 'La subasta todavía no inició.' };
    }
    if (vehiculo.CierreUtc <= ahora) {
      await transaction.rollback();
      return { error: 'La subasta ya finalizó.' };
    }
    const actual = vehiculo.OfertaActual == null ? null : Math.round(Number(vehiculo.OfertaActual) * 100);
    const minimo = actual == null ? Math.round(Number(vehiculo.MontoBase) * 100) + 1 : Math.ceil(actual * 1.1);
    if (montoCentavos < minimo) {
      await transaction.rollback();
      return { montoMinimo: minimo / 100, error: actual == null ? 'La primera oferta debe superar el monto base.' : 'La oferta debe superar la actual en al menos 10%.' };
    }
    const montoFinal = montoCentavos / 100;
    await new sql.Request(transaction).input('id', sql.Int, id)
      .input('usuario', sql.UniqueIdentifier, usuarioId).input('monto', sql.Decimal(12, 2), montoFinal)
      .query('INSERT INTO dbo.PujasVehiculo_16776 (VehiculoId, UsuarioId, Monto) VALUES (@id, @usuario, @monto);');
    await new sql.Request(transaction).input('id', sql.Int, id).input('monto', sql.Decimal(12, 2), montoFinal)
      .query('UPDATE dbo.Vehiculos_16776 SET OfertaActual=@monto WHERE Id=@id;');
    const total = await new sql.Request(transaction).input('id', sql.Int, id)
      .query('SELECT COUNT(*) AS cantidad FROM dbo.PujasVehiculo_16776 WHERE VehiculoId=@id;');
    await transaction.commit();
    return { id, monto: montoFinal, cantidad: Number(total.recordset[0].cantidad) };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
