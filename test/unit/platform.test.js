/*
Telón - Pruebas del adaptador de plataforma
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

const viewport = app => app.document.querySelector('meta[name="viewport"]').getAttribute('content');

// ============================================================
// DETECCIÓN
// ============================================================

test('Android TV usa la interfaz de TV con lienzo de 1920 px', () => {
  const app = loadApp({ modo: 'android-tv', hasta: 'js/infra/platform.js' });
  assert.equal(app.Telon.infra.platform.nombre, 'android');
  assert.equal(app.Telon.infra.platform.esTv, true);
  assert.equal(app.Telon.infra.platform.admiteEmbed, true);
  assert.equal(viewport(app), 'width=1920');
  app.close();
});

test('un celular o tablet Android usa la interfaz táctil con el ancho real', () => {
  const app = loadApp({ modo: 'android-phone', hasta: 'js/infra/platform.js' });
  assert.equal(app.Telon.infra.platform.esTv, false);
  assert.match(viewport(app), /width=device-width/);
  app.close();
});

test('Samsung (Tizen) es TV, no admite embeds ni actualizaciones por APK', () => {
  const app = loadApp({ modo: 'tizen', hasta: 'js/infra/platform.js' });
  const plataforma = app.Telon.infra.platform;
  assert.equal(plataforma.nombre, 'tizen');
  assert.equal(plataforma.esTv, true);
  assert.equal(plataforma.admiteEmbed, false);
  assert.equal(plataforma.admiteActualizacion, false);
  assert.equal(plataforma.openEmbed('https://x', ''), false);
  app.close();
});

test('en Samsung se registran las teclas multimedia del control', () => {
  const app = loadApp({ modo: 'tizen', hasta: 'js/infra/platform.js' });
  assert.ok(app.log.includes('tizen registerKey MediaPlayPause'));
  assert.equal(app.log.filter(l => l.startsWith('tizen registerKey')).length, 8);
  app.close();
});

// ============================================================
// CONTROL REMOTO DE SAMSUNG
// ============================================================

test('las teclas de Tizen se traducen a los códigos de Android', () => {
  const app = loadApp({ modo: 'tizen', hasta: 'js/infra/platform.js' });
  const traducir = app.Telon.infra.platform.translateTizenKey;
  assert.equal(traducir(38), 19);
  assert.equal(traducir(13), 66);
  assert.equal(traducir(10252), 85);
  assert.equal(traducir(19), 127); // En Tizen 19 es MediaPause, no flecha arriba.
  assert.equal(traducir(65), null);
  app.close();
});

test('una flecha del control de Samsung llega a window._tvKey', () => {
  const app = loadApp({ modo: 'tizen', hasta: 'js/infra/platform.js' });
  const recibidas = [];
  app.window._tvKey = codigo => recibidas.push(codigo);
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { keyCode: 39 }));
  assert.deepEqual(recibidas, [22]);
  app.close();
});

test('Atrás en Samsung cierra la app solo si no queda nada abierto', () => {
  const app = loadApp({ modo: 'tizen', hasta: 'js/infra/platform.js' });
  let hayAlgoAbierto = true;
  app.window.telonBack = () => { const respuesta = hayAlgoAbierto; hayAlgoAbierto = false; return respuesta; };
  const atras = () => app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { keyCode: 10009 }));
  atras();
  assert.ok(!app.log.includes('tizen exit'));
  atras();
  assert.ok(app.log.includes('tizen exit'));
  app.close();
});

// ============================================================
// CONTRATO COMÚN (POLIMORFISMO)
// ============================================================

test('los tres adaptadores cumplen el mismo contrato y se pueden usar indistintamente', () => {
  const contrato = modo => {
    const app = loadApp({ modo, hasta: 'js/infra/platform.js' });
    const plataforma = app.Telon.infra.platform;
    const forma = Object.fromEntries(Object.keys(plataforma).sort().map(k => [k, typeof plataforma[k]]));
    // Ninguna acción puede romper en ningún sistema: donde no aplica, no hace nada o devuelve false.
    plataforma.setOrientation('landscape');
    plataforma.closeEmbed();
    assert.equal(typeof plataforma.openEmbed('https://x', 'https://y'), 'boolean');
    assert.equal(typeof plataforma.downloadUpdate('https://x/a.apk'), 'boolean');
    assert.ok(Object.isFrozen(plataforma), 'nadie puede cambiar el adaptador desde afuera');
    app.close();
    return forma;
  };
  const android = contrato('android-tv');
  assert.deepEqual(contrato('tizen'), android);
  assert.deepEqual(contrato('browser'), android);
});
