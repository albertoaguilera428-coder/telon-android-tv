/*
Telón - Casos de uso: addons, catálogos y fichas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Coordina el protocolo de addons (infraestructura) con las reglas de catálogo (dominio)
y el estado. No pinta nada: devuelve datos y las pantallas deciden cómo mostrarlos.
*/
'use strict';

import { logIgnored } from '../infra/log.js';
import { InvalidDataError, userMessageFor } from '../infra/errors.js';
import { fetchRemoteJSON } from '../infra/http.js';
import { getJSON, normalizeBase, buildAddonUrl, clearVirtualCaches } from '../infra/addon-client.js';
import { needsExtra, supportsSearch, keepValidMetas } from '../domain/catalog.js';
import { buildEpisodeList } from '../domain/episodes.js';
import { estado, updateState, getEnabledAddons, findAddon, saveAddons } from './state.js';
import * as sololatino from '../infra/addons/sololatino.js';
import * as narto from '../infra/addons/narto.js';

// Cambia la lista de addons y la guarda en el dispositivo.
function setAddons(lista) {
  updateState({ addons: lista });
  saveAddons();
}

// ============================================================
// ADDONS
// ============================================================

const ADDONS_PREDETERMINADOS = ['https://insanos.net/cinemeta-es', 'https://insanos.net/sololatino', 'https://insanos.net/narto'];

// Si se recarga dos veces seguidas, la respuesta vieja no debe pisar a la nueva.
let secuenciaRecarga = 0;

// SoloLatino primero y Narto al final: así se ordenan los grupos en la pantalla de inicio.
// Devuelve false si una recarga más nueva empezó mientras esta esperaba.
async function reloadDefaultAddons() {
  const secuencia = ++secuenciaRecarga;
  // El usuario pidió recargar: lo guardado de los sitios ya no sirve.
  clearVirtualCaches();
  const resultados = await Promise.allSettled(ADDONS_PREDETERMINADOS.map(base =>
    fetchRemoteJSON(base + '/manifest.json').then(manifest => ({ base, manifest, enabled: true }))));
  if (secuencia !== secuenciaRecarga) return false;
  resultados.filter(r => r.status === 'rejected').forEach(r => logIgnored('Un addon predeterminado no respondió', r.reason));
  const remotos = resultados.filter(r => r.status === 'fulfilled').map(r => r.value);
  // Guardar también limpia el valor viejo que tenía los addons virtuales con sus cachés.
  setAddons([sololatino.ADDON_SOLOLATINO, ...remotos, narto.ADDON_NARTO]);
  return true;
}

// Reinstalar el mismo addon (misma URL o mismo id) lo actualiza en vez de duplicarlo.
async function installAddon(urlIngresada) {
  const base = normalizeBase(urlIngresada);
  if (!base) return null;
  const manifest = await getJSON(base + '/manifest.json');
  if (!manifest || !manifest.id || !manifest.name) throw new InvalidDataError('el manifest no tiene «id» o «name»');
  const registro = { base, manifest, enabled: true };
  const esElMismo = a => a.base === base || a.manifest.id === manifest.id;
  setAddons(estado.addons.some(esElMismo) ? estado.addons.map(a => (esElMismo(a) ? registro : a)) : [...estado.addons, registro]);
  return manifest;
}

// Se crea una copia en vez de cambiar el addon: los virtuales son constantes de su módulo y
// modificarlos dejaba a SoloLatino desactivado aunque se recargaran los addons.
function toggleAddon(base) {
  if (!findAddon(base)) return false;
  setAddons(estado.addons.map(a => (a.base === base ? { ...a, enabled: !a.enabled } : a)));
  return true;
}

function removeAddon(base) {
  setAddons(estado.addons.filter(a => a.base !== base));
}

// ============================================================
// CATÁLOGOS Y BÚSQUEDA
// ============================================================

const toRow = (addon, catalogo) => respuesta => ({ addon, cat: catalogo, metas: keepValidMetas(respuesta.metas) });

// Cada carga cuenta sus propios errores: dos cargas simultáneas no comparten el contador.
// Todos los catálogos mostrables de los addons activos, como pares [addon, catálogo].
const listCatalogs = filtro => getEnabledAddons().flatMap(addon => (addon.manifest.catalogs || []).filter(filtro).map(catalogo => [addon, catalogo]));

// Cada carga cuenta sus propios errores: dos cargas simultáneas no comparten el contador.
async function loadCatalogs() {
  let errores = 0;
  const peticiones = listCatalogs(catalogo => !needsExtra(catalogo)).map(([addon, catalogo]) =>
    getJSON(buildAddonUrl(addon, 'catalog', catalogo.type, catalogo.id))
      .then(toRow(addon, catalogo))
      .catch(error => {
        logIgnored('El catálogo ' + catalogo.id + ' no respondió', error);
        errores++;
        return null;
      }));
  const filas = (await Promise.all(peticiones)).filter(f => f && f.metas.length);
  return { filas, errores };
}

async function searchCatalogs(consulta) {
  const peticiones = listCatalogs(supportsSearch).map(([addon, catalogo]) =>
    getJSON(buildAddonUrl(addon, 'catalog', catalogo.type, catalogo.id, 'search=' + encodeURIComponent(consulta)))
      .then(toRow(addon, catalogo))
      .catch(error => {
        logIgnored('La búsqueda en ' + catalogo.id + ' falló', error);
        return null;
      }));
  return (await Promise.all(peticiones)).filter(f => f && f.metas.length);
}

// ============================================================
// FICHAS
// ============================================================

// Parte de lo que ya sabemos (tarjeta o historial) y lo completa con la ficha del addon.
// Si el addon falla devuelve lo conocido y el motivo en "aviso": la ficha igual se puede ver.
async function fetchFullMeta(referencia) {
  let ficha = { id: referencia.id, type: referencia.type, name: referencia.name, poster: referencia.poster, description: referencia.description };
  let aviso = '';
  const addon = findAddon(referencia.base);
  if (addon) {
    try {
      const respuesta = await getJSON(buildAddonUrl(addon, 'meta', referencia.type, referencia.id));
      if (respuesta && respuesta.meta) ficha = { ...ficha, ...respuesta.meta };
    } catch (error) {
      logIgnored('No se pudo cargar la ficha de ' + referencia.id, error);
      aviso = 'No se pudo cargar la ficha completa (' + userMessageFor(error) + ').';
    }
  }
  return { ficha, episodios: buildEpisodeList(ficha), aviso, addonInstalado: Boolean(addon) };
}

// Algunas fuentes (SoloLatino) necesitan datos extra para títulos de Cinemeta. Se preparan al
// abrir la ficha, antes de que el usuario le dé play, para que las fuentes salgan sin esperar.
const prepareTitle = referencia => sololatino.seedKnownSlug(referencia);

function warmUpSources(referencia, ficha) {
  sololatino.warmUpSlugForImdb(referencia, ficha).catch(error => logIgnored('SoloLatino: no se pudo preparar el slug', error));
}

export { prepareTitle, warmUpSources, ADDONS_PREDETERMINADOS, reloadDefaultAddons, installAddon, toggleAddon, removeAddon, loadCatalogs, searchCatalogs, fetchFullMeta };
