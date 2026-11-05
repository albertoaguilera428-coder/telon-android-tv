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
  const { updateState, saveAddons } = app.Telon.app.state;
  updateState({ addons: [
    { base: '__sololatino__', manifest: { id: 'sl' }, enabled: true, _cache: { pagina: '<html>…</html>' } },
    { base: 'https://a.x', manifest: { id: 'a' }, enabled: false, _extra: 'no se guarda' }
  ] });
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

// ============================================================
// LISTA E HISTORIAL POR PERFIL
// ============================================================

const DOS_PERFILES = { profiles: [{ id: 'ana', name: 'Ana', color: '#000' }, { id: 'beto', name: 'Beto', color: '#111' }], activeProfile: 'ana' };
const serie = id => ({ base: 'https://a.x', type: 'series', id, name: 'Serie ' + id });
const guardado = (app, clave) => JSON.parse(app.window.localStorage.getItem('telon.' + clave));

test('cada perfil tiene su lista y su historial: lo de uno no aparece en el otro', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: DOS_PERFILES });
  const { estado, toggleLibrary, recordProgress, perfiles } = app.Telon.app.state;
  toggleLibrary(serie('tt1'));
  recordProgress({ key: 'k1', ts: 1, t: 30 });
  perfiles.setActive('beto');
  assert.deepEqual(plain(estado.biblioteca), [], 'Beto empieza con su lista vacía');
  assert.deepEqual(plain(estado.historial), {});
  toggleLibrary(serie('tt2'));
  perfiles.setActive('ana');
  assert.deepEqual(plain(estado.biblioteca).map(x => x.id), ['tt1'], 'al volver a Ana, su lista sigue igual');
  assert.ok(estado.historial.k1, 'y su historial también');
  assert.deepEqual(guardado(app, 'lib:beto').map(x => x.id), ['tt2']);
  app.close();
});

test('la primera vez, la lista y el historial compartidos se copian a cada perfil y se borra la copia compartida', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: { ...DOS_PERFILES, lib: [serie('tt9')], hist: { k9: { key: 'k9', ts: 5, t: 60 } }, 'lib:beto': [serie('tt7')] } });
  const { estado } = app.Telon.app.state;
  assert.deepEqual(guardado(app, 'lib:ana').map(x => x.id), ['tt9'], 'Ana recibe lo compartido');
  assert.deepEqual(guardado(app, 'lib:beto').map(x => x.id), ['tt7'], 'lo que Beto ya tenía no se pisa');
  assert.ok(guardado(app, 'hist:ana').k9 && guardado(app, 'hist:beto').k9, 'el historial compartido llega a los dos');
  assert.equal(app.window.localStorage.getItem('telon.lib'), null, 'la copia compartida se borra');
  assert.equal(app.window.localStorage.getItem('telon.hist'), null);
  assert.deepEqual(plain(estado.biblioteca).map(x => x.id), ['tt9'], 'el perfil activo ya ve lo suyo');
  app.close();
});

test('sin perfiles no hay nada que copiar y lo compartido queda donde está', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: { lib: [serie('tt9')] } });
  assert.deepEqual(guardado(app, 'lib').map(x => x.id), ['tt9']);
  app.close();
});

test('al borrar un perfil se borran su lista y su historial', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: { ...DOS_PERFILES, 'lib:beto': [serie('tt7')], 'hist:beto': { k: { key: 'k', ts: 1, t: 9 } } } });
  app.Telon.app.state.perfiles.remove('beto');
  assert.equal(app.window.localStorage.getItem('telon.lib:beto'), null);
  assert.equal(app.window.localStorage.getItem('telon.hist:beto'), null);
  app.close();
});

test('al borrar el perfil activo se pasa al siguiente y se ve su lista', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: { ...DOS_PERFILES, 'lib:beto': [serie('tt7')] } });
  const { estado, perfiles } = app.Telon.app.state;
  perfiles.remove('ana');
  assert.equal(perfiles.active().id, 'beto');
  assert.deepEqual(plain(estado.biblioteca).map(x => x.id), ['tt7']);
  app.close();
});

test('al borrar el último perfil la lista en pantalla se vacía (no queda la del perfil borrado)', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: { profiles: [{ id: 'ana', name: 'Ana', color: '#000' }], activeProfile: 'ana', 'lib:ana': [serie('tt1')], 'hist:ana': { k1: { key: 'k1', ts: 1, t: 9 } } } });
  const { estado, perfiles } = app.Telon.app.state;
  perfiles.remove('ana');
  assert.deepEqual(plain(estado.biblioteca), []);
  assert.deepEqual(plain(estado.historial), {});
  app.close();
});

test('lo guardado sin perfil pasa al primer perfil que se crea', () => {
  const app = loadApp({ hasta: 'js/app/state.js', almacen: { lib: [serie('tt9')] } });
  const { estado, perfiles } = app.Telon.app.state;
  const perfil = perfiles.add('Ana', '#000');
  perfiles.setActive(perfil.id);
  assert.deepEqual(plain(estado.biblioteca).map(x => x.id), ['tt9']);
  assert.equal(app.window.localStorage.getItem('telon.lib'), null);
  app.close();
});
