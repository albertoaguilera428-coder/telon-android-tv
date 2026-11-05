/*
Telón - Red simulada para las pruebas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Respuestas fijas para cada servicio que consulta la app (addons, SoloLatino, Narto,
Firebase). Así las pruebas no dependen de internet ni de que un sitio cambie.
*/
'use strict';

// ============================================================
// DATOS DE EJEMPLO
// ============================================================

const MANIFEST_CINEMETA = {
  id: 'org.cinemeta.es', name: 'Cinemeta ES', version: '1.0.0', description: 'Catálogo',
  resources: ['catalog', 'meta', 'stream', 'subtitles'], types: ['series', 'movie'], idPrefixes: ['tt'],
  catalogs: [{ type: 'series', id: 'top', name: 'Populares', extra: [{ name: 'search' }] }, { type: 'movie', id: 'top', name: 'Pelis' }]
};
const METAS_SERIES = [
  { id: 'tt001', type: 'series', name: 'Drama Coreano', poster: 'https://img/a.jpg', genres: ['Drama'], country: 'Korea', releaseInfo: '2023' },
  { id: 'tt002', type: 'series', name: 'The Show', genres: ['Comedia'], country: 'USA' }
];
const METAS_PELICULAS = [{ id: 'tt003', type: 'movie', name: 'Película Uno', genres: ['Acción'], countries: ['China'], year: 2020 }];
const HTML_SOLOLATINO = `<div class="card"><a href="/serie/los-simpson"><img alt="Los Simpson" src="https://img/s.jpg"></a></div>
<div class="card"><a href="/pelicula/matrix"><img alt="Matrix" src=""></a></div>`;
const SECCIONES_NARTO = { ok: true, sections: [{ items: [{ watch_url: '/watch?book_id=42', title: 'Amor Corto', poster_url: 'https://img/n.jpg', tag_names: ['Romance'] }] }] };
const FICHA_DRAMA = { id: 'tt001', name: 'Drama Coreano', description: 'Una historia', genres: ['Drama'], videos: [
  { id: 'tt001:1:2', season: 1, episode: 2, title: 'Dos' }, { id: 'tt001:1:1', season: 1, episode: 1, title: 'Uno' }, { id: 'tt001:2:1', season: 2, episode: 1 }] };

// ============================================================
// RUTEO
// ============================================================

function routeFirebase(url) {
  const operacion = url.match(/accounts:(\w+)/)[1];
  if (operacion === 'lookup') return { json: { users: [{ emailVerified: true }] } };
  return { json: { localId: 'uid1', email: 'ana@x.com', idToken: 'tok-' + operacion, displayName: 'Ana', emailVerified: false } };
}

// Devuelve { json } | { text } | { status } según la URL pedida.
function route(url) {
  if (url.includes('identitytoolkit')) return routeFirebase(url);
  if (url.includes('version.json')) return { json: { version: 1 } };
  if (url === 'https://insanos.net/cinemeta-es/manifest.json') return { json: MANIFEST_CINEMETA };
  if (url.endsWith('/manifest.json')) return { status: 500 };
  if (url.includes('/catalog/series/top/search=')) return { json: { metas: [METAS_SERIES[1]] } };
  if (url.includes('/catalog/series/top.json')) return { json: { metas: METAS_SERIES } };
  if (url.includes('/catalog/movie/top.json')) return { json: { metas: METAS_PELICULAS } };
  if (url.includes('cinemeta-es/meta/series/tt001')) return { json: { meta: FICHA_DRAMA } };
  if (url.includes('cinemeta-es/stream/')) return { json: { streams: [{ url: 'https://cdn/v.m3u8', name: 'HD\nx', title: 'T' }, { url: 'https://cdn/b.mp4', name: 'SD' }] } };
  if (url.includes('cinemeta-es/subtitles/')) return { json: { subtitles: [{ url: 'https://subs/es.srt', lang: 'spa' }] } };
  if (url.includes('subs/es.srt')) return { text: '1\n00:00:01,000 --> 00:00:02,000\nHola\n' };
  if (url.startsWith('https://sololatino.net/')) return { text: HTML_SOLOLATINO };
  if (url.includes('narto-drama.com/home/providers')) return { text: JSON.stringify(SECCIONES_NARTO) };
  if (url.includes('insanos.net/sololatino/stream')) return { json: { streams: [] } };
  if (url.includes('cinemeta.strem.io')) return { json: { metas: [] } };
  return { status: 404 };
}

module.exports = { route, MANIFEST_CINEMETA, METAS_SERIES };
