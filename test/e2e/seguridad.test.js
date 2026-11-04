/*
Telón - Pruebas de inyección (XSS) con addons maliciosos
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Los addons son de terceros: cualquiera puede publicar uno con títulos, pósters o géneros
armados para inyectar HTML, JavaScript o CSS. Esta prueba recorre las pantallas con un
addon así y verifica que nada de eso termine como código en la página.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

// ============================================================
// ADDON MALICIOSO
// ============================================================

// Cada carga intenta salir de un contexto distinto: texto, atributo, JS dentro de atributo y CSS.
const HTML = '"><img src=x id=inyectado onerror="window.hackeado=1">';
const COMILLA = "'><img id=inyectado2>";
const CSS = "https://e.x/a.jpg');color:red;background:url('https://evil.x/robo";

const MANIFEST = { id: 'malo' + HTML, name: 'Addon ' + HTML, version: '1' + HTML, description: HTML, logo: CSS,
  resources: ['catalog', 'meta', 'stream'], types: ['series'], idPrefixes: ['tt'],
  catalogs: [{ type: 'series', id: 'top', name: 'Cat ' + HTML }] };
const META = { id: 'tt1', type: 'series', name: COMILLA + HTML, poster: CSS, background: CSS, genres: [HTML], country: HTML,
  releaseInfo: HTML, description: HTML };

function route(url) {
  if (url === 'https://insanos.net/cinemeta-es/manifest.json') return { json: MANIFEST };
  if (url.endsWith('/manifest.json') || url.includes('version.json')) return { status: 404 };
  if (url.includes('cinemeta-es/catalog/')) return { json: { metas: [META] } };
  if (url.includes('cinemeta-es/meta/')) return { json: { meta: { ...META, videos: [{ id: 'tt1:1:1', season: 1, episode: 1, title: HTML }, { id: 'tt1:1:2', season: 1, episode: HTML }] } } };
  if (url.includes('cinemeta-es/stream/')) return { json: { streams: [{ url: 'https://cdn/v.m3u8', name: HTML, title: HTML }] } };
  return { status: 404 };
}

// ============================================================
// VERIFICACIONES
// ============================================================

function assertNothingInjected(app, pantalla) {
  const doc = app.document;
  assert.equal(doc.getElementById('inyectado'), null, `${pantalla}: se inyectó un elemento`);
  assert.equal(doc.getElementById('inyectado2'), null, `${pantalla}: una comilla rompió un atributo`);
  assert.equal(doc.querySelectorAll('#app script, #detail script, #player script').length, 0, `${pantalla}: hay <script>`);
  // Ningún manejador inline (onerror=, onclick=…): con CSP estricta, además, no se ejecutarían.
  const conManejador = [...doc.querySelectorAll('*')].filter(el => [...el.attributes].some(a => /^on/i.test(a.name)));
  assert.deepEqual(conManejador.map(el => el.outerHTML.slice(0, 80)), [], `${pantalla}: hay atributos on*`);
  // Una URL de imagen no puede cerrar url(...) y agregar sus propias reglas CSS.
  // Lo de adentro de url("…") es texto de la URL; lo que importa es si apareció una regla nueva afuera.
  const fueraDeUrls = [...doc.querySelectorAll('[style]')].map(el => el.getAttribute('style').replace(/url\("[^"]*"\)/g, 'url()'));
  assert.ok(!fueraDeUrls.some(s => /color:\s*red|evil\.x|url\('/.test(s)), `${pantalla}: CSS inyectado en un style`);
  assert.equal(app.window.hackeado, undefined, `${pantalla}: se ejecutó código`);
}

// ============================================================
// PRUEBA
// ============================================================

test('un addon malicioso no logra inyectar HTML, JS ni CSS en ninguna pantalla', async () => {
  const perfilMalicioso = { id: 'p', name: COMILLA, color: 'red;background:url(https://evil.x/robo)', image: CSS };
  const app = loadApp({ modo: 'android-tv', route, almacen: { profiles: [perfilMalicioso], activeProfile: 'p' } });
  await app.settle(3);
  assertNothingInjected(app, 'inicio');
  app.click('.card');
  await app.settle(2);
  assertNothingInjected(app, 'ficha');
  app.click('[data-act="savelib"]');
  app.click('[data-act="play:0"]');
  await app.settle(3);
  app.click('[data-p="sources"]');
  app.click('[data-p="closesheet"]');
  app.click('[data-p="eps"]');
  assertNothingInjected(app, 'reproductor');
  app.window.telonBack(); app.window.telonBack(); app.window.telonBack();
  app.act('tab:lib');
  await app.settle();
  assertNothingInjected(app, 'biblioteca');
  app.click('[data-act="libtab:hist"]');
  assertNothingInjected(app, 'historial');
  app.act('tab:addons');
  await app.settle();
  assertNothingInjected(app, 'addons');
  app.act('tab:settings');
  await app.settle();
  assertNothingInjected(app, 'ajustes');
  app.act('showprofiles');
  assertNothingInjected(app, 'perfiles');
  app.close();
});
