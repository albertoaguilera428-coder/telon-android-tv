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
    CO: 'Colombia', AR: 'Argentina', TH: 'Tailandia', TW: 'Taiwán', IN: 'India', UK: 'UK', GB: 'UK',
    DE: 'Alemania', FR: 'Francia', IT: 'Italia', BR: 'Brasil', CA: 'Canadá', AU: 'Australia', AT: 'Austria',
    RU: 'Rusia', ID: 'Indonesia', PH: 'Filipinas', TR: 'Turquía', UA: 'Ucrania', CL: 'Chile', PE: 'Perú', HK: 'Hong Kong' };
  // Si el addon ya manda un código de dos letras lo respetamos; GB se muestra como UK, igual que siempre.
  const CODIGOS_EQUIVALENTES = { GB: 'UK' };
  // Nombres en inglés y español. Cada patrón exige el nombre desde el inicio y, en los cortos,
  // la palabra completa: así "Indonesia" no cae en India ni "Estonia" en España.
  const ALIAS_PAIS = [
    [/^(CHINA|CHINO|CHINESE|MAINLAND CHINA)\b/, 'CN'],
    [/^(USA|EE\.? ?UU\.?|UNITED STATES|ESTADOS UNIDOS|AMERICAN)\b/, 'US'],
    [/^(KOREA|COREA|KOREAN|SOUTH KOREA)\b/, 'KR'],
    [/^(JAP[AÓO]N|JAPANESE)\b/, 'JP'],
    [/^(THAI|THAILAND|TAILANDIA)\b/, 'TH'],
    [/^TAIW[AÁ]N\b/, 'TW'],
    [/^(ESPA[ÑN]A|SPAIN|SPANISH)\b/, 'ES'],
    [/^(M[EÉ]XICO|MEXICAN)\b/, 'MX'],
    [/^(INDIA|INDIAN)\b/, 'IN'],
    [/^(UNITED KINGDOM|GREAT BRITAIN|REINO UNIDO|BRIT|ENGLAND|INGLATERRA)/, 'UK'],
    [/^(GERMANY|GERMAN|ALEMANIA)\b/, 'DE'],
    [/^(FRANCE|FRENCH|FRANCIA)\b/, 'FR'],
    [/^(ITALY|ITALIAN|ITALIA)\b/, 'IT'],
    [/^BRA[SZ]IL\b/, 'BR'],
    [/^CANAD[AÁ]\b/, 'CA'],
    [/^AUSTRALIA\b/, 'AU'],
    [/^AUSTRIA\b/, 'AT'],
    [/^(RUSSIA|RUSIA|RUSSIAN)\b/, 'RU'],
    [/^INDONESIA\b/, 'ID'],
    [/^(PHILIPPINES|FILIPINAS)\b/, 'PH'],
    [/^(TURKEY|TURQU[IÍ]A|T[UÜ]RKIYE)\b/, 'TR'],
    [/^(UKRAINE|UCRANIA)\b/, 'UA'],
    [/^(COLOMBIA)\b/, 'CO'],
    [/^(ARGENTINA)\b/, 'AR'],
    [/^CHILE\b/, 'CL'],
    [/^PER[UÚ]\b/, 'PE'],
    [/^HONG KONG\b/, 'HK']
  ];

  // ============================================================
  // RED Y LÍMITES DE CONSUMO
  // ============================================================

  // Si un servidor responde 429 respetamos su Retry-After (o 30 s si no lo dice) y no le volvemos a
  // pedir nada hasta que pase. No reintentamos solos: el usuario decide con "Reintentar". Así un
  // addon saturado no recibe una ráfaga de peticiones de cada televisor que tiene la app abierta.
  const ESPERA_429_POR_DEFECTO_MS = 30000;
  const ESPERA_429_MAXIMA_MS = 600000;
  const esperaPorOrigen = Object.create(null);

  function originOf(url) {
    try {
      return new URL(url).origin;
    } catch {
      // Las rutas de addons virtuales ("__x__/…") no son URLs: no tienen servidor al que limitar.
      return '';
    }
  }

  // Retry-After puede venir en segundos ("120") o como fecha HTTP.
  function parseRetryAfter(valor, ahora) {
    if (!valor) return ESPERA_429_POR_DEFECTO_MS;
    const segundos = Number(valor);
    const ms = Number.isFinite(segundos) ? segundos * 1000 : Date.parse(valor) - ahora;
    if (!Number.isFinite(ms)) return ESPERA_429_POR_DEFECTO_MS;
    return Math.min(Math.max(ms, 0), ESPERA_429_MAXIMA_MS);
  }

  function secondsToWait(origen) {
    const hasta = esperaPorOrigen[origen];
    if (!hasta) return 0;
    const restante = hasta - Date.now();
    return restante > 0 ? Math.ceil(restante / 1000) : 0;
  }

  // Todas las peticiones de la app a addons y sitios pasan por aquí.
  async function politeFetch(url, opciones) {
    const origen = originOf(url);
    const espera = origen ? secondsToWait(origen) : 0;
    if (espera > 0) throw new Error('el servidor pidió esperar; reintenta en ' + espera + ' s');
    const respuesta = await fetch(url, opciones);
    if (respuesta.status === 429 && origen) {
      const ahora = Date.now();
      const retryAfter = respuesta.headers && respuesta.headers.get ? respuesta.headers.get('Retry-After') : null;
      esperaPorOrigen[origen] = ahora + parseRetryAfter(retryAfter, ahora);
    }
    return respuesta;
  }

  async function fetchRemoteJSON(url, ms = ESPERA_POR_DEFECTO_MS) {
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), ms);
    try {
      const respuesta = await politeFetch(url, { signal: control.signal });
      if (respuesta.status === 429) throw new Error('demasiadas solicitudes; reintenta en ' + secondsToWait(originOf(url)) + ' s');
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
    if (/^[A-Z]{2}$/.test(mayus)) return CODIGOS_EQUIVALENTES[mayus] || mayus;
    const alias = ALIAS_PAIS.find(([patron]) => patron.test(mayus));
    // Último recurso para países que no conocemos: las dos primeras letras sirven para agrupar.
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

  // Algunos addons no mandan la lista de videos pero sí dicen "24 episodios" en la descripción.
  // Solo para series: en una película esa frase suele ser parte de la sinopsis.
  const MAXIMO_EPISODIOS_INFERIDOS = 300;

  function inferEpisodesFromDescription(ficha) {
    if (ficha.type !== 'series') return [];
    const coincidencia = (ficha.description || '').match(/(\d+)\s*[Ee]pisodios?/);
    if (!coincidencia) return [];
    const cantidad = Math.min(+coincidencia[1], MAXIMO_EPISODIOS_INFERIDOS);
    const episodios = [];
    // Mismo formato de ID que usa Stremio para series (id:temporada:episodio).
    for (let e = 1; e <= cantidad; e++) episodios.push({ id: `${ficha.id}:1:${e}`, title: `Episodio ${e}`, season: 1, episode: e });
    return episodios;
  }

  // Lista de episodios lista para reproducir. Si el addon no trae videos intentamos deducirlos de
  // la descripción; si tampoco se puede (películas, por ejemplo), queda un solo ítem.
  function buildEpisodeList(ficha) {
    const episodios = Array.isArray(ficha.videos) ? sortVideos(ficha.videos.filter(v => v && v.id)) : [];
    if (episodios.length) return episodios;
    const inferidos = inferEpisodesFromDescription(ficha);
    return inferidos.length ? inferidos : [{ id: ficha.id, title: ficha.name }];
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

  Telon.addonClient = {
    ESPERA_FUENTES_MS, politeFetch, parseRetryAfter, fetchRemoteJSON, getJSON, registerVirtualAddon, normalizeBase, buildAddonUrl,
    resourceName, supportsResource, getCountryCode, getCountryLabel, sortVideos, buildEpisodeList,
    resolveStreams, resolveSubs, convertSrtToVtt, subBlob
  };
})(window.Telon = window.Telon || {});
