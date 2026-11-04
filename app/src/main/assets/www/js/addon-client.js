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

  const { logIgnored } = Telon.util;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const ESPERA_POR_DEFECTO_MS = 15000;
  // Las fuentes tardan más que el resto: varios addons resuelven el enlace en el momento.
  const ESPERA_FUENTES_MS = 60000;
  const ETIQUETAS_PAIS = { CN: 'China', US: 'EEUU', KR: 'Corea', JP: 'Japón', ES: 'España', MX: 'México',
    CO: 'Colombia', AR: 'Argentina', TH: 'Tailandia', TW: 'Taiwán', IN: 'India', UK: 'UK', GB: 'UK' };
  // El primer patrón que coincide gana; el orden importa (por ejemplo "IN" antes que el recorte final).
  const ALIAS_PAIS = [
    [/^(CN|CHINA|CHINO|CHINESE)/, 'CN'],
    [/^(US|USA|EEUU|UNITED STATES|ESTADOS UNIDOS)/, 'US'],
    [/^(KR|KOREA|COREA|KOREAN)/, 'KR'],
    [/^(JP|JAP[AÓO]N|JAPANESE)/, 'JP'],
    [/^(TH|THAI|TAILAND)/, 'TH'],
    [/^(TW|TAIW[AÁ]N)/, 'TW'],
    [/^(ES|ESPA[ÑN]A|SPANISH)/, 'ES'],
    [/^(MX|M[EÉ]XICO|MEXICAN)/, 'MX'],
    [/^(IN|INDIA)/, 'IN'],
    [/^(GB|UK|BRIT)/, 'UK']
  ];

  // ============================================================
  // RED
  // ============================================================

  async function fetchRemoteJSON(url, ms = ESPERA_POR_DEFECTO_MS) {
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), ms);
    try {
      const respuesta = await fetch(url, { signal: control.signal });
      if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
      return await respuesta.json();
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? 'tiempo de espera agotado' : error.message, { cause: error });
    } finally {
      clearTimeout(temporizador);
    }
  }

  // base del addon virtual → función que recibe la ruta ("catalog/series/x.json") y devuelve el JSON
  const addonsVirtuales = Object.create(null);

  function registerVirtualAddon(addon, responder) {
    addonsVirtuales[addon.base] = responder;
  }

  async function getJSON(url, ms) {
    const corte = url.indexOf('/');
    const responder = corte > 0 ? addonsVirtuales[url.slice(0, corte)] : undefined;
    if (responder && corte < url.length - 1) {
      return (await responder(url.slice(corte + 1))) || { err: 'not found' };
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

  // Cada addon escribe el país a su manera ("Korea", "KR", ["Corea"]); lo normalizamos a un código.
  function getCountryCode(ficha) {
    let pais = ficha && (ficha.country || ficha.countries);
    if (Array.isArray(pais)) pais = pais[0];
    if (!pais) return '';
    const mayus = String(pais).trim().toUpperCase();
    const alias = ALIAS_PAIS.find(([patron]) => patron.test(mayus));
    return alias ? alias[1] : mayus.slice(0, 2);
  }

  const getCountryLabel = codigo => ETIQUETAS_PAIS[codigo] || codigo;

  // Orden por temporada y episodio; si faltan datos se respeta el orden en que vinieron.
  const sortVideos = listaVideos => listaVideos
    .map((video, i) => ({ video, i }))
    .sort((a, b) => ((a.video.season || 0) - (b.video.season || 0))
      || ((a.video.episode ?? a.i) - (b.video.episode ?? b.i))
      || (a.i - b.i))
    .map(x => x.video);

  // Lista de episodios lista para reproducir: películas y fichas sin videos quedan como un solo ítem.
  function buildEpisodeList(ficha) {
    const episodios = Array.isArray(ficha.videos) ? sortVideos(ficha.videos.filter(v => v && v.id)) : [];
    return episodios.length ? episodios : [{ id: ficha.id, title: ficha.name }];
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
    const texto = await (await fetch(url)).text();
    return URL.createObjectURL(new Blob([convertSrtToVtt(texto)], { type: 'text/vtt' }));
  }

  Telon.addonClient = {
    ESPERA_FUENTES_MS, fetchRemoteJSON, getJSON, registerVirtualAddon, normalizeBase, buildAddonUrl,
    resourceName, supportsResource, getCountryCode, getCountryLabel, sortVideos, buildEpisodeList,
    resolveStreams, resolveSubs, convertSrtToVtt, subBlob
  };
})(window.Telon = window.Telon || {});
