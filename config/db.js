import sql from 'mssql';

let conexion;

export function obtenerConexion() {
  if (!conexion) {
    const config = {
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 1433),
      options: {
        encrypt: true,
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
      },
      pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
      connectionTimeout: 15000,
      requestTimeout: 15000
    };

    if (!config.server || !config.database || !config.user || !config.password) {
      throw new Error('Faltan variables de conexión SQL Server.');
    }

    conexion = new sql.ConnectionPool(config)
      .connect()
      .catch((error) => {
        conexion = undefined;
        throw error;
      });
  }

  return conexion;
}

export { sql };