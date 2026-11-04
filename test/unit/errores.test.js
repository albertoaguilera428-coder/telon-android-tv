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
