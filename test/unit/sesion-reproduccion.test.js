/*
Telón - Pruebas de la sesión de reproducción (encapsulación)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/domain/playback-session.js' });
const { createPlaybackSession, LIMITES_SUBTITULOS, VELOCIDADES } = app.Telon.domain.playbackSession;
// Los errores nacen dentro de jsdom: se comparan con sus constructores, no con los de Node.
const { RangeError: RangeErrorApp } = app.window;
test.after(() => app.close());

const episodios = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
const nuevaSesion = (extra = {}) => createPlaybackSession({ referencia: { base: 'b', type: 'series', id: 'tt1' }, ficha: { name: 'Serie' }, episodios, ...extra });

// ============================================================
// ENCAPSULACIÓN
// ============================================================

test('los datos se leen pero no se pueden cambiar desde afuera', () => {
  const sesion = nuevaSesion();
  assert.throws(() => { sesion.indice = 2; }, TypeError);
  assert.throws(() => { sesion.lineaSubs = -99; }, TypeError);
  assert.throws(() => { sesion.otraCosa = 1; }, TypeError);
  assert.throws(() => { sesion.episodios.push({ id: 'x' }); }, TypeError);
  assert.equal(sesion.indice, 0);
  assert.equal(sesion.clave, 'b|series|tt1');
});

test('valores iniciales fuera de rango se corrigen al crear la sesión', () => {
  const sesion = nuevaSesion({ indice: 99, lineaSubs: -50, tamanoSubs: 'grande' });
  assert.equal(sesion.indice, 2);
  assert.equal(sesion.lineaSubs, LIMITES_SUBTITULOS.linea.min);
  assert.equal(sesion.tamanoSubs, LIMITES_SUBTITULOS.tamano.porDefecto);
  assert.throws(() => createPlaybackSession({ referencia: {}, ficha: {}, episodios: [] }), RangeErrorApp);
});

// ============================================================
// EPISODIOS Y FUENTES
// ============================================================

test('cambiar de episodio olvida las fuentes y descarta las cargas anteriores', () => {
  const sesion = nuevaSesion();
  const primera = sesion.selectEpisode(0);
  sesion.setSources([{ url: 'a' }, { url: 'b' }]);
  const segunda = sesion.selectEpisode(1);
  assert.equal(sesion.fuentes.length, 0);
  assert.equal(sesion.isCurrentLoad(primera), false);
  assert.equal(sesion.isCurrentLoad(segunda), true);
  sesion.invalidate();
  assert.equal(sesion.isCurrentLoad(segunda), false, 'al cerrar ninguna carga sigue vigente');
  assert.throws(() => sesion.selectEpisode(3), RangeErrorApp);
});

test('al fallar una fuente se pasa a la siguiente hasta que no quedan', () => {
  const sesion = nuevaSesion();
  sesion.setSources([{ url: 'a' }, { url: 'b' }]);
  assert.equal(sesion.advanceSource(), true);
  assert.equal(sesion.fuenteActual.url, 'b');
  assert.equal(sesion.advanceSource(), false);
  assert.equal(sesion.fuenteActual.url, 'b');
});

test('si la lista completa llega en otro orden, la fuente que suena conserva su lugar', () => {
  const sesion = nuevaSesion();
  const a = { url: 'a' }, b = { url: 'b' }, c = { url: 'c' };
  sesion.setSources([a]);
  sesion.replaceSources([c, b, a]);
  assert.equal(sesion.fuenteActual, a);
  assert.equal(sesion.indiceFuente, 2);
  assert.equal(sesion.selectSource(7), false);
});

test('la velocidad recorre las opciones en círculo', () => {
  const sesion = nuevaSesion();
  const vistas = VELOCIDADES.map(() => sesion.cycleSpeed());
  assert.deepEqual(plain(vistas), plain([...VELOCIDADES.slice(1), VELOCIDADES[0]]));
});

// ============================================================
// INVARIANTES (PROPIEDADES)
// ============================================================

test('propiedad: ninguna secuencia de operaciones deja la sesión en un estado inválido', () => {
  const operacion = fc.oneof(
    fc.record({ op: fc.constant('moveSubtitleLine'), n: fc.integer({ min: -30, max: 30 }) }),
    fc.record({ op: fc.constant('resizeSubtitles'), n: fc.integer({ min: -50, max: 50 }) }),
    fc.record({ op: fc.constant('selectEpisode'), n: fc.integer({ min: 0, max: 2 }) }),
    fc.record({ op: fc.constant('setSources'), n: fc.integer({ min: 0, max: 5 }) }),
    fc.record({ op: fc.constant('selectSource'), n: fc.integer({ min: -2, max: 7 }) }),
    fc.constantFrom({ op: 'advanceSource' }, { op: 'cycleSpeed' }, { op: 'toggleMute' }, { op: 'toggleSubtitles' })
  );
  const { linea, tamano } = LIMITES_SUBTITULOS;
  fc.assert(fc.property(fc.array(operacion, { maxLength: 60 }), operaciones => {
    const sesion = nuevaSesion();
    for (const { op, n } of operaciones) {
      if (op === 'setSources') sesion.setSources(Array.from({ length: n }, (_, i) => ({ url: 'f' + i })));
      else sesion[op](n);
      assert.ok(sesion.lineaSubs >= linea.min && sesion.lineaSubs <= linea.max);
      assert.ok(sesion.tamanoSubs >= tamano.min && sesion.tamanoSubs <= tamano.max);
      assert.ok(sesion.indice >= 0 && sesion.indice < episodios.length);
      assert.ok(sesion.fuentes.length === 0 ? sesion.indiceFuente === 0 : sesion.indiceFuente < sesion.fuentes.length);
      assert.ok(VELOCIDADES.includes(sesion.velocidad));
    }
  }));
});
