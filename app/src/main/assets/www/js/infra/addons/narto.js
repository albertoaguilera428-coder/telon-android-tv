/*
Telón - Addon virtual Narto Drama
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Dramas cortos de narto-drama.com (proveedor AnyReel). El sitio no tiene servidor
Stremio, así que leemos su API y sus páginas y respondemos como si fuéramos un addon:
catálogo de tendencias, ficha con capítulos y el enlace directo de cada episodio.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const { politeFetch } = Telon.infra.http;
  const { registerVirtualAddon } = Telon.infra.addonClient;
  const { createBoundedCache } = Telon.infra.cache;
  const { HttpError } = Telon.infra.errors;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const URL_NARTO = 'https://narto-drama.com';
  // Las tendencias cambian poco: 10 minutos evita repetir la descarga en cada vuelta al inicio.
  const DURACION_CACHE_MS = 600000;
  const MAXIMO_EN_CACHE = 100;
  const CABECERAS = { 'Accept-Language': 'es-419,es' };

  const ADDON_NARTO = {
    base: '__nartodrama__',
    manifest: {
      id: 'app.telon.nartodrama', version: '1.0.0', name: 'Narto Drama',
      description: 'Dramas cortos desde narto-drama.com (AnyReel)',
      resources: ['catalog', 'meta', 'stream'], types: ['series'], idPrefixes: ['nd-'],
      catalogs: [{ type: 'series', id: 'nd-tendencia', name: 'Tendencia', extra: [{ name: 'search' }] }]
    },
    enabled: true,
    _slugs: {}
  };

  // ============================================================
  // LECTURA DEL SITIO
  // ============================================================

  async function ndFetchText(ruta) {
    const respuesta = await politeFetch(URL_NARTO + ruta, { headers: CABECERAS });
    if (!respuesta.ok) throw new HttpError(respuesta.status);
    return respuesta.text();
  }

  const cacheNarto = createBoundedCache({ maximo: MAXIMO_EN_CACHE, vidaMs: DURACION_CACHE_MS });

  function toDrama(item) {
    const coincidenciaLibro = (item.watch_url || '').match(/book_id=(\d+)/);
    if (!coincidenciaLibro) return null;
    return {
      id: 'nd-' + coincidenciaLibro[1], type: 'series', name: item.title || 'Drama',
      poster: item.poster_url || '', description: item.description || '',
      genres: item.tag_names || [], _idLibro: coincidenciaLibro[1],
      _urlVer: item.watch_url.startsWith('http') ? item.watch_url : URL_NARTO + item.watch_url
    };
  }

  async function ndSections() {
    const guardadas = cacheNarto.get('secciones');
    if (guardadas) return guardadas;
    const datos = JSON.parse(await ndFetchText('/home/providers/sections?provider=anyreel&lang=es-ES&target_lang=es-ES'));
    if (!datos.ok || !datos.sections) return [];
    const dramas = [], vistos = new Set();
    for (const seccion of datos.sections) {
      for (const item of (seccion.items || [])) {
        const drama = toDrama(item);
        // Un mismo drama aparece en varias secciones; lo mostramos una sola vez.
        if (!drama || vistos.has(drama._idLibro)) continue;
        vistos.add(drama._idLibro);
        dramas.push(drama);
      }
    }
    cacheNarto.set('secciones', dramas);
    return dramas;
  }

  async function ndResolveSlug(idLibro) {
    if (ADDON_NARTO._slugs[idLibro]) return ADDON_NARTO._slugs[idLibro];
    const drama = (await ndSections()).find(x => x._idLibro === idLibro);
    if (!drama) return null;
    // Narto solo nos da un enlace con book_id; el slug real aparece al seguir la redirección.
    const respuesta = await politeFetch(drama._urlVer, { redirect: 'follow', headers: CABECERAS });
    if (!respuesta.ok) throw new HttpError(respuesta.status);
    const coincidenciaUrl = respuesta.url.match(/\/detail\/watch\/([^/?]+)/);
    // A veces no redirige y el slug viene escrito dentro del HTML.
    const coincidencia = coincidenciaUrl || (await respuesta.text()).match(/\/detail\/watch\/([a-z0-9-]+)/);
    if (!coincidencia) return null;
    ADDON_NARTO._slugs[idLibro] = coincidencia[1];
    return coincidencia[1];
  }

  function parseEpisodes(html, idLibro) {
    const coincidencia = html.match(/episodeItemsRaw\s*=\s*(\[[\s\S]*?\]);/);
    if (!coincidencia) return [];
    try {
      return JSON.parse(coincidencia[1]).map(e => ({
        id: 'nd-' + idLibro + ':' + e.number, title: e.title || 'Episodio ' + e.number,
        season: 1, episode: e.number, _url: e.direct_play_url || e.play_url || ''
      }));
    } catch (error) {
      // Si cambian el formato de episodios, mostramos la ficha sin capítulos en vez de romper la pantalla.
      logIgnored('Narto cambió el formato de episodios', error);
      return [];
    }
  }

  function parseMetaPage(html, idLibro, slug) {
    const tituloCrudo = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    const titulo = (tituloCrudo && tituloCrudo.replace(/ - Streaming.*/, '').trim()) || slug;
    const descripcion = (html.match(/name="description" content="([^"]*)"/) || [])[1] || '';
    const poster = (html.match(/property="og:image" content="([^"]*)"/)
      || html.match(/content="([^"]*)"[^>]*property="og:image"/) || [])[1] || '';
    return { id: 'nd-' + idLibro, type: 'series', name: titulo, description: descripcion, poster, background: poster,
      videos: parseEpisodes(html, idLibro) };
  }

  async function ndMeta(idLibro) {
    const claveCache = 'meta:' + idLibro;
    const guardada = cacheNarto.get(claveCache);
    if (guardada) return guardada;
    const slug = await ndResolveSlug(idLibro);
    if (!slug) return { id: 'nd-' + idLibro, type: 'series', name: 'Drama', videos: [] };
    const valor = parseMetaPage(await ndFetchText('/detail/watch/' + slug + '?lang=es-ES'), idLibro, slug);
    cacheNarto.set(claveCache, valor);
    return valor;
  }

  // ============================================================
  // RESPUESTAS COMO ADDON
  // ============================================================

  // Los campos internos (_idLibro, _urlVer) no salen hacia la interfaz.
  const toPublicMeta = ({ _idLibro, _urlVer, ...resto }) => resto; // eslint-disable-line no-unused-vars

  async function respond(ruta) {
    if (/^catalog\/series\/nd-\w+\.json$/.test(ruta)) {
      return { metas: (await ndSections()).map(toPublicMeta) };
    }
    const coincidenciaBusqueda = ruta.match(/^catalog\/series\/nd-\w+\/search=(.+)\.json$/);
    if (coincidenciaBusqueda) {
      // Narto no tiene buscador propio, así que la búsqueda filtra en memoria la lista de tendencias.
      const consulta = decodeURIComponent(coincidenciaBusqueda[1]).toLowerCase();
      const dramas = await ndSections();
      return { metas: dramas.filter(d => d.name.toLowerCase().includes(consulta)).map(toPublicMeta) };
    }
    const coincidenciaFicha = ruta.match(/^meta\/series\/nd-(.+)\.json$/);
    if (coincidenciaFicha) {
      return { meta: await ndMeta(coincidenciaFicha[1].split(':')[0]) };
    }
    const coincidenciaStream = ruta.match(/^stream\/series\/nd-(.+)\.json$/);
    if (coincidenciaStream) return respondStream(coincidenciaStream[1]);
    return { err: 'not found' };
  }

  async function respondStream(idEpisodio) {
    const posDosPuntos = idEpisodio.lastIndexOf(':');
    if (posDosPuntos < 0) return { streams: [] };
    const numeroEp = parseInt(idEpisodio.substring(posDosPuntos + 1), 10);
    const ficha = await ndMeta(idEpisodio.substring(0, posDosPuntos));
    const episodio = ficha.videos.find(v => v.episode === numeroEp);
    if (!episodio || !episodio._url) return { streams: [] };
    return { streams: [{ url: episodio._url, name: 'Narto Drama', title: episodio.title }] };
  }

  registerVirtualAddon(ADDON_NARTO, respond);
  Telon.infra.narto = { ADDON_NARTO, respond, parseMetaPage, isNartoAddon: base => base === ADDON_NARTO.base || (base || '').includes('/narto') };
})(window.Telon = window.Telon || {});
