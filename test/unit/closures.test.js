/*
Telón - Pruebas de closures, temporizadores y memoria retenida
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

const CON_PERFIL = { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' };

// ============================================================
// TEMPORIZADORES DEL REPRODUCTOR
// ============================================================

test('al cerrar el reproductor no queda ningún temporizador suyo vivo', async () => {
  const app = loadApp({ modo: 'android-tv', almacen: CON_PERFIL });
  await app.settle(2);
  app.click('.card[data-k*="tt001"]');
  await app.settle(2);
  app.click('[data-act="play:0"]');
  await app.settle(2);
  const reproductor = app.Telon.app.state.estado.reproductor;
  // El espía se instala antes de programar: así ve si los reintentos llegan a ejecutarse.
  const ejecutados = [];
  const original = app.window.setTimeout;
  app.window.setTimeout = (funcion, ms) => original(() => { ejecutados.push(ms); funcion(); }, ms);
  // Metadatos cargados: programa los 10 reintentos de subtítulos (1 s, 2 s, …).
  reproductor.video.dispatchEvent(new app.window.Event('loadedmetadata'));
  assert.ok(reproductor.temporizadores.size >= 10, 'hay temporizadores pendientes mientras se reproduce');
  app.window.telonBack();
  assert.equal(app.Telon.app.state.estado.reproductor, null);
  assert.equal(reproductor.temporizadores.size, 0, 'closePlayer los liberó');
  await new Promise(r => original(r, 1200));
  assert.ok(!ejecutados.includes(1000), 'el reintento de subtítulos no corrió después de cerrar');
  app.close();
});

// ============================================================
// ÍNDICE DE TARJETAS
// ============================================================

test('el índice de tarjetas solo guarda las que están en pantalla', async () => {
  const app = loadApp({ modo: 'android-tv', almacen: CON_PERFIL });
  await app.settle(2);
  const { cardCount } = app.Telon.ui.components;
  const enInicio = cardCount();
  assert.ok(enInicio > 0);
  // Ir y volver varias veces no acumula tarjetas.
  for (let i = 0; i < 5; i++) {
    app.act('tab:lib');
    await app.settle();
    app.act('tab:home');
    await app.settle();
  }
  assert.equal(cardCount(), enInicio);
  app.act('tab:settings');
  await app.settle();
  assert.equal(cardCount(), 0, 'en Ajustes no hay tarjetas registradas');
  app.close();
});
