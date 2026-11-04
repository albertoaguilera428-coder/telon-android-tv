/*
Telón - Pruebas del estado y los datos guardados
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

// ============================================================
// HISTORIAL
// ============================================================

test('propiedad: trimHistory nunca supera el máximo y conserva las entradas más recientes', () => {
  const app = loadApp({ hasta: 'js/app/state.js' });
  const { trimHistory } = app.Telon.domain.progress;
  const entrada = fc.record({ key: fc.uuid(), ts: fc.nat() });
  fc.assert(fc.property(fc.uniqueArray(entrada, { selector: e => e.key, maxLength: 120 }), fc.integer({ min: 1, max: 80 }), (entradas, maximo) => {
    const historial = Object.fromEntries(entradas.map(e => [e.key, e]));
    const recortado = Object.values(trimHistory(historial, maximo));
    assert.ok(recortado.length <= maximo);
    assert.equal(recortado.length, Math.min(maximo, entradas.length));
    const minimoConservado = Math.min(...recortado.map(e => e.ts));
    const descartados = entradas.filter(e => !recortado.some(r => r.key === e.key));
    assert.ok(descartados.every(e => e.ts <= minimoConservado));
  }));
  app.close();
});

// ============================================================
// ADDONS GUARDADOS
// ============================================================

test('saveAddons no guarda los addons virtuales ni sus cachés', () => {
  const app = loadApp({ hasta: 'js/app/state.js' });
  const { estado, saveAddons } = app.Telon.app.state;
  estado.addons = [
    { base: '__sololatino__', manifest: { id: 'sl' }, enabled: true, _cache: { pagina: '<html>…</html>' } },
    { base: 'https://a.x', manifest: { id: 'a' }, enabled: false, _extra: 'no se guarda' }
  ];
  saveAddons();
  assert.deepEqual(JSON.parse(app.window.localStorage.getItem('telon.addons')), [{ base: 'https://a.x', manifest: { id: 'a' }, enabled: false }]);
  app.close();
});

// ============================================================
// PERFILES
// ============================================================

test('al borrar el perfil activo, pasa a estar activo el primero que queda', () => {
  const app = loadApp({ hasta: 'js/app/state.js' });
  const { perfiles } = app.Telon.app.state;
  const ana = perfiles.add('Ana', '#000');
  const beto = perfiles.add('Beto', '#111');
  perfiles.setActive(ana.id);
  perfiles.remove(ana.id);
  assert.equal(perfiles.active().id, beto.id);
  assert.deepEqual(plain(perfiles.all().map(p => p.name)), ['Beto']);
  app.close();
});

test('la pantalla de perfiles aparece al arrancar solo si no hay perfiles guardados', () => {
  const sinPerfiles = loadApp({ hasta: 'js/app/state.js' });
  const conPerfiles = loadApp({ hasta: 'js/app/state.js', almacen: { profiles: [{ id: 'x', name: 'Ana', color: '#000' }] } });
  assert.equal(sinPerfiles.Telon.app.state.estado.pantallaPerfiles, true);
  assert.equal(conPerfiles.Telon.app.state.estado.pantallaPerfiles, false);
  sinPerfiles.close();
  conPerfiles.close();
});
