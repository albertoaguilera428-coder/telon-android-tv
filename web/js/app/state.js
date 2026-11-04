/*
Telón - Estado de la app y repositorios de datos guardados
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Un solo objeto de estado para la interfaz y un repositorio por cada cosa que se guarda
en el dispositivo (perfiles, preferencias, sesión, lista, historial, addons). Las
pantallas nunca tocan localStorage: piden y guardan a través de estos repositorios.

El estado se lee como estado.x pero solo cambia con updateState({ x }): así cada cambio
pasa por un solo lugar y avisa a quien se suscribió (main.js repinta lo que corresponde).
Escribir estado.x = … directamente lanza un error.
Las claves y la forma de lo guardado no se cambian a la ligera: ahí están los datos de
los usuarios.
*/
'use strict';

import { store } from '../infra/storage.js';
import { FILTROS_VACIOS } from '../domain/catalog.js';
import { refKey, trimHistory } from '../domain/progress.js';
import { LIMITES_SUBTITULOS } from '../domain/playback-session.js';

// ============================================================
// PERFILES
// ============================================================

const perfiles = {
  all() { return store.get('profiles', []); },
  save(lista) { return store.set('profiles', lista); },
  active() {
    const id = store.get('activeProfile', null);
    const todos = this.all();
    return todos.find(p => p.id === id) || todos[0] || null;
  },
  setActive(id) { store.set('activeProfile', id); },
  add(nombre, color) {
    const perfil = { id: Date.now().toString(36), name: nombre, color, pin: '' };
    this.save([...this.all(), perfil]);
    return perfil;
  },
  remove(id) {
    const lista = this.all().filter(p => p.id !== id);
    this.save(lista);
    if (store.get('activeProfile') === id && lista.length) this.setActive(lista[0].id);
  },
  // Devuelve false si el cambio no se pudo guardar.
  update(id, cambios) {
    return this.save(this.all().map(p => (p.id === id ? { ...p, ...cambios } : p)));
  },
  findByName(nombre) {
    return this.all().find(p => p.name.toLowerCase() === nombre.trim().toLowerCase()) || null;
  }
};

// ============================================================
// PREFERENCIAS
// ============================================================

const OPCIONES_CALIDAD = ['Auto', '1080p', '720p', '480p'];
// Mismos valores por defecto que usa la sesión de reproducción: una sola fuente de verdad.
const { linea: LINEA_SUBS, tamano: TAMANO_SUBS } = LIMITES_SUBTITULOS;

const preferencias = {
  quality: () => store.get('quality', 'Auto'),
  cycleQuality() {
    const siguiente = OPCIONES_CALIDAD[(OPCIONES_CALIDAD.indexOf(this.quality()) + 1) % OPCIONES_CALIDAD.length];
    store.set('quality', siguiente);
    return siguiente;
  },
  autoSubs: () => store.get('autoSubs', true),
  toggleAutoSubs() { store.set('autoSubs', !this.autoSubs()); },
  // Los dramas cortos de Narto traen subtítulos quemados en la imagen: por defecto apagados.
  nartoSubs: () => store.get('nartoSubs', false),
  toggleNartoSubs() { store.set('nartoSubs', !this.nartoSubs()); },
  subtitlesEnabledFor(esNarto) { return esNarto ? this.nartoSubs() : this.autoSubs(); },
  subtitleLine: () => store.get('subLine', LINEA_SUBS.porDefecto),
  saveSubtitleLine(linea) { store.set('subLine', linea); },
  subtitleSize: () => store.get('subSize', TAMANO_SUBS.porDefecto),
  saveSubtitleSize(tamano) { store.set('subSize', tamano); }
};

// ============================================================
// SESIÓN DE LA CUENTA
// ============================================================

const sesion = {
  get: () => store.get('loginProvider', null),
  save(datos) { store.set('loginProvider', datos); },
  clear() { store.set('loginProvider', null); }
};

// ============================================================
// ESTADO DE LA INTERFAZ
// ============================================================

