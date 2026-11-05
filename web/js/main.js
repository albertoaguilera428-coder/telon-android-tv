/*
Telón - Arranque y acciones globales
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Último archivo en cargar: conecta los clics (data-act) con lo que hace cada pantalla,
decide qué se repinta cuando cambia el estado, expone las funciones que llama el
sistema (botón atrás, pausa) y arranca la app.
*/
'use strict';

// Primero: rellena lo que le falta al Chromium de los televisores más viejos.
import './infra/polyfills.js';
import * as plataforma from './infra/platform.js';
import { logIgnored } from './infra/log.js';
import { userMessageFor } from './infra/errors.js';
import { toggleFilterValue, FILTROS_VACIOS } from './domain/catalog.js';
import { estado, updateState, subscribe, perfiles, preferencias, clearHistory, clearLibrary, resetAllData } from './app/state.js';
import * as catalogo from './app/catalog-service.js';
import { $, COLORES_PERFIL } from './ui/dom.js';
import { toast, findCard } from './ui/components.js';
import { homeBody, loadHome, runSearch } from './ui/home.js';
import { render, setTab } from './ui/screens.js';
import { install } from './ui/addons-screen.js';
import { openDetail, renderDetail, closeDetail, toggleLib } from './ui/detail.js';
import { openPlayer, closePlayer, playerSheet, saveProgress, resume } from './ui/player.js';
import { playerClick } from './ui/player-actions.js';
import * as cuenta from './ui/account.js';
// Como espacio de nombres: así una prueba puede reemplazar el redimensionado (jsdom no tiene canvas).
import * as avatarImage from './ui/avatar-image.js';
import { checkForUpdate } from './ui/update-banner.js';
import './ui/tv-remote.js';

// ============================================================
// CONSTANTES
// ============================================================

// Esperamos a que el usuario deje de escribir antes de consultar a todos los addons.
const ESPERA_BUSQUEDA_MS = 350;
let temporizadorBusqueda = null;

// ============================================================
// QUÉ SE REPINTA CUANDO CAMBIA EL ESTADO
// ============================================================

// Cada clave del estado repinta solo lo que la muestra. Repintar de más no es gratis: en TV
// render() devuelve el foco a la pestaña y, con la ficha abierta, lo mandaría detrás de ella.
// urlNueva y consulta cambian con cada tecla y no repintan; el reproductor se pinta solo.
const CLAVES_PANTALLA = ['pestana', 'pantallaPerfiles', 'pestanaBiblioteca', 'busquedaAbierta', 'addons', 'instalando', 'errorInstalar', 'confirmarBorrado'];
const CLAVES_INICIO = ['filtros', 'filas', 'filasConError', 'cargando', 'filasBusqueda', 'buscando', 'consultaBuscada'];
const CLAVES_FICHA = ['detalle', 'temporadaDetalle'];
// La lista y el historial cambian cada pocos segundos mientras se reproduce: se repintan al cerrar.
const CLAVES_DATOS = ['biblioteca', 'historial'];

function repaintOnChange(cambiadas) {
  const toca = claves => claves.some(clave => cambiadas.has(clave));
  const sinReproductor = !estado.reproductor;
  const cerroReproductor = cambiadas.has('reproductor') && sinReproductor;
  const datosAlaVista = toca(CLAVES_DATOS) && sinReproductor;
  let pintarFicha = toca(CLAVES_FICHA);

  if (toca(CLAVES_PANTALLA)) render();
  else if (datosAlaVista && !estado.detalle) render();
  else if (cerroReproductor && estado.pestana === 'lib') render();
  else if ((toca(CLAVES_INICIO) || cerroReproductor) && estado.pestana === 'home') homeBody();

  if ((datosAlaVista || cerroReproductor) && estado.detalle) pintarFicha = true;
  if (pintarFicha) renderDetail();
}

// ============================================================
// ADDONS
// ============================================================

async function reloadAddons() {
  toast('Recargando addons…');
  // Si mientras tanto empezó otra recarga, esa se encarga de pintar: esta ya no aplica.
  if (!await catalogo.reloadDefaultAddons()) return;
  updateState({ filas: null, filasBusqueda: null });
  loadHome();
  toast('Addons recargados');
}

// ============================================================
// ACCIONES DE PERFIL
// ============================================================

// Perfiles, preferencias y cuenta viven en repositorios (localStorage), no en el estado de la
// interfaz: después de cambiarlos se repinta a mano.

function addProfile() {
  const nombre = prompt('Nombre del perfil:');
  if (!nombre || !nombre.trim()) return;
  const perfil = perfiles.add(nombre.trim(), COLORES_PERFIL[perfiles.all().length % COLORES_PERFIL.length]);
  if (perfiles.all().length === 1) perfiles.setActive(perfil.id);
  render();
}

