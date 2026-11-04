/*
Telón - Pruebas del progreso: qué se guarda al ver, qué aparece en «Continuar viendo» y dónde se retoma
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/domain/progress.js' });
const progreso = app.Telon.domain.progress;
test.after(() => app.close());

const entrada = (key, ts, t = 120) => ({ key, ts, t, idx: 0, videoId: key + ':1', dur: 600 });

// ============================================================
// LA CLAVE DE CADA TÍTULO
// ============================================================

test('cada título se identifica por addon, tipo e id: dos distintos nunca comparten clave', () => {
  assert.equal(progreso.refKey({ base: 'https://a', type: 'series', id: 'tt1' }), 'https://a|series|tt1');
  assert.notEqual(progreso.refKey({ base: 'https://a', type: 'series', id: 'tt1' }), progreso.refKey({ base: 'https://a', type: 'movie', id: 'tt1' }));
  assert.notEqual(progreso.refKey({ base: 'https://a', type: 'series', id: 'tt1' }), progreso.refKey({ base: 'https://b', type: 'series', id: 'tt1' }));
});

// ============================================================
// AL GUARDAR
// ============================================================

const VISTA = { referencia: { base: 'b', type: 'series', id: 'tt1' }, ficha: { name: 'Serie', poster: 'p' }, episodios: [{ id: 'e1' }, { id: 'e2', episode: 2 }], indice: 1, clave: 'b|series|tt1' };

test('a menos de 3 segundos del final cuenta como visto: se guarda en 0 para no reabrir los créditos', () => {
  assert.equal(progreso.buildHistoryEntry(VISTA, 598, 600, 1).t, 0);
  assert.equal(progreso.buildHistoryEntry(VISTA, 597, 600, 1).t, 597, 'justo a 3 segundos todavía se guarda la posición');
  assert.equal(progreso.buildHistoryEntry(VISTA, 300, 0, 1).t, 300, 'sin duración conocida se guarda tal cual');
});

// ============================================================
// CONTINUAR VIENDO
// ============================================================

test('el historial se ordena de lo más reciente a lo más viejo', () => {
  const orden = progreso.sortByRecent({ a: entrada('a', 10), b: entrada('b', 30), c: entrada('c', 20) });
  assert.deepEqual(plain(orden).map(e => e.key), ['b', 'c', 'a']);
});

test('«Continuar viendo» muestra lo visto más de 1 segundo, de lo más reciente a lo más viejo', () => {
  const historial = { a: entrada('a', 10, 1), b: entrada('b', 30, 1.5), c: entrada('c', 20, 0), d: entrada('d', 40, 300) };
  assert.deepEqual(plain(progreso.continueWatching(historial)).map(e => e.key), ['d', 'b'], 'un segundo justo no es progreso; uno y medio sí');
});

test('«Continuar viendo» muestra como máximo 10, los más recientes', () => {
  const historial = {};
  for (let i = 1; i <= 12; i++) historial['k' + i] = entrada('k' + i, i);
  const fila = plain(progreso.continueWatching(historial)).map(e => e.key);
  assert.equal(fila.length, 10);
  assert.equal(fila[0], 'k12');
  assert.ok(!fila.includes('k1') && !fila.includes('k2'), 'quedan afuera los dos más viejos');
});

// ============================================================
// RETOMAR
// ============================================================

test('se retoma donde quedó solo en el mismo episodio y con el mismo video', () => {
  const guardada = { idx: 2, videoId: 'tt1:1:3', t: 245 };
  assert.equal(progreso.resumePosition(guardada, 2, 'tt1:1:3'), 245);
  assert.equal(progreso.resumePosition(guardada, 1, 'tt1:1:3'), 0, 'otro episodio empieza desde el principio');
  assert.equal(progreso.resumePosition(guardada, 2, 'tt1:1:9'), 0, 'otro video en esa posición (la lista cambió) también');
  assert.equal(progreso.resumePosition(undefined, 2, 'tt1:1:3'), 0, 'sin historial, desde el principio');
});
