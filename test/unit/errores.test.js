/*
Telón - Pruebas del manejo de errores
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

// ============================================================
// TIPOS Y MENSAJES
// ============================================================

test('los errores propios son Error, conservan la causa y tienen su nombre', () => {
  const app = loadApp({ hasta: 'js/infra/errors.js' });
  const { TelonError, HttpError, TimeoutError, RateLimitError, AuthError } = app.Telon.infra.errors;
  const causa = new app.window.Error('original');
  const casos = [new HttpError(500, { cause: causa }), new TimeoutError({ cause: causa }), new RateLimitError(30), new AuthError('EMAIL_EXISTS')];
  for (const error of casos) {
    assert.ok(error instanceof app.window.Error && error instanceof TelonError, error.name);
    assert.ok(error.stack, 'conserva el stack');
  }
  assert.deepEqual(casos.map(e => e.name), ['HttpError', 'TimeoutError', 'RateLimitError', 'AuthError']);
  assert.equal(casos[0].cause, causa);
  assert.equal(casos[0].status, 500);
  assert.equal(casos[3].code, 'EMAIL_EXISTS');
  app.close();
});

test('al usuario nunca le llega un mensaje interno', () => {
  const app = loadApp({ hasta: 'js/infra/errors.js' });
  const { userMessageFor, HttpError } = app.Telon.infra.errors;
  const w = app.window;
  assert.match(userMessageFor(new HttpError(503)), /HTTP 503/);
  assert.equal(userMessageFor(new w.SyntaxError('Unexpected token < in JSON at position 0')), 'la respuesta del servidor no es válida');
  // Un TypeError suelto es casi siempre un bug: no se disfraza de problema de red.
  assert.equal(userMessageFor(new w.TypeError("Cannot read properties of undefined (reading 'match')")), 'ocurrió un error inesperado');
  assert.equal(userMessageFor(new w.Error('x is undefined')), 'ocurrió un error inesperado');
  assert.equal(userMessageFor('texto suelto'), 'ocurrió un error inesperado');
  app.close();
});

// ============================================================
// RED
// ============================================================

test('una respuesta que no es JSON se informa como dato inválido, con la causa original', async () => {
  const app = loadApp({ hasta: 'js/infra/http.js' });
  app.window.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse('<html>') });
  await assert.rejects(app.Telon.infra.http.fetchRemoteJSON('https://x/a.json'), error => error.name === 'InvalidDataError' && error.cause.name === 'SyntaxError');
  app.close();
});

test('si fetch falla (sin red, DNS, CORS) se informa como problema de conexión', async () => {
  const app = loadApp({ hasta: 'js/infra/http.js' });
  app.window.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(app.Telon.infra.http.fetchRemoteJSON('https://x/a.json'), error => error.name === 'NetworkError' && error.cause.message === 'Failed to fetch');
  app.close();
});

test('Firebase entrega sus errores como AuthError con el código', async () => {
  const app = loadApp({ hasta: 'js/infra/firebase-auth.js', route: () => ({ json: { error: { message: 'EMAIL_EXISTS' } } }) });
  await assert.rejects(app.Telon.infra.firebaseAuth.postFirebase('signUp', {}), error => error.name === 'AuthError' && error.code === 'EMAIL_EXISTS');
  app.close();
});

// ============================================================
// FRONTERA GLOBAL
// ============================================================

test('un error que nadie atrapó se avisa una sola vez aunque se repita', async () => {
  const app = loadApp({ modo: 'android-tv', almacen: { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' } });
  await app.settle(2);
  let ahora = 1e12;
  app.window.Date.now = () => ahora;
  const rechazo = mensaje => {
    const evento = new app.window.Event('unhandledrejection');
    evento.reason = new app.window.Error(mensaje);
    app.window.dispatchEvent(evento);
  };
  rechazo('fallo interno 1');
  const primero = app.document.getElementById('toast').textContent;
  assert.match(primero, /Algo falló \(ocurrió un error inesperado\)/);
  assert.ok(!primero.includes('fallo interno'), 'no muestra el detalle interno');
  app.document.getElementById('toast').innerHTML = '';
  rechazo('fallo interno 2');
  assert.equal(app.document.getElementById('toast').textContent, '', 'no repite el aviso enseguida');
  ahora += 6000;
  rechazo('fallo interno 3');
  assert.match(app.document.getElementById('toast').textContent, /Algo falló/);
  app.close();
});

// ============================================================
// CLASIFICACIÓN DE ERRORES DE RED (CASOS QUE SEÑALÓ LA MUTACIÓN)
// ============================================================

const cargarHttp = () => { const app = loadApp({ hasta: 'js/infra/http.js' }); return { app, http: app.Telon.infra.http }; };

test('una cancelación pedida desde afuera se informa como problema de conexión', async () => {
  const { app, http } = cargarHttp();
  const cancelada = Object.assign(new app.window.Error('cancelada'), { name: 'AbortError' });
  app.window.fetch = async () => { throw cancelada; };
  await assert.rejects(http.politeFetch('https://x/a', { signal: new app.window.AbortController().signal }), error => error.name === 'NetworkError' && error.cause === cancelada);
  app.close();
});

test('un error desconocido de fetch se devuelve tal cual, sin disfrazarlo de problema de conexión', async () => {
  const { app, http } = cargarHttp();
  const raro = new app.window.RangeError('algo inesperado');
  app.window.fetch = async () => { throw raro; };
  await assert.rejects(http.politeFetch('https://x/a'), error => error === raro);
  app.window.fetch = async () => { throw undefined; };
  await assert.rejects(http.politeFetch('https://x/a'), error => error === undefined);
  app.close();
});

test('cortar por tiempo conserva la causa del corte', async () => {
  const { app, http } = cargarHttp();
  app.window.fetch = (url, opciones) => new Promise((_, rechazar) => opciones.signal.addEventListener('abort', () => rechazar(Object.assign(new app.window.Error('abort'), { name: 'AbortError' }))));
  await assert.rejects(http.politeFetch('https://x/a', {}, 20), error => error.name === 'TimeoutError' && error.cause && error.cause.name === 'AbortError');
  app.close();
});

test('al terminar una petición se cancela su temporizador (no queda vivo para cortarla tarde)', async () => {
  const { app, http } = cargarHttp();
  const cancelados = [];
  const original = app.window.clearTimeout;
  app.window.clearTimeout = id => { cancelados.push(id); original(id); };
  app.window.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) });
  await http.politeFetch('https://x/a');
  assert.equal(cancelados.filter(id => id !== null && id !== undefined).length, 1);
  app.close();
});

test('un 429 sin cabeceras usa la espera por defecto (30 s) sin romper', async () => {
  const { app, http } = cargarHttp();
  app.window.fetch = async () => ({ ok: false, status: 429 });
  // El reloj de prueba avanza 1 s por consulta: entre registrar y leer la espera pasa un segundo.
  await assert.rejects(http.fetchRemoteJSON('https://sin-cabeceras.test/a.json'), error => error.name === 'RateLimitError' && error.segundos >= 29 && error.segundos <= 30);
  app.close();
});

test('si leer la respuesta falla por otra cosa que JSON roto, es un problema de conexión con su causa', async () => {
  const { app, http } = cargarHttp();
  const cortada = new app.window.TypeError('la conexión se cortó a mitad');
  app.window.fetch = async () => ({ ok: true, status: 200, json: async () => { throw cortada; } });
  await assert.rejects(http.fetchRemoteJSON('https://x/a.json'), error => error.name === 'NetworkError' && error.cause === cortada);
  app.close();
});

test('una respuesta normal no activa la espera del 429: la siguiente petición al mismo servidor sale', async () => {
  const { app, http } = cargarHttp();
  app.window.fetch = async () => ({ ok: true, status: 200, headers: { get: () => '600' }, json: async () => ({}) });
  await http.politeFetch('https://mismo.test/a');
  await assert.doesNotReject(http.politeFetch('https://mismo.test/b'), 'un 200 (aunque traiga Retry-After) no bloquea al servidor');
  app.close();
});

test('si fetch no llega al servidor (TypeError), politeFetch lo informa como problema de conexión', async () => {
  const { app, http } = cargarHttp();
  const sinRed = new app.window.TypeError('Failed to fetch');
  app.window.fetch = async () => { throw sinRed; };
  await assert.rejects(http.politeFetch('https://x/a'), error => error.name === 'NetworkError' && error.cause === sinRed);
  app.close();
});