function pickGalleryImage(perfil) {
  const selectorArchivo = document.getElementById('pffile');
  if (!selectorArchivo) return;
  selectorArchivo.onchange = async evento => {
    const archivo = evento.target.files[0];
    selectorArchivo.value = '';
    if (!archivo) return;
    try {
      saveProfileImage(perfil, await avatarImage.resizeToAvatar(archivo));
    } catch (error) {
      logIgnored('No se pudo procesar la foto elegida', error);
      toast('No se pudo usar esa foto: ' + userMessageFor(error));
    }
  };
  selectorArchivo.click();
}

function saveProfileImage(perfil, imagen) {
  if (!perfiles.update(perfil.id, { image: imagen })) { toast('No se pudo guardar la foto: no queda espacio en el dispositivo'); return; }
  render();
  toast('Foto actualizada');
}

function editProfileImage() {
  const perfil = perfiles.active();
  if (!perfil) { toast('Selecciona un perfil primero'); return; }
  const eleccion = prompt('Escribe la URL de una imagen, o escribe "galería" para elegir una foto del teléfono:');
  if (!eleccion) return;
  const respuesta = eleccion.trim();
  if (respuesta.toLowerCase() === 'galería' || respuesta.toLowerCase() === 'galeria') {
    pickGalleryImage(perfil);
  } else if (/^https?:\/\//i.test(respuesta)) {
    saveProfileImage(perfil, respuesta);
  } else {
    toast('URL no válida');
  }
}

function manageProfiles() {
  const nombres = perfiles.all().map(p => p.name).join(', ');
  const nombreABorrar = prompt('Escribe el nombre del perfil a eliminar:\n(' + nombres + ')');
  if (!nombreABorrar) return;
  const encontrado = perfiles.findByName(nombreABorrar);
  if (!encontrado) { toast('Perfil no encontrado'); return; }
  perfiles.remove(encontrado.id);
  toast('Perfil eliminado');
  render();
}

// ============================================================
// ACCIONES DE ADDONS Y DATOS
// ============================================================

function toggleAddon(base) {
  if (!catalogo.toggleAddon(base)) return;
  updateState({ filas: null, filasBusqueda: null });
}

function deleteAddon(base) {
  if (estado.confirmarBorrado !== base) { updateState({ confirmarBorrado: base }); return; }
  catalogo.removeAddon(base);
  updateState({ filas: null, confirmarBorrado: null });
  toast('Addon quitado');
}

function cycleQuality() {
  const siguiente = preferencias.cycleQuality();
  toast('Calidad: ' + siguiente);
  render();
}

function confirmAndRun(pregunta, accion) {
  if (confirm(pregunta)) accion();
}

// El buscador vive en el inicio: si se pide desde otra pestaña (en TV, «Buscar» está en la
// navegación), se va al inicio con el buscador abierto.
function toggleSearch() {
  if (estado.busquedaAbierta && estado.pestana === 'home') { closeSearch(); return; }
  updateState({ pestana: 'home', busquedaAbierta: true, confirmarBorrado: null });
  $('#q').focus();
}

const closeSearch = () => updateState({ busquedaAbierta: false, consulta: '', consultaBuscada: '', filasBusqueda: null });
const setFilter = cambios => updateState({ filtros: { ...estado.filtros, ...cambios } });

// ============================================================
// TABLA DE ACCIONES (data-act="accion:argumento")
// ============================================================

