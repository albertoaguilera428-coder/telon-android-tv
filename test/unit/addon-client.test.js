/*
Telón - Pruebas del cliente del protocolo de addons
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ sinArrancar: true });
// Reúne red (infra/http), protocolo (infra/addon-client) y reglas de países y episodios (dominio).
const { infra, domain } = app.Telon;
const cliente = Object.assign({}, infra.http, infra.addonClient, domain.countries, domain.episodes);
test.after(() => app.close());

const addonDePrueba = (recursos, extra = {}) => ({ base: 'https://a.x', manifest: { resources: recursos, types: ['series'], idPrefixes: ['tt'], ...extra } });

// ============================================================
// normalizeBase y buildAddonUrl
// ============================================================

test('normalizeBase acepta stremio://, la URL del manifest y barras sobrantes', () => {
  assert.equal(cliente.normalizeBase(' stremio://a.x/addon/manifest.json '), 'https://a.x/addon');
  assert.equal(cliente.normalizeBase('https://a.x/addon///'), 'https://a.x/addon');
  assert.equal(cliente.normalizeBase('http://192.168.1.20:7000/manifest.json?x=1'), 'http://192.168.1.20:7000');
});

test('propiedad: normalizeBase es idempotente y nunca termina en barra', () => {
  fc.assert(fc.property(fc.webUrl(), fc.constantFrom('', '/', '/manifest.json', '//'), (url, cola) => {
    const una = cliente.normalizeBase(url + cola);
    assert.equal(cliente.normalizeBase(una), una);
    assert.ok(!una.endsWith('/'));
  }));
});

test('buildAddonUrl codifica el id y agrega el extra antes de .json', () => {
  const addon = { base: 'https://a.x' };
  assert.equal(cliente.buildAddonUrl(addon, 'stream', 'series', 'tt1:1:2'), 'https://a.x/stream/series/tt1%3A1%3A2.json');
  assert.equal(cliente.buildAddonUrl(addon, 'catalog', 'movie', 'top', 'search=hola'), 'https://a.x/catalog/movie/top/search=hola.json');
});

// ============================================================
// supportsResource
// ============================================================

test('supportsResource respeta tipos y prefijos del manifest', () => {
  const addon = addonDePrueba(['stream']);
  assert.equal(cliente.supportsResource(addon, 'stream', 'series', 'tt123'), true);
  assert.equal(cliente.supportsResource(addon, 'stream', 'movie', 'tt123'), false);
  assert.equal(cliente.supportsResource(addon, 'stream', 'series', 'nd-1'), false);
  assert.equal(cliente.supportsResource(addon, 'subtitles', 'series', 'tt123'), false);
});

test('supportsResource deja que un recurso declare sus propios tipos y prefijos', () => {
  const addon = addonDePrueba(['catalog', { name: 'stream', types: ['movie'], idPrefixes: ['sl-'] }]);
  assert.equal(cliente.supportsResource(addon, 'stream', 'movie', 'sl-matrix'), true);
  assert.equal(cliente.supportsResource(addon, 'stream', 'series', 'tt1'), false);
});

// ============================================================
// Países
// ============================================================

test('getCountryCode normaliza las formas en que los addons escriben el país', () => {
  const casos = [['Korea', 'KR'], ['corea del sur', 'KR'], ['ESTADOS UNIDOS', 'US'], ['Japón', 'JP'], ['México', 'MX'],
    ['UK', 'UK'], ['Colombia', 'CO']];
  for (const [entrada, esperado] of casos) assert.equal(cliente.getCountryCode({ country: entrada }), esperado, entrada);
  assert.equal(cliente.getCountryCode({ countries: ['China', 'Japan'] }), 'CN');
  assert.equal(cliente.getCountryCode({}), '');
  assert.equal(cliente.getCountryCode(null), '');
});

test('getCountryLabel traduce códigos conocidos y deja pasar los demás', () => {
  assert.equal(cliente.getCountryLabel('KR'), 'Corea');
  assert.equal(cliente.getCountryLabel('ZZ'), 'ZZ');
});

test('propiedad: getCountryCode devuelve como máximo dos letras', () => {
  fc.assert(fc.property(fc.string(), pais => {
    assert.ok(cliente.getCountryCode({ country: pais }).length <= 2);
  }));
});

// ============================================================
// Episodios
// ============================================================

test('sortVideos ordena por temporada y episodio', () => {
  const ordenados = cliente.sortVideos([{ id: 'c', season: 2, episode: 1 }, { id: 'b', season: 1, episode: 2 }, { id: 'a', season: 1, episode: 1 }]);
  assert.deepEqual(plain(ordenados.map(v => v.id)), ['a', 'b', 'c']);
});

test('propiedad: sortVideos es una permutación ordenada por temporada', () => {
  const video = fc.record({ id: fc.uuid(), season: fc.option(fc.nat(5), { nil: undefined }), episode: fc.option(fc.nat(30), { nil: undefined }) });
  fc.assert(fc.property(fc.array(video), videos => {
    const ordenados = cliente.sortVideos(videos);
    assert.deepEqual([...ordenados.map(v => v.id)].sort(), [...videos.map(v => v.id)].sort());
    for (let i = 1; i < ordenados.length; i++) assert.ok((ordenados[i - 1].season || 0) <= (ordenados[i].season || 0));
  }));
});

test('buildEpisodeList convierte una película o ficha sin videos en un solo ítem', () => {
  assert.deepEqual(plain(cliente.buildEpisodeList({ id: 'tt9', name: 'Matrix' })), [{ id: 'tt9', title: 'Matrix' }]);
  assert.deepEqual(plain(cliente.buildEpisodeList({ id: 'x', videos: [null, { id: 'e2', episode: 2 }, { id: 'e1', episode: 1 }] }).map(v => v.id)), ['e1', 'e2']);
});

test('convertSrtToVtt agrega la cabecera y cambia la coma decimal', () => {
  assert.equal(cliente.convertSrtToVtt('1\r\n00:00:01,500 --> 00:00:02,000\r\nHola'), 'WEBVTT\n\n1\n00:00:01.500 --> 00:00:02.000\nHola');
  assert.equal(cliente.convertSrtToVtt('WEBVTT\n\nya'), 'WEBVTT\n\nya');
});

// ============================================================
// Red: addons virtuales, tiempo de espera y fuentes
// ============================================================

test('getJSON envía las rutas de un addon virtual a su respondedor', async () => {
  cliente.registerVirtualAddon({ base: '__prueba__' }, async ruta => ({ ruta }));
  assert.deepEqual(plain(await cliente.getJSON('__prueba__/catalog/series/x.json')), { ruta: 'catalog/series/x.json' });
});

test('getJSON responde "not found" si el addon virtual no reconoce la ruta', async () => {
  cliente.registerVirtualAddon({ base: '__mudo__' }, async () => null);
  assert.deepEqual(plain(await cliente.getJSON('__mudo__/meta/x.json')), { err: 'not found' });
});

test('fetchRemoteJSON corta con un mensaje claro cuando se agota el tiempo', async () => {
  const original = app.window.fetch;
  app.window.fetch = (url, { signal }) => new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(Object.assign(new Error('x'), { name: 'AbortError' }))));
  try {
    await assert.rejects(cliente.fetchRemoteJSON('https://lento.x', 5), /tiempo de espera agotado/);
  } finally {
    app.window.fetch = original;
  }
});

test('resolveStreams avisa con la primera fuente reproducible y devuelve todas', async () => {
  cliente.registerVirtualAddon({ base: '__embed__' }, async () => ({ streams: [{ url: 'https://web', _tipo: 'embed' }] }));
  cliente.registerVirtualAddon({ base: '__nativo__' }, async () => ({ streams: [{ url: 'https://cdn/v.m3u8' }, { sin: 'url' }] }));
  const addons = ['__embed__', '__nativo__'].map(base => ({ base, manifest: { resources: ['stream'] } }));
  const avisos = [];
  const todas = await cliente.resolveStreams(addons, 'series', 'tt1', fuentes => avisos.push(fuentes.map(f => f.url)), f => f._tipo !== 'embed');
  assert.deepEqual(plain(avisos), [['https://cdn/v.m3u8']]);
  assert.deepEqual(plain(todas.map(f => f.url)), ['https://cdn/v.m3u8']);
});

test('resolveSubs prefiere el subtítulo en español', async () => {
  cliente.registerVirtualAddon({ base: '__subs__' }, async () => ({ subtitles: [{ url: 'en.srt', lang: 'eng' }, { url: 'es.srt', lang: 'spa' }] }));
  const sub = await cliente.resolveSubs([{ base: '__subs__', manifest: { resources: ['subtitles'] } }], 'series', 'tt1', []);
  assert.equal(sub.url, 'es.srt');
});

// ============================================================
// CASOS QUE SEÑALARON LAS PRUEBAS DE MUTACIÓN
// ============================================================

// Un nombre por cada patrón de la tabla. Solo cuenta si el país va al principio: "North Korea" no
// es Corea del Sur y "Zona China" no es China (cae en sus dos primeras letras, como cualquier
// país desconocido).
const UN_NOMBRE_POR_PATRON = [['China', 'CN'], ['USA', 'US'], ['Corea', 'KR'], ['Japón', 'JP'], ['Thailand', 'TH'], ['Taiwán', 'TW'],
  ['Spain', 'ES'], ['México', 'MX'], ['India', 'IN'], ['Reino Unido', 'UK'], ['Alemania', 'DE'], ['Francia', 'FR'], ['Italia', 'IT'],
  ['Brasil', 'BR'], ['Canadá', 'CA'], ['Australia', 'AU'], ['Austria', 'AT'], ['Rusia', 'RU'], ['Indonesia', 'ID'], ['Filipinas', 'PH'],
  ['Turquía', 'TR'], ['Ucrania', 'UA'], ['Colombia', 'CO'], ['Argentina', 'AR'], ['Chile', 'CL'], ['Perú', 'PE'], ['Hong Kong', 'HK']];

test('cada país de la tabla se reconoce solo si va al principio', () => {
  for (const [nombre, codigo] of UN_NOMBRE_POR_PATRON) {
    assert.equal(cliente.getCountryCode({ country: nombre }), codigo, nombre);
    assert.equal(cliente.getCountryCode({ country: 'Zona ' + nombre }), 'ZO', 'Zona ' + nombre);
  }
  assert.equal(cliente.getCountryCode({ country: 'North Korea' }), 'NO');
});

test('Turquía se reconoce en sus formas: Turkey, Turquía, Türkiye y Turkiye', () => {
  for (const forma of ['Turkey', 'Turquía', 'Türkiye', 'Turkiye']) assert.equal(cliente.getCountryCode({ country: forma }), 'TR', forma);
});

test('los países sin patrón dan sus dos primeras letras, con o sin tilde', () => {
  for (const [forma, codigo] of [['Canadá', 'CA'], ['Canada', 'CA'], ['Perú', 'PE'], ['Peru', 'PE'], ['Brazil', 'BR'], ['Italian', 'IT'], ['Indian', 'IN']]) {
    assert.equal(cliente.getCountryCode({ country: forma }), codigo, forma);
  }
});

test('Estados Unidos se reconoce con o sin puntos y espacios', () => {
  for (const forma of ['EEUU', 'EE UU', 'EE.UU.', 'EE. UU.', 'Estados Unidos', 'United States', 'American']) {
    assert.equal(cliente.getCountryCode({ country: forma }), 'US', forma);
  }
});

test('con varios países manda el primero, también si es un código que se traduce (GB → UK)', () => {
  assert.equal(cliente.getCountryCode({ countries: ['GB', 'US'] }), 'UK');
  assert.equal(cliente.getCountryCode({ countries: ['Korea', 'USA'] }), 'KR');
});

test('getCountryCode compara desde el inicio: "Argentina" no es India ni "Rusia" es EEUU', () => {
  assert.equal(cliente.getCountryCode({ country: 'Argentina' }), 'AR');
  assert.equal(cliente.getCountryCode({ country: 'Rusia' }), 'RU');
  assert.equal(cliente.getCountryCode({ country: 'Bután' }), 'BU');
  assert.equal(cliente.getCountryCode({ country: '  Korea' }), 'KR');
  for (const [entrada, esperado] of [['Thailand', 'TH'], ['Taiwán', 'TW'], ['España', 'ES'], ['India', 'IN'], ['British', 'UK'], ['Chinese', 'CN']]) {
    assert.equal(cliente.getCountryCode({ country: entrada }), esperado, entrada);
  }
});

test('getCountryLabel conoce todas las etiquetas en español', () => {
  const esperadas = { CN: 'China', US: 'EEUU', KR: 'Corea', JP: 'Japón', ES: 'España', MX: 'México', CO: 'Colombia', AR: 'Argentina', TH: 'Tailandia', TW: 'Taiwán', IN: 'India', UK: 'UK', GB: 'UK' };
  for (const [codigo, etiqueta] of Object.entries(esperadas)) assert.equal(cliente.getCountryLabel(codigo), etiqueta);
});

test('supportsResource acepta el id si coincide con cualquiera de los prefijos', () => {
  const addon = addonDePrueba(['meta'], { idPrefixes: ['tt', 'nd-'] });
  assert.equal(cliente.supportsResource(addon, 'meta', 'series', 'nd-42'), true);
});

test('sortVideos conserva el orden original entre episodios sin número', () => {
  const ordenados = cliente.sortVideos([{ id: 'x' }, { id: 'y' }, { id: 'z' }]);
  assert.deepEqual(plain(ordenados.map(v => v.id)), ['x', 'y', 'z']);
  const empatados = cliente.sortVideos([{ id: 'b', season: 1, episode: 1 }, { id: 'a', season: 1, episode: 1 }]);
  assert.deepEqual(plain(empatados.map(v => v.id)), ['b', 'a']);
});

test('fetchRemoteJSON informa el código HTTP con un error tipado', async () => {
  const original = app.window.fetch;
  app.window.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  try {
    await assert.rejects(cliente.fetchRemoteJSON('https://caido.x'), error => error.name === 'HttpError' && error.status === 503 && /HTTP 503/.test(error.message));
  } finally {
    app.window.fetch = original;
  }
});

test('getJSON solo usa el addon virtual si la URL trae una ruta después de la base', async () => {
  cliente.registerVirtualAddon({ base: '__vacio__' }, async () => ({ virtual: true }));
  app.log.length = 0;
  await cliente.getJSON('__vacio__/').catch(() => {});
  await cliente.getJSON('/__vacio__/x.json').catch(() => {});
  assert.equal(app.log.filter(l => l.startsWith('fetch')).length, 2);
});

test('resolveStreams sin filtro deja pasar todo, avisa una sola vez y tolera addons caídos', async () => {
  cliente.registerVirtualAddon({ base: '__a__' }, async () => ({ streams: [{ url: 'https://a', _tipo: 'embed' }] }));
  cliente.registerVirtualAddon({ base: '__b__' }, async () => ({ streams: [{ url: 'https://b' }] }));
  cliente.registerVirtualAddon({ base: '__roto__' }, async () => { throw new Error('caído'); });
  const addons = ['__a__', '__roto__', '__b__'].map(base => ({ base, manifest: { resources: ['stream'] } }));
  const avisos = [];
  const todas = await cliente.resolveStreams(addons, 'series', 'tt1', fuentes => avisos.push(fuentes));
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].length, 1, 'el aviso recibe una copia, no la lista que sigue creciendo');
  assert.deepEqual(plain(todas.map(f => f.url).sort()), ['https://a', 'https://b']);
  assert.equal(todas[0].addon.base === '__a__' || todas[0].addon.base === '__b__', true);
});

test('resolveSubs también usa los subtítulos que vienen dentro de las fuentes', async () => {
  const sub = await cliente.resolveSubs([], 'series', 'tt1', [{ subtitles: [null, { url: 'pt.srt', lang: 'por' }, { url: 'es.vtt', lang: 'es-419' }] }]);
  assert.equal(sub.url, 'es.vtt');
  assert.equal(await cliente.resolveSubs([], 'series', 'tt1', []), null);
});

// ============================================================
// PAÍSES: NOMBRES QUE ANTES CAÍAN EN OTRO PAÍS
// ============================================================

test('getCountryCode reconoce nombres que antes se confundían con otro país', () => {
  const casos = [['Great Britain', 'UK'], ['United Kingdom', 'UK'], ['Reino Unido', 'UK'], ['Indonesia', 'ID'], ['India', 'IN'],
    ['Estonia', 'ES'], ['Ukraine', 'UA'], ['Ucrania', 'UA'], ['Alemania', 'DE'], ['Germany', 'DE'], ['Austria', 'AT'], ['Australia', 'AU'],
    ['Filipinas', 'PH'], ['Turquía', 'TR'], ['South Korea', 'KR'], ['EE.UU.', 'US'], ['Spain', 'ES'], ['Thailand', 'TH']];
  for (const [entrada, esperado] of casos) assert.equal(cliente.getCountryCode({ country: entrada }), esperado, entrada);
});

test('getCountryCode respeta los códigos de dos letras que ya manda el addon', () => {
  assert.equal(cliente.getCountryCode({ country: 'de' }), 'DE');
  assert.equal(cliente.getCountryCode({ country: 'GB' }), 'UK');
  assert.equal(cliente.getCountryCode({ country: 'IN' }), 'IN');
});

test('propiedad: un código de dos letras siempre se devuelve tal cual (salvo GB → UK)', () => {
  fc.assert(fc.property(fc.stringMatching(/^[A-Z]{2}$/), codigo => {
    assert.equal(cliente.getCountryCode({ country: codigo }), codigo === 'GB' ? 'UK' : codigo);
  }));
});

test('getCountryLabel nombra en español los países nuevos', () => {
  assert.equal(cliente.getCountryLabel('DE'), 'Alemania');
  assert.equal(cliente.getCountryLabel('UA'), 'Ucrania');
});

// ============================================================
// EPISODIOS DEDUCIDOS DE LA DESCRIPCIÓN
// ============================================================

test('una serie sin lista de videos pero con "N episodios" en la descripción arma N episodios', () => {
  const episodios = plain(cliente.buildEpisodeList({ id: 'tt7', type: 'series', name: 'X', description: 'Drama de 12 episodios' }));
  assert.equal(episodios.length, 12);
  assert.deepEqual(episodios[0], { id: 'tt7:1:1', title: 'Episodio 1', season: 1, episode: 1 });
  assert.equal(episodios[11].id, 'tt7:1:12');
});

test('una película con "episodios" en la sinopsis sigue siendo un solo ítem', () => {
  assert.deepEqual(plain(cliente.buildEpisodeList({ id: 'tt8', type: 'movie', name: 'Peli', description: 'Basada en 3 episodios reales' })), [{ id: 'tt8', title: 'Peli' }]);
});

test('los episodios deducidos tienen un tope de 300', () => {
  assert.equal(cliente.buildEpisodeList({ id: 'x', type: 'series', description: '9999 episodios' }).length, 300);
});

test('si la ficha trae videos, la descripción no se usa', () => {
  assert.equal(cliente.buildEpisodeList({ id: 'x', type: 'series', description: '50 episodios', videos: [{ id: 'v1' }] }).length, 1);
});

// ============================================================
// LÍMITES DE CONSUMO (429 Y Retry-After)
// ============================================================

test('parseRetryAfter entiende segundos y fechas HTTP, con 30 s por defecto y 10 min de tope', () => {
  const ahora = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(cliente.parseRetryAfter('120', ahora), 120000);
  assert.equal(cliente.parseRetryAfter('Wed, 04 Nov 2026 12:01:00 GMT', ahora), 60000);
  assert.equal(cliente.parseRetryAfter(null, ahora), 30000);
  assert.equal(cliente.parseRetryAfter('basura', ahora), 30000);
  assert.equal(cliente.parseRetryAfter('99999', ahora), 600000);
  assert.equal(cliente.parseRetryAfter('-5', ahora), 0);
});

test('después de un 429 no se vuelve a consultar ese servidor hasta que pase el Retry-After', async () => {
  const appLimite = loadApp({ hasta: 'js/infra/addon-client.js' });
  const red = appLimite.Telon.infra.http;
  let ahora = 1000000, peticiones = 0;
  appLimite.window.Date.now = () => ahora;
  appLimite.window.fetch = async () => {
    peticiones++;
    return peticiones === 1
      ? { ok: false, status: 429, headers: { get: nombre => nombre === 'Retry-After' ? '60' : null }, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ metas: [] }) };
  };
  await assert.rejects(red.fetchRemoteJSON('https://saturado.x/catalog/a.json'), /reintenta en 60 s/);
  await assert.rejects(red.fetchRemoteJSON('https://saturado.x/catalog/b.json'), /pidió esperar/);
  assert.equal(peticiones, 1, 'la segunda consulta no salió a la red');
  assert.deepEqual(plain(await red.fetchRemoteJSON('https://otro.x/catalog/a.json')), { metas: [] }, 'otros servidores siguen funcionando');
  ahora += 61000;
  assert.deepEqual(plain(await red.fetchRemoteJSON('https://saturado.x/catalog/a.json')), { metas: [] });
  appLimite.close();
});

// ============================================================
// FUENTES Y SUBTÍTULOS CON ADDONS QUE RESPONDEN, FALLAN O NO SABEN (CASOS DE LA MUTACIÓN)
// ============================================================

// Una app nueva con respuestas a medida por URL y los avisos de consola a la vista.
function withAnswers(respuestas) {
  const app = loadApp({ hasta: 'js/infra/addon-client.js', route: url => respuestas[Object.keys(respuestas).find(parte => url.includes(parte))] || { status: 404 } });
  const avisos = [];
  app.window.console.warn = (...partes) => avisos.push(partes.join(' '));
  return { app, cliente: app.Telon.infra.addonClient, avisos, pedidos: () => app.log.filter(l => l.startsWith('fetch')) };
}

const conStream = base => ({ base, manifest: { resources: ['stream', 'subtitles'], types: ['series'], idPrefixes: ['tt'] } });
const sinStream = base => ({ base, manifest: { resources: ['catalog'], types: ['series'] } });

test('a un addon que no ofrece fuentes no se le piden', async () => {
  const { app, cliente, pedidos } = withAnswers({ 'https://a.x/stream/': { json: { streams: [{ url: 'https://v/1' }] } } });
  const fuentes = await cliente.resolveStreams([conStream('https://a.x'), sinStream('https://b.x')], 'series', 'tt1');
  assert.equal(fuentes.length, 1);
  assert.ok(!pedidos().some(p => p.includes('https://b.x')), 'b.x no tiene el recurso stream');
  app.close();
});

test('un addon que contesta sin fuentes, o que falla, no aporta nada; el que falla queda registrado', async () => {
  const { app, cliente, avisos } = withAnswers({ 'https://a.x/stream/': { json: {} }, 'https://c.x/stream/': { json: { streams: [{ url: 'https://v/c' }] } } });
  const fuentes = await cliente.resolveStreams([conStream('https://a.x'), conStream('https://b.x'), conStream('https://c.x')], 'series', 'tt1');
  assert.deepEqual(plain(fuentes).map(f => f.url), ['https://v/c'], 'a.x sin streams y b.x con error no aportan');
  assert.ok(avisos.some(a => a.includes('https://b.x') && a.includes('no entregó fuentes')), 'el fallo de b.x no se pierde en silencio');
  assert.ok(!avisos.some(a => a.includes('https://a.x')), 'contestar sin fuentes no es un fallo: a.x no queda registrado como error');
  app.close();
});

test('los subtítulos se buscan en las fuentes y en los addons que los ofrecen; se prefiere el español', async () => {
  const { app, cliente, pedidos } = withAnswers({ 'https://a.x/subtitles/': { json: { subtitles: [{ url: 'https://s/en', lang: 'eng' }, { url: 'https://s/es', lang: 'spa' }] } } });
  const fuentes = [{ subtitles: [{ url: 'https://s/fr', lang: 'fre' }, { lang: 'spa' }] }];
  const elegido = await cliente.resolveSubs([conStream('https://a.x'), sinStream('https://b.x')], 'series', 'tt1', fuentes);
  assert.equal(elegido.url, 'https://s/es', 'el subtítulo sin url se descarta; gana el español');
  assert.ok(!pedidos().some(p => p.includes('https://b.x')), 'a quien no ofrece subtítulos no se le piden');
  app.close();
});

test('sin español se toma el primero; el idioma se reconoce solo al principio del código', async () => {
  const { app, cliente } = withAnswers({ 'https://a.x/subtitles/': { json: { subtitles: [{ url: 'https://s/pt', lang: 'por' }, { url: 'https://s/tes', lang: 'tes' }] } } });
  const elegido = await cliente.resolveSubs([conStream('https://a.x')], 'series', 'tt1', []);
  assert.equal(elegido.url, 'https://s/pt', '«tes» no es español aunque contenga «es»');
  app.close();
});

test('si los addons no tienen subtítulos o fallan, no hay subtítulo (y el fallo queda registrado)', async () => {
  const { app, cliente, avisos } = withAnswers({ 'https://a.x/subtitles/': { json: {} } });
  const elegido = await cliente.resolveSubs([conStream('https://a.x'), conStream('https://b.x')], 'series', 'tt1', [{}]);
  assert.equal(elegido, null);
  assert.ok(avisos.some(a => a.includes('https://b.x') && a.includes('no entregó subtítulos')));
  assert.ok(!avisos.some(a => a.includes('https://a.x')), 'contestar sin subtítulos no es un fallo');
  app.close();
});

test('un addon sin recursos declarados no ofrece nada', () => {
  assert.equal(cliente.supportsResource({ base: 'x', manifest: {} }, 'stream', 'series', 'tt1'), false);
});

test('stremio:// solo se reemplaza al principio del enlace', () => {
  assert.equal(cliente.normalizeBase('https://a.x/?volver=stremio://b'), 'https://a.x/?volver=stremio://b');
});

test('un SRT que menciona WEBVTT en un diálogo igual se convierte', () => {
  assert.equal(cliente.convertSrtToVtt('1\n00:00:01,000 --> 00:00:02,000\nWEBVTT es un formato'), 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nWEBVTT es un formato');
});

test('el subtítulo descargado se entrega como WebVTT listo para el reproductor', async () => {
  const { app, cliente } = withAnswers({ 'https://s/es.srt': { text: '1\n00:00:01,000 --> 00:00:02,000\nHola' } });
  let archivo = null;
  app.window.URL.createObjectURL = blob => { archivo = blob; return 'blob:sub'; };
  assert.equal(await cliente.subBlob('https://s/es.srt'), 'blob:sub');
  assert.equal(archivo.type, 'text/vtt');
  assert.ok(archivo.size > 'WEBVTT'.length, 'lleva el contenido convertido');
  app.close();
});
