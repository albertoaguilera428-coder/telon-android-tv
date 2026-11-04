/*
Telón - Addon virtual SoloLatino.net
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Series, películas, animes y doramas en español latino. Los catálogos y fichas salen de
leer las páginas del sitio; las fuentes vienen del addon de insanos.net, que indexa por
ID de IMDb, y como respaldo queda la página del episodio como reproductor embebido.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.util;
  const { politeFetch } = Telon.addonClient;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const URL_SOLOLATINO = 'https://sololatino.net';
  const URL_FUENTES_INSANOS = 'https://insanos.net/sololatino/stream/';
  const URL_CINEMETA = 'https://v3-cinemeta.strem.io';
  const DURACION_CACHE_MS = 600000;
  const RUTAS_CATALOGO_SL = { 'sl-series': '/series', 'sl-animes': '/animes', 'sl-doramas': '/doramas', 'sl-peliculas': '/peliculas' };
  // Algunas series no traen su ID de IMDb en SoloLatino; para esas dejamos el slug sembrado a mano.
  const SLUGS_POR_IMDB = { 'tt0096697': 'los-simpson' };
  // SoloLatino nombra sus páginas con y sin artículo ("los-simpson"), así que probamos ambas.
  const ARTICULOS_SLUG = ['', 'los-', 'las-', 'el-', 'la-'];

  const ADDON_SOLOLATINO = {
    base: '__sololatino__',
    manifest: {
      id: 'app.telon.sololatino', version: '1.0.0', name: 'SoloLatino.net',
      description: 'Series, películas, animes y doramas en español latino',
      resources: ['catalog', 'meta', { name: 'stream', types: ['series', 'movie'], idPrefixes: ['sl-', 'tt'] }], types: ['series', 'movie'], idPrefixes: ['sl-'],
      catalogs: [
        { type: 'series', id: 'sl-series', name: 'Series', extra: [{ name: 'search' }] },
        { type: 'series', id: 'sl-animes', name: 'Animes', extra: [{ name: 'search' }] },
        { type: 'series', id: 'sl-doramas', name: 'Doramas', extra: [{ name: 'search' }] },
        { type: 'movie', id: 'sl-peliculas', name: 'Películas', extra: [{ name: 'search' }] }
      ]
    },
    enabled: true,
    // Memoria entre pantallas: IDs de IMDb, slugs y nombres que vamos descubriendo por ID de video.
    _cache: {}, _urlsVideo: {}, _idsImdb: {}, _slugs: {}, _nombres: {}
  };

  // ============================================================
  // LECTURA DEL SITIO
  // ============================================================

  async function slFetch(ruta) {
    const respuesta = await politeFetch(URL_SOLOLATINO + ruta, { headers: { 'Accept-Language': 'es-419,es' }, credentials: 'include' });
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
    return respuesta.text();
  }

  async function fetchJSON(url) {
    return (await politeFetch(url)).json();
  }

  async function withSlCache(clave, cargador) {
    const entrada = ADDON_SOLOLATINO._cache[clave];
    if (entrada && Date.now() - entrada.ts < DURACION_CACHE_MS) return entrada.valor;
    const valor = await cargador();
    ADDON_SOLOLATINO._cache[clave] = { valor, ts: Date.now() };
    return valor;
  }

  const textOf = (documento, selector) => {
    const nodo = documento.querySelector(selector);
    return nodo && nodo.textContent ? nodo.textContent.trim() : '';
  };
  const contentOf = (documento, selector) => {
    const nodo = documento.querySelector(selector);
    return (nodo && nodo.content) || '';
  };

  // Leemos el atributo y no img.src: con src="" el navegador devuelve la URL de la propia app,
  // y una ruta relativa terminaría apuntando a file:// en vez de al sitio.
  function resolveImageUrl(imagen) {
    const src = imagen && imagen.getAttribute('src');
    if (!src) return '';
    try {
      return new URL(src, URL_SOLOLATINO).href;
    } catch (error) {
      logIgnored('SoloLatino: URL de imagen inválida ' + src, error);
      return '';
    }
  }

  function slParseCards(html) {
    const documento = new DOMParser().parseFromString(html, 'text/html');
    const salida = [];
    for (const tarjeta of documento.querySelectorAll('.card')) {
      const enlace = tarjeta.querySelector('a[href]');
      if (!enlace) continue;
      const href = enlace.getAttribute('href') || '';
      const imagen = tarjeta.querySelector('img');
      const slug = href.replace(/.*\/(serie|pelicula|anime|dorama)\//, '');
      const tipo = href.includes('/pelicula/') ? 'movie' : 'series';
      salida.push({ id: 'sl-' + slug, type: tipo, name: (imagen && imagen.alt) || slug, poster: resolveImageUrl(imagen), _slug: slug });
    }
    return salida;
  }

  function slParseMeta(html, id) {
    const documento = new DOMParser().parseFromString(html, 'text/html');
    const generos = [...documento.querySelectorAll('a[href*="/genero/"]')].map(a => a.textContent.trim());
    const anio = (textOf(documento, '.text-xs, [class*="year"]').match(/(\d{4})/) || [])[1] || '';
    const episodios = [];
    for (const enlaceEp of documento.querySelectorAll('a.ep-item, a[class*="ep-item"]')) {
      const href = enlaceEp.getAttribute('href') || '';
      const tempEp = href.match(/\/temporada-(\d+)\/episodio-(\d+)/);
      if (!tempEp) continue;
      const tituloEp = textOf(enlaceEp, '.font-semibold') || 'Episodio ' + tempEp[2];
      episodios.push({ id: 'sl-' + tempEp[1] + 'x' + tempEp[2], title: tituloEp, season: +tempEp[1], episode: +tempEp[2], _url: href });
    }
    const enlaceImdb = documento.querySelector('a[href*="imdb.com/title/tt"]');
    const idImdb = enlaceImdb ? (enlaceImdb.href.match(/tt\d+/) || [])[0] : null;
    const poster = contentOf(documento, 'meta[property="og:image"]');
    return { id, type: 'series', name: textOf(documento, 'h1') || id, description: contentOf(documento, 'meta[name="description"]'),
      poster, background: poster, genres: generos, releaseInfo: anio, videos: episodios, _idImdb: idImdb };
  }

  const slugFromName = nombre => nombre.toLowerCase().replace(/^the\s+/i, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');

  // Adivinamos el slug con peticiones HEAD: es barato y no descarga la página entera.
  async function guessSlug(nombre, rutaBase) {
    const base = slugFromName(nombre);
    for (const articulo of ARTICULOS_SLUG) {
      try {
        const respuesta = await politeFetch(URL_SOLOLATINO + rutaBase + articulo + base, { method: 'HEAD', credentials: 'include' });
        if (respuesta.ok) return articulo + base;
      } catch (error) {
        logIgnored('SoloLatino: falló la prueba del slug ' + articulo + base, error);
      }
    }
    return null;
  }

  // ============================================================
  // PUENTE CON CINEMETA (IDs DE IMDb)
  // ============================================================

  function seedKnownSlug(referencia) {
    const idImdb = referencia.id.split(':')[0];
    if (!referencia.id.startsWith('tt') || !SLUGS_POR_IMDB[idImdb]) return;
    ADDON_SOLOLATINO._slugs['tt:' + idImdb] = SLUGS_POR_IMDB[idImdb];
    ADDON_SOLOLATINO._idsImdb['tt:' + idImdb] = idImdb;
  }

  // Buscamos el slug de SoloLatino en segundo plano para que, al darle play a algo de Cinemeta,
  // las fuentes salgan sin esperar la búsqueda.
  async function warmUpSlugForImdb(referencia, ficha) {
    const idImdb = referencia.id.split(':')[0];
    if (!referencia.id.startsWith('tt') || !ficha.name || ADDON_SOLOLATINO._idsImdb['tt:' + idImdb]) return;
    const remember = slug => {
      ADDON_SOLOLATINO._slugs['tt:' + idImdb] = slug;
      ADDON_SOLOLATINO._idsImdb['tt:' + idImdb] = idImdb;
    };
    const consultas = [ficha.name];
    if (/^The /i.test(ficha.name)) consultas.push(ficha.name.replace(/^The /i, ''));
    for (const consulta of consultas) {
      try {
        const tarjetas = slParseCards(await slFetch('/buscar?q=' + encodeURIComponent(consulta)));
        if (tarjetas.length) { remember(tarjetas[0]._slug); return; }
      } catch (error) {
        logIgnored('SoloLatino: falló la búsqueda de ' + consulta, error);
      }
    }
    const slug = await guessSlug(ficha.name, referencia.type === 'movie' ? '/pelicula/' : '/serie/');
    if (slug) remember(slug);
  }

  // ============================================================
  // RESPUESTAS COMO ADDON
  // ============================================================

  const toPublicMeta = ({ _slug, ...resto }) => resto; // eslint-disable-line no-unused-vars
  const pagePath = (tipo, slug) => (tipo === 'movie' ? '/pelicula/' : '/serie/') + slug;

  async function respondCatalog(idCatalogo, consulta) {
    let html;
    if (consulta) {
      html = await withSlCache('search:' + consulta, () => slFetch('/buscar?q=' + encodeURIComponent(consulta)));
    } else {
      const rutaCatalogo = RUTAS_CATALOGO_SL[idCatalogo];
      if (!rutaCatalogo) return { metas: [] };
      html = await withSlCache('cat:' + rutaCatalogo, () => slFetch(rutaCatalogo));
    }
    return { metas: slParseCards(html).map(toPublicMeta) };
  }

  async function respondMeta(tipo, slug) {
    const html = await withSlCache('meta:' + slug, () => slFetch(pagePath(tipo, slug)));
    const ficha = slParseMeta(html, 'sl-' + slug);
    ficha.videos.forEach(v => {
      if (v._url) ADDON_SOLOLATINO._urlsVideo[v.id] = v._url;
      if (ficha._idImdb) ADDON_SOLOLATINO._idsImdb[v.id] = ficha._idImdb;
      ADDON_SOLOLATINO._slugs[v.id] = slug;
    });
    if (ficha._idImdb) ADDON_SOLOLATINO._idsImdb['sl-' + slug] = ficha._idImdb;
    ADDON_SOLOLATINO._slugs['sl-' + slug] = slug;
    ADDON_SOLOLATINO._nombres['sl-' + slug] = ficha.name;
    if (tipo === 'movie') {
      ficha.type = 'movie';
      if (!ficha.videos.length) ficha.videos = [{ id: 'sl-' + slug, title: ficha.name }];
    }
    return { meta: ficha };
  }

  // Si la ficha no se abrió antes (por ejemplo, viniendo del historial) no tenemos el ID: releemos la página.
  async function rereadImdbId(tipo, idVideo, idCompleto) {
    try {
      const slug = /^(\d+)x(\d+)$/.test(idVideo) ? ADDON_SOLOLATINO._slugs[idCompleto] : idVideo;
      if (!slug) return null;
      const ficha = slParseMeta(await slFetch(pagePath(tipo, slug)), 'sl-' + slug);
      if (ficha._idImdb) {
        ADDON_SOLOLATINO._idsImdb['sl-' + slug] = ficha._idImdb;
        ficha.videos.forEach(v => { ADDON_SOLOLATINO._idsImdb[v.id] = ficha._idImdb; });
      }
      return ADDON_SOLOLATINO._idsImdb[idCompleto] || ficha._idImdb || null;
    } catch (error) {
      logIgnored('SoloLatino: no se pudo releer la ficha de ' + idVideo, error);
      return null;
    }
  }

  // Último recurso: buscar el nombre en Cinemeta, que siempre trae IDs de IMDb.
  async function findImdbIdByName(tipo, idVideo, idCompleto) {
    try {
      const slug = /^(\d+)x(\d+)$/.test(idVideo) ? ADDON_SOLOLATINO._slugs[idCompleto] : idVideo;
      const nombre = ADDON_SOLOLATINO._nombres['sl-' + (slug || idVideo)] || (slug || idVideo).replace(/-/g, ' ');
      const respuesta = await fetchJSON(URL_CINEMETA + '/catalog/' + tipo + '/top/search=' + encodeURIComponent(nombre) + '.json');
      const coincidencia = (respuesta.metas || []).find(m => m.id && m.id.startsWith('tt'));
      if (!coincidencia) return null;
      ADDON_SOLOLATINO._idsImdb[idCompleto] = coincidencia.id;
      if (slug) ADDON_SOLOLATINO._idsImdb['sl-' + slug] = coincidencia.id;
      return coincidencia.id;
    } catch (error) {
      logIgnored('SoloLatino: Cinemeta no encontró ' + idVideo, error);
      return null;
    }
  }

  // Primero el CDN de insanos: entrega m3u8 directo y se reproduce en el <video> nativo.
  async function fetchInsanosStreams(tipo, idStremio) {
    try {
      const respuesta = await fetchJSON(URL_FUENTES_INSANOS + tipo + '/' + idStremio + '.json');
      return (respuesta.streams || []).filter(f => f && f.url);
    } catch (error) {
      logIgnored('insanos.net no entregó fuentes para ' + idStremio, error);
      return [];
    }
  }

  // La página del episodio como embed; MainActivity atrapa el m3u8 y lo pasa al reproductor nativo.
  // _referente viaja con la fuente porque varios reproductores solo cargan si vienen "desde" su web.
  const embedStream = (url, nombre, titulo) => ({ url, name: nombre, title: titulo, _tipo: 'embed', _referente: URL_SOLOLATINO });

  async function respondStreamSl(tipo, idVideo) {
    const idCompleto = 'sl-' + idVideo;
    const idImdb = ADDON_SOLOLATINO._idsImdb[idCompleto]
      || await rereadImdbId(tipo, idVideo, idCompleto)
      || await findImdbIdByName(tipo, idVideo, idCompleto);
    const tempEp = idVideo.match(/^(\d+)x(\d+)$/);
    const fuentes = idImdb ? await fetchInsanosStreams(tipo, tempEp ? idImdb + ':' + tempEp[1] + ':' + tempEp[2] : idImdb) : [];
    if (tempEp) {
      const slug = ADDON_SOLOLATINO._slugs[idCompleto] || ADDON_SOLOLATINO._slugs['sl-' + idVideo];
      if (slug) fuentes.push(embedStream(URL_SOLOLATINO + pagePath(tipo, slug) + '/temporada-' + tempEp[1] + '/episodio-' + tempEp[2], 'SoloLatino Web', 'Reproductor web (embed)'));
    } else if (tipo === 'movie') {
      fuentes.push(embedStream(URL_SOLOLATINO + '/pelicula/' + (ADDON_SOLOLATINO._slugs[idCompleto] || idVideo), 'SoloLatino Web', 'Reproductor web (embed)'));
    }
    return { streams: fuentes };
  }

  async function findSlugForImdb(tipo, idImdbBase) {
    const slugConocido = ADDON_SOLOLATINO._slugs['tt:' + idImdbBase];
    if (slugConocido) return slugConocido;
    for (const clave in ADDON_SOLOLATINO._idsImdb) {
      if (ADDON_SOLOLATINO._idsImdb[clave] === idImdbBase && ADDON_SOLOLATINO._slugs[clave]) return ADDON_SOLOLATINO._slugs[clave];
    }
    try {
      const respuesta = await fetchJSON(URL_CINEMETA + '/meta/' + tipo + '/' + idImdbBase + '.json');
      const nombre = respuesta.meta && respuesta.meta.name;
      if (!nombre) return null;
      const slug = await guessSlug(nombre, '/serie/');
      if (slug) ADDON_SOLOLATINO._slugs['tt:' + idImdbBase] = slug;
      return slug;
    } catch (error) {
      logIgnored('SoloLatino: Cinemeta no dio el nombre de ' + idImdbBase, error);
      return null;
    }
  }

  // IDs de IMDb (vienen de Cinemeta): mismo camino, insanos primero y la web de SoloLatino de respaldo.
  async function respondStreamImdb(tipo, idStremio) {
    const tempEp = idStremio.match(/^(tt\d+):(\d+):(\d+)$/);
    // Los especiales (temporada 0) no existen en SoloLatino; ni lo intentamos.
    if (tempEp && +tempEp[2] === 0) return { streams: [] };
    const fuentes = await fetchInsanosStreams(tipo, idStremio);
    if (!fuentes.length && tempEp) {
      const slug = await findSlugForImdb(tipo, tempEp[1]);
      if (slug) fuentes.push(embedStream(URL_SOLOLATINO + '/serie/' + slug + '/temporada-' + tempEp[2] + '/episodio-' + tempEp[3], 'SoloLatino', 'Reproductor SoloLatino (auto)'));
    }
    return { streams: fuentes };
  }

  async function respond(ruta) {
    const coincidenciaCatalogo = ruta.match(/^catalog\/(series|movie)\/(sl-\w+)(?:\/search=(.*))?\.json$/);
    if (coincidenciaCatalogo) {
      return respondCatalog(coincidenciaCatalogo[2], coincidenciaCatalogo[3] ? decodeURIComponent(coincidenciaCatalogo[3]) : '');
    }
    const coincidenciaFicha = ruta.match(/^meta\/(series|movie)\/sl-(.+)\.json$/);
    if (coincidenciaFicha) return respondMeta(coincidenciaFicha[1], coincidenciaFicha[2]);
    const coincidenciaStream = ruta.match(/^stream\/(series|movie)\/sl-(.+)\.json$/);
    if (coincidenciaStream) return respondStreamSl(coincidenciaStream[1], coincidenciaStream[2]);
    const coincidenciaStreamTt = ruta.match(/^stream\/(series|movie)\/(tt.+)\.json$/);
    if (coincidenciaStreamTt) return respondStreamImdb(coincidenciaStreamTt[1], decodeURIComponent(coincidenciaStreamTt[2]));
    return { err: 'not found' };
  }

  Telon.addonClient.registerVirtualAddon(ADDON_SOLOLATINO, respond);
  Telon.sololatino = { ADDON_SOLOLATINO, respond, slParseCards, slParseMeta, slugFromName, seedKnownSlug, warmUpSlugForImdb };
})(window.Telon = window.Telon || {});