const ACCIONES = {
  tab: argumento => { if ($('#detail') && !$('#detail').hidden) closeDetail(); setTab(argumento); },
  filter: argumento => setFilter({ pais: argumento }),
  ftype: argumento => setFilter({ tipo: toggleFilterValue(estado.filtros.tipo, argumento) }),
  fgenre: argumento => setFilter({ genero: toggleFilterValue(estado.filtros.genero, argumento) }),
  filterreset: () => updateState({ filtros: { ...FILTROS_VACIOS } }),
  pickprofile: argumento => {
    perfiles.setActive(argumento);
    updateState({ pantallaPerfiles: false });
    if (!estado.filas && estado.addons.length) loadHome();
  },
  addprofile: addProfile,
  showprofiles: () => updateState({ pantallaPerfiles: true }),
  editprofileimg: editProfileImage,
  manageprofiles: manageProfiles,
  refresh: () => { updateState({ filas: null }); loadHome(); },
  reloadaddons: () => reloadAddons(),
  search: toggleSearch,
  open: (argumento, boton) => { const referencia = findCard(boton.dataset.k); if (referencia) openDetail(referencia); },
  closedetail: () => closeDetail(),
  season: argumento => updateState({ temporadaDetalle: +argumento }),
  savelib: () => toggleLib(estado.detalle.referencia),
  play: argumento => { const d = estado.detalle; if (d && !d.cargando) openPlayer(d.referencia, d.ficha, d.episodios, +argumento); },
  resume: (argumento, boton) => resume(boton.dataset.k),
  libtab: argumento => updateState({ pestanaBiblioteca: argumento }),
  install: () => install(),
  toggle: toggleAddon,
  del: deleteAddon,
  togglesubs: () => { preferencias.toggleAutoSubs(); render(); },
  togglenartosubs: () => { preferencias.toggleNartoSubs(); render(); },
  setquality: cycleQuality,
  clearhist: () => confirmAndRun('¿Borrar todo el historial?', () => { clearHistory(); toast('Historial borrado'); }),
  clearlib: () => confirmAndRun('¿Vaciar tu lista?', () => { clearLibrary(); toast('Lista vaciada'); }),
  clearall: () => confirmAndRun('¿Restablecer todo? Se borran perfiles, historial, lista y addons.', () => { resetAllData(); location.reload(); }),
  register: cuenta.registerAccount,
  emaillogin: cuenta.loginWithEmail,
  resendverify: cuenta.resendVerification,
  checkverify: cuenta.checkVerification,
  logout: cuenta.logout
};

function handleGlobalClick(evento) {
  // El reproductor tiene su propia tabla de acciones (data-p).
  if (evento.target.closest('#player')) return;
  const boton = evento.target.closest('[data-act]');
  if (!boton) return;
  const [accion, ...resto] = boton.dataset.act.split(':');
  if (Object.prototype.hasOwnProperty.call(ACCIONES, accion)) ACCIONES[accion](resto.join(':'), boton);
}

function handleInput(evento) {
  if (evento.target.id === 'addurl') updateState({ urlNueva: evento.target.value });
  if (evento.target.id === 'q') {
    updateState({ consulta: evento.target.value });
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(runSearch, ESPERA_BUSQUEDA_MS);
  }
}

// ============================================================
// FUNCIONES QUE LLAMA EL SISTEMA (MainActivity / adaptador de Tizen)
// ============================================================

// Botón atrás: cierra lo que esté más arriba. Devuelve false si no queda nada y hay que salir.
function handleBack() {
  if (estado.pantallaPerfiles && perfiles.active()) { updateState({ pantallaPerfiles: false }); return true; }
  if (estado.reproductor) { if (estado.reproductor.panel) playerSheet(null); else closePlayer(); return true; }
  if (estado.detalle) { closeDetail(); return true; }
  if (estado.busquedaAbierta) { closeSearch(); return true; }
  if (estado.pestana !== 'home') { setTab('home'); return true; }
  return false;
}

function handleSystemPause() {
  if (!estado.reproductor) return;
  estado.reproductor.video.pause();
  saveProgress(true);
}

// ============================================================
// FRONTERA GLOBAL DE ERRORES
// ============================================================

// Lo que nadie atrapó (un fallo de programación, una promesa olvidada) llega aquí: queda
// registrado con su detalle y el usuario ve un aviso estable, sin textos internos. Como
// máximo un aviso cada pocos segundos, para que un error repetido no tape la pantalla.
const MINIMO_ENTRE_AVISOS_MS = 5000;
let ultimoAviso = 0;

function reportUnexpectedError(error) {
  logIgnored('Error no atrapado', error);
  const ahora = Date.now();
  if (ahora - ultimoAviso < MINIMO_ENTRE_AVISOS_MS) return;
  ultimoAviso = ahora;
  toast('Algo falló (' + userMessageFor(error) + '). Si se repite, recarga los addons.');
}

// ============================================================
// ARRANQUE
// ============================================================

window.addEventListener('error', evento => reportUnexpectedError(evento.error || new Error(evento.message)));
window.addEventListener('unhandledrejection', evento => reportUnexpectedError(evento.reason));

document.addEventListener('click', handleGlobalClick);
document.addEventListener('input', handleInput);
document.addEventListener('keydown', evento => { if (evento.key === 'Enter' && evento.target.id === 'addurl') install(); });
$('#player').addEventListener('click', playerClick);

window.telonBack = handleBack;
window.telonPause = handleSystemPause;
window.__telon = estado; // Para inspeccionar el estado desde chrome://inspect mientras depuramos.

if (plataforma.esTv) document.body.classList.add('tv');
subscribe(repaintOnChange);
render();
reloadAddons();
checkForUpdate();

