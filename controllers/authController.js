import bcrypt from 'bcryptjs';
import { obtenerConexion, sql } from '../config/db.js';
import { crearToken } from '../middleware/autenticacion.js';

const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registrar(req, res, next) {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const apellido = String(req.body.apellido || '').trim();
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const telefono = String(req.body.telefono || '').trim();
    const password = String(req.body.password || '');
    if (!nombre || nombre.length > 80 || !apellido || apellido.length > 80 || !correoValido.test(correo) || correo.length > 320 || !telefono || telefono.length > 40 || password.length < 12 || password.length > 100) {
      return res.status(400).json({ error: 'Completá nombre, apellido, correo, teléfono y una contraseña de al menos 12 caracteres.' });
    }
    const hash = await bcrypt.hash(password, 12);
    const pool = await obtenerConexion();
    const result = await pool.request()
      .input('nombre', sql.NVarChar(80), nombre)
      .input('apellido', sql.NVarChar(80), apellido)
      .input('correo', sql.NVarChar(320), correo)
      .input('telefono', sql.NVarChar(40), telefono)
      .input('hash', sql.NVarChar(100), hash)
      .query(`
        INSERT INTO dbo.Usuarios_16776 (Nombre, Apellido, Correo, Telefono, PasswordHash)
        OUTPUT INSERTED.Id, INSERTED.Nombre, INSERTED.Apellido, INSERTED.Correo, INSERTED.Telefono
        VALUES (@nombre, @apellido, @correo, @telefono, @hash);
      `);
    const usuario = result.recordset[0];
    res.status(201).json({ token: crearToken(usuario), usuario });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    next(error);
  }
}

export async function iniciarSesion(req, res, next) {
  try {
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const pool = await obtenerConexion();
    const result = await pool.request().input('correo', sql.NVarChar(320), correo)
      .query('SELECT Id, Nombre, Apellido, Correo, Telefono, PasswordHash FROM dbo.Usuarios_16776 WHERE Correo = @correo;');
    const usuario = result.recordset[0];
    if (!usuario || !(await bcrypt.compare(password, usuario.PasswordHash))) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    delete usuario.PasswordHash;
    res.json({ token: crearToken(usuario), usuario });
  } catch (error) {
    next(error);
  }
}

export async function perfil(req, res, next) {
  try {
    const pool = await obtenerConexion();
    const result = await pool.request().input('id', sql.UniqueIdentifier, req.usuario.sub)
      .query('SELECT Id, Nombre, Apellido, Correo, Telefono FROM dbo.Usuarios_16776 WHERE Id = @id;');
    if (!result.recordset[0]) return res.status(404).json({ error: 'La cuenta ya no existe.' });
    res.json({ usuario: result.recordset[0] });
  } catch (error) {
    next(error);
  }
}
