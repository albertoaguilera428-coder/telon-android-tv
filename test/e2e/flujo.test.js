/*
Telón - Prueba de flujo completo (regresión)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Recorre la app como lo haría alguien en el sofá: perfiles, inicio, filtros, búsqueda,
ficha, reproductor, control remoto, biblioteca, ajustes, addons y cuenta. En cada
paso compara el DOM, lo guardado y las peticiones contra una captura de referencia.

Si un cambio de interfaz es intencional, se regenera la referencia con:
  UPDATE_GOLDEN=1 npm run test:e2e
y el diff del archivo golden se revisa en el pull request.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadApp } = require('../support/app-driver');

// ============================================================
// RECORRIDO
// ============================================================

async function runFullJourney(modo, www) {
  const app = loadApp({ modo, www });
  const capturas = [];
  const snap = nombre => capturas.push(app.snapshot(nombre));
  await app.settle(2);
  snap('01-perfiles-vacio');
  app.prompts.push('Ana'); app.click('[data-act="addprofile"]'); await app.settle(); snap('02-perfil-creado');
  app.click('[data-act^="pickprofile:"]'); await app.settle(2); snap('03-inicio');
  app.click('[data-act="filter:KR"]'); await app.settle(); snap('04-filtro-pais');
  app.click('[data-act="filterreset"]'); app.click('[data-act="fgenre:Drama"]'); await app.settle(); snap('05-filtro-genero');
  app.click('[data-act="filterreset"]'); app.click('[data-act="ftype:movie"]'); await app.settle(); snap('06-filtro-tipo');
  app.click('[data-act="filterreset"]'); await app.settle();
  app.click('[data-act="search"]'); app.type('#q', 'show'); await new Promise(r => setTimeout(r, 450)); await app.settle(); snap('07-busqueda');
  app.click('[data-act="search"]'); await app.settle();
  app.click('.card[data-k*="tt001"]'); await app.settle(2); snap('08-detalle');
  app.click('[data-act="season:2"]'); await app.settle(); snap('09-temporada');
  app.click('[data-act="savelib"]'); await app.settle(); snap('10-guardado');
  app.click('[data-act="play:0"]'); await app.settle(3); snap('11-reproductor');
  app.click('[data-p="speed"]'); app.click('[data-p="mute"]'); await app.settle(); snap('12-velocidad-mute');
  app.click('[data-p="subs"]'); app.click('[data-p="subsize:2"]'); app.click('[data-p="subpos:-1"]'); await app.settle(); snap('13-subs');
  app.click('[data-p="closesheet"]'); app.click('[data-p="eps"]'); await app.settle(); snap('14-episodios');
  app.click('[data-p="ep:1"]'); await app.settle(2); snap('15-otro-episodio');
  app.window._tvKey(85); app.window._tvKey(22); app.window._tvKey(87); await app.settle(2); snap('16-teclas-tv');
  app.window.telonBack(); await app.settle(); snap('17-back-cierra-player');
  app.window.telonBack(); await app.settle(); snap('18-back-cierra-detalle');
  app.act('tab:lib'); await app.settle(); snap('19-biblioteca');
  app.click('[data-act="libtab:hist"]'); await app.settle(); snap('20-historial');
  app.click('[data-act^="resume"]'); await app.settle(2); snap('21-resume');
  app.window.telonBack(); app.window.telonBack(); await app.settle();
  app.act('tab:settings'); await app.settle(); snap('22-ajustes');
  app.click('[data-act="setquality"]'); app.click('[data-act="togglesubs"]'); app.click('[data-act="togglenartosubs"]'); await app.settle(); snap('23-ajustes-cambiados');
  app.act('tab:addons'); await app.settle(); snap('24-addons');
  app.type('#addurl', 'stremio://insanos.net/cinemeta-es/manifest.json'); app.click('[data-act="install"]'); await app.settle(2); snap('25-instalar');
  app.click('[data-act^="toggle:"]'); await app.settle(); snap('26-toggle');
  app.click('[data-act^="del:"]'); app.click('[data-act^="del:"]'); await app.settle(); snap('27-quitar');
  app.act('tab:home'); await app.settle(); app.click('.card[data-k*="nd-42"]'); await app.settle(2); snap('28-narto');
  app.window.telonBack(); app.act('showprofiles'); await app.settle(); snap('29-ver-perfiles');
  app.prompts.push('ana'); app.click('[data-act="manageprofiles"]'); await app.settle(); snap('30-borrar-perfil');
  app.window.telonPause(); snap('31-final');
  app.prompts.push('Beto'); app.click('[data-act="addprofile"]'); app.click('[data-act^="pickprofile:"]'); await app.settle();
  app.act('tab:settings'); await app.settle();
  app.document.getElementById('authname').value = 'Ana';
  app.document.getElementById('authemail').value = 'ana@x.com';
  app.document.getElementById('authpass').value = 'secreto1';
  app.click('[data-act="register"]'); await app.settle(2); snap('32-registro');
  app.click('[data-act="checkverify"]'); await app.settle(2); snap('33-verificado');
  app.click('[data-act="logout"]'); await app.settle(); snap('34-logout');
  app.document.getElementById('authemail').value = 'ana@x.com';
  app.document.getElementById('authpass').value = 'secreto1';
  app.click('[data-act="emaillogin"]'); await app.settle(2); snap('35-login');
  const errores = app.errores.slice();
  app.close();
  return { capturas, errores };
}

// ============================================================
// PRUEBAS
// ============================================================

const GOLDEN = path.join(__dirname, 'golden', 'flujo-android-tv.json');

test('el recorrido completo en Android TV coincide con la captura de referencia', async () => {
  const { capturas, errores } = await runFullJourney('android-tv');
  assert.deepEqual(errores, []);
  if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(capturas, null, 1) + '\n');
  }
  const referencia = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.equal(capturas.length, referencia.length);
  // Una aserción por paso: el mensaje de fallo dice en qué paso cambió algo.
  capturas.forEach((captura, i) => assert.deepEqual(captura, referencia[i], 'Cambió el paso ' + captura.nombre));
});

for (const modo of ['android-phone', 'tizen']) {
  test(`el recorrido completo en ${modo} termina sin errores`, async () => {
    const { capturas, errores } = await runFullJourney(modo);
    assert.deepEqual(errores, []);
    assert.equal(capturas.length, 35);
  });
}

test('en Samsung se reproduce la fuente nativa aunque el primer addon solo ofrezca un embed', async () => {
  const { capturas } = await runFullJourney('tizen');
  const reproductor = capturas.find(c => c.nombre === '11-reproductor');
  assert.match(reproductor.body, /<video[^>]*src="https:\/\/cdn\/v\.m3u8"/);
  assert.ok(!reproductor.log.some(l => l.includes('openEmbed')));
});

test('el paquete para Samsung (código transpilado a Chromium 69) hace el mismo recorrido sin errores', async () => {
  const raiz = path.join(__dirname, '..', '..');
  execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build-tizen.mjs')], { stdio: 'ignore' });
  const { capturas, errores } = await runFullJourney('tizen', path.join(raiz, 'build', 'tizen'));
  assert.deepEqual(errores, []);
  assert.match(capturas.find(c => c.nombre === '11-reproductor').body, /<video[^>]*src="https:\/\/cdn\/v\.m3u8"/);
});

module.exports = { runFullJourney };
