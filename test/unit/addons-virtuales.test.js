/*
Telón - Pruebas de los addons virtuales (Narto Drama y SoloLatino)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Prueban el análisis de páginas y las respuestas como addon con HTML de ejemplo; si los
sitios cambian su estructura, estas pruebas no lo detectan (no consultan la red real).
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: ['js/infra/addons/sololatino.js', 'js/infra/addons/narto.js'] });
const { narto, sololatino } = app.Telon.infra;
test.after(() => app.close());

// ============================================================
// NARTO DRAMA
// ============================================================

const PAGINA_NARTO = `<title>Amor Corto - Streaming gratis</title><meta name="description" content="Un drama">
<meta property="og:image" content="https://img/p.jpg"><script>var episodeItemsRaw = [{"number":1,"title":"Inicio","direct_play_url":"https://v/1.m3u8"},{"number":2,"play_url":"https://v/2.m3u8"}];</script>`;

test('Narto: lee título, descripción, póster y episodios de la página', () => {
  const ficha = plain(narto.parseMetaPage(PAGINA_NARTO, '42', 'amor-corto'));
  assert.equal(ficha.name, 'Amor Corto');
  assert.equal(ficha.description, 'Un drama');
  assert.equal(ficha.poster, 'https://img/p.jpg');
  assert.deepEqual(ficha.videos.map(v => [v.id, v.title, v._url]), [['nd-42:1', 'Inicio', 'https://v/1.m3u8'], ['nd-42:2', 'Episodio 2', 'https://v/2.m3u8']]);
});

test('Narto: si cambia el formato de episodios, la ficha sale sin capítulos en vez de fallar', () => {
  const ficha = narto.parseMetaPage('<title>X</title><script>episodeItemsRaw = [roto];</script>', '1', 'x');
  assert.equal(ficha.videos.length, 0);
});

test('Narto: reconoce sus addons por base virtual o por la ruta /narto', () => {
  assert.equal(narto.isNartoAddon('__nartodrama__'), true);
  assert.equal(narto.isNartoAddon('https://insanos.net/narto'), true);
  assert.equal(narto.isNartoAddon('https://insanos.net/cinemeta-es'), false);
  assert.equal(narto.isNartoAddon(undefined), false);
});

// ============================================================
// SOLOLATINO
// ============================================================

test('SoloLatino: arma tarjetas con slug y tipo a partir del HTML del catálogo', () => {
  const html = '<div class="card"><a href="/serie/los-simpson"><img alt="Los Simpson" src="https://img/s.jpg"></a></div><div class="card"><a href="/pelicula/matrix"><img alt="" src=""></a></div><div class="card">sin enlace</div><div class="card"><a href="/serie/x"><img alt="X" src="/img/x.jpg"></a></div>';
  assert.deepEqual(plain(sololatino.slParseCards(html)), [
    { id: 'sl-los-simpson', type: 'series', name: 'Los Simpson', poster: 'https://img/s.jpg', _slug: 'los-simpson' },
    { id: 'sl-matrix', type: 'movie', name: 'matrix', poster: '', _slug: 'matrix' },
    { id: 'sl-x', type: 'series', name: 'X', poster: 'https://sololatino.net/img/x.jpg', _slug: 'x' }
  ]);
});

test('SoloLatino: lee la ficha con episodios por temporada y el ID de IMDb', () => {
  const html = `<h1> Los Simpson </h1><meta name="description" content="Familia"><a href="/genero/comedia">Comedia</a><span class="text-xs">Año 1989</span>
    <a class="ep-item" href="/serie/los-simpson/temporada-1/episodio-2"><span class="font-semibold">Dos</span></a>
    <a class="ep-item" href="/serie/los-simpson/temporada-1/episodio-1"></a><a href="https://www.imdb.com/title/tt0096697/">IMDb</a>`;
  const ficha = plain(sololatino.slParseMeta(html, 'sl-los-simpson'));
  assert.equal(ficha.name, 'Los Simpson');
  assert.deepEqual(ficha.genres, ['Comedia']);
  assert.equal(ficha.releaseInfo, '1989');
  assert.equal(ficha._idImdb, 'tt0096697');
  assert.deepEqual(ficha.videos.map(v => [v.id, v.title]), [['sl-1x2', 'Dos'], ['sl-1x1', 'Episodio 1']]);
});

test('SoloLatino: arma el slug como lo nombra el sitio (sin "The" ni signos)', () => {
  assert.equal(sololatino.slugFromName('The Last of Us: Part 2!'), 'last-of-us-part-2');
});

test('SoloLatino: los especiales (temporada 0) no se buscan', async () => {
  app.log.length = 0;
  assert.deepEqual(plain(await sololatino.respond('stream/series/tt0096697%3A0%3A3.json')), { streams: [] });
  assert.equal(app.log.length, 0);
});

test('SoloLatino: las fuentes embebidas llevan el referente del sitio', async () => {
  const respuesta = plain(await sololatino.respond('stream/movie/sl-matrix.json'));
  const embed = respuesta.streams.find(f => f._tipo === 'embed');
  assert.equal(embed.url, 'https://sololatino.net/pelicula/matrix');
  assert.equal(embed._referente, 'https://sololatino.net');
});
