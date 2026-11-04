/*
Telón - Cliente del protocolo de addons (Stremio)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Telón no trae contenido propio: lo traen los addons. Este módulo habla su protocolo
(manifest, catalog, meta, stream, subtitles) y no sabe nada de pantallas. Los addons
"virtuales" (sitios sin servidor Stremio) se registran aquí y responden por la misma
puerta, así que el resto de la app no distingue entre uno real y uno virtual.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const { politeFetch, fetchRemoteJSON } = Telon.infra.http;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Las fuentes tardan más que el resto: varios addons resuelven el enlace en el momento.
  const ESPERA_FUENTES_MS = 60000;

  // base del addon virtual → { responder, limpiarCache }. responder recibe la ruta
  // ("catalog/series/x.json") y devuelve el JSON; limpiarCache borra lo que guardó el sitio.
  const addonsVirtuales = Object.create(null);

  function registerVirtualAddon(addon, responder, { limpiarCache = () => {} } = {}) {
    addonsVirtuales[addon.base] = { responder, limpiarCache };
  }

  // Invalidación explícita: "Recargar addons" tiene que traer contenido nuevo, no lo guardado.
  function clearVirtualCaches() {
    Object.values(addonsVirtuales).forEach(addon => addon.limpiarCache());
  }

  async function getJSON(url, ms) {
    const corte = url.indexOf('/');
    const virtual = corte > 0 ? addonsVirtuales[url.slice(0, corte)] : undefined;
    if (virtual && corte < url.length - 1) {
      return (await virtual.responder(url.slice(corte + 1))) || { err: 'not found' };
    }
    return fetchRemoteJSON(url, ms);
  }

  // ============================================================
  // PROTOCOLO
  // ============================================================

  // Acepta lo que la gente suele pegar: stremio://, la URL del manifest o la carpeta.
  const normalizeBase = url => url.trim()
    .replace(/^stremio:\/\//i, 'https://')
    .replace(/\/manifest\.json.*$/i, '')
    .replace(/\/+$/, '');

  const buildAddonUrl = (addon, recurso, tipo, id, extra) =>
    `${addon.base}/${recurso}/${tipo}/${encodeURIComponent(id)}${extra ? '/' + extra : ''}.json`;

  const resourceName = recurso => typeof recurso === 'string' ? recurso : recurso.name;

  // Un recurso puede restringir tipos e ID por su cuenta o heredar los del manifest.
  function supportsResource(addon, nombre, tipo, id) {
    for (const recurso of (addon.manifest.resources || [])) {
      if (resourceName(recurso) !== nombre) continue;
      const detalle = typeof recurso === 'object' ? recurso : {};
      const tipos = detalle.types || addon.manifest.types;
      const prefijos = detalle.idPrefixes || addon.manifest.idPrefixes;
      if (tipo && tipos && tipos.length && !tipos.includes(tipo)) continue;
      if (id && prefijos && prefijos.length && !prefijos.some(prefijo => String(id).startsWith(prefijo))) continue;
      return true;
    }
    return false;
  }

  // ============================================================
  // FUENTES Y SUBTÍTULOS
  // ============================================================

  // Consulta todos los addons a la vez. onFirst se dispara con la primera respuesta útil para
  // que el video arranque sin esperar al addon más lento; la promesa trae la lista completa.
  // esReproducible deja afuera las fuentes que esta plataforma no puede abrir, antes de avisar.
  function resolveStreams(addons, tipo, idVideo, onFirst, esReproducible = () => true) {
    const todasLasFuentes = [];
    let yaAvisado = false;
    const peticiones = addons
      .filter(addon => supportsResource(addon, 'stream', tipo, idVideo))
      .map(addon => getJSON(buildAddonUrl(addon, 'stream', tipo, idVideo), ESPERA_FUENTES_MS)
        .then(respuesta => {
          const fuentes = (respuesta.streams || []).filter(f => f && f.url && esReproducible(f)).map(f => ({ ...f, addon }));
          todasLasFuentes.push(...fuentes);
          if (fuentes.length && !yaAvisado && onFirst) {
            yaAvisado = true;
            onFirst(todasLasFuentes.slice());
          }
          return fuentes;
        })
        .catch(error => {
          logIgnored('El addon ' + addon.base + ' no entregó fuentes', error);
          return [];
        }));
    return Promise.all(peticiones).then(() => todasLasFuentes);
  }

  // Preferimos subtítulos en español; si no hay, cualquiera es mejor que nada.
  async function resolveSubs(addons, tipo, idVideo, fuentes) {
    const candidatos = [];
    fuentes.forEach(f => (f.subtitles || []).forEach(s => s && s.url && candidatos.push(s)));
    const peticiones = addons
      .filter(addon => supportsResource(addon, 'subtitles', tipo, idVideo))
      .map(addon => getJSON(buildAddonUrl(addon, 'subtitles', tipo, idVideo))
        .then(respuesta => respuesta.subtitles || [])
        .catch(error => {
          logIgnored('El addon ' + addon.base + ' no entregó subtítulos', error);
          return [];
        }));
    (await Promise.all(peticiones)).flat().forEach(s => s && s.url && candidatos.push(s));
    const enEspanol = candidatos.find(s => /^(es|spa)/i.test(s.lang || ''));
    return enEspanol || candidatos[0] || null;
  }

  // <track> solo entiende WebVTT; muchos addons entregan SRT, que se diferencia en la coma decimal.
  function convertSrtToVtt(texto) {
    if (/^\uFEFF?WEBVTT/.test(texto)) return texto;
    return 'WEBVTT\n\n' + texto.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }

  async function subBlob(url) {
    const texto = await (await politeFetch(url)).text();
    return URL.createObjectURL(new Blob([convertSrtToVtt(texto)], { type: 'text/vtt' }));
  }

  Telon.infra.addonClient = { getJSON, registerVirtualAddon, clearVirtualCaches, normalizeBase, buildAddonUrl, supportsResource, resolveStreams, resolveSubs, convertSrtToVtt, subBlob };
})(window.Telon = window.Telon || {});
