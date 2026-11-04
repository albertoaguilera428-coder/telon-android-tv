/*
Telón - Pruebas del orden de fuentes por calidad preferida
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/domain/sources.js' });
const { matchesQuality, rankByQuality } = app.Telon.domain.sources;
test.after(() => app.close());

const fuente = (name, title) => ({ name, title, url: 'https://x/' + name });

test('reconoce la calidad en el nombre o el título de la fuente', () => {
  assert.equal(matchesQuality(fuente('HD 1080p'), '1080p'), true);
  assert.equal(matchesQuality(fuente('Servidor', 'FullHD 1080'), '1080p'), true);
  assert.equal(matchesQuality(fuente('720p'), '1080p'), false);
  assert.equal(matchesQuality(fuente('10800 kbps'), '1080p'), false);
  assert.equal(matchesQuality(fuente('Calidad 480P'), '480p'), true);
});

test('con una calidad elegida, esas fuentes van primero sin desordenar el resto', () => {
  const lista = [fuente('A 720p'), fuente('B 1080p'), fuente('C'), fuente('D 1080')];
  assert.deepEqual(plain(rankByQuality(lista, '1080p').map(f => f.name)), ['B 1080p', 'D 1080', 'A 720p', 'C']);
});

test('con "Auto" el orden queda como llegó, en una lista nueva', () => {
  const lista = [fuente('A 720p'), fuente('B 1080p')];
  const ordenadas = rankByQuality(lista, 'Auto');
  assert.deepEqual(plain(ordenadas.map(f => f.name)), ['A 720p', 'B 1080p']);
  assert.notEqual(ordenadas, lista, 'quien la reciba puede cambiarla sin tocar la original');
});

test('una calidad sin número ("Auto", vacía) no coincide con ninguna fuente', () => {
  for (const calidad of ['Auto', '', undefined]) {
    assert.equal(matchesQuality(fuente('HD 1080p'), calidad), false);
    assert.equal(matchesQuality(fuente('Servidor'), calidad), false);
  }
});

test('la calidad se reconoce sin importar mayúsculas: "1080P" y "1080p" son lo mismo', () => {
  assert.equal(matchesQuality(fuente('FULL HD 1080P'), '1080p'), true);
});

test('propiedad: ordenar por calidad nunca agrega ni pierde fuentes', () => {
  const unaFuente = fc.record({ name: fc.string(), title: fc.option(fc.string(), { nil: undefined }) });
  fc.assert(fc.property(fc.array(unaFuente), fc.constantFrom('Auto', '1080p', '720p', '480p'), (lista, calidad) => {
    const ordenadas = rankByQuality(lista, calidad);
    assert.equal(ordenadas.length, lista.length);
    assert.ok(lista.every(f => ordenadas.includes(f)));
  }));
});
