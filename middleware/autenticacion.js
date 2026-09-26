import jwt from 'jsonwebtoken';

export function obtenerSecreto() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET debe contener al menos 32 caracteres.');
  }
  return secret;
}

export function crearToken(usuario) {
  return jwt.sign({ sub: usuario.Id, correo: usuario.Correo }, obtenerSecreto(), { expiresIn: '12h' });
}

export function autenticar(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Iniciá sesión para continuar.' });
  try {
    req.usuario = jwt.verify(token, obtenerSecreto());
    next();
  } catch {
    res.status(401).json({ error: 'La sesión venció. Iniciá sesión nuevamente.' });
  }
}

export function verificarTokenSocket(token) {
  if (!token) return null;
  return jwt.verify(token, obtenerSecreto());
}
