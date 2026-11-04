/*
Telón - Pruebas de lógica de interfaz (foco, historial, cuenta, etiquetas)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp } = require('../support/app-driver');

// Carga todo menos main.js: la interfaz queda disponible sin arrancar la app.
const app = loadApp({ sinArrancar: true });
const { tvRemote } = app.Telon.ui;
const { progress, episodes, account } = app.Telon.domain;
test.after(() => app.close());

const rect = (left, top, width = 100, height = 100) => ({ left, top, width, height });

// ============================================================
// NAVEGACIÓN POR FOCO (CONTROL REMOTO)
// ============================================================

test('a la derecha prefiere la tarjeta de la misma fila aunque otra esté más cerca en diagonal', () => {
  const actual = rect(0, 0);
  const candidatos = [rect(150, 120), rect(400, 0)];
  assert.equal(tvRemote.pickNextFocus(actual, candidatos, 'right'), 1);
});

test('abajo prefiere lo que está en la misma columna', () => {
  const actual = rect(0, 0);
  const candidatos = [rect(300, 150), rect(0, 400)];
  assert.equal(tvRemote.pickNextFocus(actual, candidatos, 'down'), 1);
});

test('si no hay nada en esa dirección, el foco no se mueve', () => {
  assert.equal(tvRemote.pickNextFocus(rect(0, 0), [rect(-300, 0)], 'right'), -1);
});

test('propiedad: el candidato elegido siempre está en la dirección pedida', () => {
  const caja = fc.record({ left: fc.integer({ min: -2000, max: 2000 }), top: fc.integer({ min: -2000, max: 2000 }), width: fc.integer({ min: 1, max: 400 }), height: fc.integer({ min: 1, max: 400 }) });
  const centro = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  fc.assert(fc.property(caja, fc.array(caja, { maxLength: 20 }), fc.constantFrom('up', 'down', 'left', 'right'), (actual, candidatos, direccion) => {
    const elegido = tvRemote.pickNextFocus(actual, candidatos, direccion);
    if (elegido < 0) return;
    const dx = centro(candidatos[elegido]).x - centro(actual).x, dy = centro(candidatos[elegido]).y - centro(actual).y;
    const esperado = { right: dx >= 20, left: dx <= -20, down: dy >= 20, up: dy <= -20 }[direccion];
    assert.ok(esperado);
  }));
});

// ============================================================
// TECLAS CON EL REPRODUCTOR ABIERTO
// ============================================================

test('sin duración (transmisión en vivo) retroceder y adelantar mueven 10 s sin saltar al inicio', () => {
  const video = { currentTime: 95, duration: NaN, pause() {}, play: () => Promise.resolve() };
  app.Telon.app.state.updateState({ reproductor: { video, indice: 0, episodios: [{ id: 'a' }] } });
  tvRemote.handleTvKey(tvRemote.TECLA.RETROCEDER);
  assert.equal(video.currentTime, 85);
  tvRemote.handleTvKey(tvRemote.TECLA.ADELANTAR);
  assert.equal(video.currentTime, 95);
  video.duration = Infinity;
  tvRemote.handleTvKey(tvRemote.TECLA.ADELANTAR);
  assert.equal(video.currentTime, 105);
  app.Telon.app.state.updateState({ reproductor: null });
});

test('con duración conocida, adelantar no pasa del final', () => {
  const video = { currentTime: 95, duration: 100, pause() {}, play: () => Promise.resolve() };
  app.Telon.app.state.updateState({ reproductor: { video, indice: 0, episodios: [{ id: 'a' }] } });
  tvRemote.handleTvKey(tvRemote.TECLA.ADELANTAR);
  assert.equal(video.currentTime, 100);
  app.Telon.app.state.updateState({ reproductor: null });
});

// ============================================================
// PROGRESO Y ETIQUETAS
// ============================================================

const reproductorFalso = { clave: 'k', referencia: { base: 'b', type: 'series', id: 'tt1' }, ficha: { name: 'Serie', poster: 'p' }, episodios: [{ id: 'e1' }, { id: 'e2', episode: 7 }], indice: 1 };

test('el historial guarda la posición con los nombres de campo que ya existen en los dispositivos', () => {
  const entrada = progress.buildHistoryEntry(reproductorFalso, 120, 1500, 1700000000000);
  assert.deepEqual(Object.keys(entrada).sort(), ['base', 'dur', 'id', 'idx', 'key', 'label', 'name', 'poster', 't', 'total', 'ts', 'type', 'videoId'].sort());
  assert.equal(entrada.t, 120);
  assert.equal(entrada.label, 'Ep. 7');
  assert.equal(entrada.videoId, 'e2');
});

test('a menos de 3 segundos del final el episodio cuenta como visto (vuelve a 0)', () => {
  assert.equal(progress.buildHistoryEntry(reproductorFalso, 1498, 1500, 1).t, 0);
  assert.equal(progress.buildHistoryEntry(reproductorFalso, 1490, 1500, 1).t, 1490);
});

test('las películas (un solo video) no llevan etiqueta de episodio', () => {
  assert.equal(episodes.episodeLabel([{ id: 'x' }], 0), '');
  assert.equal(episodes.episodeLabel([{ id: 'a' }, { id: 'b' }], 1), 'Ep. 2');
});

test('el porcentaje de progreso nunca pasa de 100 ni falla sin duración', () => {
  assert.equal(progress.progressPercent({ t: 50, dur: 100 }), 50);
  assert.equal(progress.progressPercent({ t: 500, dur: 100 }), 100);
  assert.equal(progress.progressPercent({ t: 5, dur: 0 }), 0);
});

// ============================================================
// CUENTA
// ============================================================

test('el registro valida nombre, correo y largo de la contraseña antes de llamar a Firebase', () => {
  const validar = account.validateRegistration;
  assert.equal(validar(' ', 'a@x.com', 'secreto'), 'Escribe tu nombre');
  assert.equal(validar('Ana', '', 'secreto'), 'Escribe tu correo');
  assert.equal(validar('Ana', 'a@x.com', '12345'), 'La contraseña debe tener al menos 6 caracteres');
  assert.equal(validar('Ana', 'a@x.com', '123456'), null);
});

// ============================================================
// FOCO: BORDES Y CRITERIO DE MISMA FILA (señalados por mutación)
// ============================================================

test('a exactamente 20 px ya cuenta como "en esa dirección" para las cuatro flechas', () => {
  const actual = rect(0, 0, 0, 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(20, 0, 0, 0)], 'right'), 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(-20, 0, 0, 0)], 'left'), 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(0, 20, 0, 0)], 'down'), 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(0, -20, 0, 0)], 'up'), 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(19, 0, 0, 0)], 'right'), -1);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(-19, 0, 0, 0)], 'left'), -1);
});

test('"misma fila" tolera hasta el 70 % del alto actual (no un mínimo fijo de 25 px)', () => {
  const actual = rect(0, 0, 100, 100);
  // A está 69 px más abajo (misma fila con alto 100); B está más cerca en x pero claramente en otra fila.
  assert.equal(tvRemote.pickNextFocus(actual, [rect(100, 69), rect(50, 71)], 'right'), 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(0, 100), rect(69, 150)], 'down'), 0);
  assert.equal(tvRemote.pickNextFocus(actual, [rect(71, 100), rect(0, 300)], 'down'), 1);
});

test('a igual puntaje gana el primero en el orden de la página', () => {
  assert.equal(tvRemote.pickNextFocus(rect(0, 0), [rect(200, 0), rect(200, 0)], 'right'), 0);
});

test('moveTvFocus enfoca la pestaña activa si nada tiene foco y luego se mueve a la derecha', () => {
  const tv = loadApp({ sinArrancar: true });
  const doc = tv.document;
  doc.querySelector('#nav').innerHTML = '<button id="a">Inicio</button><button id="b" class="on">Biblioteca</button>';
  doc.querySelector('#screen').innerHTML = '<button id="c">Derecha</button><button id="oculto" hidden>Oculto</button><button id="cero">Sin tamaño</button>';
  const cajas = { a: rect(0, 0), b: rect(150, 0), c: rect(300, 0), oculto: rect(160, 0), cero: rect(170, 0, 0, 0) };
  Object.defineProperty(tv.window.HTMLElement.prototype, 'offsetParent', { get() { return this.hidden ? null : doc.body; } });
  tv.window.HTMLElement.prototype.getBoundingClientRect = function () { return cajas[this.id] || rect(0, 0, 0, 0); };
  tv.Telon.ui.tvRemote.handleTvKey(tv.Telon.ui.tvRemote.TECLA.DERECHA);
  assert.equal(doc.activeElement.id, 'b');
  tv.Telon.ui.tvRemote.handleTvKey(tv.Telon.ui.tvRemote.TECLA.DERECHA);
  assert.equal(doc.activeElement.id, 'c');
  tv.Telon.ui.tvRemote.handleTvKey(tv.Telon.ui.tvRemote.TECLA.IZQUIERDA);
  assert.equal(doc.activeElement.id, 'b');
  tv.close();
});

test('OK sobre un elemento enfocado lo activa', () => {
  const tv = loadApp({ sinArrancar: true });
  let activado = false;
  tv.document.querySelector('#screen').innerHTML = '<button id="x">X</button>';
  const boton = tv.document.getElementById('x');
  boton.addEventListener('click', () => { activado = true; });
  boton.focus();
  tv.Telon.ui.tvRemote.handleTvKey(tv.Telon.ui.tvRemote.TECLA.ENTER);
  assert.equal(activado, true);
  tv.close();
});

// ============================================================
// FOCO DESPUÉS DE VOLVER A PINTAR (TV)
// ============================================================

test('en TV, al volver a pintar, el foco vuelve al mismo botón y no salta a otro lado', async () => {
  const tv = loadApp({ modo: 'android-tv', almacen: { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' } });
  await tv.settle(2);
  tv.act('tab:settings');
  await tv.settle();
  const interruptor = tv.document.querySelector('[data-act="togglesubs"]');
  interruptor.focus();
  interruptor.click();
  await tv.settle();
  assert.equal(tv.document.activeElement.dataset.act, 'togglesubs');
  assert.notEqual(tv.document.activeElement, interruptor, 'es el botón nuevo después de pintar');
  tv.close();
});

test('en TV, sin botón equivalente, el foco va a la pestaña activa', async () => {
  const tv = loadApp({ modo: 'android-tv', almacen: { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' } });
  await tv.settle(2);
  // Con el control: el foco está en "Biblioteca" y se presiona OK.
  tv.document.querySelector('[data-act="tab:lib"]').focus();
  tv.document.activeElement.click();
  await tv.settle();
  assert.equal(tv.document.activeElement.dataset.act, 'tab:lib');
  // Si el botón enfocado no existe en la pantalla nueva, el foco cae en la pestaña activa.
  tv.document.activeElement.blur();
  tv.act('tab:settings');
  await tv.settle();
  assert.equal(tv.document.activeElement.dataset.act, 'tab:settings');
  tv.close();
});

test('Ajustes ya no muestra la sección "Interfaz" vacía', async () => {
  const tv = loadApp({ modo: 'android-phone', almacen: { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' } });
  await tv.settle(2);
  tv.act('tab:settings');
  await tv.settle();
  const secciones = [...tv.document.querySelectorAll('.set-section label')].map(l => l.textContent);
  assert.ok(!secciones.includes('Interfaz'));
  assert.ok(secciones.includes('Reproducción'));
  tv.close();
});
