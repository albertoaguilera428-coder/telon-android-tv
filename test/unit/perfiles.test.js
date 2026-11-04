/*
Telón - Pruebas de la foto de perfil
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

"Cambiar foto" acepta un enlace a una imagen o una foto de la galería del teléfono. La
reducción de la foto se prueba en Chromium (test/e2e/visual.test.js): jsdom no tiene
canvas, así que aquí se reemplaza por una versión que responde al instante.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

const PERFIL = { id: 'p', name: 'Ana', color: '#B23A48' };

async function openProfiles() {
  const app = loadApp({ modo: 'android-phone', almacen: { profiles: [PERFIL], activeProfile: 'p' } });
  await app.settle(2);
  app.act('showprofiles');
  return app;
}

const savedProfile = app => app.Telon.app.state.perfiles.all()[0];
const toastText = app => app.document.querySelector('#toast').textContent;

function chooseFromGallery(app, archivo) {
  const selector = app.document.getElementById('pffile');
  Object.defineProperty(selector, 'files', { configurable: true, value: archivo ? [archivo] : [] });
  selector.dispatchEvent(new app.window.Event('change'));
}

// ============================================================
// POR ENLACE
// ============================================================

test('con un enlace https la foto queda guardada y se ve en el perfil', async () => {
  const app = await openProfiles();
  app.prompts.push('https://img/ana.jpg');
  app.click('[data-act="editprofileimg"]');
  assert.equal(savedProfile(app).image, 'https://img/ana.jpg');
  assert.match(toastText(app), /Foto actualizada/);
  assert.ok(app.document.querySelector('.pf-avatar img[src="https://img/ana.jpg"]'));
  app.close();
});

test('un texto que no es enlace se rechaza sin tocar el perfil', async () => {
  const app = await openProfiles();
  app.prompts.push('javascript:alert(1)');
  app.click('[data-act="editprofileimg"]');
  assert.equal(savedProfile(app).image, undefined);
  assert.match(toastText(app), /URL no válida/);
  app.close();
});

test('si se cancela la pregunta no pasa nada', async () => {
  const app = await openProfiles();
  const antes = toastText(app);
  app.click('[data-act="editprofileimg"]');
  assert.equal(savedProfile(app).image, undefined);
  assert.equal(toastText(app), antes);
  app.close();
});

// ============================================================
// DESDE LA GALERÍA
// ============================================================

test('una foto de la galería se guarda ya reducida', async () => {
  const app = await openProfiles();
  app.Telon.ui.avatarImage.resizeToAvatar = async () => 'data:image/jpeg;base64,AAAA';
  app.prompts.push('Galería');
  app.click('[data-act="editprofileimg"]');
  chooseFromGallery(app, new app.window.Blob(['x'], { type: 'image/jpeg' }));
  await app.settle();
  assert.equal(savedProfile(app).image, 'data:image/jpeg;base64,AAAA');
  assert.match(toastText(app), /Foto actualizada/);
  app.close();
});

test('si la foto no se puede procesar, avisa con un mensaje claro y el perfil queda igual', async () => {
  const app = await openProfiles();
  app.Telon.ui.avatarImage.resizeToAvatar = async () => { throw new app.Telon.infra.errors.InvalidDataError('no es una imagen'); };
  app.prompts.push('galeria');
  app.click('[data-act="editprofileimg"]');
  chooseFromGallery(app, new app.window.Blob(['x'], { type: 'text/plain' }));
  await app.settle();
  assert.equal(savedProfile(app).image, undefined);
  assert.match(toastText(app), /No se pudo usar esa foto/);
  app.close();
});

test('si se cierra la galería sin elegir, no pasa nada', async () => {
  const app = await openProfiles();
  let llamadas = 0;
  app.Telon.ui.avatarImage.resizeToAvatar = async () => { llamadas++; return 'data:,'; };
  app.prompts.push('galería');
  app.click('[data-act="editprofileimg"]');
  chooseFromGallery(app, null);
  await app.settle();
  assert.equal(llamadas, 0);
  assert.equal(savedProfile(app).image, undefined);
  app.close();
});
