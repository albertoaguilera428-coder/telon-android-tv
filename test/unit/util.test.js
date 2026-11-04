/*
Telón - Pruebas de utilidades
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/ui/dom.js' });
const { escapeHTML, colorFor, toInitials, COLORES } = app.Telon.ui.dom;
const { store } = app.Telon.infra.storage;
test.after(() => app.close());

// ============================================================
// escapeHTML
// ============================================================

test('escapeHTML convierte los cinco caracteres peligrosos', () => {
  assert.equal(escapeHTML(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
});

test('escapeHTML trata null y undefined como texto vacío', () => {
  assert.equal(escapeHTML(null), '');
  assert.equal(escapeHTML(undefined), '');
  assert.equal(escapeHTML(0), '0');
});

test('propiedad: la salida de escapeHTML nunca contiene < > " \' sin escapar y se puede revertir', () => {
  const revertir = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  fc.assert(fc.property(fc.string(), texto => {
    const salida = escapeHTML(texto);
    assert.ok(!/[<>"']/.test(salida));
    assert.equal(revertir(salida), texto);
  }));
});

// ============================================================
// colorFor y toInitials
// ============================================================

test('propiedad: colorFor siempre devuelve el mismo color de la paleta para el mismo texto', () => {
  fc.assert(fc.property(fc.string(), texto => {
    assert.ok(COLORES.includes(colorFor(texto)));
    assert.equal(colorFor(texto), colorFor(texto));
  }));
});

test('toInitials toma la inicial de las dos primeras palabras', () => {
  assert.equal(toInitials('cinemeta en español'), 'CE');
  assert.equal(toInitials('  narto  '), 'N');
  assert.equal(toInitials(''), '?');
  assert.equal(toInitials(null), '?');
});

// ============================================================
// store
// ============================================================

test('store guarda con prefijo telon. y devuelve el valor por defecto si no existe', () => {
  store.set('prueba', { a: 1 });
  assert.equal(app.window.localStorage.getItem('telon.prueba'), '{"a":1}');
  assert.deepEqual(plain(store.get('prueba', null)), { a: 1 });
  assert.equal(store.get('no-existe', 'defecto'), 'defecto');
});

test('store no rompe la app si lo guardado está corrupto', () => {
  app.window.localStorage.setItem('telon.roto', '{no es json');
  assert.equal(store.get('roto', 'defecto'), 'defecto');
});
