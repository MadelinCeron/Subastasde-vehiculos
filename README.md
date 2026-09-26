# Rastro — Subastas de vehículos

Proyecto del segundo parcial de Desarrollo y Diseño Web.

La plataforma permite explorar vehículos, publicar subastas y realizar ofertas. Los cambios en las pujas aparecen en los navegadores conectados sin recargar la página.

**Estudiante:** Madelin Jazmin Ceron Molina  
**Carnet:** 1890-23-16776

## Funciones

- Inventario público con filtros por características del vehículo.
- Registro e inicio de sesión para publicar y ofertar.
- Publicaciones con ficha técnica, nivel de daño y al menos cinco fotos.
- Búsqueda y edición de publicaciones propias.
- Detalle con galería, oferta actual y tiempo restante.
- Validación del monto y del horario de cada puja en el servidor.
- Actualización en vivo de ofertas e indicadores de «Vas ganando» o «Tu oferta fue superada». No se muestra la identidad de otros postores.

## Cuentas de prueba

Estas cuentas permiten probar la subasta desde distintos navegadores:

| Correo | Contraseña |
| --- | --- |
| `lucia.demo@rastro.test` | `Rastro-Lote-16776-A!` |
| `mateo.demo@rastro.test` | `Rastro-Lote-16776-B!` |
| `sofia.demo@rastro.test` | `Rastro-Lote-16776-C!` |

Son contraseñas exclusivas para esta demostración.

## Tecnologías

Vue 3 para la interfaz; Node.js y Express para la API; SQL Server para guardar los datos; Socket.IO para las actualizaciones en vivo. Las contraseñas se almacenan como hashes bcrypt.

Las tablas creadas para este proyecto terminan en `_16776`.

## Fotos de los lotes de demostración

No encontré conjuntos verificables de cinco fotos que correspondan al mismo ejemplar de cada lote, así que el seed no usa fotos de stock. El carrusel muestra placas distintas con el nombre de cada toma y avisa que la foto real está pendiente. El inventario no registra el color de pintura; confirmá el color del ejemplar antes de añadir las fotos y mantenelo igual en las cuatro vistas exteriores.

Colocá cinco JPG distintos por vehículo en las carpetas `frontend/public/images/demo/2018-ford-mustang-gt/` y `frontend/public/images/demo/2020-toyota-rav4-adventure/`. En ambas carpetas usá estos nombres y tomas: `01-front-left.jpg` (frontal izquierda), `02-left-side.jpg` (lateral izquierdo), `03-front-right.jpg` (frontal derecha), `04-rear.jpg` (parte trasera) y `05-interior.jpg` (interior del mismo auto). El primer lote requiere un Ford Mustang GT 2018; el segundo, un Toyota RAV4 Adventure 2020. En cada carrusel, las cinco imágenes deben ser de la misma unidad y las fotos exteriores deben conservar el mismo color. Cada carpeta contiene instrucciones específicas.

Después de añadir imágenes autorizadas, ejecutá `npm run build`; el archivo real reemplaza automáticamente su placa pendiente.

## Ejecutar localmente

Se necesita Node.js y acceso a SQL Server. Las variables necesarias están descritas en `.env.example`; los valores reales se guardan en un archivo `.env` local, que no se sube al repositorio.

```powershell
npm ci
npm run db:check
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Abrir `http://localhost:3000`. Si se configura otro puerto, abrir la dirección correspondiente.

## Pruebas

```powershell
npm test
npm run build
```

Las pruebas revisan autenticación, filtros, publicaciones, fotos, reglas de puja y actualizaciones entre dos clientes conectados.
