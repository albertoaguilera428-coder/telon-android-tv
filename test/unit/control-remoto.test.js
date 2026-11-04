/*
Telón - Todo lo que tiene una acción se puede usar con el control remoto
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

El control remoto solo se mueve entre botones, enlaces y campos. Una opción hecha con una caja
(<div data-act>) funciona con el dedo pero en el TV no hay forma de llegar a ella: pasó con
«Borrar historial», «Cambiar perfil» y «Calidad preferida». Esta prueba recorre cada pantalla
y falla si aparece una acción que el control no puede alcanzar.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

const CON_PERFIL = { profiles: [{ id: 'p', name: 'Ana', color: '#B23A48' }], activeProfile: 'p' };
const SESION_SIN_VERIFICAR = { loginProvider: { provider: 'email', name: 'Ana', email: 'ana@x.com', verified: false, idToken: 't' } };

// Solo para el dedo, con equivalente en el TV: tocar el video (OK pausa), el fondo del panel y su
// interior (Atrás o el botón de cerrar).
const SOLO_TACTILES = new Set(['tap', 'keep', 'closesheet']);
const ENFOCABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Acciones de la pantalla que el control no puede alcanzar.
function unreachableActions(app) {
  return [...app.document.querySelectorAll('[data-act], [data-p]')]
    .filter(elemento => !elemento.matches(ENFOCABLE))
    .filter(elemento => !(elemento.dataset.p && SOLO_TACTILES.has(elemento.dataset.p) && elemento.tagName === 'DIV'))
    .map(elemento => `<${elemento.tagName.toLowerCase()} ${elemento.dataset.act ? 'data-act="' + elemento.dataset.act + '"' : 'data-p="' + elemento.dataset.p + '"'}>`);
}

function assertReachable(app, pantalla) {
  assert.deepEqual(unreachableActions(app), [], `en ${pantalla} hay acciones que el control no alcanza`);
}

// ============================================================
// PANTALLAS
// ============================================================

test('en todas las pantallas, cada acción es un botón, enlace o campo que el control alcanza', async () => {
  const app = loadApp({ modo: 'android-tv', almacen: { ...CON_PERFIL, ...SESION_SIN_VERIFICAR } });
  await app.settle(2);
  assertReachable(app, 'Inicio');
  app.act('search'); await app.settle();
  assertReachable(app, 'Inicio con el buscador');
  app.act('search'); await app.settle();
  app.act('tab:lib'); await app.settle();
  assertReachable(app, 'Biblioteca (Mi lista)');
  app.act('libtab:hist'); await app.settle();
  assertReachable(app, 'Biblioteca (Historial)');
  app.act('tab:settings'); await app.settle();
  assertReachable(app, 'Ajustes con sesión sin verificar');
  app.act('tab:addons'); await app.settle();
  assertReachable(app, 'Addons');
  app.act('showprofiles'); await app.settle();
  assertReachable(app, 'Perfiles');
  app.act('pickprofile:p'); await app.settle(2);
  app.act('tab:home'); await app.settle();

  app.click('.card[data-k*="tt001"]'); await app.settle(2);
  assertReachable(app, 'la ficha');
  app.click('[data-act="play:0"]'); await app.settle(3);
  assertReachable(app, 'el reproductor');
  for (const panel of ['eps', 'subs', 'sources']) {
    app.click(`#player [data-p="${panel}"]`); await app.settle();
    assertReachable(app, `el panel ${panel} del reproductor`);
    app.click('[data-p="closesheet"]'); await app.settle();
  }
  app.close();
});

test('Ajustes sin sesión: el formulario de cuenta también es alcanzable', async () => {
  const app = loadApp({ modo: 'android-tv', almacen: CON_PERFIL });
  await app.settle(2);
  app.act('tab:settings'); await app.settle();
  assertReachable(app, 'Ajustes sin sesión');
  app.close();
});

test('la regla detecta una opción hecha con una caja (control de la propia prueba)', async () => {
  const app = loadApp({ modo: 'android-tv', almacen: CON_PERFIL });
  await app.settle(2);
  app.document.querySelector('#screen').insertAdjacentHTML('beforeend', '<div data-act="clearhist">Borrar</div>');
  assert.deepEqual(unreachableActions(app), ['<div data-act="clearhist">']);
  app.close();
});
