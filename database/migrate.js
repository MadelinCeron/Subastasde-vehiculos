import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { obtenerConexion } from '../config/db.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export async function migrar() {
  const pool = await obtenerConexion();
  const permissions = await pool.request().query(`
    SELECT
      HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS PuedeCrear,
      HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER') AS PuedeAlterar;
  `);
  const permission = permissions.recordset[0];
  if (permission.PuedeCrear !== 1 || permission.PuedeAlterar !== 1) {
    throw new Error('El usuario SQL no tiene permisos para crear las tablas nuevas en dbo.');
  }

  const schema = await readFile(schemaPath, 'utf8');
  const statements = schema.split(/^\s*GO\s*$/im).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await pool.request().query(statement);
  console.log(`Migración _16776 completada (${statements.length} pasos idempotentes).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrar().then(async () => (await obtenerConexion()).close()).catch(async (error) => {
    console.error(`Migración fallida (${error.code || error.name || 'unknown'}).`);
    try { await (await obtenerConexion()).close(); } catch {}
    process.exitCode = 1;
  });
}
