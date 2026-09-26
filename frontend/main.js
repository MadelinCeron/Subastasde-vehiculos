import { createApp, computed, onMounted, onUnmounted, reactive, ref } from 'vue/dist/vue.esm-bundler.js';
import { io } from 'socket.io-client';
import './style.css';

const token = ref(localStorage.getItem('sesion') || '');
const usuario = ref(JSON.parse(localStorage.getItem('usuario') || 'null'));
const cargando = ref(false);
const error = ref('');
const inventario = ref([]);
const propios = ref([]);
const busquedaPropia = ref('');
const detalle = ref(null);
const fotoActiva = ref(0);
const ahora = ref(Date.now());
const estadoPersonal = ref('');
const filtroAbierto = ref(false);
const oferta = ref('');
const modoAuth = ref('login');
const socket = ref(null);
const filtros = reactive({ q: '', anio: '', tipo: '', marca: '', modelo: '', motor: '', transmision: '', combustible: '', trenManejo: '', cilindros: '', dano: '' });
const cuenta = reactive({ nombre: '', apellido: '', correo: '', telefono: '', password: '' });
const form = reactive({ id: '', anio: '', tipo: '', marca: '', modelo: '', motor: '', transmision: '', combustible: '', trenManejo: '', cilindros: '', dano: 'verde', montoBase: '', inicioUtc: '', cierreUtc: '', fotosTexto: '' });
const vista = ref('home');
const filtroCampos = [
  ['q', 'Buscar marca o modelo'], ['anio', 'Año'], ['tipo', 'Tipo'], ['marca', 'Marca'], ['modelo', 'Modelo'],
  ['motor', 'Motor'], ['transmision', 'Transmisión'], ['combustible', 'Combustible'], ['trenManejo', 'Tren de manejo'], ['cilindros', 'Cilindros']
];
const pujaMinima = computed(() => !detalle.value ? 0 : Number(detalle.value.cantidadPujas) ? Math.ceil(Number(detalle.value.ofertaActual) * 110) / 100 : Number(detalle.value.montoBase) + 0.01);
const estadoDetalle = computed(() => {
  if (!detalle.value) return '';
  if (new Date(detalle.value.cierreUtc).getTime() <= ahora.value) return Number(detalle.value.cantidadPujas) ? 'cerrada' : 'desierta';
  return new Date(detalle.value.inicioUtc).getTime() > ahora.value ? 'programada' : 'abierta';
});
const propiosFiltrados = computed(() => {
  const query = busquedaPropia.value.trim().toLocaleLowerCase();
  if (!query) return propios.value;
  return propios.value.filter((item) => `${item.id} ${item.anio} ${item.marca} ${item.modelo}`.toLocaleLowerCase().includes(query));
});

