/*
Telón - Pruebas de la caché (cache-aside, estampida, invalidación y métricas)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');
const { route } = require('../support/fixtures');

const nuevaCache = (opciones = {}) => {
  const app = loadApp({ hasta: 'js/infra/cache.js' });
  return { app, cache: app.Telon.infra.cache.createBoundedCache({ maximo: 10, vidaMs: 1e9, ...opciones }) };
};

// ============================================================
// ESTAMPIDA: UNA SOLA CARGA PARA PEDIDOS SIMULTÁNEOS
// ============================================================

test('si varios piden la misma clave a la vez, se carga una sola vez y todos reciben el resultado', async () => {
  const { app, cache } = nuevaCache();
  let cargas = 0, terminar;
  const cargador = () => { cargas++; return new Promise(r => { terminar = r; }); };
  const pedidos = [1, 2, 3, 4].map(() => cache.getOrLoad('x', cargador));
  terminar('valor');
  assert.deepEqual(await Promise.all(pedidos), ['valor', 'valor', 'valor', 'valor']);
  assert.equal(cargas, 1);
  app.close();
});

test('un error no queda guardado: todos los que esperaban lo reciben y el siguiente pedido reintenta', async () => {
  const { app, cache } = nuevaCache();
  let cargas = 0;
  const falla = () => { cargas++; return Promise.reject(new Error('caído')); };
  const resultados = await Promise.allSettled([cache.getOrLoad('x', falla), cache.getOrLoad('x', falla)]);
  assert.deepEqual(resultados.map(r => r.status), ['rejected', 'rejected']);
  assert.equal(cargas, 1);
  assert.equal(await cache.getOrLoad('x', async () => 'ahora sí'), 'ahora sí');
  app.close();
});

// ============================================================
// VALORES COMPARTIDOS Y MÉTRICAS
// ============================================================

test('lo guardado no se puede modificar desde afuera (todos reciben el mismo objeto)', () => {
  const { app, cache } = nuevaCache();
  cache.set('ficha', { name: 'Serie', videos: [{ id: 'e1' }] });
  const ficha = cache.get('ficha');
  assert.throws(() => { ficha.name = 'otra'; });
  assert.throws(() => { ficha.videos.push({ id: 'e2' }); });
  app.close();
});

test('cuenta aciertos, fallos, descartes y cargas compartidas', async () => {
  const { app, cache } = nuevaCache({ maximo: 1 });
  cache.get('nada');
  cache.set('a', 1);
  cache.get('a');
  cache.set('b', 2);
  await Promise.all([cache.getOrLoad('c', async () => 3), cache.getOrLoad('c', async () => 3)]);
  assert.deepEqual(plain(cache.stats()), { aciertos: 1, fallos: 2, descartes: 2, cargasCompartidas: 1, tamano: 1, maximo: 1 });
  cache.clear();
  assert.equal(cache.stats().tamano, 0);
  app.close();
});

// ============================================================
// ADDONS VIRTUALES
// ============================================================

const contarPeticiones = (app, parte) => app.log.filter(l => l.startsWith('fetch') && l.includes(parte)).length;

test('una búsqueda en SoloLatino descarga la página de resultados una sola vez', async () => {
  const app = loadApp({ hasta: 'js/app/catalog-service.js' });
  const { reloadDefaultAddons, searchCatalogs } = app.Telon.app.catalogService;
  await reloadDefaultAddons();
  app.log.length = 0;
  await searchCatalogs('show');
  assert.equal(contarPeticiones(app, 'sololatino.net/buscar'), 1);
  app.close();
});

test('una película y una serie con el mismo slug no comparten la ficha guardada', async () => {
  const app = loadApp({
    hasta: 'js/infra/addons/sololatino.js',
    route: url => url.endsWith('/pelicula/matrix') ? { text: '<h1>Matrix (película)</h1>' }
      : url.endsWith('/serie/matrix') ? { text: '<h1>Matrix (serie)</h1>' } : route(url)
  });
  const { respond } = app.Telon.infra.sololatino;
  const pelicula = await respond('meta/movie/sl-matrix.json');
  const serie = await respond('meta/series/sl-matrix.json');
  assert.equal(pelicula.meta.name, 'Matrix (película)');
  assert.equal(serie.meta.name, 'Matrix (serie)');
  app.close();
});

test('«Recargar addons» trae contenido nuevo de SoloLatino y Narto en vez de servir la caché', async () => {
  const app = loadApp({ hasta: 'js/app/catalog-service.js' });
  const { reloadDefaultAddons, loadCatalogs } = app.Telon.app.catalogService;
  await reloadDefaultAddons();
  await loadCatalogs();
  app.log.length = 0;
  await loadCatalogs();
  assert.equal(contarPeticiones(app, 'sololatino.net/series'), 0, 'sin recargar, sale de la caché');
  await reloadDefaultAddons();
  await loadCatalogs();
  assert.equal(contarPeticiones(app, 'sololatino.net/series'), 1, 'al recargar se vuelve a pedir');
  assert.equal(contarPeticiones(app, 'narto-drama.com/home'), 1);
  app.close();
});
