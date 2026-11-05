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

// En Android la tecla llega primero al WebView: si la página no la marca como usada, el WebView
// hace scroll con la flecha abajo y MainActivity nunca se entera (el foco no bajaba de la barra).
test('en Android TV las flechas y OK los atiende la página y quedan marcados como usados', () => {
  const app = loadApp({ modo: 'android-tv', hasta: 'js/infra/platform.js' });
  const recibidas = [];
  app.window._tvKey = codigo => recibidas.push(codigo);
  const marcadas = [40, 38, 37, 39, 13].map(keyCode => {
    const evento = new app.window.KeyboardEvent('keydown', { keyCode, cancelable: true });
    app.document.dispatchEvent(evento);
    return evento.defaultPrevented;
  });
  assert.deepEqual(recibidas, [20, 19, 21, 22, 66]);
  assert.deepEqual(marcadas, [true, true, true, true, true], 'si no se marcan, el WebView hace scroll en vez de mover el foco');
  // Lo demás (letras, teclas multimedia) sigue su camino normal hacia MainActivity.
  const letra = new app.window.KeyboardEvent('keydown', { keyCode: 65, cancelable: true });
  app.document.dispatchEvent(letra);
  assert.equal(letra.defaultPrevented, false);
  app.close();
});

test('en un campo de texto las flechas de lado mueven el cursor y en el borde salen del campo', () => {
  const app = loadApp({ modo: 'android-tv', hasta: 'js/infra/platform.js' });
  const recibidas = [];
  app.window._tvKey = codigo => recibidas.push(codigo);
  const campo = app.document.createElement('input');
  campo.value = 'https://x';
  app.document.body.appendChild(campo);
  const pulsar = keyCode => {
    const evento = new app.window.KeyboardEvent('keydown', { keyCode, cancelable: true, bubbles: true });
    campo.dispatchEvent(evento);
    return evento.defaultPrevented;
  };
  campo.setSelectionRange(3, 3);
  assert.deepEqual([pulsar(37), pulsar(39), pulsar(13)], [false, false, false], 'en medio del texto, el sistema mueve el cursor y OK abre el teclado');
  campo.setSelectionRange(campo.value.length, campo.value.length);
  assert.equal(pulsar(39), true, 'con el cursor al final, → sale del campo (por ejemplo, a «Instalar»)');
  campo.setSelectionRange(0, 0);
  assert.equal(pulsar(37), true, 'con el cursor al principio, ← sale del campo');
  assert.equal(pulsar(40), true, 'abajo siempre sale del campo');
  assert.deepEqual(recibidas, [22, 21, 20]);
  app.close();
});

test('en un celular Android las flechas no se tocan (teclados físicos y escritura normal)', () => {
  const app = loadApp({ modo: 'android-phone', hasta: 'js/infra/platform.js' });
  const recibidas = [];
  app.window._tvKey = codigo => recibidas.push(codigo);
  const evento = new app.window.KeyboardEvent('keydown', { keyCode: 40, cancelable: true });
  app.document.dispatchEvent(evento);
  assert.deepEqual(recibidas, []);
  assert.equal(evento.defaultPrevented, false);
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
    // Que nadie cambie el adaptador desde afuera lo garantiza el lenguaje (un import es de solo
    // lectura) y lo revisa test/unit/arquitectura.test.js en el código.
    app.close();
    return forma;
  };
  const android = contrato('android-tv');
  assert.deepEqual(contrato('tizen'), android);
  assert.deepEqual(contrato('browser'), android);
});
