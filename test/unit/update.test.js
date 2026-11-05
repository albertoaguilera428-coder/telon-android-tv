/*
Telón - Pruebas del aviso de nueva versión
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('../support/app-driver');

const VERSION_ACTUAL = (() => {
  const app = loadApp({ hasta: 'js/app/update-service.js' });
  const version = app.Telon.app.updateService.VERSION_TELON;
  app.close();
  return version;
})();

// ============================================================
// SEGURIDAD DEL BANNER
// ============================================================

test('una URL maliciosa en version.json no se ejecuta: se entrega tal cual al puente de Android', () => {
  const app = loadApp({ modo: 'android-tv', hasta: 'js/ui/update-banner.js' });
  const urlMaliciosa = "https://x/a.apk');window.hackeado=true;('";
  app.Telon.ui.updateBanner.showUpdateBanner({ version: 3, url: urlMaliciosa, notes: '<img src=x onerror="window.hackeado=true">' });
  assert.equal(app.document.querySelector('#updateBanner [onclick]'), null);
  assert.equal(app.document.querySelector('#updateBanner img'), null);
  app.document.querySelector('[data-update="install"]').click();
  assert.equal(app.window.hackeado, undefined);
  assert.ok(app.log.includes('bridge downloadAndInstall ' + JSON.stringify([urlMaliciosa])));
  app.close();
});

test('"Luego" cierra el banner', () => {
  const app = loadApp({ modo: 'android-tv', hasta: 'js/ui/update-banner.js' });
  app.Telon.ui.updateBanner.showUpdateBanner({ version: 3, url: 'https://x/a.apk' });
  app.document.querySelector('[data-update="later"]').click();
  assert.equal(app.document.querySelector('#updateBanner'), null);
  app.close();
});

// ============================================================
// CUÁNDO SE OFRECE
// ============================================================

test('solo se ofrece actualizar en Android y si la versión publicada es mayor', async () => {
  const conVersion = version => (url) => url.includes('version.json') ? { json: { version, url: 'https://x/a.apk' } } : { status: 404 };
  const actual = VERSION_ACTUAL;
  const casos = [['android-tv', actual + 1, true], ['android-tv', actual, false], ['android-tv', actual - 1, false], ['tizen', actual + 1, false]];
  for (const [modo, version, esperado] of casos) {
    const app = loadApp({ modo, hasta: 'js/ui/update-banner.js', route: conVersion(version) });
    await app.Telon.ui.updateBanner.checkForUpdate();
    assert.equal(Boolean(app.document.querySelector('#updateBanner')), esperado, `${modo} v${version}`);
    app.close();
  }
});

test('la versión de la app web coincide con versionCode del APK', () => {
  const gradle = fs.readFileSync(path.join(__dirname, '../../app/build.gradle'), 'utf8');
  assert.equal(Number(/versionCode\s+(\d+)/.exec(gradle)[1]), VERSION_ACTUAL, 'si no coinciden, el aviso de versión nueva se equivoca');
});
