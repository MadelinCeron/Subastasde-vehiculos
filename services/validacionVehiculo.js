const camposTexto = ['tipo', 'marca', 'modelo', 'motor', 'transmision', 'combustible', 'trenManejo'];
const longitudes = { tipo: 40, marca: 60, modelo: 80, motor: 60, transmision: 40, combustible: 40, trenManejo: 40 };

export function validarVehiculo(body) {
  const errores = [];
  const anio = Number(body.anio);
  const cilindros = Number(body.cilindros);
  const montoBase = Number(body.montoBase);
  const inicio = new Date(body.inicioUtc);
  const cierre = new Date(body.cierreUtc);

  if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) errores.push('El año debe estar entre 1900 y 2100.');
  for (const campo of camposTexto) {
    const valor = String(body[campo] ?? '').trim();
    if (!valor || valor.length > longitudes[campo]) errores.push(`Revisá el campo ${campo}.`);
  }
  if (!Number.isInteger(cilindros) || cilindros < 1 || cilindros > 16) errores.push('Los cilindros deben estar entre 1 y 16.');
  if (!['verde', 'amarillo', 'rojo'].includes(String(body.dano || '').toLowerCase())) errores.push('El daño debe ser verde, amarillo o rojo.');
  if (!Number.isFinite(montoBase) || montoBase <= 0 || montoBase >= 10000000000) errores.push('El monto base no es válido.');
  if (Number.isNaN(inicio.valueOf()) || Number.isNaN(cierre.valueOf()) || cierre <= inicio) errores.push('El cierre debe ocurrir después del inicio.');

  const fotos = Array.isArray(body.fotos) ? body.fotos.map((url) => String(url).trim()).filter(Boolean) : [];
  if (fotos.length < 5) errores.push('Agregá al menos cinco fotos.');
  if (fotos.length > 20) errores.push('Se permiten hasta veinte fotos.');
  for (const foto of fotos) {
    try {
      const url = new URL(foto);
      if (!['https:', 'http:'].includes(url.protocol) || foto.length > 2048) throw new Error();
    } catch {
      errores.push('Cada foto debe ser una URL HTTP o HTTPS válida.');
      break;
    }
  }

  if (errores.length) return { errores };
  return {
    datos: {
      anio,
      tipo: String(body.tipo).trim(),
      marca: String(body.marca).trim(),
      modelo: String(body.modelo).trim(),
      motor: String(body.motor).trim(),
      transmision: String(body.transmision).trim(),
      combustible: String(body.combustible).trim(),
      trenManejo: String(body.trenManejo).trim(),
      cilindros,
      dano: String(body.dano).toLowerCase(),
      montoBase: Math.round(montoBase * 100) / 100,
      inicio: new Date(Math.floor(inicio.getTime() / 1000) * 1000).toISOString(),
      cierre: new Date(Math.floor(cierre.getTime() / 1000) * 1000).toISOString(),
      fotos
    }
  };
}

export function estadoSubasta(inicio, cierre, now = new Date()) {
  if (new Date(cierre) <= now) return 'cerrada';
  if (new Date(inicio) > now) return 'programada';
  return 'abierta';
}
