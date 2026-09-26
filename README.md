# Rastro · Subastas de vehículos

Aplicación SPA en Vue 3 con API Express, SQL Server y actualizaciones de ofertas en tiempo real con Socket.IO. La API y el frontend compilado se sirven desde un único servicio Node en Render.

## URL pública

Pendiente de crear el servicio desde tu cuenta de Render. Render asignará una URL al finalizar el primer deploy; reemplazá esta referencia en la entrega: `https://<nombre-del-servicio>.onrender.com`.

## Requisitos

- Node.js 22.12 o posterior y npm.
- SQL Server accesible desde la máquina local y desde Render, con una base configurada.
- Permiso `CREATE TABLE` en la base y `ALTER` sobre el esquema `dbo`.

## Ejecución local

1. Conservá tu `.env` actual; no lo copies al repositorio ni compartas sus valores. Agregá `JWT_SECRET` con un valor aleatorio de al menos 32 caracteres. Podés generar uno con `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.
2. Verificá que `.env` tenga `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`. `DB_TRUST_SERVER_CERTIFICATE=true` mantiene compatibilidad con SQL Server local que usa certificado propio; en producción usá `false` cuando el certificado del servidor sea válido.
3. Instalá dependencias con `npm ci`.
4. Ejecutá `npm run db:check`. Comprueba conexión y permisos mediante consultas de lectura; no crea tablas.
5. Ejecutá `npm run db:migrate`. Solo agrega `Usuarios_16776`, `Vehiculos_16776`, `FotosVehiculo_16776` y `PujasVehiculo_16776`. Es idempotente y no altera `Estudiantes`, `Misiones` ni `EstudianteMisiones`.
6. Ejecutá `npm run db:seed` para crear las cuentas y los lotes de demostración. Es repetible: no duplica datos ni restablece la contraseña de una cuenta demo ya existente.
7. Iniciá la API y la SPA compilada con `npm start`, y abrí `http://localhost:3000`.

Para trabajar en frontend, usá `npm run dev` en otra terminal. Vite sirve la SPA en `http://localhost:5173` y reenvía API y Socket.IO a `http://localhost:3000`.

## Cuentas de demostración

Solo para esta demostración, nunca reutilices estas contraseñas en otros servicios.

| Correo | Contraseña |
| --- | --- |
| `lucia.demo@rastro.test` | `Rastro-Lote-16776-A!` |
| `mateo.demo@rastro.test` | `Rastro-Lote-16776-B!` |
| `sofia.demo@rastro.test` | `Rastro-Lote-16776-C!` |

Las contraseñas se guardan únicamente como hashes bcrypt. El seed crea cada usuario una sola vez y no sobrescribe credenciales modificadas posteriormente.

## Verificación

`npm test` ejecuta pruebas integrales contra SQL Server real. Crea publicaciones y cuentas temporales, prueba autenticación, filtros combinados, cinco fotos, edición, cierre y apertura futura, incrementos de puja, simultaneidad con dos clientes Socket.IO y privacidad de la identidad; luego elimina los registros temporales. Ejecutala contra una base de desarrollo, no contra tablas de producción ajenas. El test también vuelve a correr migración y seed, que deben ser idempotentes.

`npm run build` genera `dist/`, que Express sirve junto con `/api` y `/socket.io`.

## Render y GitHub

1. Subí el repositorio a GitHub sin incluir `.env`; `.gitignore` excluye `.env`, variantes locales, `node_modules` y `dist`.
2. En Render, elegí **New + → Blueprint** y conectá el repositorio. Render leerá `render.yaml`, compilará la SPA y ejecutará migración y seed antes de iniciar el servicio.
3. En la configuración del servicio, cargá `DB_SERVER`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` como variables secretas. Confirmá que SQL Server acepte conexiones desde Render al puerto 1433. `JWT_SECRET` se genera automáticamente; `DB_TRUST_SERVER_CERTIFICATE=false` mantiene la validación TLS.
4. Cuando el deploy termine, comprobá `/api/salud`, reemplazá la URL pendiente de este README y probá las tres cuentas demo.

No hay URL pública todavía porque el servicio no puede crearse ni vincularse a GitHub/Render sin acceso a tus cuentas. El plan gratuito de Render puede suspender el servicio inactivo; el primer acceso posterior puede tardar.

## Diseño de API

- `POST /api/auth/registro`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/vehiculos` acepta filtros combinables: `q`, `anio`, `tipo`, `marca`, `modelo`, `motor`, `transmision`, `combustible`, `trenManejo`, `cilindros` y `dano`.
- `GET /api/vehiculos/:id`, `GET /api/vehiculos/mios`, `POST /api/vehiculos`, `PUT /api/vehiculos/:id`
- `POST /api/vehiculos/:id/pujas`
- Los eventos Socket.IO públicos comparten monto y cantidad, nunca identidad. `subasta:estado-personal` se emite solo a sockets autenticados del usuario correspondiente.

El publicador puede editar sus publicaciones. Después de la primera oferta, se conservan bloqueados el monto base y las fechas de la subasta para no cambiar las condiciones a los postores; los demás datos se pueden corregir.
