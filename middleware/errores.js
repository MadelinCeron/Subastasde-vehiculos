export function manejarError(error, _req, res, _next) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(`Error de API (${error.code || error.name || 'unknown'}).`);
  res.status(status).json({ error: status >= 500 ? 'Ocurrió un error inesperado. Intentá de nuevo.' : error.message });
}