function dinero(value) { return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 }).format(Number(value || 0)); }
function fecha(value) { return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function cuentaAtras(value) {
  const restan = Math.max(0, new Date(value).getTime() - ahora.value);
  if (!restan) return 'Finalizada';
  const segundos = Math.floor(restan / 1000);
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return dias ? `${dias}d ${horas}h ${minutos}m` : `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}
function estadoTexto(value) { return ({ abierta: 'En curso', programada: 'Próximamente', cerrada: 'Finalizada', desierta: 'Desierta' })[value] || value; }

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}), ...options.headers };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}
async function cargarInventario(aplicar = false) {
  cargando.value = true;
  try {
    const query = new URLSearchParams();
    if (aplicar) for (const [key, value] of Object.entries(filtros)) if (String(value).trim()) query.set(key, String(value).trim());
    inventario.value = (await api('/api/vehiculos' + (query.size ? '?' + query.toString() : ''))).vehiculos;
  } catch (e) { error.value = e.message; }
  finally { cargando.value = false; }
}
async function abrirDetalle(id) {
  socket.value?.disconnect();
  detalle.value = null;
  fotoActiva.value = 0;
  estadoPersonal.value = '';
  cargando.value = true;
  try {
    detalle.value = (await api('/api/vehiculos/' + id)).vehiculo;
    oferta.value = pujaMinima.value.toFixed(2);
    socket.value = io({ auth: token.value ? { token: token.value } : {} });
    socket.value.on('connect', () => socket.value.emit('subasta:unirse', id));
    socket.value.on('subasta:actualizacion', (event) => {
      if (!detalle.value || detalle.value.id !== id) return;
      detalle.value.ofertaActual = event.monto;
      detalle.value.cantidadPujas = event.cantidad;
      oferta.value = pujaMinima.value.toFixed(2);
    });
    socket.value.on('subasta:estado-personal', (event) => { estadoPersonal.value = event.estado; });
  } catch (e) { error.value = e.message; }
  finally { cargando.value = false; }
}
async function cargarMisPublicaciones() {
  try { propios.value = (await api('/api/vehiculos/mios')).vehiculos; }
  catch (e) { error.value = e.message; }
}
function limpiarForm() { Object.assign(form, { id: '', anio: '', tipo: '', marca: '', modelo: '', motor: '', transmision: '', combustible: '', trenManejo: '', cilindros: '', dano: 'verde', montoBase: '', inicioUtc: '', cierreUtc: '', fotosTexto: '' }); }
async function cargarEdicion(id) {
  try {
    const list = (await api('/api/vehiculos/mios')).vehiculos;
    if (!list.some((item) => item.id === id && Number(item.cantidadPujas) === 0)) throw new Error('Solo podés editar tus publicaciones sin ofertas.');
    const car = (await api('/api/vehiculos/' + id)).vehiculo;
    Object.assign(form, { ...car, id: String(id), inicioUtc: new Date(car.inicioUtc).toISOString().slice(0, 16), cierreUtc: new Date(car.cierreUtc).toISOString().slice(0, 16), fotosTexto: car.fotos.join('\n') });
  } catch (e) { error.value = e.message; }
}
function cambiarRuta() {
  error.value = '';
  const [pagina, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (!pagina) { vista.value = 'home'; detalle.value = null; socket.value?.disconnect(); cargarInventario(); return; }
  if (pagina === 'vehiculo' && id) { vista.value = 'detalle'; abrirDetalle(Number(id)); return; }
  if (pagina === 'registro' || pagina === 'login') { vista.value = 'auth'; modoAuth.value = pagina; return; }
  if (pagina === 'publicar' || pagina === 'editar') {
    if (!token.value) { location.hash = '#/login'; return; }
    vista.value = 'publicar';
    if (pagina === 'editar' && id) cargarEdicion(Number(id)); else limpiarForm();
    return;
  }
  if (pagina === 'mios') {
    if (!token.value) { location.hash = '#/login'; return; }
    vista.value = 'mios'; busquedaPropia.value = ''; cargarMisPublicaciones(); return;
  }
  location.hash = '#/';
}
async function autenticar() {
  error.value = '';
  try {
    const ruta = modoAuth.value === 'registro' ? '/api/auth/registro' : '/api/auth/login';
    const result = await api(ruta, { method: 'POST', body: JSON.stringify(cuenta) });
    token.value = result.token;
    usuario.value = result.usuario;
    localStorage.setItem('sesion', result.token);
    localStorage.setItem('usuario', JSON.stringify(result.usuario));
    location.hash = '#/';
  } catch (e) { error.value = e.message; }
}
async function guardarVehiculo() {
  error.value = '';
  const body = { ...form, fotos: form.fotosTexto.split(/\r?\n/).map((url) => url.trim()).filter(Boolean) };
  delete body.id;
  delete body.fotosTexto;
  try {
    const url = form.id ? '/api/vehiculos/' + form.id : '/api/vehiculos';
    const result = await api(url, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    location.hash = '#/vehiculo/' + result.id;
  } catch (e) { error.value = e.message; }
}
async function ofertar() {
  error.value = '';
  try {
    await api('/api/vehiculos/' + detalle.value.id + '/pujas', { method: 'POST', body: JSON.stringify({ monto: Number(oferta.value) }) });
    estadoPersonal.value = 'ganando';
  } catch (e) { error.value = e.message; }
}
function salir() {
  token.value = '';
  usuario.value = null;
  localStorage.removeItem('sesion');
  localStorage.removeItem('usuario');
  socket.value?.disconnect();
  location.hash = '#/';
}
function aplicarFiltros() { cargarInventario(true); }
function limpiarFiltros() { Object.keys(filtros).forEach((key) => { filtros[key] = ''; }); cargarInventario(); }

createApp({
  setup() {
    let reloj;
    onMounted(() => { window.addEventListener('hashchange', cambiarRuta); cambiarRuta(); reloj = setInterval(() => { ahora.value = Date.now(); }, 1000); });
    onUnmounted(() => { window.removeEventListener('hashchange', cambiarRuta); clearInterval(reloj); socket.value?.disconnect(); });
    return { token, usuario, cargando, error, inventario, propios, propiosFiltrados, busquedaPropia, detalle, fotoActiva, filtroAbierto, filtros, filtroCampos, cuenta, modoAuth, form, oferta, estadoPersonal, estadoDetalle, pujaMinima, vista, dinero, fecha, cuentaAtras, estadoTexto, cambiarRuta, autenticar, guardarVehiculo, ofertar, salir, aplicarFiltros, limpiarFiltros, location };
  },
  template: `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" href="#/" aria-label="Rastro, inventario"><span class="brand-mark">R</span><span>rastro<span class="brand-dot">.</span></span></a>
        <nav class="main-nav"><a href="#/" :class="{ selected: vista === 'home' || vista === 'detalle' }">Subastas</a><a v-if="token" href="#/mios" :class="{ selected: vista === 'mios' }">Mis publicaciones</a></nav>
        <div class="account-nav"><template v-if="usuario"><span class="user-greeting">Hola, {{ usuario.nombre }}</span><button class="text-button" @click="salir">Salir</button></template><template v-else><a class="text-button sign-in" href="#/login">Ingresar</a><a class="button button-dark button-small" href="#/registro">Crear cuenta <span>↗</span></a></template><a v-if="token" class="button button-accent button-small publish-link" href="#/publicar">Publicar vehículo <span>＋</span></a></div>
      </header>
      <main>
        <section v-if="vista === 'home'" class="page-section inventory-page">
          <div class="page-heading"><div><div class="eyebrow"><span class="live-dot"></span> Subastas abiertas al público</div><h1>Encontrá tu próximo<br /><em>proyecto.</em></h1></div><div class="heading-side"><p>Vehículos con historia, listos para su siguiente capítulo.</p><a class="button button-accent" :href="token ? '#/publicar' : '#/registro'">Publicar vehículo <span>↗</span></a></div><div class="heading-index"><strong>{{ String(inventario.length).padStart(2, '0') }}</strong><span>lotes<br />disponibles</span></div></div>
          <div class="inventory-toolbar"><div class="toolbar-label"><span class="toolbar-rule"></span> Inventario <span class="muted-count">{{ inventario.length }} resultados</span></div><button class="filter-toggle" :aria-expanded="filtroAbierto" @click="filtroAbierto = !filtroAbierto"><span class="filter-icon">☷</span> Filtros <span class="filter-plus">{{ filtroAbierto ? '−' : '+' }}</span></button></div>
          <form v-if="filtroAbierto" class="filter-panel" @submit.prevent="aplicarFiltros"><label v-for="[key, label] in filtroCampos" :key="key" class="filter-field"><span>{{ label }}</span><input v-model="filtros[key]" :type="key === 'anio' || key === 'cilindros' ? 'number' : 'text'" /></label><label class="filter-field"><span>Daño</span><select v-model="filtros.dano"><option value="">Todos</option><option value="verde">Verde</option><option value="amarillo">Amarillo</option><option value="rojo">Rojo</option></select></label><div class="filter-actions"><button class="button button-dark button-small">Aplicar</button><button type="button" class="text-button" @click="limpiarFiltros">Limpiar</button></div></form>
          <p v-if="error" class="notice notice-error" role="alert">{{ error }}</p><div v-if="cargando" class="loading-state"><span class="loader"></span> Cargando inventario</div>
          <div v-else-if="inventario.length" class="vehicle-grid"><article v-for="(car, index) in inventario" :key="car.id" class="vehicle-card" :style="{ '--card-index': index }"><a class="vehicle-image" :href="'#/vehiculo/' + car.id"><img :src="car.foto" :alt="car.anio + ' ' + car.marca + ' ' + car.modelo" loading="lazy" /><span class="lot-number">LOTE {{ String(car.id).padStart(5, '0') }}</span><span class="condition-dot" :class="'condition-' + car.dano" :title="'Daño ' + car.dano"></span><span class="image-arrow">↗</span></a><div class="vehicle-info"><div class="vehicle-overline"><span>{{ car.tipo }}</span><span :class="['status-label', car.estado]">{{ estadoTexto(car.estado) }}</span></div><a class="vehicle-title" :href="'#/vehiculo/' + car.id">{{ car.anio }} {{ car.marca }} {{ car.modelo }}</a><div class="vehicle-specs"><span>{{ car.transmision }}</span><span>{{ car.combustible }}</span><span>{{ car.trenManejo }}</span></div><div class="vehicle-bottom"><div><small>{{ Number(car.cantidadPujas) ? 'Oferta actual' : 'Monto base' }}</small><strong>{{ dinero(car.ofertaActual) }}</strong></div><div class="card-timer"><small>Cierra en</small><strong>{{ cuentaAtras(car.cierreUtc) }}</strong></div></div></div></article></div>
          <div v-else-if="!cargando" class="empty-state"><span class="empty-symbol">—</span><h2>No hay lotes con esos criterios.</h2><p>Probá cambiar o quitar alguno de los filtros.</p><button class="text-button" @click="limpiarFiltros">Ver todo el inventario ↗</button></div><div class="inventory-footnote"><span>01 — {{ String(inventario.length).padStart(2, '0') }}</span><span>Los lotes se actualizan en tiempo real</span><span>Guatemala · GTQ</span></div>
        </section>

        <section v-else-if="vista === 'detalle'" class="page-section detail-page"><a class="back-link" href="#/">← Volver al inventario</a><p v-if="error" class="notice notice-error">{{ error }}</p><div v-if="cargando || !detalle" class="loading-state"><span class="loader"></span> Cargando ficha</div><template v-else>
          <div class="detail-heading"><div><div class="eyebrow">LOTE {{ String(detalle.id).padStart(5, '0') }} <span class="eyebrow-divider">/</span> {{ detalle.tipo }}</div><h1>{{ detalle.anio }} {{ detalle.marca }} <em>{{ detalle.modelo }}</em></h1></div><span :class="['status-label', estadoDetalle]">{{ estadoTexto(estadoDetalle) }}</span></div>
          <div class="detail-layout"><div class="gallery"><div class="gallery-main"><img :src="detalle.fotos[fotoActiva]" :alt="'Foto ' + (fotoActiva + 1) + ' de ' + detalle.marca + ' ' + detalle.modelo" /><span class="gallery-count">{{ String(fotoActiva + 1).padStart(2, '0') }} / {{ String(detalle.fotos.length).padStart(2, '0') }}</span><button v-if="detalle.fotos.length > 1" class="gallery-next" aria-label="Ver siguiente foto" @click="fotoActiva = (fotoActiva + 1) % detalle.fotos.length">→</button></div><div class="gallery-thumbs"><button v-for="(foto, index) in detalle.fotos" :key="foto" :class="{ active: fotoActiva === index }" :aria-label="'Ver foto ' + (index + 1)" @click="fotoActiva = index"><img :src="foto" alt="" /></button></div></div>
            <aside class="bid-panel"><div class="bid-panel-top"><span class="eyebrow">{{ estadoDetalle === 'abierta' ? 'SUBASTA EN VIVO' : 'ESTADO DE SUBASTA' }}</span><span v-if="estadoDetalle === 'abierta'" class="live-dot"></span></div><template v-if="estadoDetalle === 'abierta'"><p class="bid-caption">{{ Number(detalle.cantidadPujas) ? 'Oferta más alta' : 'Monto base' }}</p><strong class="current-bid">{{ dinero(detalle.ofertaActual) }}</strong><div class="countdown-row"><span>Cierra en</span><strong>{{ cuentaAtras(detalle.cierreUtc) }}</strong></div><div v-if="estadoPersonal" :class="['personal-state', estadoPersonal]">{{ estadoPersonal === 'ganando' ? '✓ Vas ganando' : '↑ Tu oferta fue superada' }}</div><template v-if="token"><label class="bid-input-label" for="monto">Tu oferta <span>Mínimo {{ dinero(pujaMinima) }}</span></label><div class="bid-input-wrap"><span>Q</span><input id="monto" v-model="oferta" type="number" min="0.01" step="0.01" /></div><button class="button button-accent button-full" @click="ofertar">Enviar oferta <span>↗</span></button></template><a v-else class="button button-dark button-full" href="#/login">Ingresá para ofertar <span>↗</span></a><small class="bid-note">Incremento mínimo: 10% sobre la oferta más alta.</small></template><template v-else-if="estadoDetalle === 'programada'"><p class="bid-caption">Comienza</p><strong class="current-bid current-bid-date">{{ fecha(detalle.inicioUtc) }}</strong><div class="countdown-row"><span>Tiempo hasta apertura</span><strong>{{ cuentaAtras(detalle.inicioUtc) }}</strong></div></template><template v-else><p class="bid-caption">{{ estadoDetalle === 'desierta' ? 'Sin ofertas válidas' : 'Subasta finalizada' }}</p><strong class="current-bid">{{ dinero(detalle.ofertaActual) }}</strong><div class="closed-note">{{ estadoDetalle === 'desierta' ? 'Este lote cerró sin recibir ofertas.' : 'Cierre: ' + fecha(detalle.cierreUtc) }}</div></template><p v-if="error" class="notice notice-error">{{ error }}</p><div class="bid-count"><span>Ofertas registradas</span><strong>{{ detalle.cantidadPujas }}</strong></div></aside></div>
          <div class="vehicle-dossier"><div class="dossier-heading"><div><span class="eyebrow">DETALLES DEL LOTE</span><h2>Ficha técnica</h2></div><span class="condition-badge" :class="'condition-' + detalle.dano"><i></i> Daño {{ detalle.dano }}</span></div><div class="spec-grid"><div><span>Año</span><strong>{{ detalle.anio }}</strong></div><div><span>Tipo</span><strong>{{ detalle.tipo }}</strong></div><div><span>Marca</span><strong>{{ detalle.marca }}</strong></div><div><span>Modelo</span><strong>{{ detalle.modelo }}</strong></div><div><span>Motor</span><strong>{{ detalle.motor }}</strong></div><div><span>Transmisión</span><strong>{{ detalle.transmision }}</strong></div><div><span>Combustible</span><strong>{{ detalle.combustible }}</strong></div><div><span>Tren de manejo</span><strong>{{ detalle.trenManejo }}</strong></div><div><span>Cilindros</span><strong>{{ detalle.cilindros }}</strong></div><div><span>Cierre</span><strong>{{ fecha(detalle.cierreUtc) }}</strong></div></div></div>
        </template></section>

        <section v-else-if="vista === 'auth'" class="account-page"><div class="account-art"><div class="account-art-index">R / 16776</div><div><span class="eyebrow">EL SIGUIENTE LOTE TE ESPERA</span><h1>Una buena<br />historia <em>empieza</em><br />al volante.</h1></div><span class="account-art-bottom">Subastas con otra perspectiva.</span></div><div class="account-form-wrap"><div class="account-form"><div class="eyebrow">{{ modoAuth === 'registro' ? 'NUEVA CUENTA' : 'QUÉ BUENO VERTE' }}</div><h2>{{ modoAuth === 'registro' ? 'Creá tu cuenta.' : 'Ingresá a Rastro.' }}</h2><p>{{ modoAuth === 'registro' ? 'Registrate para ofertar y publicar vehículos.' : 'Ingresá para ofertar en tus lotes favoritos.' }}</p><form @submit.prevent="autenticar"><template v-if="modoAuth === 'registro'"><div class="form-row"><label class="field"><span>Nombre</span><input v-model="cuenta.nombre" required maxlength="80" /></label><label class="field"><span>Apellido</span><input v-model="cuenta.apellido" required maxlength="80" /></label></div><label class="field"><span>Teléfono</span><input v-model="cuenta.telefono" type="tel" required maxlength="40" /></label></template><label class="field"><span>Correo electrónico</span><input v-model="cuenta.correo" type="email" required /></label><label class="field"><span>Contraseña</span><input v-model="cuenta.password" type="password" :minlength="modoAuth === 'registro' ? 12 : 1" required /></label><p v-if="error" class="notice notice-error">{{ error }}</p><button class="button button-accent button-full">{{ modoAuth === 'registro' ? 'Crear cuenta' : 'Ingresar' }} <span>↗</span></button></form><p class="account-switch">{{ modoAuth === 'registro' ? '¿Ya tenés cuenta?' : '¿Primera vez en Rastro?' }} <a :href="modoAuth === 'registro' ? '#/login' : '#/registro'">{{ modoAuth === 'registro' ? 'Ingresá' : 'Crear cuenta' }}</a></p></div></div></section>

        <section v-else-if="vista === 'publicar'" class="page-section editor-page"><a class="back-link" href="#/mios">← Mis publicaciones</a><div class="editor-heading"><div class="eyebrow">{{ form.id ? 'GESTIÓN DE LOTE' : 'NUEVO LOTE' }}</div><h1>{{ form.id ? 'Editar publicación.' : 'Dale salida a tu vehículo.' }}</h1><p>Completá la ficha y agregá al menos cinco fotos con sus URL.</p></div><form class="editor-form" @submit.prevent="guardarVehiculo"><div class="editor-section-title"><span>01</span><h2>Identificación</h2></div><div class="form-grid"><label class="field"><span>Año</span><input v-model="form.anio" type="number" min="1900" max="2100" required /></label><label class="field"><span>Tipo</span><input v-model="form.tipo" required /></label><label class="field"><span>Marca</span><input v-model="form.marca" required /></label><label class="field"><span>Modelo</span><input v-model="form.modelo" required /></label><label class="field"><span>Motor</span><input v-model="form.motor" required /></label><label class="field"><span>Transmisión</span><input v-model="form.transmision" required /></label><label class="field"><span>Combustible</span><input v-model="form.combustible" required /></label><label class="field"><span>Tren de manejo</span><input v-model="form.trenManejo" required /></label><label class="field"><span>Cilindros</span><input v-model="form.cilindros" type="number" min="1" max="16" required /></label><label class="field"><span>Daño</span><select v-model="form.dano"><option value="verde">Verde · Leve</option><option value="amarillo">Amarillo · Moderado</option><option value="rojo">Rojo · Alto</option></select></label></div><div class="editor-section-title"><span>02</span><h2>Condiciones de subasta</h2></div><div class="form-grid"><label class="field"><span>Monto base (GTQ)</span><input v-model="form.montoBase" type="number" min="0.01" step="0.01" required /></label><label class="field"><span>Inicio</span><input v-model="form.inicioUtc" type="datetime-local" required /></label><label class="field"><span>Cierre</span><input v-model="form.cierreUtc" type="datetime-local" required /></label></div><div class="editor-section-title"><span>03</span><h2>Fotografías</h2><small>Mínimo 5 · máximo 20</small></div><label class="field"><span>Una URL por línea</span><textarea v-model="form.fotosTexto" rows="7" required></textarea></label><p v-if="error" class="notice notice-error">{{ error }}</p><div class="editor-submit"><a class="text-button" href="#/mios">Cancelar</a><button class="button button-accent">{{ form.id ? 'Guardar cambios' : 'Publicar lote' }} <span>↗</span></button></div></form></section>

        <section v-else-if="vista === 'mios'" class="page-section owned-page">
          <div class="owned-heading"><div><div class="eyebrow">GESTIÓN DE CUENTA</div><h1>Mis <em>publicaciones.</em></h1></div><a class="button button-accent" href="#/publicar">Nuevo vehículo <span>＋</span></a></div>
          <p v-if="error" class="notice notice-error">{{ error }}</p>
          <label v-if="propios.length" class="owned-search"><span>Buscar por marca, modelo o lote</span><input v-model="busquedaPropia" type="search" placeholder="Ej. Honda, Civic o 00124" /></label>
          <div v-if="propiosFiltrados.length" class="owned-list"><article v-for="item in propiosFiltrados" :key="item.id" class="owned-row"><img :src="item.foto" :alt="item.marca + ' ' + item.modelo" /><div class="owned-main"><span class="eyebrow">LOTE {{ String(item.id).padStart(5, '0') }}</span><a :href="'#/vehiculo/' + item.id">{{ item.anio }} {{ item.marca }} {{ item.modelo }}</a><small>{{ item.cantidadPujas }} ofertas · cierra {{ fecha(item.cierreUtc) }}</small></div><strong>{{ dinero(item.ofertaActual) }}</strong><button class="icon-button" title="Editar publicación" @click="location.hash = '#/editar/' + item.id">↗</button></article></div>
          <div v-else-if="propios.length" class="empty-state"><span class="empty-symbol">—</span><h2>No hay publicaciones que coincidan.</h2><button class="text-button" @click="busquedaPropia = ''">Limpiar búsqueda</button></div>
          <div v-else class="empty-state"><span class="empty-symbol">—</span><h2>Todavía no publicaste un vehículo.</h2><a class="button button-accent" href="#/publicar">Crear publicación <span>↗</span></a></div>
        </section>
      </main>
      <footer v-if="vista !== 'auth'" class="site-footer"><a class="brand" href="#/"><span class="brand-mark">R</span><span>rastro<span class="brand-dot">.</span></span></a><span>Subastas de vehículos · Guatemala</span><span>Proyecto 16776</span></footer>
    </div>
  `
}).mount('#app');
