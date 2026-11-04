/*
Telón - Pruebas del estado con suscripciones y de qué se repinta
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

El estado solo cambia con updateState y main.js repinta lo que corresponde a cada clave.
Repintar de más no es inofensivo: en TV render() mueve el foco, y con la ficha abierta lo
mandaría detrás de ella. Estas pruebas cuidan que cada cambio repinte solo lo suyo.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

const CON_PERFIL = { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' };

// Cuenta cuántas veces se reemplazó el contenido de un contenedor (cada render lo reemplaza entero).
function countRepaints(app, selector) {
  const contador = { veces: 0 };
  const observador = new app.window.MutationObserver(() => { contador.veces++; });
  observador.observe(app.document.querySelector(selector), { childList: true });
  contador.detener = () => observador.disconnect();
  return contador;
}

const nextMicrotask = () => new Promise(r => setTimeout(r, 0));

// ============================================================
// EL ESTADO
// ============================================================

test('el estado no se puede escribir directamente: solo con updateState', () => {
  const app = loadApp({ hasta: 'js/app/state.js' });
  const { estado, updateState } = app.Telon.app.state;
  assert.throws(() => { estado.pestana = 'lib'; }, /updateState/);
  assert.throws(() => { delete estado.pestana; }, /updateState/);
  updateState({ pestana: 'lib' });
  assert.equal(estado.pestana, 'lib');
  app.close();
});

test('updateState avisa una vez por llamada y solo con las claves que cambiaron', () => {
  const app = loadApp({ hasta: 'js/app/state.js' });
  const { estado, updateState, subscribe } = app.Telon.app.state;
  const avisos = [];
  const desuscribir = subscribe(claves => avisos.push([...claves].sort()));
  updateState({ pestana: 'lib', cargando: true, busquedaAbierta: estado.busquedaAbierta });
  updateState({ pestana: 'lib' });
  assert.deepEqual(avisos, [['cargando', 'pestana']], 'la clave sin cambio y la llamada repetida no avisan');
  desuscribir();
  updateState({ pestana: 'home' });
  assert.equal(avisos.length, 1, 'después de desuscribirse no llegan más avisos');
  app.close();
});

// ============================================================
// QUÉ SE REPINTA
// ============================================================

async function openDetailOnTv() {
  const app = loadApp({ modo: 'android-tv', almacen: CON_PERFIL });
  await app.settle(2);
  app.click('.card[data-k*="tt001"]');
  await app.settle(2);
  return app;
}

test('guardar en la lista con la ficha abierta repinta la ficha, no la pantalla de abajo', async () => {
  const app = await openDetailOnTv();
  const pantalla = countRepaints(app, '#screen'), ficha = countRepaints(app, '#detail');
  app.click('[data-act="savelib"]');
  await nextMicrotask();
  assert.equal(pantalla.veces, 0, 'render() de la pantalla movería el foco detrás de la ficha en TV');
  assert.ok(ficha.veces > 0, 'la ficha muestra «Guardado»');
  assert.match(app.document.querySelector('[data-act="savelib"]').textContent, /Guardado/);
  pantalla.detener(); ficha.detener();
  app.close();
});

test('mientras se reproduce, guardar el progreso no repinta nada debajo del reproductor', async () => {
  const app = await openDetailOnTv();
  app.click('[data-act="play:0"]');
  await app.settle(2);
  const pantalla = countRepaints(app, '#screen'), ficha = countRepaints(app, '#detail');
  const video = app.Telon.app.state.estado.reproductor.video;
  Object.defineProperty(video, 'currentTime', { configurable: true, value: 42 });
  Object.defineProperty(video, 'duration', { configurable: true, value: 600 });
  video.dispatchEvent(new app.window.Event('timeupdate'));
  await nextMicrotask();
  assert.ok(app.Telon.app.state.estado.historial[Object.keys(app.Telon.app.state.estado.historial)[0]].t >= 42, 'el progreso quedó guardado');
  assert.equal(pantalla.veces + ficha.veces, 0);
  pantalla.detener(); ficha.detener();
  app.close();
});

test('al cerrar el reproductor se repintan la ficha y el inicio con el progreso nuevo', async () => {
  const app = await openDetailOnTv();
  app.click('[data-act="play:0"]');
  await app.settle(2);
  const video = app.Telon.app.state.estado.reproductor.video;
  Object.defineProperty(video, 'currentTime', { configurable: true, value: 120 });
  Object.defineProperty(video, 'duration', { configurable: true, value: 600 });
  app.window.telonBack();
  await nextMicrotask();
  assert.match(app.document.querySelector('#detail [data-act^="play:"]').textContent, /Continuar/);
  assert.ok(app.document.querySelector('#screen').textContent.includes('Continuar viendo'));
  app.close();
});

test('cambiar un filtro repinta solo el cuerpo del inicio, no la barra ni la navegación', async () => {
  const app = loadApp({ modo: 'android-phone', almacen: CON_PERFIL });
  await app.settle(2);
  const navegacion = countRepaints(app, '#nav'), cuerpo = countRepaints(app, '#homeBody');
  app.click('[data-act="filter:KR"]');
  await nextMicrotask();
  assert.equal(navegacion.veces, 0);
  assert.equal(cuerpo.veces, 1);
  navegacion.detener(); cuerpo.detener();
  app.close();
});
