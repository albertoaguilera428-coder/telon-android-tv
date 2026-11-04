/*
Telón - Pruebas de concurrencia, tiempos de espera y recursos
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Carreras entre cargas, tope de peticiones simultáneas, cola acotada, tiempos de espera y
cachés con tamaño máximo. Usan una red falsa con respuestas controladas a mano.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

// Red falsa: cada fetch queda pendiente hasta que la prueba decide responderlo.
function manualNetwork(app) {
  const pendientes = [];
  let activas = 0, pico = 0;
  app.window.fetch = (url, opciones = {}) => new Promise((resolver, rechazar) => {
    activas++;
    pico = Math.max(pico, activas);
    const terminar = () => { activas--; };
    if (opciones.signal) opciones.signal.addEventListener('abort', () => { terminar(); rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' })); });
    pendientes.push({ url: String(url), responder: cuerpo => { terminar(); resolver({ ok: true, status: 200, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); } });
  });
  return { pendientes, pico: () => pico, activas: () => activas };
}

const tick = () => new Promise(r => setTimeout(r, 0));

// ============================================================
// TOPE DE PETICIONES SIMULTÁNEAS
// ============================================================

test('nunca salen más de 8 peticiones a la vez y las demás esperan su turno en orden', async () => {
  const app = loadApp({ hasta: 'js/infra/http.js' });
  const { politeFetch, MAXIMO_SIMULTANEAS } = app.Telon.infra.http;
  const red = manualNetwork(app);
  const promesas = Array.from({ length: 20 }, (_, i) => politeFetch('https://a.x/' + i));
  await tick();
  assert.equal(red.pendientes.length, MAXIMO_SIMULTANEAS);
  // Se responden de a una; cada respuesta libera un turno para la siguiente en la cola.
  for (let i = 0; i < 20; i++) {
    red.pendientes[i].responder({ i });
    await tick();
  }
  await Promise.all(promesas);
  assert.equal(red.pico(), MAXIMO_SIMULTANEAS);
  assert.deepEqual(red.pendientes.map(p => p.url), Array.from({ length: 20 }, (_, i) => 'https://a.x/' + i));
  assert.deepEqual({ ...app.Telon.infra.http.activeRequests() }, { activas: 0, enEspera: 0 });
  app.close();
});

test('si la cola de espera se llena, se rechaza en vez de acumular trabajo sin fin', async () => {
  const app = loadApp({ hasta: 'js/infra/http.js' });
  const { politeFetch, MAXIMO_SIMULTANEAS, MAXIMO_EN_ESPERA } = app.Telon.infra.http;
  manualNetwork(app);
  Array.from({ length: MAXIMO_SIMULTANEAS + MAXIMO_EN_ESPERA }, (_, i) => politeFetch('https://a.x/' + i).catch(() => {}));
  await assert.rejects(politeFetch('https://a.x/una-mas'), /demasiadas peticiones en espera/);
  app.close();
});

test('una petición sin respuesta se corta por tiempo y libera su turno', async () => {
  const app = loadApp({ hasta: 'js/infra/http.js' });
  const { politeFetch } = app.Telon.infra.http;
  const red = manualNetwork(app);
  await assert.rejects(politeFetch('https://lento.x', {}, 20), /tiempo de espera agotado/);
  assert.equal(red.activas(), 0);
  assert.deepEqual({ ...app.Telon.infra.http.activeRequests() }, { activas: 0, enEspera: 0 });
  app.close();
});

// ============================================================
// CARRERAS ENTRE CARGAS
// ============================================================

test('si se carga el inicio dos veces, la respuesta vieja no pisa a la nueva (ni su contador de errores)', async () => {
  const app = loadApp({ hasta: 'js/ui/update-banner.js' });
  const { estado, updateState } = app.Telon.app.state;
  const { loadHome } = app.Telon.ui.home;
  const red = manualNetwork(app);
  updateState({ addons: [{ base: 'https://a.x', enabled: true, manifest: { resources: ['catalog'], catalogs: [{ type: 'series', id: 'top' }] } }] });
  const primera = loadHome();
  await tick();
  const segunda = loadHome();
  await tick();
  // La segunda responde primero con datos nuevos; la primera llega después con datos viejos.
  red.pendientes[1].responder({ metas: [{ id: 'nuevo', name: 'Nuevo' }] });
  await segunda;
  red.pendientes[0].responder({ metas: [{ id: 'viejo', name: 'Viejo' }] });
  await primera;
  assert.deepEqual(plain(estado.filas.map(f => f.metas[0].id)), ['nuevo']);
  assert.equal(estado.cargando, false);
  app.close();
});

test('si se recargan los addons dos veces, solo la última recarga actualiza la lista', async () => {
  const app = loadApp({ hasta: 'js/app/catalog-service.js' });
  const { reloadDefaultAddons, ADDONS_PREDETERMINADOS } = app.Telon.app.catalogService;
  const red = manualNetwork(app);
  const primera = reloadDefaultAddons();
  await tick();
  const segunda = reloadDefaultAddons();
  await tick();
  const total = ADDONS_PREDETERMINADOS.length;
  red.pendientes.slice(total).forEach(p => p.responder({ id: 'nuevo', name: 'Nuevo' }));
  red.pendientes.slice(0, total).forEach(p => p.responder({ id: 'viejo', name: 'Viejo' }));
  assert.equal(await segunda, true);
  assert.equal(await primera, false);
  const nombres = app.Telon.app.state.estado.addons.map(a => a.manifest.name);
  assert.ok(nombres.includes('Nuevo') && !nombres.includes('Viejo'));
  app.close();
});

// ============================================================
// CACHÉ ACOTADA
// ============================================================

test('la caché descarta la entrada usada hace más tiempo y vence por tiempo', () => {
  const app = loadApp({ hasta: 'js/infra/cache.js' });
  let ahora = 0;
  app.window.Date.now = () => ahora;
  const cache = app.Telon.infra.cache.createBoundedCache({ maximo: 2, vidaMs: 100 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a'); // "a" pasa a ser la más reciente
  cache.set('c', 3); // se descarta "b"
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
  ahora = 100;
  assert.equal(cache.get('a'), undefined, 'vencida');
  app.close();
});

test('propiedad: la caché nunca supera su tamaño máximo', () => {
  const app = loadApp({ hasta: 'js/infra/cache.js' });
  fc.assert(fc.property(fc.integer({ min: 1, max: 10 }), fc.array(fc.tuple(fc.constantFrom('get', 'set'), fc.string({ maxLength: 3 }))), (maximo, operaciones) => {
    const cache = app.Telon.infra.cache.createBoundedCache({ maximo, vidaMs: 1e9 });
    for (const [operacion, clave] of operaciones) {
      if (operacion === 'set') cache.set(clave, clave); else cache.get(clave);
      assert.ok(cache.size() <= maximo);
    }
  }));
  app.close();
});

test('getOrLoad no vuelve a cargar lo que ya está guardado', async () => {
  const app = loadApp({ hasta: 'js/infra/cache.js' });
  const cache = app.Telon.infra.cache.createBoundedCache({ maximo: 5, vidaMs: 1e9 });
  let cargas = 0;
  const cargador = async () => ++cargas;
  assert.equal(await cache.getOrLoad('x', cargador), 1);
  assert.equal(await cache.getOrLoad('x', cargador), 1);
  assert.equal(cargas, 1);
  app.close();
});
