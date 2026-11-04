/*
Telón - Casos de uso: addons, catálogos y fichas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Coordina el protocolo de addons (infraestructura) con las reglas de catálogo (dominio)
y el estado. No pinta nada: devuelve datos y las pantallas deciden cómo mostrarlos.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const { InvalidDataError, userMessageFor } = Telon.infra.errors;
  const { fetchRemoteJSON } = Telon.infra.http;
  const { getJSON, normalizeBase, buildAddonUrl } = Telon.infra.addonClient;
  const { needsExtra, supportsSearch, keepValidMetas } = Telon.domain.catalog;
  const { buildEpisodeList } = Telon.domain.episodes;
  const { estado, getEnabledAddons, findAddon, saveAddons } = Telon.app.state;

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
    const resultados = await Promise.allSettled(ADDONS_PREDETERMINADOS.map(base =>
      fetchRemoteJSON(base + '/manifest.json').then(manifest => ({ base, manifest, enabled: true }))));
    if (secuencia !== secuenciaRecarga) return false;
    resultados.filter(r => r.status === 'rejected').forEach(r => logIgnored('Un addon predeterminado no respondió', r.reason));
    const remotos = resultados.filter(r => r.status === 'fulfilled').map(r => r.value);
    estado.addons = [Telon.infra.sololatino.ADDON_SOLOLATINO, ...remotos, Telon.infra.narto.ADDON_NARTO];
    // También limpia el valor viejo que guardaba los addons virtuales con sus cachés.
    saveAddons();
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
    estado.addons = estado.addons.some(esElMismo) ? estado.addons.map(a => (esElMismo(a) ? registro : a)) : [...estado.addons, registro];
    saveAddons();
    return manifest;
  }

  // Se crea una copia en vez de cambiar el addon: los virtuales son constantes de su módulo y
  // modificarlos dejaba a SoloLatino desactivado aunque se recargaran los addons.
  function toggleAddon(base) {
    if (!findAddon(base)) return false;
    estado.addons = estado.addons.map(a => (a.base === base ? { ...a, enabled: !a.enabled } : a));
    saveAddons();
    return true;
  }

  function removeAddon(base) {
    estado.addons = estado.addons.filter(a => a.base !== base);
    saveAddons();
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
  const prepareTitle = referencia => Telon.infra.sololatino.seedKnownSlug(referencia);

  function warmUpSources(referencia, ficha) {
    Telon.infra.sololatino.warmUpSlugForImdb(referencia, ficha).catch(error => logIgnored('SoloLatino: no se pudo preparar el slug', error));
  }

  Telon.app.catalogService = { prepareTitle, warmUpSources, ADDONS_PREDETERMINADOS, reloadDefaultAddons, installAddon, toggleAddon, removeAddon, loadCatalogs, searchCatalogs, fetchFullMeta };
})(window.Telon = window.Telon || {});