const estadoInterno = {
  pestana: 'home', filtros: { ...FILTROS_VACIOS }, pestanaBiblioteca: 'list', busquedaAbierta: false,
  consulta: '', // Lo que hay escrito en el buscador (cambia con cada tecla, no repinta).
  consultaBuscada: '', // La consulta cuyos resultados se muestran.
  pantallaPerfiles: !perfiles.all().length,
  addons: [], // Los llena reloadDefaultAddons(): la lista viene fija en el código.
  biblioteca: store.get('lib', []), // Guardada con los campos del protocolo Stremio: [{ base, type, id, name, poster, country }]
  historial: store.get('hist', {}), // refKey → última posición vista.
  filas: null, filasConError: 0, cargando: false,
  filasBusqueda: null, buscando: false,
  urlNueva: '', instalando: false, errorInstalar: '', confirmarBorrado: null,
  detalle: null, reproductor: null,
  temporadaDetalle: null, temporadaReproductor: null
};

const oyentes = new Set();

// Aplica los cambios y avisa una sola vez con las claves que de verdad cambiaron (mismo valor =
// sin aviso). Los oyentes se llaman en el momento: quien cambia el estado ve la pantalla al día.
function updateState(cambios) {
  const cambiadas = Object.keys(cambios).filter(clave => estadoInterno[clave] !== cambios[clave]);
  if (!cambiadas.length) return;
  cambiadas.forEach(clave => { estadoInterno[clave] = cambios[clave]; });
  const claves = new Set(cambiadas);
  oyentes.forEach(oyente => oyente(claves));
}

function subscribe(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

const rechazarEscritura = (_, clave) => { throw new TypeError(`El estado solo cambia con updateState({ ${String(clave)}: … })`); };
const estado = new Proxy(estadoInterno, { set: rechazarEscritura, deleteProperty: rechazarEscritura, defineProperty: rechazarEscritura });

// ============================================================
// ADDONS
// ============================================================

const getEnabledAddons = () => estado.addons.filter(a => a.enabled);
const findAddon = base => estado.addons.find(a => a.base === base);

// Los addons virtuales (base "__…__") viven en el código y llevan cachés con páginas HTML
// enteras: guardarlos llenaba localStorage. Solo persistimos lo que describe a cada addon.
const isVirtualAddon = addon => /^__.+__$/.test(addon.base);
const toStoredAddon = addon => ({ base: addon.base, manifest: addon.manifest, enabled: addon.enabled });
const saveAddons = () => store.set('addons', estado.addons.filter(a => !isVirtualAddon(a)).map(toStoredAddon));

// ============================================================
// MI LISTA E HISTORIAL
// ============================================================

const isInLibrary = referencia => estado.biblioteca.some(x => refKey(x) === refKey(referencia));

// Guarda con el nombre y póster de la ficha completa si ya llegó; son mejores que los de la tarjeta.
// Devuelve true si quedó guardada y false si se quitó. Siempre crea una lista nueva: quien
// tenga la anterior (una pantalla a medio pintar) no la ve cambiar por debajo.
function toggleLibrary(referencia, ficha = {}) {
  const clave = refKey(referencia);
  const yaEstaba = estado.biblioteca.some(x => refKey(x) === clave);
  const biblioteca = yaEstaba
    ? estado.biblioteca.filter(x => refKey(x) !== clave)
    : [...estado.biblioteca, { base: referencia.base, type: referencia.type, id: referencia.id, name: ficha.name || referencia.name, poster: ficha.poster || referencia.poster, country: referencia.country }];
  store.set('lib', biblioteca);
  updateState({ biblioteca });
  return !yaEstaba;
}

function clearLibrary() {
  store.set('lib', []);
  updateState({ biblioteca: [] });
}

function saveHistory(historial) {
  const recortado = trimHistory(historial);
  store.set('hist', recortado);
  updateState({ historial: recortado });
}

function recordProgress(entrada) {
  saveHistory({ ...estado.historial, [entrada.key]: entrada });
}

function clearHistory() {
  saveHistory({});
}

const resetAllData = () => store.clearAll();

export { perfiles, preferencias, sesion, estado, updateState, subscribe, refKey, getEnabledAddons, findAddon, saveAddons, isInLibrary, toggleLibrary, clearLibrary, recordProgress, clearHistory, resetAllData };
