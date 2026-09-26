import 'dotenv/config';
import { obtenerConexion } from '../config/db.js';

try {
  const pool = await obtenerConexion();
  const result = await pool.request().query(`
    SELECT
      1 AS connection_ok,
      HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS can_create_table,
      HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER') AS can_alter_dbo;
  `);
  const status = result.recordset[0];
  console.log(JSON.stringify({
    connected: status.connection_ok === 1,
    canCreateTable: status.can_create_table === 1,
    canAlterDbo: status.can_alter_dbo === 1
  }));
  await pool.close();
  if (!status.can_create_table || !status.can_alter_dbo) process.exitCode = 2;
} catch (error) {
  console.error(`Database check failed (${error.code || error.name || 'unknown'}).`);
  process.exitCode = 1;
}
