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
  sesion.selectEpisode(2);
  assert.equal(sesion.episodio.id, 'e3', 'el episodio actual es el elegido');
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

// ============================================================
// CASOS QUE SEÑALARON LAS PRUEBAS DE MUTACIÓN
// ============================================================

test('subtítulos por defecto: activados, en la línea −4 y de 20 px; topes −12…−1 y 12…36 px', () => {
  const sesion = nuevaSesion();
  assert.equal(sesion.subsActivos, true);
  assert.equal(sesion.lineaSubs, -4);
  assert.equal(sesion.tamanoSubs, 20);
  assert.equal(sesion.moveSubtitleLine(-1), -5, 'subir una línea');
  assert.equal(sesion.moveSubtitleLine(-20), -12, 'no sube más allá del tope');
  assert.equal(sesion.moveSubtitleLine(+30), -1, 'no baja más allá del borde');
  assert.equal(sesion.resizeSubtitles(+2), 22);
  assert.equal(sesion.resizeSubtitles(-100), 12);
  assert.equal(sesion.resizeSubtitles(+100), 36);
});

test('una preferencia vacía o nula usa el valor por defecto (no la convierte en 0)', () => {
  const sesion = nuevaSesion({ lineaSubs: null, tamanoSubs: '' });
  assert.equal(sesion.lineaSubs, -4);
  assert.equal(sesion.tamanoSubs, 20);
});

test('la sesión no congela las listas de quien la creó', () => {
  const propios = [{ id: 'a' }, { id: 'b' }];
  const fuentesPropias = [{ url: 'u1' }, { url: 'u2' }];
  const sesion = nuevaSesion({ episodios: propios });
  sesion.setSources(fuentesPropias);
  sesion.replaceSources(fuentesPropias);
  assert.equal(Object.isFrozen(propios), false);
  assert.equal(Object.isFrozen(fuentesPropias), false);
});

test('una sesión nueva no tiene fuentes', () => {
  assert.equal(nuevaSesion().fuentes.length, 0);
});

test('moverse de episodio: hasta el primero y hasta el último, ni uno más', () => {
  const sesion = nuevaSesion({ indice: 1 });
  assert.equal(sesion.canMove(-1), true, 'del segundo al primero');
  assert.equal(sesion.canMove(+1), true, 'del segundo al último');
  assert.equal(sesion.canMove(-2), false);
  assert.equal(sesion.canMove(+2), false);
  const enElUltimo = nuevaSesion({ indice: 2 });
  assert.equal(enElUltimo.canMove(+1), false);
  assert.equal(enElUltimo.canMove(-1), true);
});

test('elegir un episodio que no existe falla; el último sí se puede', () => {
  const sesion = nuevaSesion();
  assert.throws(() => sesion.selectEpisode(1.5), RangeErrorApp);
  assert.throws(() => sesion.selectEpisode(-1), RangeErrorApp);
  assert.throws(() => sesion.selectEpisode(3), RangeErrorApp);
  assert.doesNotThrow(() => sesion.selectEpisode(2));
  assert.equal(sesion.indice, 2);
});

test('una respuesta tardía de una carga vieja nunca se acepta, ni después de cerrar y volver a cargar', () => {
  const sesion = nuevaSesion();
  const vieja = sesion.selectEpisode(0);
  sesion.invalidate();
  const nueva = sesion.selectEpisode(0);
  assert.equal(sesion.isCurrentLoad(vieja), false);
  assert.equal(sesion.isCurrentLoad(nueva), true);
  assert.ok(nueva > vieja, 'los números de carga solo crecen');
});

test('se puede elegir la primera fuente', () => {
  const sesion = nuevaSesion();
  sesion.setSources([{ url: 'u1' }, { url: 'u2' }]);
  sesion.selectSource(1);
  assert.equal(sesion.selectSource(0), true);
  assert.equal(sesion.indiceFuente, 0);
});

test('los datos de la sesión se pueden inspeccionar (al depurar en chrome://inspect se ven)', () => {
  const claves = Object.keys(nuevaSesion());
  for (const clave of ['indice', 'episodio', 'fuentes', 'subsActivos']) assert.ok(claves.includes(clave), clave);
});

test('silenciar y los subtítulos alternan y devuelven el estado nuevo', () => {
  const sesion = nuevaSesion({ subsActivos: false });
  assert.equal(sesion.silenciado, false, 'empieza con sonido');
  assert.equal(sesion.toggleMute(), true);
  assert.equal(sesion.silenciado, true);
  assert.equal(sesion.toggleMute(), false);
  assert.equal(sesion.subsActivos, false);
  assert.equal(sesion.toggleSubtitles(), true);
  assert.equal(sesion.subsActivos, true);
});

test('la sesión muestra la serie, la ficha, los episodios y la clave con que se creó', () => {
  const referencia = { base: 'b', type: 'series', id: 'tt1' };
  const ficha = { name: 'Serie' };
  const sesion = createPlaybackSession({ referencia, ficha, episodios });
  assert.equal(sesion.referencia, referencia);
  assert.equal(sesion.ficha, ficha);
  assert.deepEqual(plain(sesion.episodios), plain(episodios));
  assert.equal(sesion.clave, 'b|series|tt1');
});
